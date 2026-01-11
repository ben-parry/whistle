// ============================================
// ENTRIES API ENDPOINT
// ============================================
// GET /api/time/entries
// Gets all time entries for CSV export (completed sessions only)
//
// Response: {
//   entries: [
//     { date, day_of_week, start_time, end_time, duration_hours },
//     ...
//   ]
// }
// ============================================

const { sql } = require('@vercel/postgres');
const { getCurrentUser, sendJson, sendError } = require('../_helpers');

// Day names for the day_of_week field
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
            return sendError(response, 401, 'You must be logged in to export entries.');
        }

        // ----------------------------------------
        // STEP 2: Get all completed entries
        // ----------------------------------------
        const result = await sql`
            SELECT
                id,
                start_time,
                end_time,
                start_timezone
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            ORDER BY start_time DESC
        `;

        // ----------------------------------------
        // STEP 3: Format entries for export
        // ----------------------------------------
        const entries = result.rows.map(entry => {
            const startDate = new Date(entry.start_time);
            const endDate = new Date(entry.end_time);

            // Calculate duration in hours
            const durationMs = endDate - startDate;
            const durationHours = durationMs / (1000 * 60 * 60);

            // Format date as YYYY-MM-DD
            const dateString = startDate.toISOString().split('T')[0];

            // Get day of week
            const dayOfWeek = DAY_NAMES[startDate.getDay()];

            // Format times as HH:MM (24-hour)
            const formatTime = (date) => {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            };

            return {
                date: dateString,
                day_of_week: dayOfWeek,
                start_time: formatTime(startDate),
                end_time: formatTime(endDate),
                duration_hours: Math.round(durationHours * 100) / 100
            };
        });

        return sendJson(response, 200, { entries });

    } catch (error) {
        console.error('Entries error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
