/* declare the legacy global early so old code can reference it safely */
if (!('currentUser' in window)) {
  window.currentUser = null; // eslint-disable-line no-undef
}
