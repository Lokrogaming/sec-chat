// Per-conversation encryption mechanisms.
// Every cipher resolves to a symmetric key + AEAD/CBC parameters used by ChatView.

import { supabase } from '@/integrations/supabase/client';

export type CipherId = 'aes-gcm' | 'aes-cbc' | 'x25519' | 'ecdh-p256';

export interface CipherMeta {
  id: CipherId;
  label: string;
  short: string;
  description: string;
  keyExchange: boolean;
}

export const CIPHERS: CipherMeta[] = [
  {
    id: 'aes-gcm',
    label: 'AES-256-GCM',
    short: 'AES-256-GCM',
    description: 'Default. Authenticated encryption with a key derived from the conversation secret.',
    keyExchange: false,
  },
  {
    id: 'aes-cbc',
    label: 'AES-256-CBC',
    short: 'AES-256-CBC',
    description: 'Classic block cipher mode. Widely audited, no built-in authentication tag.',
    keyExchange: false,
  },
  {
    id: 'x25519',
    label: 'Curve25519 (X25519) + AES-GCM',
    short: 'X25519 E2EE',
    description: 'True end-to-end: each device holds a private key, shared secret via X25519 ECDH.',
    keyExchange: true,
  },
  {
    id: 'ecdh-p256',
    label: 'ECDH P-256 + AES-GCM',
    short: 'P-256 E2EE',
    description: 'End-to-end key agreement over NIST P-256. Broad browser support.',
    keyExchange: true,
  },
];

export const DEFAULT_CIPHER: CipherId = 'aes-gcm';

export function getCipherMeta(id: string | null | undefined): CipherMeta {
  return CIPHERS.find((c) => c.id === id) || CIPHERS[0];
}

export interface ResolvedCipher {
  id: CipherId;
  key: CryptoKey;
  algorithm: 'AES-GCM' | 'AES-CBC';
  ivLength: number;
}

/* ---------- helpers ---------- */

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function derivePassphraseKey(
  conversationId: string,
  salt: string,
  algorithm: 'AES-GCM' | 'AES-CBC'
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(conversationId.replace(/-/g, '')),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    material,
    { name: algorithm, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/* ---------- key exchange (X25519 / P-256) ---------- */

const KX_ALGO: Record<'x25519' | 'ecdh-p256', any> = {
  'x25519': { name: 'X25519' },
  'ecdh-p256': { name: 'ECDH', namedCurve: 'P-256' },
};

export async function isCipherSupported(id: CipherId): Promise<boolean> {
  if (id !== 'x25519') return true;
  try {
    await crypto.subtle.generateKey(KX_ALGO['x25519'], true, ['deriveBits']);
    return true;
  } catch {
    return false;
  }
}

function storageKey(alg: string, userId: string) {
  return `secchat-kx-${alg}-${userId}`;
}

async function loadOrCreateKeyPair(alg: 'x25519' | 'ecdh-p256', userId: string) {
  const stored = localStorage.getItem(storageKey(alg, userId));
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        parsed.privateJwk,
        KX_ALGO[alg],
        true,
        ['deriveBits']
      );
      return { privateKey, publicB64: parsed.publicB64 as string };
    } catch {
      localStorage.removeItem(storageKey(alg, userId));
    }
  }

  const pair = (await crypto.subtle.generateKey(KX_ALGO[alg], true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
  const publicB64 = toBase64(publicRaw);
  localStorage.setItem(storageKey(alg, userId), JSON.stringify({ privateJwk, publicB64 }));
  return { privateKey: pair.privateKey, publicB64 };
}

/** Generates (if needed) and publishes the current user's public key for a key-exchange cipher. */
export async function publishPublicKey(alg: 'x25519' | 'ecdh-p256', userId: string) {
  const { publicB64 } = await loadOrCreateKeyPair(alg, userId);
  await supabase
    .from('profiles')
    .update({ public_key: publicB64, public_key_alg: alg })
    .eq('user_id', userId);
  return publicB64;
}

async function deriveSharedKey(
  alg: 'x25519' | 'ecdh-p256',
  userId: string,
  otherUserId: string,
  conversationId: string
): Promise<CryptoKey> {
  const { privateKey } = await loadOrCreateKeyPair(alg, userId);
  await publishPublicKey(alg, userId);

  const { data } = await supabase
    .from('profiles')
    .select('public_key, public_key_alg')
    .eq('user_id', otherUserId)
    .maybeSingle();

  if (!data?.public_key || data.public_key_alg !== alg) {
    throw new Error('PEER_KEY_MISSING');
  }

  const peerKey = await crypto.subtle.importKey(
    'raw',
    fromBase64(data.public_key),
    KX_ALGO[alg],
    false,
    []
  );

  const bits = await crypto.subtle.deriveBits(
    alg === 'x25519' ? { name: 'X25519', public: peerKey } : { name: 'ECDH', public: peerKey },
    privateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const encoder = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(conversationId),
      info: encoder.encode(`secchat-${alg}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/* ---------- public API ---------- */

export async function resolveCipher(
  id: CipherId,
  conversationId: string,
  ctx: { userId: string; otherUserId?: string }
): Promise<ResolvedCipher> {
  switch (id) {
    case 'aes-cbc':
      return {
        id,
        key: await derivePassphraseKey(conversationId, 'cipherchat-cbc-v1', 'AES-CBC'),
        algorithm: 'AES-CBC',
        ivLength: 16,
      };
    case 'x25519':
    case 'ecdh-p256': {
      if (!ctx.otherUserId) throw new Error('PEER_KEY_MISSING');
      return {
        id,
        key: await deriveSharedKey(id, ctx.userId, ctx.otherUserId, conversationId),
        algorithm: 'AES-GCM',
        ivLength: 12,
      };
    }
    case 'aes-gcm':
    default:
      return {
        id: 'aes-gcm',
        key: await derivePassphraseKey(conversationId, 'cipherchat-v1', 'AES-GCM'),
        algorithm: 'AES-GCM',
        ivLength: 12,
      };
  }
}

export async function encryptWith(
  plaintext: string,
  cipher: ResolvedCipher
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(cipher.ivLength));
  const ciphertext = await crypto.subtle.encrypt(
    { name: cipher.algorithm, iv },
    cipher.key,
    new TextEncoder().encode(plaintext)
  );
  return { encrypted: toBase64(ciphertext), iv: toBase64(iv.buffer) };
}

export async function decryptWith(
  encryptedBase64: string,
  ivBase64: string,
  cipher: ResolvedCipher
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: cipher.algorithm, iv: new Uint8Array(fromBase64(ivBase64)) },
    cipher.key,
    fromBase64(encryptedBase64)
  );
  return new TextDecoder().decode(decrypted);
}
