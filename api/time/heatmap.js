// ============================================
// HEATMAP API ENDPOINT
// ============================================
// GET /api/time/heatmap
// Gets daily work totals for the current calendar year
//
// Response: { year, days: { "2026-01-01": 4.5, ... } }
// ============================================

const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to view heatmap.');
        }

        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

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

        const days = {};
        result.rows.forEach(row => {
            const date = new Date(row.work_date);
            const dateString = date.toISOString().split('T')[0];
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
