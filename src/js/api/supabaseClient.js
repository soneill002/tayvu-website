import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase;
export function getClient() {
  if (supabase) return supabase;
  /* TODO: replace placeholders with real env vars */
  const url = window.__supabase?.url || 'https://placeholder.local';
  const key = window.__supabase?.anonKey || 'skip';
  supabase = createClient(url, key);
  return supabase;
}
