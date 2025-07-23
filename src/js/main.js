// src/js/main.js
import '../styles/base.css';
import { initRouter } from '@/router.js'; // alias in action
import { initAuthUI } from '@/auth/authUI.js';
import { showNotification, toggleMobileMenu, showError, formatDate, qs } from '@/utils/ui.js';

initRouter();
initAuthUI();

/* ── keep global links temporarily so legacy code still works ── */
window.showNotification = showNotification;
window.toggleMobileMenu = toggleMobileMenu;
window.showError = showError;
window.formatDate = formatDate;
window.qs = qs;
