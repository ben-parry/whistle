// ============================================
// LEADERBOARD API ENDPOINT
// ============================================
// GET /api/leaderboard?view=year    — yearly rankings
// GET /api/leaderboard?view=today   — today's activity
// Public endpoint — no auth required
// ============================================

const { sql, sendJson, sendError, autoCloseAllStaleSessions } = require('./_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'GET') {
        return sendError(response, 405, 'Method not allowed. Use GET.');
    }

    // Auto-close any stale sessions before computing leaderboard data
    await autoCloseAllStaleSessions();

    const view = request.query.view || 'year';

    if (view === 'today') {
        return handleToday(request, response);
    }
    return handleYear(request, response);
};

// ============================================
// YEARLY RANKINGS
// ============================================

async function handleYear(request, response) {
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
}

// ============================================
// TODAY'S ACTIVITY
// ============================================

async function handleToday(request, response) {
    try {
        const timezone = request.query.timezone || 'UTC';

        let todayStart, todayEnd;
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const todayStr = formatter.format(now);

            todayStart = new Date(`${todayStr}T00:00:00`);
            todayEnd = new Date(`${todayStr}T23:59:59.999`);

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
            const now = new Date();
            todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        }

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
}
