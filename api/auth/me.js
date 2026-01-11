// ============================================
// GET CURRENT USER API ENDPOINT
// ============================================
// GET /api/auth/me
// Returns the currently logged-in user's info
//
// Response (logged in): { user: { id, email } }
// Response (not logged in): { user: null }
// ============================================

const { getCurrentUser, sendJson, sendError } = require('../_helpers');

// ============================================
// MAIN HANDLER FUNCTION
// ============================================

module.exports = async function handler(request, response) {
    // Only allow GET requests (reading data)
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Get the current user from session
        // ----------------------------------------
        const user = await getCurrentUser(request);

        // ----------------------------------------
        // STEP 2: Return the user info (or null)
        // ----------------------------------------
        if (user) {
            return sendJson(response, 200, {
                user: {
                    id: user.id,
                    email: user.email
                }
            });
        } else {
            return sendJson(response, 200, { user: null });
        }

    } catch (error) {
        console.error('Get current user error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
