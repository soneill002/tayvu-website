/* -------- smooth scroll for in-page anchors -------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#') return; // ignore dummy links

    const id = href.slice(1);
    const el = document.getElementById(id);
    if (!el || ['home', 'about', 'pricing'].includes(id)) return; // let router handle those

    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth' });
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
