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
// WEEKEND RESTRICTION HELPER
// ============================================
// Returns an error message if clock in/out is restricted, null otherwise

function checkWeekendRestriction(timezone) {
    try {
        // Get current time in user's timezone
        const now = new Date();
        const options = { timeZone: timezone, weekday: 'short', hour: 'numeric', hour12: false };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);

        const weekday = parts.find(p => p.type === 'weekday').value;
        const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);

        // Sunday - all day restricted
        if (weekday === 'Sun') {
            return 'Clock in/out is not available on Sundays.';
        }

        // Saturday after 6pm (18:00) - restricted
        if (weekday === 'Sat' && hour >= 18) {
            return 'Clock in/out is not available after 6pm on Saturdays.';
        }

        return null;
    } catch (error) {
        // If timezone is invalid, don't block (fail open for simplicity)
        console.error('Timezone check error:', error);
        return null;
    }
}

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
        // STEP 2.5: Check weekend restriction
        // ----------------------------------------
        // No clock-in after 6pm Saturday or all day Sunday
        const restrictionError = checkWeekendRestriction(timezone);
        if (restrictionError) {
            return sendError(response, 400, restrictionError);
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
