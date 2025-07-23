import { showNotification, qs } from '@/utils/ui.js';
// import { openModal }            from '@/utils/modal.js';

export function initExampleMemorial() {
  /* VSCO-style gallery click-to-view */
  qs('#exampleMemorial')?.addEventListener('click', (e) => {
    const card = e.target.closest('.moment-vsco');
    if (card) viewMomentDetail(card);
  });

  /* Share button */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="share-memorial"]')) shareMemorial();
  });
}

/* ---------- helpers ---------- */
export function shareMemorial() {
  if (navigator.share) {
    navigator.share({
      title: 'Margaret Rose Thompson Memorial',
      text: 'Visit the memorial page for Margaret Rose Thompson',
      url: window.location.href
    });
  } else {
    navigator.clipboard.writeText(window.location.href);
    showNotification('Memorial link copied to clipboard!');
  }
}

function viewMomentDetail(card) {
  const img = card.querySelector('img');
  const date = card.querySelector('.moment-date-vsco')?.textContent || '';
  const caption = card.querySelector('.moment-caption-vsco')?.textContent || '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px;">
      <div class="modal-header">
        <h2>${caption}</h2>
        <button class="close-modal"
                onclick="this.closest('.modal').remove();document.body.style.overflow='auto';">
          &times;
        </button>
      </div>
      <img src="${img.src}" style="width:100%;border-radius:10px;margin-bottom:1rem;">
      <p style="text-align:center;color:var(--text-secondary);">${date}</p>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  });
}
