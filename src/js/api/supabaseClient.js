// src/js/api/supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

let supabase;

export function getClient() {
  if (supabase) return supabase;

  // 1️⃣  Primary source: Netlify env-vars
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_ANON_KEY;

  // 2️⃣  Dev fallback (window stub)
  const finalUrl = url || window.__supabase?.url;
  const finalKey = key || window.__supabase?.anonKey;

  if (!finalUrl || !finalKey) {
    console.error(
      "Supabase credentials missing — set SUPABASE_URL & SUPABASE_ANON_KEY"
    );
    return null;
  }

  supabase = createClient(finalUrl, finalKey);
  return supabase;
}
