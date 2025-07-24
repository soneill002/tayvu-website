// src/js/features/blog/blog.js
import { showNotification } from '@/utils/ui.js';

// Contentful configuration
const SPACE_ID = 'anitqnp5kmpd'; // Your actual space ID
const ACCESS_TOKEN = 'WWotlcYyA2rF4ziPtWUUuNoqxbFIJURCAN7MbWeO_Es'; // Your actual token
const CONTENT_TYPE = 'tayvuBlog';

// State management
let allPosts = [];
let displayedPosts = 0;
const postsPerPage = 9;
let isLoading = false;


// Initialize blog
export function initBlog() {
  // Reset state when navigating to blog
  displayedPosts = 0;
  allPosts = [];
  
  // Always show blog grid and hide single post view
  const blogSection = document.getElementById('blog');
  const blogPostSection = document.getElementById('blogPost');
  
  if (blogSection) {
    blogSection.style.display = 'block';
  }
  
  if (blogPostSection) {
    blogPostSection.style.display = 'none';
  }
  
  // Add event listener for blog post clicks
  const blogGrid = document.getElementById('blogGrid');
  if (blogGrid) {
    blogGrid.addEventListener('click', handleBlogPostClick);
  }
  
  // Load posts
  loadBlogPosts();
}





// Handle blog post clicks
function handleBlogPostClick(event) {
  // Find the closest parent element with class 'blog-post-card'
  const postCard = event.target.closest('.blog-post-card');
  
  // If we found a post card, get its slug and open the post
  if (postCard) {
    const slug = postCard.dataset.slug;
    if (slug) {
      openBlogPost(slug);
    }
  }
}





// Load blog posts from Contentful
async function loadBlogPosts() {
  if (isLoading) return;
  isLoading = true;
  
  const loadingEl = document.getElementById('blogLoading');
  const gridEl = document.getElementById('blogGrid');
  const loadMoreEl = document.getElementById('blogLoadMore');
  
  // Show loading state
  loadingEl.style.display = 'block';
  gridEl.style.display = 'none';
  loadMoreEl.style.display = 'none';
  
  try {
    const response = await fetch(
      `https://cdn.contentful.com/spaces/${SPACE_ID}/environments/master/entries?access_token=${ACCESS_TOKEN}&content_type=${CONTENT_TYPE}&include=2&order=-fields.publishDate`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    
    const data = await response.json();
    allPosts = processContentfulData(data);
    
    // Display initial posts
    displayPosts();
    
  } catch (error) {
    console.error('Error loading blog posts:', error);
    showNotification('Unable to load blog posts. Please try again later.', 'error');
    
    gridEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p>Unable to load articles at this time.</p>
        <p style="margin-top: 0.5rem; font-size: 0.9rem;">Please check back later.</p>
      </div>
    `;
    gridEl.style.display = 'grid';
  } finally {
    loadingEl.style.display = 'none';
    isLoading = false;
  }
}

// Process Contentful response data
function processContentfulData(data) {
  const { items, includes } = data;
  
  // Create asset map for easy lookup
  const assetMap = {};
  if (includes?.Asset) {
    includes.Asset.forEach(asset => {
      assetMap[asset.sys.id] = asset;
    });
  }
  
  // Create author map
  const authorMap = {};
  if (includes?.Entry) {
    includes.Entry.forEach(entry => {
      if (entry.sys.contentType.sys.id === 'author') {
        authorMap[entry.sys.id] = entry;
      }
    });
  }
  
  // Process posts
  return items.map(item => {
    const fields = item.fields;
    
    // Get featured image
    let featuredImage = null;
    if (fields.featuredImage?.sys?.id) {
      const asset = assetMap[fields.featuredImage.sys.id];
      if (asset?.fields?.file?.url) {
        featuredImage = {
          url: `https:${asset.fields.file.url}`,
          title: asset.fields.title || fields.title
        };
      }
    }
    
    // Get author
    let author = null;
    if (fields.author?.sys?.id) {
      const authorEntry = authorMap[fields.author.sys.id];
      if (authorEntry?.fields) {
        author = {
          name: authorEntry.fields.name || 'Tayvu Team',
          bio: authorEntry.fields.bio
        };
      }
    }
    
   // Extract text from rich text content
    let contentText = '';
    let contentHtml = '';
    if (fields.content?.content) {
      contentText = extractTextFromRichText(fields.content);
      contentHtml = richTextToHtml(fields.content);
    }



    return {
      id: item.sys.id,
      title: fields.title || 'Untitled',
      slug: fields.slug || '',
      excerpt: fields.excerpt || '',
      category: fields.category || 'general',
      content: contentHtml, // Use HTML version for display
      contentText: contentText, // Keep plain text for reading time
      publishDate: fields.publishDate || new Date().toISOString(),
      featuredImage,
      author: author || { name: 'Tayvu Team' },
      tags: fields.tags || [],
      featured: fields.featured || false,
      readingTime: fields.readingTime || calculateReadingTime(contentText)
    };
  });
}

// Helper function to convert rich text to HTML
function richTextToHtml(richText) {
  if (!richText || !richText.content) return '';
  
  function processNode(node) {
    if (node.nodeType === 'text') {
      // Handle text formatting
      let text = node.value;
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach(mark => {
          switch (mark.type) {
            case 'bold':
              text = `<strong>${text}</strong>`;
              break;
            case 'italic':
              text = `<em>${text}</em>`;
              break;
            case 'underline':
              text = `<u>${text}</u>`;
              break;
            case 'code':
              text = `<code>${text}</code>`;
              break;
          }
        });
      }
      return text;
    }
    
    if (node.nodeType === 'paragraph') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<p>${content}</p>`;
    }
    
    if (node.nodeType === 'heading-1') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h1>${content}</h1>`;
    }
    
    if (node.nodeType === 'heading-2') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h2>${content}</h2>`;
    }
    
    if (node.nodeType === 'heading-3') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h3>${content}</h3>`;
    }
    
    if (node.nodeType === 'heading-4') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h4>${content}</h4>`;
    }
    
    if (node.nodeType === 'heading-5') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h5>${content}</h5>`;
    }
    
    if (node.nodeType === 'heading-6') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<h6>${content}</h6>`;
    }
    
    if (node.nodeType === 'blockquote') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<blockquote>${content}</blockquote>`;
    }
    
    if (node.nodeType === 'unordered-list') {
      const items = node.content ? node.content.map(processNode).join('') : '';
      return `<ul>${items}</ul>`;
    }
    
    if (node.nodeType === 'ordered-list') {
      const items = node.content ? node.content.map(processNode).join('') : '';
      return `<ol>${items}</ol>`;
    }
    
    if (node.nodeType === 'list-item') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      return `<li>${content}</li>`;
    }
    
    if (node.nodeType === 'hr') {
      return '<hr>';
    }
    
    if (node.nodeType === 'hyperlink') {
      const content = node.content ? node.content.map(processNode).join('') : '';
      const url = node.data?.uri || '#';
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${content}</a>`;
    }
    
    // Handle embedded entries (like images)
    if (node.nodeType === 'embedded-asset-block') {
      // This would need access to the asset data
      return ''; // For now, skip embedded assets
    }
    
    // If we don't recognize the node type, process its content if it has any
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(processNode).join('');
    }
    
    return '';
  }
  
  return richText.content.map(processNode).join('');
}



// Helper function to extract text from rich text
function extractTextFromRichText(richText) {
  let text = '';
  
  function processNode(node) {
    if (node.nodeType === 'text') {
      text += node.value + ' ';
    } else if (node.content) {
      node.content.forEach(processNode);
    }
  }
  
  if (richText.content) {
    richText.content.forEach(processNode);
  }
  
  return text.trim();
}

// Calculate reading time
function calculateReadingTime(content) {
  if (!content) return 5;
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// Display posts
function displayPosts() {
  const gridEl = document.getElementById('blogGrid');
  const loadMoreEl = document.getElementById('blogLoadMore');
  
  // Calculate which posts to show
  const startIndex = displayedPosts;
  const endIndex = Math.min(displayedPosts + postsPerPage, allPosts.length);
  const postsToShow = allPosts.slice(startIndex, endIndex);
  
  // Create HTML for new posts
  const postsHTML = postsToShow.map((post, index) => {
    const isFirstPost = startIndex === 0 && index === 0;
    return createPostCard(post, isFirstPost);
  }).join('');
  
  // Add to grid
  if (displayedPosts === 0) {
    gridEl.innerHTML = postsHTML;
  } else {
    gridEl.insertAdjacentHTML('beforeend', postsHTML);
  }
  
  // Update displayed count
  displayedPosts = endIndex;
  
  // Show/hide load more button
  if (displayedPosts < allPosts.length) {
    loadMoreEl.style.display = 'block';
  } else {
    loadMoreEl.style.display = 'none';
  }
  
  // Show grid
  gridEl.style.display = 'grid';
  
  // Show empty state if no posts
  if (allPosts.length === 0) {
    gridEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-seedling" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p>No articles published yet.</p>
        <p style="margin-top: 0.5rem; font-size: 0.9rem;">Check back soon for helpful resources.</p>
      </div>
    `;
  }
}

// Create post card HTML
function createPostCard(post, isFeatured = false) {
  const formattedDate = new Date(post.publishDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const featuredClass = isFeatured && post.featured ? 'featured' : '';
  
  // Default image if none provided
  const imageUrl = post.featuredImage?.url || 
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI0U4RDVCNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM2QjkxNzQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5UYXl2dSBCbG9nPC90ZXh0Pjwvc3ZnPg==';
  
  return `
    <article class="blog-post-card ${featuredClass}" data-slug="${post.slug}">
      <img 
        src="${imageUrl}${post.featuredImage ? '?w=800&h=400&fit=fill' : ''}" 
        alt="${post.featuredImage?.title || post.title}" 
        class="blog-post-image"
        loading="lazy"
      />
      <div class="blog-post-content">
        <span class="blog-post-category">${formatCategory(post.category)}</span>
        <h2 class="blog-post-title">${escapeHtml(post.title)}</h2>
        <p class="blog-post-excerpt">${escapeHtml(post.excerpt)}</p>
        <div class="blog-post-meta">
          <span class="blog-post-author">
            <i class="fas fa-user-circle"></i>
            ${escapeHtml(post.author.name)}
          </span>
          </div>
      </div>
    </article>
  `;
}

// Format category for display
function formatCategory(category) {
  const categoryMap = {
    'memorial-guides': 'Memorial Guides',
    'grief-support': 'Grief Support',
    'celebration-ideas': 'Celebration Ideas',
    'digital-legacy': 'Digital Legacy',
    'memorial-stories': 'Memorial Stories',
    'announcements': 'Announcements'
  };
  return categoryMap[category] || category;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Load more posts function (called from HTML)
window.loadMorePosts = function() {
  displayPosts();
};


// Cleanup function to remove event listeners
export function cleanupBlog() {
  const blogGrid = document.getElementById('blogGrid');
  if (blogGrid) {
    blogGrid.removeEventListener('click', handleBlogPostClick);
  }
  
  // Reset blog view to grid when leaving
  const blogSection = document.getElementById('blog');
  const blogPostSection = document.getElementById('blogPost');
  
  if (blogSection) {
    blogSection.style.display = 'block';
  }
  
  if (blogPostSection) {
    blogPostSection.style.display = 'none';
  }
}




// Open individual blog post
function openBlogPost(slug) {
  const post = allPosts.find(p => p.slug === slug);
  if (!post) return;
  
  // Hide blog grid, show single post
  document.getElementById('blog').style.display = 'none';
  document.getElementById('blogPost').style.display = 'block';
  
  // Create post HTML
  const postHTML = `
    <div class="single-post">
      ${post.featuredImage ? `
        <img src="${post.featuredImage.url}?w=1200&h=600&fit=fill" 
             alt="${post.title}" 
             class="single-post-image" />
      ` : ''}
      
      <div class="single-post-meta">
        <span class="blog-post-category">${formatCategory(post.category)}</span>
      </div>
      
      <h1 class="single-post-title">${post.title}</h1>
      
      <div class="single-post-author-line">
        <span class="blog-post-author">
          <i class="fas fa-user-circle"></i>
          ${post.author.name}
        </span>
        <span class="reading-time">
          <i class="fas fa-clock"></i>
          ${post.readingTime} min read
        </span>
      </div>
      
       <div class="single-post-excerpt">${post.excerpt}</div>
      
      <div class="single-post-content">
        ${post.content}
      </div>
    </div>
  `;
  
  document.getElementById('singlePostContent').innerHTML = postHTML;
  window.scrollTo(0, 0);
};