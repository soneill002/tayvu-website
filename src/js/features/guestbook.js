/*  src/js/features/guestbook.js  */
import { showNotification, qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initGuestbook() {
  /* delegated opener */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-guestbook"]')) {
      openGuestbookModal();
    }
  });
}

/* ──────────────────────────────────────────
   MODAL OPEN / CLOSE
   ────────────────────────────────────────── */
function openGuestbookModal() {
  if (!window.currentUser) {
    showNotification('Please sign in to leave a message');
    window.openModal?.('signin');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Leave a Message</h2>
        <button class="close-modal"
                aria-label="Close guestbook modal"
                onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">
          &times;
        </button>
      </div>
      <form id="guestbookForm">
        <div class="form-group">
          <label for="guestbookMessage">Your Message</label>
          <textarea id="guestbookMessage"
                    name="message"
                    rows="6"
                    required
                    placeholder="Share your memories and condolences..."></textarea>
        </div>
        <div class="form-actions">
          <button type="button"
                  class="btn-secondary"
                  onclick="this.closest('.modal').remove(); document.body.style.overflow='auto';">
            Cancel
          </button>
          <button type="submit" class="btn-primary">Post Message</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  /* attach submit */
  qs('#guestbookForm')?.addEventListener('submit', submitGuestbookEntry);
}

/* ──────────────────────────────────────────
   FORM HANDLER
   ────────────────────────────────────────── */
async function submitGuestbookEntry(e) {
  e.preventDefault();

  const messageInput = qs('#guestbookMessage');
  const rawMessage = messageInput.value;

  // Get memorial ID from the current page
  const memorialId = getMemorialIdFromHash();
  
  if (!memorialId) {
    showNotification('Memorial not found', 'error');
    return;
  }

  // Sanitize message
  const sanitized = window.MemorialSanitizer?.sanitizeMessage
    ? window.MemorialSanitizer.sanitizeMessage(rawMessage)
    : rawMessage;

  const supabase = getClient();
  if (!supabase) {
    showNotification('Service unavailable', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

  try {
    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, name')
      .eq('id', window.currentUser.id)
      .single();

    const authorName = profile?.full_name || 
                      profile?.name || 
                      window.currentUser.email?.split('@')[0] || 
                      'Anonymous';

    const { error } = await supabase
      .from('guestbook_entries')
      .insert({
        memorial_id: memorialId,
        user_id: window.currentUser.id,
        author_name: authorName,
        author_email: window.currentUser.email,
        message: sanitized
      });

    if (error) throw error;

    showNotification('Your message has been posted', 'success');
    messageInput.value = '';
    qs('.modal')?.remove();
    document.body.style.overflow = 'auto';
    
    // Reload guestbook entries
    await loadGuestbookEntries(memorialId);
    
  } catch (error) {
    console.error('Error posting message:', error);
    showNotification('Failed to post message', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Message';
  }
}

/* ──────────────────────────────────────────
   HELPER FUNCTIONS
   ────────────────────────────────────────── */

// Get memorial ID from URL hash
function getMemorialIdFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/#memorial\/(.+)/);
  return match ? match[1] : window.currentMemorialId || null;
}

// Load and display guestbook entries
export async function loadGuestbookEntries(memorialId) {
  const supabase = getClient();
  if (!supabase) return;

  try {
    // First try to get memorial by slug/ID to get the actual UUID
    let actualMemorialId = memorialId;
    
    // Check if it's not a UUID (i.e., it's a slug)
    if (!memorialId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: memorial } = await supabase
        .from('memorials')
        .select('id')
        .eq('slug', memorialId)
        .single();
      
      if (memorial) {
        actualMemorialId = memorial.id;
      }
    }

    const { data: entries, error } = await supabase
      .from('guestbook_entries')
      .select(`
        *,
        profiles:user_id (
          full_name,
          name,
          avatar_url
        )
      `)
      .eq('memorial_id', actualMemorialId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    displayGuestbookEntries(entries);
  } catch (error) {
    console.error('Error loading guestbook:', error);
  }
}

// Display guestbook entries in the UI
function displayGuestbookEntries(entries) {
  const container = qs('.guestbook-entries');
  if (!container) return;

  if (!entries || entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>No messages yet. Be the first to leave a message of love.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(entry => {
    const profile = entry.profiles;
    const avatarUrl = profile?.avatar_url || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.author_name)}&background=6b9174&color=fff`;
    
    const date = new Date(entry.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const isOwner = entry.user_id === window.currentUser?.id;
    const canDelete = isOwner || window.isMemorialOwner;

    return `
      <div class="guestbook-entry" data-entry-id="${entry.id}">
        <div class="entry-header">
          <img
            src="${avatarUrl}"
            alt="${entry.author_name}"
            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(entry.author_name)}&background=6b9174&color=fff'"
          />
          <div class="entry-info">
            <h4>${entry.author_name}</h4>
            <p class="entry-date">${date}</p>
          </div>
          ${canDelete ? `
            <button class="delete-entry" onclick="deleteGuestbookEntry('${entry.id}')" title="Delete message">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        </div>
        <p class="entry-message">${entry.message}</p>
      </div>
    `;
  }).join('');

  // Add fade-in animation
  requestAnimationFrame(() => {
    container.querySelectorAll('.guestbook-entry').forEach((entry, index) => {
      entry.style.opacity = '0';
      entry.style.transform = 'translateY(20px)';
      setTimeout(() => {
        entry.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        entry.style.opacity = '1';
        entry.style.transform = 'translateY(0)';
      }, index * 50);
    });
  });
}

/* ──────────────────────────────────────────
   DELETE FUNCTIONALITY
   ────────────────────────────────────────── */
window.deleteGuestbookEntry = async function(entryId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  
  const supabase = getClient();
  if (!supabase) {
    showNotification('Service unavailable', 'error');
    return;
  }

  try {
    // If user is memorial owner, they can delete any entry
    if (window.isMemorialOwner) {
      const { error } = await supabase
        .from('guestbook_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    } else {
      // Otherwise, users can only delete their own entries
      const { error } = await supabase
        .from('guestbook_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', window.currentUser.id);

      if (error) throw error;
    }
    
    // Animate removal
    const entryElement = qs(`[data-entry-id="${entryId}"]`);
    if (entryElement) {
      entryElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      entryElement.style.opacity = '0';
      entryElement.style.transform = 'translateX(-20px)';
      setTimeout(() => entryElement.remove(), 300);
    }
    
    showNotification('Message deleted', 'success');
  } catch (error) {
    console.error('Error deleting entry:', error);
    showNotification('Failed to delete message', 'error');
  }
};

/* ──────────────────────────────────────────
   REAL-TIME UPDATES (Optional)
   ────────────────────────────────────────── */
export function subscribeToGuestbookUpdates(memorialId) {
  const supabase = getClient();
  if (!supabase) return null;

  // Subscribe to new entries
  const subscription = supabase
    .channel(`guestbook:${memorialId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guestbook_entries',
        filter: `memorial_id=eq.${memorialId}`
      },
      (payload) => {
        // Add new entry to the UI without full reload
        appendNewEntry(payload.new);
      }
    )
    .subscribe();

  return subscription;
}

// Helper to append new entry without full reload
async function appendNewEntry(entry) {
  const supabase = getClient();
  if (!supabase) return;

  // Fetch the profile data for the new entry
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, name, avatar_url')
    .eq('id', entry.user_id)
    .single();

  // Create entry with profile data
  const entryWithProfile = {
    ...entry,
    profiles: profile
  };

  // Get current entries and add new one
  const container = qs('.guestbook-entries');
  if (!container) return;

  // Remove empty state if it exists
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Create new entry HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = displayGuestbookEntries([entryWithProfile]);
  const newEntry = tempDiv.firstElementChild;

  // Add to top of list with animation
  newEntry.style.opacity = '0';
  newEntry.style.transform = 'translateY(-20px)';
  container.insertBefore(newEntry, container.firstChild);

  requestAnimationFrame(() => {
    newEntry.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    newEntry.style.opacity = '1';
    newEntry.style.transform = 'translateY(0)';
  });
}

/* ──────────────────────────────────────────
   CLEANUP
   ────────────────────────────────────────── */
export function unsubscribeFromGuestbook(subscription) {
  if (subscription) {
    subscription.unsubscribe();
  }
}