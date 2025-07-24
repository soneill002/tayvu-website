// src/js/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client (will be null if env vars missing)
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase client initialized');
} else {
  console.error('❌ Supabase credentials missing!');
  console.error('URL:', supabaseUrl ? '✓ Found' : '✗ Missing');
  console.error('Key:', supabaseAnonKey ? '✓ Found' : '✗ Missing');
}

// Export functions
export function getClient() {
  return supabase;
}

export async function initSupabase() {
  if (!supabase) {
    console.error('Cannot init - Supabase client is null');
    return null;
  }

  // Set up auth state listener
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event);
    window.currentUser = session?.user || null;
    
    // Dispatch custom event for other parts of the app
    document.dispatchEvent(new CustomEvent('auth:state', { 
      detail: { event, session, user: session?.user } 
    }));
  });

  // Get initial session
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    window.currentUser = session?.user || null;
    console.log('Initial auth check:', window.currentUser ? 'Logged in' : 'Not logged in');
    
    return supabase;
  } catch (error) {
    console.error('Error getting session:', error);
    return supabase;
  }
}