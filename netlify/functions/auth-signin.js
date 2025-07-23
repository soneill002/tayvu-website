// netlify/functions/auth-signin.js
// Secure server-side authentication endpoint

const { createClient } = require('@supabase/supabase-js');
const { Validator, ValidationError } = require('./utils/validation');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Security headers
const headers = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};

// CORS configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

exports.handler = async (event, context) => {
  // Combine headers
  const responseHeaders = { ...headers, ...corsHeaders };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      throw new ValidationError('body', 'Invalid request body');
    }

    // Validate input
    const validator = new Validator();
    const validatedData = validator.validateLogin(body);

    // Attempt authentication with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password
    });

    if (error) {
      console.error('Auth error:', error);
      return {
        statusCode: 401,
        headers: responseHeaders,
        body: JSON.stringify({
          error: 'Invalid email or password'
        })
      };
    }

    // Success
    const { user, session } = data;

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || null,
          created_at: user.created_at
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at
        }
      })
    };
  } catch (error) {
    console.error('Authentication error:', error);

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({
          error: error.message,
          field: error.field
        })
      };
    }

    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'An error occurred during authentication'
      })
    };
  }
};
