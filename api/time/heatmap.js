// ============================================
// HEATMAP API ENDPOINT
// ============================================
// GET /api/time/heatmap
// Gets daily work totals for the current calendar year (for the heatmap)
//
// Response: {
//   year: 2026,
//   days: {
//     "2026-01-01": 4.5,
//     "2026-01-02": 8.0,
//     ...
//   }
// }
// ============================================

const { sql } = require('@vercel/postgres');
const { getCurrentUser, sendJson, sendError } = require('../_helpers');

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
            return sendError(response, 401, 'You must be logged in to view heatmap.');
        }

        // ----------------------------------------
        // STEP 2: Get current year boundaries
        // ----------------------------------------
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

        // ----------------------------------------
        // STEP 3: Get daily totals
        // ----------------------------------------
        // This query groups entries by date and sums up the hours
        // DATE(start_time) extracts just the date part (no time)
        const result = await sql`
            SELECT
                DATE(start_time) as work_date,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
            AND start_time >= ${yearStart}
            AND start_time < ${yearEnd}
            GROUP BY DATE(start_time)
            ORDER BY work_date
        `;

        // ----------------------------------------
        // STEP 4: Format as an object keyed by date
        // ----------------------------------------
        const days = {};

        result.rows.forEach(row => {
            // Format date as YYYY-MM-DD
            const date = new Date(row.work_date);
            const dateString = date.toISOString().split('T')[0];

            // Round hours to 2 decimal places
            days[dateString] = Math.round(parseFloat(row.total_hours) * 100) / 100;
        });

        return sendJson(response, 200, {
            year: currentYear,
            days: days
        });

    } catch (error) {
        console.error('Heatmap error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
