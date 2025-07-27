/* src/js/features/faq/faq.js */

/* ──────────────────────────────────────────
   FAQ PAGE FUNCTIONALITY
   ────────────────────────────────────────── */

export function initFAQ() {
  // FAQ functionality is handled by inline onclick for now
  console.log('FAQ page initialized');
}

// Toggle FAQ answer visibility
window.toggleFAQ = function(button) {
  const faqItem = button.closest('.faq-item');
  const answer = faqItem.querySelector('.faq-answer');
  const icon = button.querySelector('i');
  
  // Toggle active state
  faqItem.classList.toggle('active');
  
  // Toggle answer visibility
  if (faqItem.classList.contains('active')) {
    answer.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    answer.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
  
  // Close other FAQ items
  document.querySelectorAll('.faq-item').forEach(item => {
    if (item !== faqItem && item.classList.contains('active')) {
      item.classList.remove('active');
      item.querySelector('.faq-answer').style.display = 'none';
      const itemIcon = item.querySelector('i');
      itemIcon.classList.remove('fa-chevron-up');
      itemIcon.classList.add('fa-chevron-down');
    }
  });
};