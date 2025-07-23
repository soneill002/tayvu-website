/*  src/js/features/guestbook.js  */
import { showNotification, qs } from '@/utils/ui.js';

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initGuestbook() {
  /* delegated opener */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-guestbook"]')) {
      openGuestbookModal();
    }
  });
}

/* ──────────────────────────────────────────
   MODAL OPEN / CLOSE
   ────────────────────────────────────────── */
function openGuestbookModal() {
  if (!window.currentUser) {
    showNotification('Please sign in to leave a message');
    window.openModal?.('signin');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Leave a Message</h2>
        <button class="close-modal"
                aria-label="Close guestbook modal"
                onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">
          &times;
        </button>
      </div>
      <form id="guestbookForm">
        <div class="form-group">
          <label for="guestbookMessage">Your Message</label>
          <textarea id="guestbookMessage"
                    name="message"
                    rows="6"
                    required
                    placeholder="Share your memories and condolences..."></textarea>
        </div>
        <div class="form-actions">
          <button type="button"
                  class="btn-secondary"
                  onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">
            Cancel
          </button>
          <button type="submit" class="btn-primary">Post Message</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  /* attach submit */
  qs('#guestbookForm')?.addEventListener('submit', submitGuestbookEntry);
}

/* ──────────────────────────────────────────
   FORM HANDLER
   ────────────────────────────────────────── */
function submitGuestbookEntry(e) {
  e.preventDefault();

  const messageInput = qs('#guestbookMessage');
  const rawMessage = messageInput.value;

  /* — sanitize — */
  const sanitized = window.MemorialSanitizer?.sanitizeMessage
    ? window.MemorialSanitizer.sanitizeMessage(rawMessage)
    : window.DOMPurify.sanitize(rawMessage, { ALLOWED_TAGS: ['b', 'i', 'br'] });

  if (!sanitized.trim()) {
    showNotification('Please enter a valid message', 'error');
    return;
  }

  /* build entry */
  const entry = document.createElement('div');
  entry.className = 'guestbook-entry';

  /* header */
  entry.innerHTML = `
    <div class="entry-header">
      <img src="${window.currentUser?.photoURL || 'assets/default-avatar.jpg'}"
           alt="Profile"
           width="50" height="50"
           onerror="this.src='assets/default-avatar.jpg';">
      <div class="entry-info">
        <h4>${safeText(window.currentUser?.displayName || 'Anonymous')}</h4>
        <p class="entry-date">Just now</p>
      </div>
    </div>
    <p class="entry-message">${sanitized}</p>
    <div class="entry-actions">
      <button class="action-btn" onclick="incrementLikes(this)">
        <i class="fas fa-heart"></i> 0
      </button>
    </div>`;

  /* prepend */
  qs('.guestbook-entries')?.prepend(entry);

  /* close & notify */
  messageInput.value = '';
  e.target.closest('.modal').remove();
  document.body.style.overflow = 'auto';
  showNotification('Your message has been posted');

  /* TODO: persist to DB */
  window.saveGuestbookEntry?.({
    message: sanitized,
    userId: window.currentUser?.uid,
    userName: safeText(window.currentUser?.displayName),
    timestamp: new Date().toISOString()
  });
}

/* ──────────────────────────────────────────
   LIKE BUTTON
   ────────────────────────────────────────── */
function incrementLikes(btn) {
  const count = parseInt(btn.textContent.trim().split(' ').pop(), 10) || 0;
  btn.innerHTML = `<i class="fas fa-heart"></i> ${count + 1}`;
}

/* ──────────────────────────────────────────
   HELPERS
   ────────────────────────────────────────── */
function safeText(text) {
  return window.DOMPurify ? window.DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }) : text;
}

/* ──────────────────────────────────────────
   TEMP GLOBAL SHIM
   Remove after inline handlers are gone.
   ────────────────────────────────────────── */
Object.assign(window, {
  openGuestbookModal,
  submitGuestbookEntry,
  incrementLikes
});
