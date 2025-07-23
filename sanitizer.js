// sanitizer.js - Comprehensive HTML sanitization utility

// Initialize DOMPurify configuration
const createSanitizer = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  // Configure DOMPurify with strict settings for memorial content
  const config = {
    // Allowed HTML tags
    ALLOWED_TAGS: [
      'p',
      'br',
      'span',
      'div',
      'strong',
      'em',
      'i',
      'b',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
      'video',
      'source',
      'time',
      'small',
      'sub',
      'sup',
      'hr',
      'pre',
      'code'
    ],

    // Allowed attributes
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'target',
      'rel',
      'width',
      'height',
      'style',
      'datetime',
      'data-*',
      'aria-*',
      'role',
      'srcset',
      'sizes',
      'loading',
      'decoding',
      'controls',
      'autoplay',
      'muted',
      'loop',
      'poster',
      'type',
      'preload'
    ],

    // Allowed CSS properties (for style attribute)
    ALLOWED_STYLE_PROPS: [
      'color',
      'background-color',
      'font-size',
      'font-weight',
      'text-align',
      'margin',
      'padding',
      'border',
      'border-radius',
      'width',
      'height',
      'max-width',
      'max-height',
      'display',
      'float',
      'clear',
      'position',
      'top',
      'left',
      'right',
      'bottom',
      'text-decoration',
      'font-style',
      'line-height',
      'letter-spacing'
    ],

    // Allowed URI schemes
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

    // Additional security settings
    FORCE_BODY: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  };

  return {
    config,
    purify: window.DOMPurify
  };
};

// Main sanitization functions
const MemorialSanitizer = {
  // Initialize sanitizer
  init() {
    const { purify, config } = createSanitizer();
    if (!purify) {
      console.error('DOMPurify not loaded');
      return false;
    }

    // Set default configuration
    purify.setConfig(config);

    // Add custom hooks for additional security
    purify.addHook('afterSanitizeAttributes', (node) => {
      // Ensure external links open in new tab with security attributes
      if (node.tagName === 'A' && node.hasAttribute('href')) {
        const href = node.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }

      // Validate image sources
      if (node.tagName === 'IMG' && node.hasAttribute('src')) {
        const src = node.getAttribute('src');
        if (!this.isValidImageSource(src)) {
          node.removeAttribute('src');
          node.setAttribute('alt', 'Invalid image source');
        }
      }
    });

    return true;
  },

  // Sanitize general HTML content
  sanitizeHTML(dirty, options = {}) {
    if (!window.DOMPurify) {
      console.error('DOMPurify not available');
      return '';
    }

    const customConfig = { ...createSanitizer().config, ...options };
    return window.DOMPurify.sanitize(dirty, customConfig);
  },

  // Sanitize user-generated text (names, captions, etc.)
  sanitizeText(text) {
    if (!text) return '';

    // Remove all HTML tags and trim whitespace
    const cleaned = this.sanitizeHTML(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });

    // Additional text-specific sanitization
    return cleaned
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 1000); // Limit length
  },

  // Sanitize rich text content (obituaries, stories)
  sanitizeRichText(content) {
    if (!content) return '';

    // Allow basic formatting tags for rich text
    return this.sanitizeHTML(content, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'i',
        'b',
        'u',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'a',
        'span',
        'div'
      ],
      ALLOWED_ATTR: ['href', 'class', 'style'],
      ALLOWED_STYLE_PROPS: [
        'text-align',
        'color',
        'font-weight',
        'font-style',
        'text-decoration',
        'margin',
        'padding'
      ]
    });
  },

  // Sanitize user messages (guestbook entries, comments)
  sanitizeMessage(message) {
    if (!message) return '';

    // Allow very limited formatting for messages
    return this.sanitizeHTML(message, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
      ALLOWED_ATTR: ['href'],
      ALLOWED_URI_REGEXP: /^https?:\/\//i
    });
  },

  // Sanitize URLs
  sanitizeURL(url) {
    if (!url) return '';

    try {
      const parsed = new URL(url);
      // Only allow http(s) protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch (e) {
      return '';
    }
  },

  // Validate image sources
  isValidImageSource(src) {
    if (!src) return false;

    // Allow data URLs for small images
    if (src.startsWith('data:image/')) {
      // Limit data URL size (100KB)
      return src.length < 100000;
    }

    // Allow specific image hosting services
    const allowedDomains = [
      'images.unsplash.com',
      'i.imgur.com',
      'res.cloudinary.com',
      'tayvu.com',
      'localhost'
    ];

    try {
      const url = new URL(src);
      return allowedDomains.some((domain) => url.hostname.includes(domain));
    } catch (e) {
      return false;
    }
  },

  // Escape HTML for display (when you want to show HTML code)
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemorialSanitizer;
}
