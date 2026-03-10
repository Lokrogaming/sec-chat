// ECDH + AES-GCM encryption utilities for end-to-end encrypted messaging
// Private keys are stored in localStorage, public keys in the database.
// Shared AES keys are derived per-conversation via ECDH key agreement.

const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const ECDH_CURVE = 'P-256';
const STORAGE_KEY_PREFIX = 'secchat_privkey_';

// ─── ECDH Keypair Management ───

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: ECDH_CURVE },
    true,
    ['deriveKey']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: ECDH_CURVE },
    true,
    []
  );
}

export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: ECDH_CURVE },
    true,
    ['deriveKey']
  );
}

// ─── localStorage Private Key Storage ───

export function storePrivateKey(userId: string, jwkString: string): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + userId, jwkString);
}

export function loadPrivateKey(userId: string): string | null {
  return localStorage.getItem(STORAGE_KEY_PREFIX + userId);
}

export function clearPrivateKey(userId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + userId);
}

// ─── ECDH Shared Secret Derivation ───

export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── AES-GCM Encrypt / Decrypt ───

export async function encryptMessage(
  plaintext: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    key,
    data
  );

  return {
    encrypted: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

export async function decryptMessage(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Helpers ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
