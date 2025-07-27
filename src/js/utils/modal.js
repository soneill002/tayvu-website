// src/js/utils/modal.js
export function openModal(type) {
  console.log('Opening modal:', type);
  const el = document.getElementById(`${type}Modal`);
  if (!el) {
    console.error(`Modal not found: ${type}Modal`);
    return;
  }
  el.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

export function closeModal(type) {
  console.log('Closing modal:', type);
  const el = document.getElementById(`${type}Modal`);
  if (!el) return;
  el.style.display = 'none';
  document.body.style.overflow = 'auto';
}

/* Click handler for elements with data-modal attribute */
document.addEventListener('click', (e) => {
  // Handle data-modal clicks (for opening modals)
  const modalTrigger = e.target.closest('[data-modal]');
  if (modalTrigger) {
    e.preventDefault();
    const modalType = modalTrigger.getAttribute('data-modal');
    console.log('Modal trigger clicked:', modalType);
    openModal(modalType);
    return;
  }
  
  // Handle data-modal-close clicks (for closing modals)
  const closeButton = e.target.closest('[data-modal-close]');
  if (closeButton) {
    e.preventDefault();
    const modalType = closeButton.getAttribute('data-modal-close');
    closeModal(modalType);
    return;
  }
  
  // Handle clicking the close button with class close-modal
  if (e.target.classList.contains('close-modal')) {
    const modal = e.target.closest('.modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
    return;
  }
  
  // Handle clicking on the modal backdrop
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
});

// Handle profile button click
document.addEventListener('click', (e) => {
  const profileBtn = e.target.closest('[data-action="profile"]');
  if (profileBtn) {
    e.preventDefault();
    // If user is logged in, go to profile. Otherwise show signin
    if (window.currentUser) {
      window.location.hash = '#profile';
    } else {
      openModal('signin');
    }
  }
});

/* Keep global shim while old inline onclicks exist */
window.openModal = openModal;
window.closeModal = closeModal;