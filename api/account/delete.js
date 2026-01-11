// ============================================
// DELETE ACCOUNT API ENDPOINT
// ============================================
// DELETE /api/account/delete
// Permanently deletes the user's account and all their data
//
// Response: { success: true }
// ============================================

const {
    sql,
    getCurrentUser,
    createLogoutCookie,
    sendJson,
    sendError
} = require('../_helpers');

// ============================================
// MAIN HANDLER FUNCTION
// ============================================

module.exports = async function handler(request, response) {
    // Only allow DELETE requests
    if (request.method !== 'DELETE') {
        return sendError(response, 405, 'Method not allowed. Use DELETE.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Make sure user is logged in
        // ----------------------------------------
        const user = await getCurrentUser(request);

        if (!user) {
            return sendError(response, 401, 'You must be logged in to delete your account.');
        }

        // ----------------------------------------
        // STEP 2: Delete the user
        // ----------------------------------------
        // Note: Time entries are automatically deleted because of
        // ON DELETE CASCADE in the database schema
        await sql`
            DELETE FROM users WHERE id = ${user.id}
        `;

        // ----------------------------------------
        // STEP 3: Clear the session cookie
        // ----------------------------------------
        response.setHeader('Set-Cookie', createLogoutCookie());

        return sendJson(response, 200, {
            success: true,
            message: 'Your account has been permanently deleted.'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
