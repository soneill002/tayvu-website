// src/js/utils/passwordModal.js
import { showNotification } from './ui.js';

export function showPasswordPrompt(memorialName) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>Private Memorial</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove(); return false;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 1.5rem;">This memorial for <strong>${memorialName}</strong> is private. Please enter the access password to view.</p>
          <form id="passwordForm">
            <div class="form-group">
              <label class="form-label">Password</label>
              <input 
                type="password" 
                id="accessPassword" 
                class="form-input" 
                placeholder="Enter access password"
                required
                autofocus
              />
            </div>
            <div class="form-actions" style="margin-top: 1.5rem;">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove(); return false;">
                Cancel
              </button>
              <button type="submit" class="btn-primary">
                <i class="fas fa-lock-open"></i> Access Memorial
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Focus on password input
    const passwordInput = modal.querySelector('#accessPassword');
    if (passwordInput) {
      passwordInput.focus();
    }
    
    const form = modal.querySelector('#passwordForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const password = modal.querySelector('#accessPassword').value;
      modal.remove();
      document.body.style.overflow = 'auto';
      resolve(password);
    });
    
    // Handle cancel via close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.remove();
      document.body.style.overflow = 'auto';
      resolve(null);
    });
    
    // Handle cancel via secondary button
    const cancelBtn = modal.querySelector('.btn-secondary');
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.remove();
      document.body.style.overflow = 'auto';
      resolve(null);
    });
    
    // Handle cancel via backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
        resolve(null);
      }
    });
    
    // Handle Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.body.style.overflow = 'auto';
        document.removeEventListener('keydown', escapeHandler);
        resolve(null);
      }
    });
  });
}

// Alternative function to show incorrect password error
export function showPasswordError() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal modal-backdrop';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>Incorrect Password</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove(); return false;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #d2755a;"></i>
          </div>
          <p style="text-align: center; margin-bottom: 1.5rem;">The password you entered is incorrect. Please try again or contact the memorial owner for the correct password.</p>
          <div class="form-actions" style="justify-content: center;">
            <button type="button" class="btn-primary" onclick="this.closest('.modal').remove();">
              Try Again
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Auto-focus on Try Again button
    const tryAgainBtn = modal.querySelector('.btn-primary');
    if (tryAgainBtn) {
      tryAgainBtn.focus();
    }
    
    // Handle close
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.remove();
      document.body.style.overflow = 'auto';
      resolve(true); // Indicate they want to try again
    });
    
    // Handle Try Again button
    tryAgainBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.remove();
      document.body.style.overflow = 'auto';
      resolve(true); // Indicate they want to try again
    });
    
    // Handle backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
        resolve(false); // Don't try again
      }
    });
  });
}

// Function to show access granted notification
export function showAccessGranted(memorialName) {
  // Create a nice success modal
  const modal = document.createElement('div');
  modal.className = 'modal modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-body" style="text-align: center; padding: 2rem;">
        <div style="margin-bottom: 1.5rem;">
          <i class="fas fa-check-circle" style="font-size: 4rem; color: #6b9174;"></i>
        </div>
        <h2 style="margin-bottom: 1rem;">Access Granted</h2>
        <p>You now have access to view the memorial for <strong>${memorialName}</strong>.</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  // Auto close after 2 seconds
  setTimeout(() => {
    modal.remove();
    document.body.style.overflow = 'auto';
  }, 2000);
}