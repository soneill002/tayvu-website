const cloudinary = require('cloudinary').v2;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key for backend use
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Get the authorization token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }) 
      };
    }

    const token = authHeader.substring(7);
    
    // Verify the JWT token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid or expired token' }) 
      };
    }

    const { publicId, resourceType = 'image' } = JSON.parse(event.body);
    
    if (!publicId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'publicId is required' }) 
      };
    }

    // For profile avatars, verify user owns the profile
    if (publicId.includes('avatars/')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, avatar_public_id')
        .eq('id', user.id)
        .eq('avatar_public_id', publicId)
        .single();

      if (!profile) {
        return { 
          statusCode: 403, 
          body: JSON.stringify({ error: 'You do not have permission to delete this avatar' }) 
        };
      }
    }
    
    // For memorial photos, verify user owns the memorial
    else if (publicId.includes('memorials/')) {
      // Extract memorial ID from publicId if needed
      // Check if user owns the memorial or is a collaborator with delete permissions
      const memorialIdMatch = publicId.match(/memorials\/([^\/]+)\//);
      if (memorialIdMatch) {
        const memorialId = memorialIdMatch[1];
        
        const { data: memorial } = await supabase
          .from('memorials')
          .select('created_by')
          .eq('id', memorialId)
          .single();

        if (!memorial || memorial.created_by !== user.id) {
          // Check if user is a collaborator with admin rights
          const { data: collaborator } = await supabase
            .from('memorial_collaborators')
            .select('role')
            .eq('memorial_id', memorialId)
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();

          if (!collaborator) {
            return { 
              statusCode: 403, 
              body: JSON.stringify({ error: 'You do not have permission to delete this image' }) 
            };
          }
        }
      }
    }
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, result })
    };
    
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};