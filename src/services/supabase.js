import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasValidSupabaseConfig = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  if (supabaseUrl.includes('your_supabase_url_here') || supabaseAnonKey.includes('your_supabase_anon_key_here')) {
    return false;
  }

  try {
    const parsed = new URL(supabaseUrl);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const createNoopQuery = () => ({
  upsert: async () => ({ data: null, error: null }),
  delete: () => ({
    eq: () => ({
      eq: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  }),
  select: () => ({
    eq: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
});

const createFallbackClient = () => ({
  from: () => createNoopQuery(),
  auth: {
    signInWithPassword: async () => ({ data: null, error: new Error('Supabase is not configured.') }),
    signUp: async () => ({ data: null, error: new Error('Supabase is not configured.') }),
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  },
});

export const supabase =
  hasValidSupabaseConfig()
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createFallbackClient();

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUser() {
  return supabase.auth.getUser();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange?.(callback) ?? {
    data: {
      subscription: {
        unsubscribe() {},
      },
    },
  };
}
