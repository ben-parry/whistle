// ============================================
// CLOCK OUT API ENDPOINT
// ============================================
// POST /api/time/clock-out
// Ends the current work session (clocks out)
//
// Response: { success: true, entry: { id, start_time, end_time, duration_hours } }
// ============================================

const { sql, getCurrentUser, sendJson, sendError } = require('../_helpers');

// Maximum shift length in hours
const MAX_SHIFT_HOURS = 15;

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
            return sendError(response, 401, 'You must be logged in to clock out.');
        }

        // ----------------------------------------
        // STEP 2: Find the open time entry
        // ----------------------------------------
        const openEntry = await sql`
            SELECT id, start_time, start_timezone
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NULL
        `;

        if (openEntry.rows.length === 0) {
            return sendError(response, 400, 'You are not currently clocked in.');
        }

        const entry = openEntry.rows[0];

        // ----------------------------------------
        // STEP 3: Calculate the end time
        // ----------------------------------------
        // Check if we need to cap at 15 hours
        const startTime = new Date(entry.start_time);
        const now = new Date();
        const hoursWorked = (now - startTime) / (1000 * 60 * 60); // Convert ms to hours

        let endTime;
        if (hoursWorked > MAX_SHIFT_HOURS) {
            // Cap at 15 hours from start time
            endTime = new Date(startTime.getTime() + (MAX_SHIFT_HOURS * 60 * 60 * 1000));
        } else {
            endTime = now;
        }

        // ----------------------------------------
        // STEP 4: Update the entry with end time
        // ----------------------------------------
        const result = await sql`
            UPDATE time_entries
            SET end_time = ${endTime.toISOString()}
            WHERE id = ${entry.id}
            RETURNING id, start_time, end_time
        `;

        const updatedEntry = result.rows[0];

        // Calculate duration for the response
        const start = new Date(updatedEntry.start_time);
        const end = new Date(updatedEntry.end_time);
        const durationHours = (end - start) / (1000 * 60 * 60);

        return sendJson(response, 200, {
            success: true,
            entry: {
                id: updatedEntry.id,
                start_time: updatedEntry.start_time,
                end_time: updatedEntry.end_time,
                duration_hours: Math.round(durationHours * 100) / 100 // Round to 2 decimals
            }
        });

    } catch (error) {
        console.error('Clock out error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
