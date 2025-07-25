const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { publicId } = JSON.parse(event.body);
    
    // Add authentication check here
    // Verify user owns the memorial
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};