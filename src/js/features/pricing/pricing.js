import { showNotification } from '@/utils/ui.js';
import { openModal } from '@/utils/modal.js';

export function initPricing() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plan]');
    if (!btn) return;

    const plan = btn.dataset.plan;
    if (!window.currentUser) {
      showNotification('Please sign in to create a memorial');
      return openModal('signin');
    }

    showNotification(`Selected ${plan} plan — payment integration coming soon!`);
  });
}
