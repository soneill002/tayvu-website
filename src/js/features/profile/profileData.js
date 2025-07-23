// src/js/features/profile/profileData.js
import { qs } from '@/utils/ui.js';
import { showPage } from '@/router.js';

/* ------------------ PUBLIC API ------------------ */
export async function loadProfileData() {
  if (!window.currentUser) return;

  // User info
  qs('#profileName').textContent = window.currentUser.user_metadata?.name || 'User';
  qs('#profileEmail').textContent = window.currentUser.email;

  // Settings form
  qs('#settingsName').value = window.currentUser.user_metadata?.name || '';
  qs('#settingsEmail').value = window.currentUser.email;

  // Stats (mock for now)
  qs('#memorialsCount').textContent = '3';
  qs('#contributionsCount').textContent = '12';
  qs('#visitorsCount').textContent = '256';

  // Load memorials (mock data for demo)
  loadMyMemorials();

  // Load contributions (mock data for demo)
  loadMyContributions();
}

/* ------------------ helpers (copied verbatim) ------------------ */
function loadMyMemorials() {
  // Mock data for demonstration - replace with actual data from database
  const memorials = [
    {
      id: 1,
      name: 'Margaret Rose Thompson',
      dates: 'March 15, 1945 - December 3, 2023',
      photo: 'https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?w=200&h=200&fit=crop',
      photos: 24,
      tributes: 18
    }
  ];

  const container = document.getElementById('myMemorials');

  if (!container) {
    console.error('myMemorials container not found');
    return;
  }

  if (memorials.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-monument"></i>
                </div>
                <h3>No memorials yet</h3>
                <p>Create your first memorial to honor a loved one</p>
                <button class="btn-primary" onclick="goToCreateMemorial()">
                    <i class="fas fa-plus"></i>
                    Create Memorial
                </button>
            </div>
        `;
  } else {
    container.innerHTML = memorials
      .map(
        (memorial) => `
            <div class="memorial-card" onclick="viewMemorial(${memorial.id})">
                <div class="memorial-card-image">
                    <img src="${memorial.photo}" alt="${memorial.name}">
                </div>
                <div class="memorial-card-content">
                    <h3 class="memorial-card-name">${memorial.name}</h3>
                    <p class="memorial-card-dates">${memorial.dates}</p>
                    <div class="memorial-card-stats">
                        <span class="memorial-card-stat">
                            <i class="fas fa-images"></i>
                            <span>${memorial.photos}</span>
                        </span>
                        <span class="memorial-card-stat">
                            <i class="fas fa-comment"></i>
                            <span>${memorial.tributes}</span>
                        </span>
                    </div>
                </div>
            </div>
        `
      )
      .join('');
  }
}

function loadMyContributions() {
  // Mock data for demonstration
  const contributions = [
    {
      memorialName: 'Elizabeth Grace Williams',
      memorialPhoto:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
      type: 'message',
      message:
        'Your kindness and wisdom will always be remembered. Thank you for being such an inspiration.',
      date: '2 days ago'
    },
    {
      memorialName: 'Sarah Louise Davis',
      memorialPhoto:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
      type: 'photo',
      message: 'Added 3 photos to the memorial',
      date: '2 weeks ago'
    }
  ];

  const container = document.getElementById('myContributions');

  if (contributions.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart"></i>
                <h3>No contributions yet</h3>
                <p>Visit memorials to leave messages and light candles</p>
            </div>
        `;
  } else {
    container.innerHTML = contributions
      .map(
        (contrib) => `
            <div class="contribution-item">
                <img src="${contrib.memorialPhoto}" alt="${contrib.memorialName}" class="contribution-memorial-photo">
                <div class="contribution-content">
                    <h4 class="contribution-memorial-name">${contrib.memorialName}</h4>
                    <span class="contribution-type">
                        <i class="fas fa-${contrib.type === 'message' ? 'comment' : contrib.type === 'candle' ? 'candle' : 'images'}"></i>
                        ${contrib.type === 'message' ? 'Left a message' : contrib.type === 'candle' ? 'Lit a candle' : 'Added photos'}
                    </span>
                    <p class="contribution-message">${contrib.message}</p>
                    <p class="contribution-date">${contrib.date}</p>
                </div>
            </div>
        `
      )
      .join('');
  }
}

/* ------------------ public navigation helper ------------------ */
export function goToProfile() {
  if (!window.currentUser) {
    window.openModal?.('signin'); // legacy modal
    return;
  }
  showPage('profile'); // imported from router
  loadProfileData();
}

// at the bottom of profileData.js
window.goToProfile = goToProfile;
