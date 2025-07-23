// netlify/functions/auth-signup.js
// Secure server-side signup endpoint

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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

exports.handler = async (event, context) => {
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
    const validatedData = validator.validateSignup(body);

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          name: validatedData.name
        }
      }
    });

    if (authError) {
      console.error('Supabase auth error:', authError);

      // Check if email already exists
      if (authError.message.includes('already registered')) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({
            error: 'This email is already registered',
            field: 'email'
          })
        };
      }

      throw new Error('Unable to create account');
    }

    // Return success
    return {
      statusCode: 201,
      headers: responseHeaders,
      body: JSON.stringify({
        message: 'Account created successfully. Please check your email to verify your account.',
        requiresVerification: true
      })
    };
  } catch (error) {
    console.error('Signup error:', error);

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
        error: 'Unable to create account. Please try again.'
      })
    };
  }
};
