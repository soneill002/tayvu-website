/*  src/js/features/profile/profileUI.js  */
import { showNotification, qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';

let supabase;

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export async function initProfilePage() {
  supabase = getClient();

  document.addEventListener('auth:state', maybeLoadProfile);
  window.addEventListener('hashchange', maybeLoadProfile);
  maybeLoadProfile();

  /* delegated click – photo & delete only */
  qs('#profile')?.addEventListener('click', (e) => {
    if (e.target.closest('.profile-photo-edit')) return uploadProfilePhoto();
    if (e.target.closest('[data-action="delete-account"]')) return confirmDeleteAccount();
  });

  qs('#profileSettingsForm')?.addEventListener('submit', updateProfile);
}

/* ──────────────────────────────────────────
   TAB SWITCHER  ← kept exactly like the legacy code
   (relies on the global `event` from inline onclick)
   ────────────────────────────────────────── */
export function switchProfileTab(tab) {
  /* update buttons */
  document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
  event.target.closest('.profile-tab').classList.add('active');

  /* update content */
  document.querySelectorAll('.profile-tab-content').forEach((c) => c.classList.remove('active'));
  document.getElementById(`${tab}Tab`).classList.add('active');
}

/* keep inline handlers working */
window.switchProfileTab = switchProfileTab;

/* ──────────────────────────────────────────
   LOAD DATA
   ────────────────────────────────────────── */
async function maybeLoadProfile() {
  if (location.hash !== '#profile') return;
  const user = supabase?.auth.getUser()?.data?.user;
  if (!user) return;

  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (error) throw error;
    renderProfile(data);
  } catch (err) {
    console.error(err);
    showNotification('Unable to load profile', 'error');
  }
}

function renderProfile(p) {
  qs('#profileName').textContent = p.full_name || '—';
  qs('#profileEmail').textContent = p.email || '—';
  qs('#profilePhoto')?.setAttribute('src', p.avatar_url || 'assets/default-avatar.jpg');
  qs('#inputFullName')?.setAttribute('value', p.full_name || '');
  qs('#inputHeadline')?.setAttribute('value', p.headline || '');
  qs('#inputLocation')?.setAttribute('value', p.location || '');
}

/* ──────────────────────────────────────────
   UPDATE PROFILE
   ────────────────────────────────────────── */
async function updateProfile(e) {
  e.preventDefault();
  const user = supabase?.auth.getUser()?.data?.user;
  if (!user) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  const upd = {
    full_name: qs('#inputFullName').value.trim(),
    headline: qs('#inputHeadline').value.trim(),
    location: qs('#inputLocation').value.trim()
  };

  try {
    const { error } = await supabase.from('profiles').update(upd).eq('id', user.id);
    if (error) throw error;
    showNotification('Profile updated', 'success');
    maybeLoadProfile();
  } catch (err) {
    console.error(err);
    showNotification('Update failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

/* ──────────────────────────────────────────
   PHOTO UPLOAD
   ────────────────────────────────────────── */
function uploadProfilePhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) return;

    const user = supabase?.auth.getUser()?.data?.user;
    if (!user) return;

    try {
      const filePath = `avatars/${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);

      qs('#profilePhoto')?.setAttribute('src', urlData.publicUrl);
      showNotification('Profile photo updated', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Upload failed', 'error');
    }
  };
  input.click();
}

/* ──────────────────────────────────────────
   DELETE ACCOUNT
   ────────────────────────────────────────── */
async function confirmDeleteAccount() {
  if (!confirm('Delete account permanently?')) return;
  const user = supabase?.auth.getUser()?.data?.user;
  if (!user) return;

  try {
    await supabase.rpc('delete_user', { uid: user.id });
    await supabase.auth.signOut();
    showNotification('Account deleted');
    location.hash = '#home';
  } catch (err) {
    console.error(err);
    showNotification('Unable to delete account', 'error');
  }
}
