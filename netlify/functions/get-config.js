// netlify/functions/get-config.js
// Production-ready configuration endpoint with security and caching

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate environment variables exist
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  // Build response headers with security best practices
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  // CORS handling based on environment
  const allowedOrigins = [
    'https://tayvu.com',
    'https://www.tayvu.com',
    'http://localhost:8888',
    'http://localhost:3000',
    'http://127.0.0.1:8888'
  ];

  // Get the origin from the request
  const origin = event.headers.origin || event.headers.Origin;

  // In production, only allow specific origins
  if (process.env.CONTEXT === 'production') {
    if (origin && allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  } else {
    // In development, allow any origin
    headers['Access-Control-Allow-Origin'] = origin || '*';
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Add CORS preflight headers
  headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours

  // Log the request in development
  if (process.env.CONTEXT !== 'production') {
    console.log('Config request from:', origin || 'Unknown origin');
  }

  try {
    // Return the configuration
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        environment: process.env.CONTEXT || 'development',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in get-config function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
