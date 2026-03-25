// ============================================
// CLOCK OUT API ENDPOINT
// ============================================
// POST /api/time/clock-out
// Ends the current work session
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    get9pmCutoff,
    MAX_DAILY_HOURS
} = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to clock out.');
        }

        // Find open entry
        const openEntry = await sql`
            SELECT id, start_time, start_timezone
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NULL
        `;

        if (openEntry.rows.length === 0) {
            return sendError(response, 400, 'You are not currently clocked in.');
        }

        const entry = openEntry.rows[0];
        const startTime = new Date(entry.start_time);
        const now = new Date();
        let endTime = now;

        // Cap at 9pm in user's timezone
        const cutoff9pm = get9pmCutoff(entry.start_time, entry.start_timezone);
        if (cutoff9pm && endTime > cutoff9pm) {
            endTime = cutoff9pm;
        }

        // Cap at 12 hours from start
        const cutoff12h = new Date(startTime.getTime() + MAX_DAILY_HOURS * 60 * 60 * 1000);
        if (endTime > cutoff12h) {
            endTime = cutoff12h;
        }

        // Ensure end_time is not before start_time
        if (endTime < startTime) {
            endTime = startTime;
        }

        // Update the entry
        const result = await sql`
            UPDATE time_entries
            SET end_time = ${endTime.toISOString()}
            WHERE id = ${entry.id}
            RETURNING id, start_time, end_time
        `;

        const updatedEntry = result.rows[0];
        const start = new Date(updatedEntry.start_time);
        const end = new Date(updatedEntry.end_time);
        const durationHours = (end - start) / (1000 * 60 * 60);

        return sendJson(response, 200, {
            success: true,
            entry: {
                id: updatedEntry.id,
                start_time: updatedEntry.start_time,
                end_time: updatedEntry.end_time,
                duration_hours: Math.round(durationHours * 100) / 100
            }
        });

    } catch (error) {
        console.error('Clock out error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
