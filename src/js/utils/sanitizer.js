/*  src/js/utils/sanitizer.js
    Very small wrapper around DOMPurify (or a fallback noop)
---------------------------------------------------------- */

let _purify;

// Dynamically import DOMPurify only if it’s available.
// If you already bundle DOMPurify, just `import DOMPurify from 'dompurify'` instead.
try {
  _purify = await import('dompurify');
} catch {
  console.warn(
    '[sanitizer] DOMPurify not found – falling back to a no-op sanitizer.\n' +
      'Add “dompurify” to your project for stronger protection.'
  );
}

/* Allowed tags & attributes for the obituary rich-text editor.
   Trim this down further if you need tighter security. */
const ALLOWED_TAGS = [
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'br',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'a'
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title'];

/* Single public helper – mirror what wizard.js expects */
export const MemorialSanitizer = {
  /** Sanitize an HTML string coming from the rich-text editor */
  sanitizeRichText(html = '') {
    if (!_purify) return html; // graceful fallback
    return _purify.default.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR
    });
  }
};
