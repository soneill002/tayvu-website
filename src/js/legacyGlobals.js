// ── Temporary adapter for legacy global variables ──
// As we migrate functions out of the monolith we can
// gradually delete these exports and their window.* counterparts.

export const apiClient = window.apiClient;
export const updateAuthUI = window.updateAuthUI;
export const closeModal = window.closeModal;
