// src/js/utils/ui.js

function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'success' ? 'var(--primary-color)' : '#E53E3E'};
        color: white;
        border-radius: 10px;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Mobile menu
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('active');
}

// Utility functions
function showError(fieldId, message) {
  const errorElement = document.getElementById(fieldId);
  if (!errorElement) {
    console.error(`Error element ${fieldId} not found`);
    showNotification(message, 'error');
    return;
  }

  errorElement.textContent = message;
  errorElement.style.display = 'block';

  // Also add error styling to the input
  const inputField = errorElement.previousElementSibling;
  if (inputField && inputField.tagName === 'INPUT') {
    inputField.style.borderColor = '#E53E3E';
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorElement.style.display = 'none';
    if (inputField && inputField.tagName === 'INPUT') {
      inputField.style.borderColor = '';
    }
  }, 5000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const qs = (sel, parent = document) => parent.querySelector(sel);

// Add loading state to button
function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;
  
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.classList.add('btn-loading');
    if (loadingText) {
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    }
  } else {
    button.disabled = false;
    button.classList.remove('btn-loading');
    button.innerHTML = button.dataset.originalText || button.textContent;
  }
}

// Toast notification system (better than showNotification for errors)
function showToast(message, type = 'success', duration = 5000) {
  // Remove any existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  
  // Icon based on type
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  // Colors based on type
  const colors = {
    success: 'var(--primary-sage)',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 24px;
    background: white;
    color: ${colors[type] || colors.info};
    border-left: 4px solid ${colors[type] || colors.info};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    z-index: 9999;
    animation: slideInRight 0.3s ease;
    max-width: 400px;
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Export all functions
export { 
  showNotification, 
  toggleMobileMenu, 
  showError, 
  formatDate, 
  qs, 
  setButtonLoading, 
  showToast 
};