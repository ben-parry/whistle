// ============================================
// REGISTER API ENDPOINT
// ============================================
// POST /api/auth/register
// Creates a new user account
//
// Request body: { email: "user@example.com", password: "secret123" }
// Response: { success: true, user: { id, email } }
// ============================================

const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const {
    createSessionCookie,
    sendJson,
    sendError,
    isValidEmail
} = require('../_helpers');

// ============================================
// MAIN HANDLER FUNCTION
// ============================================
// This function runs when someone makes a request to /api/auth/register

module.exports = async function handler(request, response) {
    // Only allow POST requests (creating new data)
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Get email and password from request
        // ----------------------------------------
        const { email, password } = request.body;

        // ----------------------------------------
        // STEP 2: Validate the input
        // ----------------------------------------

        // Check that email was provided
        if (!email || typeof email !== 'string') {
            return sendError(response, 400, 'Email is required.');
        }

        // Check that password was provided
        if (!password || typeof password !== 'string') {
            return sendError(response, 400, 'Password is required.');
        }

        // Clean up the email (lowercase, trim whitespace)
        const cleanEmail = email.toLowerCase().trim();

        // Check that email format is valid
        if (!isValidEmail(cleanEmail)) {
            return sendError(response, 400, 'Please enter a valid email address.');
        }

        // Check password length (at least 8 characters)
        if (password.length < 8) {
            return sendError(response, 400, 'Password must be at least 8 characters.');
        }

        // ----------------------------------------
        // STEP 3: Check if email already exists
        // ----------------------------------------
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${cleanEmail}
        `;

        if (existingUser.rows.length > 0) {
            return sendError(response, 400, 'An account with this email already exists.');
        }

        // ----------------------------------------
        // STEP 4: Hash the password
        // ----------------------------------------
        // We NEVER store plain text passwords!
        // bcrypt creates a secure hash that can't be reversed
        // The "10" is the "salt rounds" - higher = more secure but slower
        const passwordHash = await bcrypt.hash(password, 10);

        // ----------------------------------------
        // STEP 5: Generate a session token
        // ----------------------------------------
        // This random string will be stored in a cookie to keep the user logged in
        const sessionToken = uuidv4();

        // ----------------------------------------
        // STEP 6: Create the user in the database
        // ----------------------------------------
        const result = await sql`
            INSERT INTO users (email, password_hash, session_token)
            VALUES (${cleanEmail}, ${passwordHash}, ${sessionToken})
            RETURNING id, email, created_at
        `;

        const newUser = result.rows[0];

        // ----------------------------------------
        // STEP 7: Set the session cookie and respond
        // ----------------------------------------
        response.setHeader('Set-Cookie', createSessionCookie(sessionToken));

        return sendJson(response, 201, {
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email
            }
        });

    } catch (error) {
        // Log the error for debugging (you'll see this in Vercel logs)
        console.error('Registration error:', error);

        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
