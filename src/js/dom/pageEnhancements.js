/* -------- smooth scroll for in-page anchors -------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#') return; // ignore dummy links

    const id = href.slice(1);
    
    // List of routes that should be handled by the router
    const routerPages = ['home', 'about', 'pricing', 'faq', 'blog', 'createMemorial', 'profile'];
    
    // If this is a router page, let the router handle it
    if (routerPages.includes(id)) {
      // The router listens for hashchange events, so we don't need to prevent default
      return;
    }
    
    // For non-router pages, check if it's an in-page anchor
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* -------- fade-in on scroll -------- */
const observer = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    }),
  { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
);

document.querySelectorAll('.animate-fade-in').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
  observer.observe(el);
});