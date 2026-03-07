// ============================================
// CHANGE PASSWORD API ENDPOINT
// ============================================
// POST /api/auth/change-password
// Changes the user's password (requires current password)
//
// Request body: { current_password, new_password }
// Response: { success: true }
// ============================================

const bcrypt = require('bcryptjs');
const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        // ----------------------------------------
        // Check auth
        // ----------------------------------------
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to change your password.');
        }

        // ----------------------------------------
        // Validate input
        // ----------------------------------------
        const { current_password, new_password } = request.body;

        if (!current_password || !new_password) {
            return sendError(response, 400, 'Current password and new password are required.');
        }

        if (new_password.length < 8) {
            return sendError(response, 400, 'New password must be at least 8 characters.');
        }

        // ----------------------------------------
        // Verify current password
        // ----------------------------------------
        const userRecord = await sql`
            SELECT password_hash FROM users WHERE id = ${user.id}
        `;

        if (userRecord.rows.length === 0) {
            return sendError(response, 404, 'User not found.');
        }

        const passwordMatches = await bcrypt.compare(current_password, userRecord.rows[0].password_hash);
        if (!passwordMatches) {
            return sendError(response, 401, 'Current password is incorrect.');
        }

        // ----------------------------------------
        // Update password
        // ----------------------------------------
        const newHash = await bcrypt.hash(new_password, 10);

        await sql`
            UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}
        `;

        return sendJson(response, 200, { success: true });

    } catch (error) {
        console.error('Change password error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
