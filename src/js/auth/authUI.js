/// src/js/auth/authUI.js
import { showNotification, showError, qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';
import { openModal, closeModal } from '@/utils/modal.js';
import { showPage } from '@/router.js';

/* ---------- UI toggle helper (was window.updateAuthUI) ---------- */
function updateAuthUI(isLoggedIn) {
  const signinBtn = document.querySelector('.btn-signin');
  const profileBtn = document.querySelector('.profile-btn');

  if (isLoggedIn) {
    signinBtn.style.display = 'none';
    profileBtn.style.display = 'flex';

    if (window.currentUser) {
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
    showNotification('Application not initialized', 'error');
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

    // Use Supabase auth directly
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        }
      }
    });

    if (error) throw error;

    // Success!
    showNotification('Account created! Please check your email to verify.', 'success');
    form.reset();
    closeModal('signup');
    setTimeout(() => openModal('signin'), 500);
  } catch (error) {
    console.error('Sign-up error:', error);

    if (error.message?.includes('already registered')) {
      const errorEl = document.getElementById('signupEmailError');
      if (!errorEl) {
        // Create error element if it doesn't exist
        const emailInput = document.getElementById('signupEmail');
        const errorSpan = document.createElement('span');
        errorSpan.className = 'form-error';
        errorSpan.id = 'signupEmailError';
        errorSpan.style.color = '#E53E3E';
        errorSpan.style.fontSize = '0.875rem';
        errorSpan.style.marginTop = '0.25rem';
        errorSpan.style.display = 'block';
        errorSpan.textContent = 'This email is already registered';
        emailInput.parentNode.appendChild(errorSpan);
      } else {
        errorEl.textContent = 'This email is already registered';
        errorEl.style.display = 'block';
      }
    } else {
      showNotification(error.message || 'Sign up failed', 'error');
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
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const supabase = getClient();

  if (!supabase) {
    showNotification('Application not initialized', 'error');
    return;
  }

  // Clear previous errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Use Supabase auth directly
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Success! The auth state listener will handle updating currentUser
    closeModal('signin');
    showNotification('Successfully signed in!');
    form.reset();
    
    // Update UI immediately
    updateAuthUI(true);
    
  } catch (error) {
    console.error('Sign-in error:', error);

    if (error.status === 400 || error.message?.includes('Invalid')) {
      showError('emailError', 'Invalid email or password');
    } else {
      showError('emailError', error.message || 'Sign in failed');
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
    // Show loading state
    showNotification('Signing out...', 'info');

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear any cached data
    sessionStorage.removeItem('supabase_config');
    localStorage.removeItem('tayvu-auth-token');

    // The onAuthStateChange listener will handle updating currentUser
    window.currentUser = null;
    updateAuthUI(false);

    // Redirect to home page
    showPage('home');

    showNotification('Successfully signed out');
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Error signing out. Please try again.', 'error');
  }
}

/* ── Initialize Auth UI ── */
export function initAuthUI() {
  // Listen for auth state changes
  document.addEventListener('auth:state', (event) => {
    const { session } = event.detail;
    updateAuthUI(!!session);
  });

  // Form handlers
  document.addEventListener('submit', (e) => {
    if (e.target.matches('#signupForm')) return handleSignUp(e);
    if (e.target.matches('#signinForm')) return handleSignIn(e);
  });

  // Sign out handler
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="signout"]')) {
      e.preventDefault();
      handleSignOut();
    }
  });

  // Modal helpers
  window.showSignUp = () => {
    closeModal('signin');
    openModal('signup');
  };

  window.showSignIn = () => {
    closeModal('signup');
    openModal('signin');
  };

  // Initial UI update based on current auth state
  updateAuthUI(!!window.currentUser);
}
