// src/js/auth/authUI.js
import { showNotification, showError, qs, setButtonLoading, showToast } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';
import { openModal, closeModal } from '@/utils/modal.js';
import { showPage } from '@/router.js';
import { handleError, withErrorHandling } from '@/utils/errorHandler.js';

/* ---------- UI toggle helper ---------- */
function updateAuthUI(isLoggedIn) {
  try {
    const signinBtn = document.querySelector('.btn-signin');
    const profileBtn = document.querySelector('.profile-btn');

    if (!signinBtn || !profileBtn) {
      console.warn('Auth UI elements not found');
      return;
    }

    if (isLoggedIn && window.currentUser) {
      signinBtn.style.display = 'none';
      profileBtn.style.display = 'flex';

      const initial = (window.currentUser.user_metadata?.name ||
        window.currentUser.email ||
        'U')[0].toUpperCase();

      const navInitial = document.getElementById('navProfileInitial');
      if (navInitial) {
        navInitial.textContent = initial;
      }

      const navPhoto = document.getElementById('navProfilePhoto');
      if (window.currentUser.user_metadata?.avatar_url && navPhoto) {
        navPhoto.src = window.currentUser.user_metadata.avatar_url;
        navPhoto.style.display = 'block';
        if (navInitial) navInitial.style.display = 'none';
      } else {
        if (navPhoto) navPhoto.style.display = 'none';
        if (navInitial) navInitial.style.display = 'block';
      }
    } else {
      signinBtn.style.display = 'inline-flex';
      profileBtn.style.display = 'none';
    }
  } catch (error) {
    handleError(error, 'Update Auth UI');
  }
}

/* ── SIGN UP HANDLER ── */
export const handleSignUp = withErrorHandling(async function(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const supabase = getClient();

  if (!supabase) {
    showToast('Application not initialized. Please refresh the page.', 'error');
    return;
  }

  // Clear errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  setButtonLoading(submitButton, true, 'Creating account...');

  try {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    // Basic validation
    if (!name || !email || !password) {
      throw new Error('Please fill in all fields');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

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

    // Check if email needs verification
    if (data.user && !data.user.email_confirmed_at) {
      form.reset();
      closeModal('signup');
      
      // Show the verification modal
      if (window.showEmailVerificationModal) {
        window.showEmailVerificationModal(email);
      } else {
        showToast('Please check your email to verify your account', 'info');
      }
      
      return;
    }

    // If somehow already verified (shouldn't happen), proceed normally
    showToast('Account created successfully!', 'success');
    form.reset();
    closeModal('signup');
    
  } catch (error) {
    console.error('Sign-up error:', error);

    // Handle specific error cases
    if (error.message?.includes('already registered')) {
      showError('signupEmailError', 'This email is already registered');
    } else if (error.message?.includes('Password')) {
      showError('signupPasswordError', error.message);
    } else if (error.message?.includes('fill in all fields')) {
      showToast(error.message, 'warning');
    } else {
      // Use error handler for unexpected errors
      handleError(error, 'Sign Up');
    }
  } finally {
    setButtonLoading(submitButton, false);
  }
}, 'Sign Up Handler');

/* ── SIGN IN HANDLER ── */
export const handleSignIn = withErrorHandling(async function(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const supabase = getClient();

  if (!supabase) {
    showToast('Application not initialized. Please refresh the page.', 'error');
    return;
  }

  // Clear errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  setButtonLoading(submitButton, true, 'Signing in...');

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (!email || !password) {
      throw new Error('Please enter your email and password');
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    // Check if email is verified
    if (data.user && !data.user.email_confirmed_at) {
      // Sign them back out
      await supabase.auth.signOut();
      
      // Close the signin modal
      closeModal('signin');
      
      // Show the verification modal
      if (window.showEmailVerificationModal) {
        window.showEmailVerificationModal(email);
      } else {
        showToast('Please verify your email before signing in', 'warning');
      }
      
      return;
    }
    
    // Success! Auth state listener will handle the rest
    showToast('Welcome back!', 'success');
    form.reset();
    closeModal('signin');
    
  } catch (error) {
    console.error('Sign-in error:', error);
    
    // Handle specific error cases
    if (error.message?.includes('Invalid') || error.message?.includes('credentials')) {
      showError('emailError', 'Invalid email or password');
    } else if (error.message?.includes('Email not confirmed')) {
      showError('emailError', 'Please verify your email before signing in');
    } else if (error.message?.includes('enter your email')) {
      showToast(error.message, 'warning');
    } else {
      // Use error handler for unexpected errors
      handleError(error, 'Sign In');
    }
  } finally {
    setButtonLoading(submitButton, false);
  }
}, 'Sign In Handler');

/* ── SIGN OUT HANDLER ── */
export const handleSignOut = withErrorHandling(async function() {
  const supabase = getClient();
  
  if (!supabase) {
    showToast('Application not initialized', 'error');
    return;
  }

  try {
    showToast('Signing out...', 'info');

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Auth state listener will handle clearing currentUser
    showToast('Signed out successfully', 'success');
    showPage('home');
    
  } catch (error) {
    console.error('Sign out error:', error);
    handleError(error, 'Sign Out');
  }
}, 'Sign Out Handler');

/* ── Initialize Auth UI ── */
export function initAuthUI() {
  try {
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

    // Show signup/signin modal handlers
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="show-signup"]')) {
        e.preventDefault();
        closeModal('signin');
        openModal('signup');
      }
      
      if (e.target.matches('[data-action="show-signin"]')) {
        e.preventDefault();
        closeModal('signup');
        openModal('signin');
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
    
  } catch (error) {
    handleError(error, 'Initialize Auth UI');
  }
}

/* ── RESEND VERIFICATION EMAIL ── */
export const resendVerificationEmail = withErrorHandling(async function(email) {
  const supabase = getClient();
  
  if (!supabase) {
    showToast('Application not initialized', 'error');
    return;
  }
  
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });
    
    if (error) throw error;
    
    showToast('Verification email sent! Please check your inbox.', 'success');
  } catch (error) {
    console.error('Resend verification error:', error);
    
    // Handle specific error cases
    if (error.message?.includes('rate limit')) {
      showToast('Please wait a few minutes before requesting another email', 'warning');
    } else {
      handleError(error, 'Resend Verification Email');
    }
  }
}, 'Resend Verification');

// Make it globally available
window.resendVerificationEmail = resendVerificationEmail;