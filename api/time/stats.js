// ============================================
// STATS API ENDPOINT
// ============================================
// GET /api/time/stats
// Returns statistics for the profile stats sentence
// ============================================

const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to view stats.');
        }

        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

        // Total distinct days worked
        const daysResult = await sql`
            SELECT COUNT(DISTINCT DATE(start_time)) as total_days
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            AND start_time >= ${yearStart}
            AND start_time < ${yearEnd}
        `;

        // Total hours
        const hoursResult = await sql`
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

        // Median daily working time
        const dailyTotals = await sql`
            SELECT
                DATE(start_time) as work_date,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) as total_minutes
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            AND start_time >= ${yearStart}
            AND start_time < ${yearEnd}
            GROUP BY DATE(start_time)
            ORDER BY total_minutes
        `;

        let medianMinutes = 0;
        if (dailyTotals.rows.length > 0) {
            const minutes = dailyTotals.rows.map(r => parseFloat(r.total_minutes));
            const mid = Math.floor(minutes.length / 2);
            if (minutes.length % 2 === 0) {
                medianMinutes = (minutes[mid - 1] + minutes[mid]) / 2;
            } else {
                medianMinutes = minutes[mid];
            }
        }

        // Median clock-in and clock-out times
        const timesResult = await sql`
            SELECT
                EXTRACT(HOUR FROM start_time) * 60 + EXTRACT(MINUTE FROM start_time) as start_minutes,
                EXTRACT(HOUR FROM end_time) * 60 + EXTRACT(MINUTE FROM end_time) as end_minutes
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            AND start_time >= ${yearStart}
            AND start_time < ${yearEnd}
            ORDER BY start_time
        `;

        let medianClockIn = null;
        let medianClockOut = null;

        if (timesResult.rows.length > 0) {
            const startMins = timesResult.rows.map(r => parseFloat(r.start_minutes)).sort((a, b) => a - b);
            const endMins = timesResult.rows.map(r => parseFloat(r.end_minutes)).sort((a, b) => a - b);

            const midS = Math.floor(startMins.length / 2);
            medianClockIn = startMins.length % 2 === 0
                ? (startMins[midS - 1] + startMins[midS]) / 2
                : startMins[midS];

            const midE = Math.floor(endMins.length / 2);
            medianClockOut = endMins.length % 2 === 0
                ? (endMins[midE - 1] + endMins[midE]) / 2
                : endMins[midE];
        }

        return sendJson(response, 200, {
            year: currentYear,
            total_days: parseInt(daysResult.rows[0].total_days),
            total_hours: Math.floor(parseFloat(hoursResult.rows[0].total_hours)),
            median_minutes: Math.round(medianMinutes),
            median_clock_in_minutes: medianClockIn !== null ? Math.round(medianClockIn) : null,
            median_clock_out_minutes: medianClockOut !== null ? Math.round(medianClockOut) : null
        });

    } catch (error) {
        console.error('Stats error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
