// ============================================
// STATUS API ENDPOINT
// ============================================
// GET /api/time/status
// Gets the current work status and year total
//
// Response: {
//   is_working: true/false,
//   current_session: { start_time, elapsed_seconds } or null,
//   year_total_hours: 123.45
// }
// ============================================

const { sql } = require('@vercel/postgres');
const { getCurrentUser, sendJson, sendError } = require('../_helpers');

// Maximum shift length in hours (for auto-timeout calculation)
const MAX_SHIFT_HOURS = 15;

// ============================================
// MAIN HANDLER FUNCTION
// ============================================

module.exports = async function handler(request, response) {
    // Only allow GET requests
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Make sure user is logged in
        // ----------------------------------------
        const user = await getCurrentUser(request);

        if (!user) {
            return sendError(response, 401, 'You must be logged in to view status.');
        }

        // ----------------------------------------
        // STEP 2: Check for open session
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
            const startTime = new Date(entry.start_time);
            const now = new Date();
            const elapsedSeconds = (now - startTime) / 1000;

            // Check if we've exceeded max shift (auto-timeout)
            const elapsedHours = elapsedSeconds / 3600;

            if (elapsedHours >= MAX_SHIFT_HOURS) {
                // Auto clock-out: set end_time to 15 hours after start
                const endTime = new Date(startTime.getTime() + (MAX_SHIFT_HOURS * 60 * 60 * 1000));
                await sql`
                    UPDATE time_entries
                    SET end_time = ${endTime.toISOString()}
                    WHERE id = ${entry.id}
                `;
                // User is no longer working
                isWorking = false;
                currentSession = null;
            } else {
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
        // STEP 3: Calculate year total (completed sessions only)
        // ----------------------------------------
        // Get the start and end of the current calendar year
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

        // Sum up all completed sessions in this year
        // We use EXTRACT(EPOCH FROM ...) to get duration in seconds
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
            year_total_hours: Math.round(yearTotalHours * 100) / 100 // Round to 2 decimals
        });

    } catch (error) {
        console.error('Status error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
