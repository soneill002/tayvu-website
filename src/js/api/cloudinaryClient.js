// src/js/api/cloudinaryClient.js
import { handleError, retryOperation } from '@/utils/errorHandler.js';
import { showToast } from '@/utils/ui.js';

/* ──────────────────────────────────────────
   CLOUDINARY CLIENT - Browser/REST API Version
   ────────────────────────────────────────── */

// Get from environment variables or hardcode for now
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'tayvu_unsigned';

// Validate configuration
if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'your-cloud-name') {
  console.error('Cloudinary cloud name not configured. Please set VITE_CLOUDINARY_CLOUD_NAME');
}

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
    
    try {
      // Ensure the URL is a Cloudinary URL
      if (!url.includes('cloudinary.com')) {
        console.warn('URL is not a Cloudinary URL:', url);
        return url;
      }
      
      return url.replace('/upload/', `/upload/${transformation}/`);
    } catch (error) {
      console.error('Error transforming URL:', error);
      return url; // Return original URL if transformation fails
    }
  }
};

/* ──────────────────────────────────────────
   UPLOAD FUNCTION WITH ERROR HANDLING
   ────────────────────────────────────────── */
export async function uploadToCloudinary(file, options = {}) {
  // Validate inputs
  if (!file) {
    throw new Error('No file provided for upload');
  }
  
  if (!file.type) {
    throw new Error('Invalid file format');
  }
  
  // Check file size (default 10MB limit)
  const maxSize = options.maxSize || 10 * 1024 * 1024;
  if (file.size > maxSize) {
    const sizeMB = (maxSize / 1024 / 1024).toFixed(0);
    throw new Error(`File size must be less than ${sizeMB}MB`);
  }
  
  // Validate file type
  const allowedTypes = options.allowedTypes || ['image/', 'video/'];
  const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
  if (!isAllowed) {
    throw new Error(`File type not allowed. Please upload ${allowedTypes.join(' or ')} files only.`);
  }
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    // Add optional parameters
    if (options.folder) {
      formData.append('folder', options.folder);
    }
    
    if (options.publicId) {
      formData.append('public_id', options.publicId);
    }
    
    if (options.tags) {
      formData.append('tags', options.tags);
    }
    
    // Determine resource type from file
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    
    // Use retry logic for upload
    const response = await retryOperation(async () => {
      const res = await fetch(
        `${cloudinaryConfig.uploadUrl}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `Upload failed: ${res.statusText}`;
        
        // Handle specific Cloudinary errors
        if (errorMessage.includes('Invalid image file')) {
          throw new Error('The file appears to be corrupted or invalid');
        }
        if (errorMessage.includes('File size too large')) {
          throw new Error('File size exceeds Cloudinary limits');
        }
        if (errorMessage.includes('Upload preset not found')) {
          throw new Error('Upload configuration error. Please contact support.');
        }
        
        throw new Error(errorMessage);
      }
      
      return res;
    }, 3, 2000); // 3 retries with 2 second delay
    
    const data = await response.json();
    
    // Validate response
    if (!data.secure_url) {
      throw new Error('Upload succeeded but no URL returned');
    }
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      thumbnailUrl: cloudinaryConfig.getTransformedUrl(
        data.secure_url,
        cloudinaryConfig.transformations.thumbnail
      )
    };
    
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    
    // Don't use handleError here since we want to throw
    // Let the calling function decide how to handle the error
    throw error;
  }
}

/* ──────────────────────────────────────────
   DELETE FUNCTION (REQUIRES SERVER-SIDE)
   ────────────────────────────────────────── */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId) {
    throw new Error('No public ID provided for deletion');
  }
  
  try {
    // This requires server-side implementation since it needs API credentials
    // Call your Netlify function or server endpoint
    const response = await retryOperation(async () => {
      const res = await fetch('/.netlify/functions/delete-cloudinary-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.currentUser?.access_token || ''}`
        },
        body: JSON.stringify({
          publicId,
          resourceType
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete file');
      }
      
      return res;
    }, 2, 1000); // 2 retries with 1 second delay
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    handleError(error, 'Delete File');
    throw error;
  }
}

/* ──────────────────────────────────────────
   BATCH UPLOAD FUNCTION
   ────────────────────────────────────────── */
export async function batchUploadToCloudinary(files, options = {}, onProgress) {
  if (!files || files.length === 0) {
    throw new Error('No files provided for upload');
  }
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: files.length,
          percentage: Math.round(((i + 1) / files.length) * 100),
          fileName: file.name
        });
      }
      
      const result = await uploadToCloudinary(file, options);
      results.push({
        success: true,
        file: file.name,
        data: result
      });
      
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      errors.push({
        success: false,
        file: file.name,
        error: error.message
      });
      
      // Continue with other files even if one fails
      continue;
    }
  }
  
  // Return summary
  return {
    successful: results,
    failed: errors,
    totalFiles: files.length,
    successCount: results.length,
    failCount: errors.length
  };
}

/* ──────────────────────────────────────────
   VALIDATION HELPERS
   ────────────────────────────────────────── */
export const cloudinaryValidation = {
  // Check if file is valid image
  isValidImage(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
  },
  
  // Check if file is valid video
  isValidVideo(file) {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
    return validTypes.includes(file.type);
  },
  
  // Get file size in MB
  getFileSizeMB(file) {
    return (file.size / 1024 / 1024).toFixed(2);
  },
  
  // Validate file size
  validateFileSize(file, maxSizeMB = 10) {
    const sizeMB = file.size / 1024 / 1024;
    return sizeMB <= maxSizeMB;
  },
  
  // Get user-friendly error for file validation
  getValidationError(file, options = {}) {
    const maxSizeMB = options.maxSizeMB || 10;
    
    if (!file) {
      return 'No file selected';
    }
    
    if (!this.isValidImage(file) && !this.isValidVideo(file)) {
      return 'Invalid file type. Please upload an image or video.';
    }
    
    if (!this.validateFileSize(file, maxSizeMB)) {
      return `File size (${this.getFileSizeMB(file)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`;
    }
    
    return null; // No error
  }
};

/* ──────────────────────────────────────────
   URL BUILDER HELPERS
   ────────────────────────────────────────── */
export const cloudinaryUrlBuilder = {
  // Build URL with custom transformations
  buildUrl(publicId, options = {}) {
    const baseUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}`;
    const resourceType = options.resourceType || 'image';
    const version = options.version || 'v1';
    const transformation = options.transformation || '';
    
    return `${baseUrl}/${resourceType}/upload/${transformation}${transformation ? '/' : ''}${version}/${publicId}`;
  },
  
  // Build thumbnail URL
  getThumbnailUrl(url, width = 150, height = 150) {
    return cloudinaryConfig.getTransformedUrl(
      url,
      `c_fill,w_${width},h_${height},q_auto`
    );
  },
  
  // Build optimized URL
  getOptimizedUrl(url, options = {}) {
    const quality = options.quality || 'auto';
    const format = options.format || 'auto';
    return cloudinaryConfig.getTransformedUrl(
      url,
      `q_${quality},f_${format}`
    );
  }
};