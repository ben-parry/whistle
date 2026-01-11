// ============================================
// CLOCK IN API ENDPOINT
// ============================================
// POST /api/time/clock-in
// Starts a new work session (clocks in)
//
// Request body: { timezone: "America/New_York" }
// Response: { success: true, entry: { id, start_time } }
// ============================================

const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

// ============================================
// MAIN HANDLER FUNCTION
// ============================================

module.exports = async function handler(request, response) {
    // Only allow POST requests
    if (request.method !== 'POST') {
        return sendError(response, 405, 'Method not allowed. Use POST.');
    }

    try {
        // ----------------------------------------
        // STEP 1: Make sure user is logged in
        // ----------------------------------------
        const user = await getCurrentUser(request);

        if (!user) {
            return sendError(response, 401, 'You must be logged in to clock in.');
        }

        // ----------------------------------------
        // STEP 2: Get the timezone from the request
        // ----------------------------------------
        // The frontend sends the user's timezone (e.g., "America/New_York")
        const { timezone } = request.body;

        if (!timezone || typeof timezone !== 'string') {
            return sendError(response, 400, 'Timezone is required.');
        }

        // ----------------------------------------
        // STEP 3: Check if user is already clocked in
        // ----------------------------------------
        // Look for any entry with no end_time (meaning they're still working)
        const openEntry = await sql`
            SELECT id FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NULL
        `;

        if (openEntry.rows.length > 0) {
            return sendError(response, 400, 'You are already clocked in.');
        }

        // ----------------------------------------
        // STEP 4: Create a new time entry
        // ----------------------------------------
        const result = await sql`
            INSERT INTO time_entries (user_id, start_time, start_timezone)
            VALUES (${user.id}, NOW(), ${timezone})
            RETURNING id, start_time, start_timezone
        `;

        const entry = result.rows[0];

        return sendJson(response, 201, {
            success: true,
            entry: {
                id: entry.id,
                start_time: entry.start_time,
                timezone: entry.start_timezone
            }
        });

    } catch (error) {
        console.error('Clock in error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
