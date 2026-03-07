// ============================================
// CLOCK OUT API ENDPOINT
// ============================================
// POST /api/time/clock-out
// Ends the current work session
//
// Request body: { auto: true } (optional, for auto clock-out)
// Response: { success: true, entry: { id, start_time, end_time, duration_hours } }
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    checkTimeRestrictions,
    getRestrictionMessage,
    get9pmCutoff,
    getHoursWorkedOnDate,
    getTimezoneDateTime,
    MAX_DAILY_HOURS,
    WORK_END_HOUR
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
            return sendError(response, 401, 'You must be logged in to clock out.');
        }

        // ----------------------------------------
        // Find open entry
        // ----------------------------------------
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
        const isAuto = request.body && request.body.auto === true;

        // ----------------------------------------
        // Check time restrictions (unless auto clock-out)
        // ----------------------------------------
        if (!isAuto && entry.start_timezone) {
            const restriction = checkTimeRestrictions(entry.start_timezone);
            if (restriction && restriction !== 'after_hours') {
                // Allow clock-out after hours (they need to be able to stop)
                // but block on Sundays (auto-close should handle that)
                if (restriction === 'sunday') {
                    return sendError(response, 400, getRestrictionMessage(restriction));
                }
            }
        }

        // ----------------------------------------
        // Calculate end time with caps
        // ----------------------------------------
        const startTime = new Date(entry.start_time);
        const now = new Date();
        let endTime = now;

        // Cap at 9pm in user's timezone
        const cutoff9pm = get9pmCutoff(entry.start_time, entry.start_timezone);
        if (cutoff9pm && endTime > cutoff9pm) {
            endTime = cutoff9pm;
        }

        // Cap at 12 hours total for the day
        const hoursAlreadyWorked = await getHoursWorkedOnDate(user.id, startTime, entry.start_timezone);
        const currentSessionHours = (endTime - startTime) / (1000 * 60 * 60);
        const totalIfClockedOut = hoursAlreadyWorked + currentSessionHours;

        if (totalIfClockedOut > MAX_DAILY_HOURS) {
            const allowedHours = MAX_DAILY_HOURS - hoursAlreadyWorked;
            if (allowedHours > 0) {
                endTime = new Date(startTime.getTime() + (allowedHours * 60 * 60 * 1000));
            } else {
                endTime = startTime; // Edge case: already at limit
            }
        }

        // Ensure end_time is not before start_time
        if (endTime < startTime) {
            endTime = startTime;
        }

        // ----------------------------------------
        // Update the entry
        // ----------------------------------------
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
