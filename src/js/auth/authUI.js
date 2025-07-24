// src/js/auth/authUI.js
import { showNotification, showError, qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';
import { openModal, closeModal } from '@/utils/modal.js';
import { showPage } from '@/router.js';

/* ---------- UI toggle helper ---------- */
function updateAuthUI(isLoggedIn) {
  const signinBtn = document.querySelector('.btn-signin');
  const profileBtn = document.querySelector('.profile-btn');

  if (isLoggedIn && window.currentUser) {
    signinBtn.style.display = 'none';
    profileBtn.style.display = 'flex';

    const initial = (window.currentUser.user_metadata?.name ||
      window.currentUser.email ||
      'U')[0].toUpperCase();

    document.getElementById('navProfileInitial').textContent = initial;

    if (window.currentUser.user_metadata?.avatar_url) {
      document.getElementById('navProfilePhoto').src = window.currentUser.user_metadata.avatar_url;
      qs('#navProfilePhoto').style.display = 'block';
      qs('#navProfileInitial').style.display = 'none';
    } else {
      qs('#navProfilePhoto').style.display = 'none';
      qs('#navProfileInitial').style.display = 'block';
    }
  } else {
    signinBtn.style.display = 'inline-flex';
    profileBtn.style.display = 'none';
  }
}

/* ── SIGN UP HANDLER ── */
export async function handleSignUp(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const supabase = getClient();

  if (!supabase) {
    showNotification('Application not initialized. Please refresh the page.', 'error');
    return;
  }

  // Clear errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  try {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    // Create account with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: name,
          created_at: new Date().toISOString()
        }
      }
    });

    if (error) throw error;

    // Success!
    showNotification('Account created! Please check your email to verify your account.', 'success');
    form.reset();
    closeModal('signup');
    
    // Show sign in modal after delay
    setTimeout(() => openModal('signin'), 1000);
    
  } catch (error) {
    console.error('Sign-up error:', error);

    if (error.message?.includes('already registered')) {
      showError('signupEmailError', 'This email is already registered');
    } else {
      showNotification(error.message || 'Failed to create account', 'error');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

/* ── SIGN IN HANDLER ── */
export async function handleSignIn(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const supabase = getClient();

  if (!supabase) {
    showNotification('Application not initialized. Please refresh the page.', 'error');
    return;
  }

  // Clear errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    // Success! Auth state listener will handle the rest
    showNotification('Welcome back!', 'success');
    form.reset();
    closeModal('signin');
    
  } catch (error) {
    console.error('Sign-in error:', error);
    
    if (error.message?.includes('Invalid') || error.message?.includes('credentials')) {
      showError('emailError', 'Invalid email or password');
    } else {
      showError('emailError', error.message || 'Failed to sign in');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

/* ── SIGN OUT HANDLER ── */
export async function handleSignOut() {
  const supabase = getClient();
  
  if (!supabase) {
    showNotification('Application not initialized', 'error');
    return;
  }

  try {
    showNotification('Signing out...', 'info');

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Auth state listener will handle clearing currentUser
    showNotification('Signed out successfully');
    showPage('home');
    
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Error signing out. Please try again.', 'error');
  }
}

/* ── Initialize Auth UI ── */
export function initAuthUI() {
  console.log('Initializing Auth UI...');
  
  // Listen for auth state changes
  document.addEventListener('auth:state', (event) => {
    console.log('Auth state event received:', event.detail);
    const { session, user } = event.detail;
    updateAuthUI(!!session);
  });

  // Form handlers
  document.addEventListener('submit', (e) => {
    if (e.target.matches('#signupForm')) {
      e.preventDefault();
      handleSignUp(e);
    }
    if (e.target.matches('#signinForm')) {
      e.preventDefault();
      handleSignIn(e);
    }
  });

  // Sign out handler
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="signout"]')) {
      e.preventDefault();
      handleSignOut();
    }
  });

  // Modal helpers (for onclick attributes in HTML)
  window.showSignUp = () => {
    closeModal('signin');
    openModal('signup');
  };

  window.showSignIn = () => {
    closeModal('signup');
    openModal('signin');
  };

  // Initial UI state
  updateAuthUI(!!window.currentUser);
}