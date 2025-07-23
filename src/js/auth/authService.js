// src/js/auth/authService.js
import { getClient } from '@/api/supabaseClient.js';

/* ── Sign-up ─────────────────────────── */
export async function signUp(email, password) {
  const { error } = await getClient().auth.signUp({ email, password });
  if (error) throw error;
}

/* ── Sign-in ─────────────────────────── */
export async function signIn(email, password) {
  const { error, data } = await getClient().auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

/* ── Sign-out ────────────────────────── */
export async function signOut() {
  await getClient().auth.signOut();
}
