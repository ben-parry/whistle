// ============================================
// TODAY'S LEADERBOARD API ENDPOINT
// ============================================
// GET /api/leaderboard/today?timezone=America/Toronto
// Public endpoint — no auth required
// Returns all users with activity today
//
// Response: {
//   entries: [{
//     name, cute_id, total_hours_today,
//     is_active, active_since
//   }]
// }
// ============================================

const { sql, sendJson, sendError } = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    try {
        // Get timezone from query param (defaults to UTC)
        const timezone = request.query.timezone || 'UTC';

        // Calculate today's boundaries in the given timezone
        let todayStart, todayEnd;
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const todayStr = formatter.format(now); // YYYY-MM-DD

            // Create boundaries
            todayStart = new Date(`${todayStr}T00:00:00`);
            todayEnd = new Date(`${todayStr}T23:59:59.999`);

            // Convert to UTC by finding the offset
            const utcFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });

            const startParts = utcFormatter.formatToParts(todayStart);
            const sYear = parseInt(startParts.find(p => p.type === 'year').value);
            const sMonth = parseInt(startParts.find(p => p.type === 'month').value) - 1;
            const sDay = parseInt(startParts.find(p => p.type === 'day').value);
            const sHour = parseInt(startParts.find(p => p.type === 'hour').value);
            const sMinute = parseInt(startParts.find(p => p.type === 'minute').value);

            const tzTime = new Date(Date.UTC(sYear, sMonth, sDay, sHour, sMinute));
            const offset = tzTime - todayStart;

            todayStart = new Date(todayStart.getTime() - offset);
            todayEnd = new Date(todayEnd.getTime() - offset);
        } catch (error) {
            // Fall back to UTC
            const now = new Date();
            todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        }

        // Get completed sessions today + any active sessions
        const result = await sql`
            SELECT
                u.name,
                u.cute_id,
                COALESCE(
                    SUM(
                        CASE WHEN te.end_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600
                        ELSE 0 END
                    ),
                    0
                ) as completed_hours,
                MAX(CASE WHEN te.end_time IS NULL THEN te.start_time ELSE NULL END) as active_since
            FROM users u
            INNER JOIN time_entries te ON te.user_id = u.id
            WHERE (
                (te.end_time IS NOT NULL AND te.start_time >= ${todayStart.toISOString()} AND te.start_time < ${todayEnd.toISOString()})
                OR te.end_time IS NULL
            )
            GROUP BY u.id, u.name, u.cute_id
            ORDER BY completed_hours DESC
        `;

        const entries = result.rows.map(row => ({
            name: row.name,
            cute_id: row.cute_id,
            total_hours_today: Math.round(parseFloat(row.completed_hours) * 100) / 100,
            is_active: row.active_since !== null,
            active_since: row.active_since
        }));

        return sendJson(response, 200, { entries });

    } catch (error) {
        console.error('Today leaderboard error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
