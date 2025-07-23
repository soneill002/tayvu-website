/* global openModal, supabase, showPage, currentUser:writable */

// src/js/auth/authUI.js
import { showNotification, showError } from '@/utils/ui.js';
import { apiClient, updateAuthUI, closeModal } from '@/legacyGlobals.js';

// Touch currentUser so ESLint counts it as used
void currentUser;

/* ── ORIGINAL FUNCTIONS (UNTOUCHED) ── */
export async function handleSignUp(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');

  // Clear errors
  document.querySelectorAll('.form-error').forEach((err) => {
    err.style.display = 'none';
  });

  // Disable form
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

  try {
    const formData = {
      name: document.getElementById('signupName').value.trim(),
      email: document.getElementById('signupEmail').value.trim(),
      password: document.getElementById('signupPassword').value,
      acceptTerms: true
    };

    // Send to server
    const response = await apiClient.request('auth-signup', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    // Success!
    showNotification(response.message || 'Account created! Please check your email.', 'success');
    form.reset();
    closeModal('signup');
    setTimeout(() => openModal('signin'), 500);
  } catch (error) {
    console.error('Sign-up error:', error);

    if (error.field === 'email') {
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
        errorSpan.textContent = error.message;
        emailInput.parentNode.appendChild(errorSpan);
      } else {
        errorEl.textContent = error.message;
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

export async function handleSignIn(event) {
  event.preventDefault();

  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

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

    // Send to server
    const response = await apiClient.request('auth-signin', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    // Success!
    apiClient.setToken(response.session.access_token);
    currentUser = response.user;
    updateAuthUI(true);
    closeModal('signin');
    showNotification('Successfully signed in!');

    // Reset form
    form.reset();
  } catch (error) {
    console.error('Sign-in error:', error);

    if (error.status === 401) {
      showError('emailError', 'Invalid email or password');
    } else if (error.field) {
      showError(`${error.field}Error`, error.message);
    } else {
      showError('emailError', error.message || 'Sign in failed');
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
}

export async function handleSignOut() {
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

    // The onAuthStateChange listener will handle updating the UI
    currentUser = null;
    updateAuthUI(false);

    // Redirect to home page
    showPage('home');

    showNotification('Successfully signed out');
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Error signing out. Please try again.', 'error');
  }
}

/* ── Binder that attaches them to the DOM ── */
export function initAuthUI() {
  document.addEventListener('submit', (e) => {
    if (e.target.matches('#signupForm')) return handleSignUp(e);
    if (e.target.matches('#signinForm')) return handleSignIn(e);
  });

  // NEW: delegated click for any element that carries data-action="signout"
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="signout"]')) {
      e.preventDefault();
      handleSignOut();
    }
  });
}
