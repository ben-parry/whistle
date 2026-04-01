// ============================================
// CURRENT USER API ENDPOINT
// ============================================
// GET  /api/auth/me  — get current user info
// POST /api/auth/me  — change password
// ============================================

const bcrypt = require('bcryptjs');
const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    MIN_SHIFT_LENGTH,
    MAX_SHIFT_LENGTH,
    MAX_SHIFT_CHANGES_PER_MONTH
} = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method === 'GET') {
        return handleGetUser(request, response);
    }
    if (request.method === 'POST') {
        return handleChangePassword(request, response);
    }
    if (request.method === 'PUT') {
        return handleChangeShiftLength(request, response);
    }
    return sendError(response, 405, 'Method not allowed. Use GET, POST, or PUT.');
};

// ============================================
// GET CURRENT USER
// ============================================

async function handleGetUser(request, response) {
    try {
        const user = await getCurrentUser(request);

        if (user) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

            const changeCount = await sql`
                SELECT COUNT(*) as count
                FROM shift_length_changes
                WHERE user_id = ${user.id}
                AND changed_at >= ${monthStart}
                AND changed_at < ${nextMonthStart}
            `;
            const changesUsed = parseInt(changeCount.rows[0].count);

            return sendJson(response, 200, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    cute_id: user.cute_id,
                    shift_length: user.shift_length,
                    shift_changes_remaining: MAX_SHIFT_CHANGES_PER_MONTH - changesUsed
                }
            });
        } else {
            return sendJson(response, 200, { user: null });
        }

    } catch (error) {
        console.error('Get current user error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
}

// ============================================
// CHANGE PASSWORD
// ============================================

async function handleChangePassword(request, response) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to change your password.');
        }

        const { current_password, new_password } = request.body;

        if (!current_password || !new_password) {
            return sendError(response, 400, 'Current password and new password are required.');
        }

        if (new_password.length < 8) {
            return sendError(response, 400, 'New password must be at least 8 characters.');
        }

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

        const newHash = await bcrypt.hash(new_password, 10);

        await sql`
            UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}
        `;

        return sendJson(response, 200, { success: true });

    } catch (error) {
        console.error('Change password error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
}

// ============================================
// CHANGE SHIFT LENGTH
// ============================================

async function handleChangeShiftLength(request, response) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to change shift length.');
        }

        const { shift_length } = request.body;
        const newLength = parseInt(shift_length, 10);

        if (isNaN(newLength) || newLength < MIN_SHIFT_LENGTH || newLength > MAX_SHIFT_LENGTH) {
            return sendError(response, 400, `Shift length must be between ${MIN_SHIFT_LENGTH} and ${MAX_SHIFT_LENGTH} hours.`);
        }

        if (newLength === user.shift_length) {
            return sendError(response, 400, 'New shift length is the same as the current one.');
        }

        // Count changes this calendar month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

        const changeCount = await sql`
            SELECT COUNT(*) as count
            FROM shift_length_changes
            WHERE user_id = ${user.id}
            AND changed_at >= ${monthStart}
            AND changed_at < ${nextMonthStart}
        `;

        const changesUsed = parseInt(changeCount.rows[0].count);
        if (changesUsed >= MAX_SHIFT_CHANGES_PER_MONTH) {
            return sendError(response, 400, `You can only change your shift length ${MAX_SHIFT_CHANGES_PER_MONTH} times per month.`);
        }

        // Record the change
        await sql`
            INSERT INTO shift_length_changes (user_id, old_length, new_length)
            VALUES (${user.id}, ${user.shift_length}, ${newLength})
        `;

        // Update the user
        await sql`
            UPDATE users SET shift_length = ${newLength} WHERE id = ${user.id}
        `;

        return sendJson(response, 200, {
            success: true,
            shift_length: newLength,
            changes_remaining: MAX_SHIFT_CHANGES_PER_MONTH - changesUsed - 1
        });

    } catch (error) {
        console.error('Change shift length error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
}
