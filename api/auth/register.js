// ============================================
// REGISTER API ENDPOINT
// ============================================
// POST /api/auth/register
// Creates a new user account with name and cute ID
//
// Request body: { email, password, name }
// Response: { success: true, user: { id, email, name, cute_id } }
// ============================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
    sql,
    createSessionCookie,
    sendJson,
    sendError,
    isValidEmail,
    isValidName,
    validateNameWithLLM,
    generateUniqueCuteId
} = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        const { email, password, name } = request.body;

        // ----------------------------------------
        // Validate email
        // ----------------------------------------
        if (!email || typeof email !== 'string') {
            return sendError(response, 400, 'Email is required.');
        }

        const cleanEmail = email.toLowerCase().trim();

        if (!isValidEmail(cleanEmail)) {
            return sendError(response, 400, 'Please enter a valid email address.');
        }

        // ----------------------------------------
        // Validate password
        // ----------------------------------------
        if (!password || typeof password !== 'string') {
            return sendError(response, 400, 'Password is required.');
        }

        if (password.length < 8) {
            return sendError(response, 400, 'Password must be at least 8 characters.');
        }

        // ----------------------------------------
        // Validate name
        // ----------------------------------------
        if (!name || typeof name !== 'string') {
            return sendError(response, 400, 'Name is required.');
        }

        const cleanName = name.trim();

        if (!isValidName(cleanName)) {
            return sendError(response, 400, 'Please enter a valid name. Names must contain only letters — no numbers or special characters.');
        }

        // LLM validation (fails open if API is unavailable)
        const isRealName = await validateNameWithLLM(cleanName);
        if (!isRealName) {
            return sendError(response, 400, 'Please enter your real name. Nicknames, handles, and joke names are not accepted.');
        }

        // ----------------------------------------
        // Check if email already exists
        // ----------------------------------------
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${cleanEmail}
        `;

        if (existingUser.rows.length > 0) {
            return sendError(response, 400, 'An account with this email already exists.');
        }

        // ----------------------------------------
        // Hash password and generate IDs
        // ----------------------------------------
        const passwordHash = await bcrypt.hash(password, 10);
        const sessionToken = crypto.randomUUID();
        const cuteId = await generateUniqueCuteId();

        // ----------------------------------------
        // Create the user
        // ----------------------------------------
        const result = await sql`
            INSERT INTO users (email, name, password_hash, session_token, cute_id)
            VALUES (${cleanEmail}, ${cleanName}, ${passwordHash}, ${sessionToken}, ${cuteId})
            RETURNING id, email, name, cute_id, created_at
        `;

        const newUser = result.rows[0];

        // ----------------------------------------
        // Set session cookie and respond
        // ----------------------------------------
        response.setHeader('Set-Cookie', createSessionCookie(sessionToken));

        return sendJson(response, 201, {
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                cute_id: newUser.cute_id
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
