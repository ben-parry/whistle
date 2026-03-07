// ============================================
// GET CURRENT USER API ENDPOINT
// ============================================
// GET /api/auth/me
// Returns the currently logged-in user's info
//
// Response (logged in): { user: { id, email, name, cute_id } }
// Response (not logged in): { user: null }
// ============================================

const { getCurrentUser, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const user = await getCurrentUser(request);

        if (user) {
            return sendJson(response, 200, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    cute_id: user.cute_id
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
