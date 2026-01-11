// ============================================
// LOGOUT API ENDPOINT
// ============================================
// POST /api/auth/logout
// Logs out the current user by clearing their session
//
// Response: { success: true }
// ============================================

const { sql } = require('@vercel/postgres');
const {
    getCurrentUser,
    createLogoutCookie,
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
        // STEP 1: Get the current user (if any)
        // ----------------------------------------
        const user = await getCurrentUser(request);

        // ----------------------------------------
        // STEP 2: Clear the session in the database
        // ----------------------------------------
        // Only do this if we found a logged-in user
        if (user) {
            await sql`
                UPDATE users
                SET session_token = NULL
                WHERE id = ${user.id}
            `;
        }

        // ----------------------------------------
        // STEP 3: Clear the session cookie
        // ----------------------------------------
        // This deletes the cookie from the browser
        response.setHeader('Set-Cookie', createLogoutCookie());

        return sendJson(response, 200, { success: true });

    } catch (error) {
        console.error('Logout error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
