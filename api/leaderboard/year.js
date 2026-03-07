// ============================================
// YEARLY LEADERBOARD API ENDPOINT
// ============================================
// GET /api/leaderboard/year
// Public endpoint — no auth required
// Returns all users ranked by total hours this year
//
// Response: { year, rankings: [{ name, cute_id, total_hours, total_sessions }] }
// ============================================

const { sql, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01T00:00:00Z`;
        const yearEnd = `${currentYear + 1}-01-01T00:00:00Z`;

        const result = await sql`
            SELECT
                u.name,
                u.cute_id,
                COUNT(te.id) as total_sessions,
                COALESCE(
                    SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600),
                    0
                ) as total_hours
            FROM users u
            LEFT JOIN time_entries te ON te.user_id = u.id
                AND te.end_time IS NOT NULL
                AND te.start_time >= ${yearStart}
                AND te.start_time < ${yearEnd}
            GROUP BY u.id, u.name, u.cute_id
            HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600), 0) > 0
            ORDER BY total_hours DESC
        `;

        const rankings = result.rows.map((row, index) => ({
            rank: index + 1,
            name: row.name,
            cute_id: row.cute_id,
            total_sessions: parseInt(row.total_sessions),
            total_hours: Math.round(parseFloat(row.total_hours) * 100) / 100
        }));

        return sendJson(response, 200, {
            year: currentYear,
            rankings: rankings
        });

    } catch (error) {
        console.error('Yearly leaderboard error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
