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