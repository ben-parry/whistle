// ============================================
// LOGIN API ENDPOINT
// ============================================
// POST /api/auth/login
// Logs in an existing user
//
// Request body: { email: "user@example.com", password: "secret123" }
// Response: { success: true, user: { id, email } }
// ============================================

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const {
    sql,
    createSessionCookie,
    sendJson,
    sendError
} = require('../_helpers');

// ============================================
// MAIN HANDLER FUNCTION
// ============================================

module.exports = async function handler(request, response) {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Get email and password from request
        // ----------------------------------------
        const { email, password } = request.body;

        // Check that both were provided
        if (!email || !password) {
            return sendError(response, 400, 'Email and password are required.');
        }

        // Clean up the email
        const cleanEmail = email.toLowerCase().trim();

        // ----------------------------------------
        // STEP 2: Find the user by email
        // ----------------------------------------
        const result = await sql`
            SELECT id, email, password_hash
            FROM users
            WHERE email = ${cleanEmail}
        `;

        // If no user found, return error
        // We use a generic message so attackers can't tell if an email exists
        if (result.rows.length === 0) {
            return sendError(response, 401, 'Invalid email or password.');
        }

        const user = result.rows[0];

        // ----------------------------------------
        // STEP 3: Check the password
        // ----------------------------------------
        // bcrypt.compare checks if the password matches the hash
        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return sendError(response, 401, 'Invalid email or password.');
        }

        // ----------------------------------------
        // STEP 4: Create a new session token
        // ----------------------------------------
        // Generate a new random token for this login session
        const sessionToken = uuidv4();

        // Save the session token to the database
        await sql`
            UPDATE users
            SET session_token = ${sessionToken}
            WHERE id = ${user.id}
        `;

        // ----------------------------------------
        // STEP 5: Set the session cookie and respond
        // ----------------------------------------
        response.setHeader('Set-Cookie', createSessionCookie(sessionToken));

        return sendJson(response, 200, {
            success: true,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
