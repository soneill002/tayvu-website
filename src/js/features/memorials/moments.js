/*  src/js/features/memorials/moments.js  */
import { showNotification, qs, formatDate } from '@/utils/ui.js';

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let moments = [];
let momentsViewMode = 'grid';
let draggedMomentIndex = null;

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initMomentsBoard() {
  /* drop-zone */
  const dropZone = qs('#momentsDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }

  /* delegated clicks (browse, view-mode) */
  document.getElementById('step4')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-upload') || e.target.closest('[data-moments-browse]')) {
      return selectMoments();
    }
    const btn = e.target.closest('.view-btn');
    if (btn) {
      changeGridView(btn.querySelector('.fa-list') ? 'list' : 'grid');
    }
  });

  //   /* first render */
  updateMomentsDisplay();
  updateMomentsCount();
}

/* expose if other modules need the raw array */
export const getMoments = () => moments;

/* ──────────────────────────────────────────
   DRAG-AND-DROP UPLOAD
   ────────────────────────────────────────── */
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  Array.from(e.dataTransfer.files).forEach(
    (file) => (file.type.startsWith('image/') || file.type.startsWith('video/')) && addMoment(file)
  );
}

/* ──────────────────────────────────────────
   FILE-SELECT UPLOAD
   ────────────────────────────────────────── */
function selectMoments() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.onchange = ({ target }) => Array.from(target.files).forEach(addMoment);
  input.click();
}

function addMoment(file) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return showNotification('Please upload only images or videos', 'error');
  }
  if (file.size > 50 * 1024 * 1024) {
    return showNotification('File size must be under 50 MB', 'error');
  }

  const reader = new FileReader();
  reader.onload = ({ target }) => {
    moments.push({
      id: Date.now() + Math.random(),
      type: file.type.startsWith('video/') ? 'video' : 'photo',
      url: target.result,
      caption: '',
      date: new Date().toISOString().split('T')[0],
      fileName: file.name
    });
    updateMomentsDisplay();
    updateMomentsCount();
    showNotification(`${file.type.startsWith('video/') ? 'Video' : 'Photo'} added successfully!`);
  };
  reader.readAsDataURL(file);
}

/* ──────────────────────────────────────────
   RENDERING
   ────────────────────────────────────────── */
function updateMomentsDisplay() {
  const grid = qs('#momentsPreviewGrid');
  if (!grid) return;

  const emptyState = qs('#momentsEmptyState');
  if (moments.length === 0) {
    emptyState?.style.setProperty('display', 'block');
    grid.innerHTML = '';
    emptyState && grid.appendChild(emptyState);
    return;
  }
  emptyState?.style.setProperty('display', 'none');

  grid.innerHTML = moments
    .map(
      (m, i) => `
    <div class="moment-preview-item ${momentsViewMode === 'list' ? 'list-view' : ''}"
         draggable="true"
         data-id="${m.id}"
         ondragstart="handleMomentDragStart(event, ${i})"
         ondragover="handleMomentDragOver(event)"
         ondrop="handleMomentDrop(event, ${i})"
         ondragend="handleMomentDragEnd(event)">
      <div class="moment-preview-image">
        ${
          m.type === 'video'
            ? `<video src="${m.url}" muted></video>
               <div class="video-indicator-overlay"><i class="fas fa-play"></i></div>`
            : `<img src="${m.url}" alt="${m.caption || 'Moment'}">`
        }
      </div>
      <div class="moment-actions">
        <button class="moment-action-btn" onclick="editMomentCaption(${i})" title="Edit caption">
          <i class="fas fa-pen"></i>
        </button>
        <button class="moment-action-btn" onclick="removeMoment(${i})" title="Remove">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="moment-caption">
        <input class="caption-input" type="text"
               placeholder="Add a caption (optional)"
               value="${m.caption}"
               onchange="updateMomentCaption(${i}, this.value)">
        ${momentsViewMode === 'grid' ? `<div class="moment-date">${formatDate(m.date)}</div>` : ''}
      </div>
    </div>`
    )
    .join('');
}

function updateMomentsCount() {
  const photoEl = qs('#photoCount');
  const videoEl = qs('#videoCount');
  if (!photoEl || !videoEl) return; // ← bail if step-4 isn’t in the DOM yet

  photoEl.textContent = moments.filter((m) => m.type === 'photo').length;
  videoEl.textContent = moments.filter((m) => m.type === 'video').length;
}

/* ──────────────────────────────────────────
   VIEW TOGGLE & CAPTION EDIT
   ────────────────────────────────────────── */
function changeGridView(view) {
  momentsViewMode = view;
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
  event.target.closest('.view-btn').classList.add('active');

  const grid = qs('#momentsPreviewGrid');
  grid?.classList.toggle('list-view', view === 'list');
  updateMomentsDisplay();
}

function updateMomentCaption(i, caption) {
  if (moments[i]) moments[i].caption = caption;
}

/* eslint-disable-next-line no-unused-vars */
function editMomentCaption(i) {
  const input = event.target.closest('.moment-preview-item')?.querySelector('.caption-input');
  input?.focus();
  input?.select();
}

/* ──────────────────────────────────────────
   REMOVE
   ────────────────────────────────────────── */
function removeMoment(i) {
  if (confirm('Are you sure you want to remove this moment?')) {
    moments.splice(i, 1);
    updateMomentsDisplay();
    updateMomentsCount();
    showNotification('Moment removed');
  }
}

/* ──────────────────────────────────────────
   DRAG REORDER
   ────────────────────────────────────────── */
function handleMomentDragStart(e, i) {
  draggedMomentIndex = i;
  e.target.classList.add('dragging');
}
function handleMomentDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function handleMomentDrop(e, dropIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (draggedMomentIndex !== null && draggedMomentIndex !== dropIdx) {
    const [dragged] = moments.splice(draggedMomentIndex, 1);
    moments.splice(draggedMomentIndex < dropIdx ? dropIdx - 1 : dropIdx, 0, dragged);
    updateMomentsDisplay();
    showNotification('Moments reordered');
  }
}
function handleMomentDragEnd(e) {
  e.target.classList.remove('dragging');
  document
    .querySelectorAll('.moment-preview-item')
    .forEach((el) => el.classList.remove('drag-over'));
  draggedMomentIndex = null;
}

/* ──────────────────────────────────────────
   TEMP GLOBAL SHIM – keeps any inline attrs working
   Remove once all inline handlers are gone.
   ────────────────────────────────────────── */
Object.assign(window, {
  handleDragOver,
  handleDragLeave,
  handleDrop,
  selectMoments,
  addMoment,
  updateMomentsDisplay,
  updateMomentsCount,
  changeGridView,
  updateMomentCaption,
  editMomentCaption,
  removeMoment,
  handleMomentDragStart,
  handleMomentDragOver,
  handleMomentDrop,
  handleMomentDragEnd
});
