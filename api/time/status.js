// ============================================
// STATUS API ENDPOINT
// ============================================
// GET /api/time/status
// Gets current work status, year total, and today's session
// Auto-closes stale sessions server-side
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    autoCloseStaleSession,
    checkTimeRestrictions,
    getRestrictionMessage,
    getTimezoneDateTime,
    MAX_DAILY_HOURS,
    WORK_START_HOUR,
    WORK_END_HOUR
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

        // Check for open session and auto-close if stale
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
            const wasClosed = await autoCloseStaleSession(entry);

            if (wasClosed) {
                isWorking = false;
            } else {
                isWorking = true;
                currentSession = {
                    id: entry.id,
                    start_time: entry.start_time,
                    timezone: entry.start_timezone
                };
            }
        }

        // Check current restrictions
        const tz = (currentSession && currentSession.timezone) ||
                   Intl.DateTimeFormat().resolvedOptions().timeZone;

        const restriction = checkTimeRestrictions(tz);
        const restrictionMessage = restriction ? getRestrictionMessage(restriction) : null;

        // Check if already completed a session today (one per day)
        let todaySession = null;
        if (!isWorking) {
            const dayStart = getTimezoneDateTime(new Date(), tz, WORK_START_HOUR, 0);
            const dayEnd = getTimezoneDateTime(new Date(), tz, WORK_END_HOUR, 0);

            if (dayStart && dayEnd) {
                const todayEntry = await sql`
                    SELECT id, start_time, end_time, start_timezone
                    FROM time_entries
                    WHERE user_id = ${user.id}
                    AND end_time IS NOT NULL
                    AND start_time >= ${dayStart.toISOString()}
                    AND start_time < ${dayEnd.toISOString()}
                    ORDER BY start_time DESC
                    LIMIT 1
                `;

                if (todayEntry.rows.length > 0) {
                    const entry = todayEntry.rows[0];
                    todaySession = {
                        id: entry.id,
                        start_time: entry.start_time,
                        end_time: entry.end_time,
                        timezone: entry.start_timezone
                    };
                }
            }
        }

        // Calculate year total
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
            today_session: todaySession,
            year_total_hours: Math.round(yearTotalHours * 100) / 100,
            restriction: restriction,
            restriction_message: restrictionMessage
        });

    } catch (error) {
        console.error('Status error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
