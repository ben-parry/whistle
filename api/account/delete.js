// ============================================
// DELETE ACCOUNT API ENDPOINT
// ============================================
// DELETE /api/account/delete
// Permanently deletes the user's account, all data,
// and sends notification email via Resend
//
// Response: { success: true }
// ============================================

const {
    sql,
    getCurrentUser,
    createLogoutCookie,
    sendJson,
    sendError
} = require('../_helpers');

module.exports = async function handler(request, response) {
    if (request.method !== 'DELETE') {
        return sendError(response, 405, 'Method not allowed. Use DELETE.');
    }

    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return sendError(response, 401, 'You must be logged in to delete your account.');
        }

        // ----------------------------------------
        // Gather info for the notification email before deletion
        // ----------------------------------------
        const statsResult = await sql`
            SELECT
                COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0) as total_hours,
                COUNT(*) as total_sessions
            FROM time_entries
            WHERE user_id = ${user.id}
            AND end_time IS NOT NULL
        `;

        const totalHours = Math.round(parseFloat(statsResult.rows[0].total_hours) * 100) / 100;
        const totalSessions = parseInt(statsResult.rows[0].total_sessions);

        // ----------------------------------------
        // Delete the user (CASCADE deletes time_entries and session_edits)
        // ----------------------------------------
        await sql`
            DELETE FROM users WHERE id = ${user.id}
        `;

        // ----------------------------------------
        // Send notification email via Resend
        // ----------------------------------------
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'Whistle <onboarding@resend.dev>',
                    to: 'ben@benparry.ca',
                    subject: `Whistle — Account Deleted: ${user.name}`,
                    html: `
                        <h2>Account Deletion Notification</h2>
                        <p>A user has deleted their Whistle account.</p>
                        <table style="border-collapse: collapse; margin: 16px 0;">
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Name</td><td>${user.name}</td></tr>
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Email</td><td>${user.email}</td></tr>
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Cute ID</td><td>${user.cute_id}</td></tr>
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Joined</td><td>${new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Total Hours</td><td>${totalHours}</td></tr>
                            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Total Sessions</td><td>${totalSessions}</td></tr>
                        </table>
                        <p style="color: #666; font-size: 14px;">This is an automated notification from Whistle.</p>
                    `
                })
            });
        } catch (emailError) {
            // Don't fail the deletion if email fails
            console.error('Failed to send deletion notification email:', emailError);
        }

        // ----------------------------------------
        // Clear session cookie
        // ----------------------------------------
        response.setHeader('Set-Cookie', createLogoutCookie());

        return sendJson(response, 200, {
            success: true,
            message: 'Your account has been permanently deleted.'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        return sendError(response, 500, 'Something went wrong. Please try again.');
    }
};
