// src/js/api/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client (will be null if env vars missing)
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  // Create client with proper auth configuration
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'gather-memorials-auth',
      flowType: 'pkce' // More secure auth flow
    },
    global: {
      headers: {
        'x-application-name': 'gather-memorials'
      }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 2
      }
    }
  });
  
  console.log('✅ Supabase client initialized with enhanced configuration');
  
  // Log the actual URL being used (without exposing the key)
  console.log('📍 Supabase URL:', supabaseUrl);
  
} else {
  console.error('❌ Supabase credentials missing!');
  console.error('URL:', supabaseUrl ? '✓ Found' : '✗ Missing');
  console.error('Key:', supabaseAnonKey ? '✓ Found (length: ' + supabaseAnonKey.length + ')' : '✗ Missing');
}

// Export functions
export function getClient() {
  if (!supabase) {
    console.error('⚠️ Supabase client not initialized - check environment variables');
  }
  return supabase;
}

// Helper function to check if user is authenticated
export async function getCurrentUser() {
  if (!supabase) return null;
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    return user;
  } catch (error) {
    console.error('Exception getting current user:', error);
    return null;
  }
}

// Helper function to get session
export async function getSession() {
  if (!supabase) return null;
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Exception getting session:', error);
    return null;
  }
}

// Enhanced initialization function
export async function initSupabase() {
  if (!supabase) {
    console.error('Cannot init - Supabase client is null');
    return null;
  }

  // Set up auth state listener with better error handling
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('🔐 Auth state changed:', event);
    
    // Update window.currentUser for backward compatibility
    window.currentUser = session?.user || null;
    
    // Log session details for debugging
    if (session) {
      console.log('✅ Session active:', {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: new Date(session.expires_at * 1000).toLocaleString()
      });
    } else {
      console.log('❌ No active session');
    }
    
    // Dispatch custom event for other parts of the app
    document.dispatchEvent(new CustomEvent('auth:state', { 
      detail: { event, session, user: session?.user } 
    }));
    
    // Handle specific auth events
    switch (event) {
      case 'SIGNED_IN':
        console.log('👤 User signed in');
        break;
      case 'SIGNED_OUT':
        console.log('👋 User signed out');
        // Clear any local storage related to memorials
        localStorage.removeItem('currentDraftId');
        localStorage.removeItem('memorialDraft');
        break;
      case 'TOKEN_REFRESHED':
        console.log('🔄 Token refreshed');
        break;
      case 'USER_UPDATED':
        console.log('📝 User data updated');
        break;
    }
  });

  // Get initial session with retry logic
  let retries = 3;
  let session = null;
  
  while (retries > 0 && !session) {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error(`Session fetch attempt ${4 - retries} failed:`, error);
        retries--;
        if (retries > 0) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        session = currentSession;
        break;
      }
    } catch (error) {
      console.error(`Exception during session fetch attempt ${4 - retries}:`, error);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Set initial user state
  window.currentUser = session?.user || null;
  
  if (session) {
    console.log('✅ Initial auth check: User logged in', {
      userId: session.user.id,
      email: session.user.email
    });
    
    // Verify the session is actually valid by making a test call
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('⚠️ Session appears invalid:', error);
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('❌ Failed to refresh session:', refreshError);
          // Clear invalid session
          await supabase.auth.signOut();
          window.currentUser = null;
        } else {
          console.log('✅ Session refreshed successfully');
          window.currentUser = refreshData.session?.user || null;
        }
      } else {
        console.log('✅ Session validated successfully');
      }
    } catch (validationError) {
      console.error('❌ Session validation failed:', validationError);
    }
  } else {
    console.log('ℹ️ Initial auth check: Not logged in');
  }
  
  // Return both client and cleanup function
  return {
    client: supabase,
    unsubscribe: authListener.subscription.unsubscribe
  };
}

// Debug helper - call this to check current auth status
export async function debugAuthStatus() {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return;
  }
  
  console.group('🔍 Auth Status Debug');
  
  try {
    // Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session:', session ? 'Active' : 'None', sessionError || '');
    
    if (session) {
      console.log('Session details:', {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: new Date(session.expires_at * 1000).toLocaleString(),
        provider: session.user.app_metadata.provider
      });
    }
    
    // Check user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('User:', user ? 'Found' : 'None', userError || '');
    
    if (user) {
      console.log('User details:', {
        id: user.id,
        email: user.email,
        emailConfirmed: user.email_confirmed_at ? 'Yes' : 'No',
        createdAt: new Date(user.created_at).toLocaleString()
      });
    }
    
    // Check window.currentUser
    console.log('window.currentUser:', window.currentUser ? 'Set' : 'Not set');
    
    // Try a test query to verify RLS
    console.log('\nTesting database access...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user?.id || 'no-user')
      .single();
    
    if (testError) {
      console.error('❌ Database test failed:', testError);
    } else {
      console.log('✅ Database test successful');
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
  
  console.groupEnd();
}

// Make debug function available globally for testing
if (typeof window !== 'undefined') {
  window.debugSupabaseAuth = debugAuthStatus;
}