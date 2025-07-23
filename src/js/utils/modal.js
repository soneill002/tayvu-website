export function openModal(type) {
  const el = document.getElementById(`${type}Modal`);
  if (!el) return;
  el.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

export function closeModal(type) {
  const el = document.getElementById(`${type}Modal`);
  if (!el) return;
  el.style.display = 'none';
  document.body.style.overflow = 'auto';
}

/* click on the grey backdrop closes any open modal */
document.addEventListener('click', (e) => {
  const modal = e.target.closest('.modal');
  if (modal && e.target === modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
});

/* keep global shim while old inline onclicks exist */
window.openModal = openModal;
window.closeModal = closeModal;
