// ============================================
// STATUS API ENDPOINT
// ============================================
// GET /api/time/status
// Gets current work status and year total
// Auto-closes stale sessions (past 9pm)
//
// Response: {
//   is_working, current_session, year_total_hours,
//   restriction, restriction_message
// }
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    autoCloseSessionAt9pm,
    checkTimeRestrictions,
    getRestrictionMessage,
    getHoursWorkedOnDate,
    MAX_DAILY_HOURS
} = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to view status.');
        }

        // ----------------------------------------
        // Check for open session
        // ----------------------------------------
        const openEntry = await sql`
            SELECT id, start_time, start_timezone
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NULL
        `;

        let isWorking = false;
        let currentSession = null;

        if (openEntry.rows.length > 0) {
            const entry = openEntry.rows[0];

            // Try to auto-close at 9pm if past cutoff
            const wasClosed = await autoCloseSessionAt9pm(entry);

            if (wasClosed) {
                isWorking = false;
                currentSession = null;
            } else {
                const startTime = new Date(entry.start_time);
                const now = new Date();
                const elapsedSeconds = (now - startTime) / 1000;

                isWorking = true;
                currentSession = {
                    id: entry.id,
                    start_time: entry.start_time,
                    timezone: entry.start_timezone,
                    elapsed_seconds: Math.floor(elapsedSeconds)
                };
            }
        }

        // ----------------------------------------
        // Check current restrictions
        // ----------------------------------------
        // Use a default timezone for restriction check when not working
        const tz = (currentSession && currentSession.timezone) ||
                   Intl.DateTimeFormat().resolvedOptions().timeZone;

        const restriction = checkTimeRestrictions(tz);
        const restrictionMessage = restriction ? getRestrictionMessage(restriction) : null;

        // Check daily hours limit
        let dailyLimitReached = false;
        if (!restriction) {
            const hoursToday = await getHoursWorkedOnDate(user.id, new Date(), tz);
            if (hoursToday >= MAX_DAILY_HOURS) {
                dailyLimitReached = true;
            }
        }

        // ----------------------------------------
        // Calculate year total
        // ----------------------------------------
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

        const totalResult = await sql`
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600),
                0
            ) as total_hours
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            AND start_time >= ${yearStart}
            AND start_time < ${yearEnd}
        `;

        const yearTotalHours = parseFloat(totalResult.rows[0].total_hours);

        return sendJson(response, 200, {
            is_working: isWorking,
            current_session: currentSession,
            year_total_hours: Math.round(yearTotalHours * 100) / 100,
            restriction: restriction,
            restriction_message: restrictionMessage,
            daily_limit_reached: dailyLimitReached
        });

    } catch (error) {
        console.error('Status error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
