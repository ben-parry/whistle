// ============================================
// SESSIONS API ENDPOINT
// ============================================
// GET /api/time/sessions
// Returns session history for the profile page
// Also returns edit count for the current month
//
// Response: {
//   sessions: [...],
//   edits_used_this_month, edits_remaining
// }
// ============================================

const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

const MAX_EDITS_PER_MONTH = 3;

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to view sessions.');
        }

        // ----------------------------------------
        // Get all completed sessions, most recent first
        // ----------------------------------------
        const result = await sql`
            SELECT
                id,
                start_time,
                end_time,
                start_timezone,
                created_at
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            ORDER BY start_time DESC
        `;

        // ----------------------------------------
        // Determine which sessions are editable
        // (current + previous calendar month only)
        // ----------------------------------------
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const sessions = result.rows.map(row => {
            const startDate = new Date(row.start_time);
            const endDate = new Date(row.end_time);
            const entryMonth = startDate.getMonth();
            const entryYear = startDate.getFullYear();

            const isCurrentMonth = entryYear === currentYear && entryMonth === currentMonth;
            const isPreviousMonth = entryYear === prevMonthYear && entryMonth === prevMonth;
            const editable = isCurrentMonth || isPreviousMonth;

            const durationMs = endDate - startDate;
            const durationHours = durationMs / (1000 * 60 * 60);

            return {
                id: row.id,
                start_time: row.start_time,
                end_time: row.end_time,
                timezone: row.start_timezone,
                duration_hours: Math.round(durationHours * 100) / 100,
                editable: editable
            };
        });

        // ----------------------------------------
        // Get edit count for this calendar month
        // ----------------------------------------
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
        const nextMonthStart = new Date(currentYear, currentMonth + 1, 1).toISOString();

        const editCount = await sql`
            SELECT COUNT(*) as count
            FROM session_edits
            WHERE user_id = ${user.id}
            AND edited_at >= ${monthStart}
            AND edited_at < ${nextMonthStart}
        `;

        const editsUsed = parseInt(editCount.rows[0].count);

        return sendJson(response, 200, {
            sessions: sessions,
            edits_used_this_month: editsUsed,
            edits_remaining: MAX_EDITS_PER_MONTH - editsUsed
        });

    } catch (error) {
        console.error('Sessions error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
