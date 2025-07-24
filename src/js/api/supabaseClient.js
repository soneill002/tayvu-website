// src/js/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

let supabase;

export function getClient() {
  if (supabase) return supabase;

  // 1️⃣  Primary source: Vite env-vars (must use VITE_ prefix)
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // 2️⃣  Dev fallback (window stub)
  const finalUrl = url || window.__supabase?.url;
  const finalKey = key || window.__supabase?.anonKey;

  if (!finalUrl || !finalKey) {
    console.error('Supabase credentials missing — set VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY');
    return null;
  }

  supabase = createClient(finalUrl, finalKey);
  return supabase;
}

export async function initSupabase() {
  const client = getClient();
  if (!client) return null;

  // Set up auth state listener
  client.auth.onAuthStateChange((event, session) => {
    window.currentUser = session?.user || null;
    document.dispatchEvent(new CustomEvent('auth:state', { detail: { event, session } }));
  });

  // Check initial session
  const { data: { session } } = await client.auth.getSession();
  window.currentUser = session?.user || null;

  console.log('Supabase initialized, current user:', window.currentUser);
  return client;
}