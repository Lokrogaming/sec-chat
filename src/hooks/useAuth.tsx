import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  storePrivateKey,
  loadPrivateKey,
  clearPrivateKey,
} from '@/lib/crypto';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Ensure user has an ECDH keypair: private in localStorage, public in profiles */
async function ensureKeypair(userId: string) {
  const existing = loadPrivateKey(userId);
  if (existing) {
    // Check if public key is already in the profile
    const { data } = await supabase
      .from('profiles')
      .select('public_key')
      .eq('user_id', userId)
      .single();
    if (data?.public_key) return; // All good
  }

  // Generate fresh keypair
  const keyPair = await generateKeyPair();
  const pubBase64 = await exportPublicKey(keyPair.publicKey);
  const privJwk = await exportPrivateKey(keyPair.privateKey);

  // Store private key locally
  storePrivateKey(userId, privJwk);

  // Store public key in profile
  await supabase
    .from('profiles')
    .update({ public_key: pubBase64 })
    .eq('user_id', userId);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          // Defer keypair check to avoid blocking auth
          setTimeout(() => ensureKeypair(session.user.id), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => ensureKeypair(session.user.id), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) clearPrivateKey(user.id);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
