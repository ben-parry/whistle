// ============================================
// CLOCK IN API ENDPOINT
// ============================================
// POST /api/time/clock-in
// Starts a new work session
//
// Request body: { timezone: "America/Toronto" }
// Response: { success: true, entry: { id, start_time } }
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    checkTimeRestrictions,
    getRestrictionMessage,
    getHoursWorkedOnDate,
    MAX_DAILY_HOURS
} = require('../_helpers');

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
            return sendError(response, 401, 'You must be logged in to clock in.');
        }

        // ----------------------------------------
        // Get timezone
        // ----------------------------------------
        const { timezone } = request.body;
        if (!timezone || typeof timezone !== 'string') {
            return sendError(response, 400, 'Timezone is required.');
        }

        // ----------------------------------------
        // Check time restrictions (5am-9pm, no Sundays)
        // ----------------------------------------
        const restriction = checkTimeRestrictions(timezone);
        if (restriction) {
            return sendError(response, 400, getRestrictionMessage(restriction));
        }

        // ----------------------------------------
        // Check if already clocked in
        // ----------------------------------------
        const openEntry = await sql`
            SELECT id FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NULL
        `;

        if (openEntry.rows.length > 0) {
            return sendError(response, 400, 'You are already clocked in.');
        }

        // ----------------------------------------
        // Check 12-hour daily limit
        // ----------------------------------------
        const hoursToday = await getHoursWorkedOnDate(user.id, new Date(), timezone);
        if (hoursToday >= MAX_DAILY_HOURS) {
            return sendError(response, 400, getRestrictionMessage('daily_limit'));
        }

        // ----------------------------------------
        // Create new time entry
        // ----------------------------------------
        const result = await sql`
            INSERT INTO time_entries (user_id, start_time, start_timezone)
            VALUES (${user.id}, NOW(), ${timezone})
            RETURNING id, start_time, start_timezone
        `;

        const entry = result.rows[0];

        return sendJson(response, 201, {
            success: true,
            entry: {
                id: entry.id,
                start_time: entry.start_time,
                timezone: entry.start_timezone
            }
        });

    } catch (error) {
        console.error('Clock in error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
