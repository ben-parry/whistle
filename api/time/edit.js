// ============================================
// EDIT SESSION API ENDPOINT
// ============================================
// PUT /api/time/edit
// Edit a session's start and/or end time
// Limited to 3 edits per calendar month
// Only sessions from current + previous calendar month
//
// Request body: { entry_id, start_time, end_time }
// Response: { success: true, entry: { ... }, edits_remaining }
// ============================================

const {
    sql,
    getCurrentUser,
    sendJson,
    sendError,
    MAX_DAILY_HOURS,
    WORK_START_HOUR,
    WORK_END_HOUR
} = require('../_helpers');

const MAX_EDITS_PER_MONTH = 3;

// Check if a timestamp falls within allowed hours (5am-9pm) and not on Sunday
function validateTimeRules(dateObj, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            hour: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(dateObj);
        const weekday = parts.find(p => p.type === 'weekday').value;
        const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);

        if (weekday === 'Sun') {
            return 'Sessions cannot be on Sundays.';
        }
        if (hour < WORK_START_HOUR) {
            return 'Session times must be after 5:00 AM.';
        }
        if (hour >= WORK_END_HOUR) {
            return 'Session times must be before 9:00 PM.';
        }
        return null;
    } catch (error) {
        return null; // Fail open
    }
}

module.exports = async function handler(request, response) {
    if (request.method !== 'PUT') {
        return sendError(response, 405, 'Method not allowed. Use PUT.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to edit sessions.');
        }

        const { entry_id, start_time, end_time } = request.body;

        if (!entry_id || !start_time || !end_time) {
            return sendError(response, 400, 'Entry ID, start time, and end time are required.');
        }

        // ----------------------------------------
        // Verify the entry belongs to the user and is editable
        // ----------------------------------------
        const entryResult = await sql`
            SELECT id, user_id, start_time, end_time, start_timezone
            FROM time_entries
            WHERE id = ${entry_id}
            AND user_id = ${user.id}
            AND end_time IS NOT NULL
        `;

        if (entryResult.rows.length === 0) {
            return sendError(response, 404, 'Session not found or cannot be edited (must be completed).');
        }

        const entry = entryResult.rows[0];

        // ----------------------------------------
        // Check session is from current or previous calendar month
        // ----------------------------------------
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const entryDate = new Date(entry.start_time);
        const entryMonth = entryDate.getMonth();
        const entryYear = entryDate.getFullYear();

        const isCurrentMonth = entryYear === currentYear && entryMonth === currentMonth;
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const isPreviousMonth = entryYear === prevMonthYear && entryMonth === prevMonth;

        if (!isCurrentMonth && !isPreviousMonth) {
            return sendError(response, 400, 'Only sessions from the current or previous calendar month can be edited.');
        }

        // ----------------------------------------
        // Check edit count for this month
        // ----------------------------------------
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
        const nextMonthStart = new Date(currentYear, currentMonth + 1, 1).toISOString();

        const editCount = await sql`
            SELECT COUNT(*) as count
            FROM session_edits
            WHERE user_id = ${user.id}
            AND edited_at >= ${monthStart}
            AND edited_at < ${nextMonthStart}
        `;

        const editsUsed = parseInt(editCount.rows[0].count);
        if (editsUsed >= MAX_EDITS_PER_MONTH) {
            return sendError(response, 400, `You have used all ${MAX_EDITS_PER_MONTH} edits for this month.`);
        }

        // ----------------------------------------
        // Validate new times
        // ----------------------------------------
        const newStart = new Date(start_time);
        const newEnd = new Date(end_time);

        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
            return sendError(response, 400, 'Invalid date format.');
        }

        if (newEnd <= newStart) {
            return sendError(response, 400, 'End time must be after start time.');
        }

        const timezone = entry.start_timezone;

        // Check time rules for both start and end
        const startError = validateTimeRules(newStart, timezone);
        if (startError) return sendError(response, 400, startError);

        const endError = validateTimeRules(newEnd, timezone);
        if (endError) return sendError(response, 400, endError);

        // Check duration doesn't exceed daily max
        const durationHours = (newEnd - newStart) / (1000 * 60 * 60);
        if (durationHours > MAX_DAILY_HOURS) {
            return sendError(response, 400, `A single session cannot exceed ${MAX_DAILY_HOURS} hours.`);
        }

        // ----------------------------------------
        // Check for overlaps with other sessions
        // ----------------------------------------
        const overlaps = await sql`
            SELECT id FROM time_entries
            WHERE user_id = ${user.id}
            AND id != ${entry_id}
            AND end_time IS NOT NULL
            AND start_time < ${newEnd.toISOString()}
            AND end_time > ${newStart.toISOString()}
        `;

        if (overlaps.rows.length > 0) {
            return sendError(response, 400, 'This edit would overlap with another session.');
        }

        // ----------------------------------------
        // Check total daily hours with edit applied
        // ----------------------------------------
        // Get all other sessions on the same day
        const dayStart = new Date(newStart);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const otherHours = await sql`
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600),
                0
            ) as total_hours
            FROM time_entries
            WHERE user_id = ${user.id}
            AND id != ${entry_id}
            AND end_time IS NOT NULL
            AND start_time >= ${dayStart.toISOString()}
            AND start_time < ${dayEnd.toISOString()}
        `;

        const otherDayHours = parseFloat(otherHours.rows[0].total_hours);
        if (otherDayHours + durationHours > MAX_DAILY_HOURS) {
            return sendError(response, 400, `This edit would exceed the ${MAX_DAILY_HOURS}-hour daily limit.`);
        }

        // ----------------------------------------
        // Record the edit and apply changes
        // ----------------------------------------
        await sql`
            INSERT INTO session_edits (user_id, entry_id, old_start_time, old_end_time, new_start_time, new_end_time)
            VALUES (${user.id}, ${entry_id}, ${entry.start_time}, ${entry.end_time}, ${newStart.toISOString()}, ${newEnd.toISOString()})
        `;

        await sql`
            UPDATE time_entries
            SET start_time = ${newStart.toISOString()}, end_time = ${newEnd.toISOString()}
            WHERE id = ${entry_id}
        `;

        return sendJson(response, 200, {
            success: true,
            entry: {
                id: entry_id,
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString()
            },
            edits_remaining: MAX_EDITS_PER_MONTH - editsUsed - 1
        });

    } catch (error) {
        console.error('Edit session error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
