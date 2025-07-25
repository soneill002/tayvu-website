// src/js/api/cloudinaryClient.js
/* ──────────────────────────────────────────
   CLOUDINARY CLIENT - Browser/REST API Version
   ────────────────────────────────────────── */

// Get from environment variables or hardcode for now
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'tayvu_unsigned';

export const cloudinaryConfig = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: CLOUDINARY_UPLOAD_PRESET,
  
  // REST API endpoints (no SDK needed)
  uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}`,
  
  // Transformation presets for different use cases
  transformations: {
    thumbnail: 'c_thumb,w_150,h_150,g_face',
    profilePhoto: 'c_fill,w_400,h_400,g_face,q_auto',
    backgroundImage: 'c_fill,w_1600,h_600,q_auto',
    momentPhoto: 'c_limit,w_1200,h_1200,q_auto',
    momentThumbnail: 'c_fill,w_300,h_300,q_auto'
  },
  
  // Helper to build transformed URLs
  getTransformedUrl(url, transformation) {
    if (!url || !transformation) return url;
    return url.replace('/upload/', `/upload/${transformation}/`);
  }
};

// ============================================
// Updated src/js/features/memorials/moments.js
// ============================================
import { showNotification, qs, formatDate } from '@/utils/ui.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let moments = [];
let momentsViewMode = 'grid';
let draggedMomentIndex = null;
let uploadQueue = [];
let isUploading = false;

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initMomentsBoard() {
  const dropZone = qs('#momentsDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }

  document.getElementById('step4')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-upload') || e.target.closest('[data-moments-browse]')) {
      return selectMoments();
    }
    const btn = e.target.closest('.view-btn');
    if (btn) {
      changeGridView(btn.querySelector('.fa-list') ? 'list' : 'grid');
    }
  });

  updateMomentsDisplay();
  updateMomentsCount();
}

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
  const files = Array.from(e.dataTransfer.files).filter(
    file => file.type.startsWith('image/') || file.type.startsWith('video/')
  );
  handleMultipleUploads(files);
}

/* ──────────────────────────────────────────
   FILE-SELECT UPLOAD
   ────────────────────────────────────────── */
function selectMoments() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.onchange = ({ target }) => {
    const files = Array.from(target.files);
    handleMultipleUploads(files);
  };
  input.click();
}

/* ──────────────────────────────────────────
   CLOUDINARY UPLOAD
   ────────────────────────────────────────── */
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  
  // Add tags for organization
  const memorialId = window.currentMemorialId || 'draft';
  formData.append('tags', `memorial_${memorialId},moments`);
  
  // Set folder structure
  formData.append('folder', `tayvu/memorials/${memorialId}/moments`);
  
  try {
    const endpoint = file.type.startsWith('video/') 
      ? `${cloudinaryConfig.uploadUrl}/video/upload`
      : `${cloudinaryConfig.uploadUrl}/image/upload`;
      
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/* ──────────────────────────────────────────
   BATCH UPLOAD MANAGEMENT
   ────────────────────────────────────────── */
function handleMultipleUploads(files) {
  // Validate files
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showNotification(`${file.name} is not an image or video`, 'error');
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      showNotification(`${file.name} is too large (max 50MB)`, 'error');
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) return;
  
  // Add to upload queue
  uploadQueue.push(...validFiles);
  processUploadQueue();
}

async function processUploadQueue() {
  if (isUploading || uploadQueue.length === 0) return;
  
  isUploading = true;
  showUploadProgress(true);
  
  while (uploadQueue.length > 0) {
    const file = uploadQueue.shift();
    try {
      await addMoment(file);
      updateUploadProgress(uploadQueue.length);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      showNotification(`Failed to upload ${file.name}`, 'error');
    }
  }
  
  isUploading = false;
  showUploadProgress(false);
  showNotification('All uploads complete!', 'success');
}

async function addMoment(file) {
  try {
    // Show loading state for this specific file
    const tempId = Date.now() + Math.random();
    const tempMoment = {
      id: tempId,
      type: file.type.startsWith('video/') ? 'video' : 'photo',
      url: URL.createObjectURL(file), // Temporary local URL
      caption: '',
      date: new Date().toISOString().split('T')[0],
      fileName: file.name,
      uploading: true
    };
    
    // Add temporary moment to show progress
    moments.push(tempMoment);
    updateMomentsDisplay();
    
    // Upload to Cloudinary
    const cloudinaryData = await uploadToCloudinary(file);
    
    // Update moment with Cloudinary data
    const momentIndex = moments.findIndex(m => m.id === tempId);
    if (momentIndex !== -1) {
      moments[momentIndex] = {
        ...moments[momentIndex],
        url: cloudinaryData.secure_url,
        thumbnailUrl: file.type.startsWith('video/') 
          ? cloudinaryData.thumbnail_url 
          : cloudinaryData.secure_url.replace('/upload/', `/upload/${cloudinaryConfig.transformations.momentThumbnail}/`),
        publicId: cloudinaryData.public_id,
        resourceType: cloudinaryData.resource_type,
        uploading: false
      };
    }
    
    // Clean up temporary URL
    URL.revokeObjectURL(tempMoment.url);
    
    updateMomentsDisplay();
    updateMomentsCount();
    
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

/* ──────────────────────────────────────────
   UI UPDATES
   ────────────────────────────────────────── */
function updateMomentsDisplay() {
  const grid = qs('#momentsPreviewGrid');
  const emptyState = qs('#momentsEmptyState');
  
  if (!grid) return;
  
  if (moments.length === 0) {
    emptyState.style.display = 'flex';
    grid.innerHTML = '';
    return;
  }
  
  emptyState.style.display = 'none';
  
  grid.innerHTML = moments
    .map((moment, index) => {
      const isVideo = moment.type === 'video';
      const displayUrl = moment.thumbnailUrl || moment.url;
      
      return `
        <div class="moment-preview-item ${momentsViewMode === 'list' ? 'list-view' : ''} ${moment.uploading ? 'uploading' : ''}" 
             data-moment-index="${index}"
             draggable="${!moment.uploading}"
             ondragstart="handleMomentDragStart(event, ${index})"
             ondragover="handleMomentDragOver(event)"
             ondrop="handleMomentDrop(event, ${index})"
             ondragend="handleMomentDragEnd(event)">
          
          ${moment.uploading ? '<div class="upload-overlay"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
          
          <div class="moment-media">
            ${isVideo ? `
              <video src="${moment.url}" controls>
                <source src="${moment.url}" type="${moment.type}">
              </video>
              <div class="video-indicator">
                <i class="fas fa-play-circle"></i>
              </div>
            ` : `
              <img src="${displayUrl}" alt="${moment.fileName}" loading="lazy">
            `}
          </div>
          
          <button type="button" 
                  class="moment-remove-btn" 
                  onclick="removeMoment(${index})"
                  ${moment.uploading ? 'disabled' : ''}>
            <i class="fas fa-times"></i>
          </button>
          
          <div class="moment-caption">
            <input type="text" 
                   class="caption-input" 
                   placeholder="Add a caption..."
                   value="${moment.caption || ''}"
                   onchange="updateMomentCaption(${index}, this.value)"
                   ${moment.uploading ? 'disabled' : ''}>
            <div class="moment-date">${formatDate(moment.date)}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

function updateMomentsCount() {
  const photos = moments.filter(m => m.type === 'photo' && !m.uploading).length;
  const videos = moments.filter(m => m.type === 'video' && !m.uploading).length;
  
  const photoCount = qs('#photoCount');
  const videoCount = qs('#videoCount');
  
  if (photoCount) photoCount.textContent = photos;
  if (videoCount) videoCount.textContent = videos;
}

/* ──────────────────────────────────────────
   UPLOAD PROGRESS UI
   ────────────────────────────────────────── */
function showUploadProgress(show) {
  let progressBar = qs('#uploadProgressBar');
  
  if (show && !progressBar) {
    const progressHTML = `
      <div id="uploadProgressBar" class="upload-progress-bar">
        <div class="upload-progress-content">
          <i class="fas fa-cloud-upload-alt"></i>
          <span>Uploading <span id="remainingCount">${uploadQueue.length}</span> file(s)...</span>
        </div>
      </div>
    `;
    document.querySelector('.moments-upload-section')?.insertAdjacentHTML('afterbegin', progressHTML);
  } else if (!show && progressBar) {
    progressBar.remove();
  }
}

function updateUploadProgress(remaining) {
  const remainingCount = qs('#remainingCount');
  if (remainingCount) {
    remainingCount.textContent = remaining;
  }
}

/* ──────────────────────────────────────────
   MOMENT ACTIONS
   ────────────────────────────────────────── */
window.removeMoment = function(index) {
  const moment = moments[index];
  if (moment && moment.uploading) return;
  
  if (confirm('Remove this moment?')) {
    moments.splice(index, 1);
    updateMomentsDisplay();
    updateMomentsCount();
    showNotification('Moment removed');
  }
};

window.updateMomentCaption = function(index, caption) {
  if (moments[index]) {
    moments[index].caption = caption;
  }
};

window.changeGridView = function(view) {
  momentsViewMode = view;
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.view-btn:has(.fa-${view === 'grid' ? 'th' : 'list'})`).classList.add('active');
  updateMomentsDisplay();
};

/* ──────────────────────────────────────────
   EXPORT MOMENTS DATA
   ────────────────────────────────────────── */
export function getMomentsForSave() {
  return moments.filter(m => !m.uploading).map(m => ({
    type: m.type,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl,
    publicId: m.publicId,
    caption: m.caption,
    date: m.date,
    fileName: m.fileName
  }));
}

// Also make it available globally for the wizard
window.getMomentsForSave = getMomentsForSave;