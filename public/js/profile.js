// ============================================
// PROFILE.JS - Profile Page Logic
// ============================================
// This file handles:
// - Loading user info
// - Exporting time entries to CSV
// - Deleting account
// - Logout
// ============================================


// ============================================
// WAIT FOR PAGE TO LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // ============================================
    // GET REFERENCES TO HTML ELEMENTS
    // ============================================

    const userEmail = document.getElementById('user-email');
    const exportButton = document.getElementById('export-button');
    const updateEmailButton = document.getElementById('update-email-button');
    const deleteButton = document.getElementById('delete-button');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDelete = document.getElementById('cancel-delete');
    const confirmDelete = document.getElementById('confirm-delete');
    const logoutButton = document.getElementById('logout-button');


    // ============================================
    // CHECK IF LOGGED IN AND LOAD USER INFO
    // ============================================

    checkAuth();

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (!data.user) {
                // Not logged in, redirect to login page
                window.location.href = '/index.html';
                return;
            }

            // Display user email
            userEmail.textContent = data.user.email;

        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/index.html';
        }
    }


    // ============================================
    // REQUEST EMAIL CHANGE
    // ============================================

    updateEmailButton.addEventListener('click', function() {
        const currentEmail = userEmail.textContent;
        const subject = encodeURIComponent('Whistle - Email Change Request');
        const body = encodeURIComponent(`Hi,\n\nI would like to change my Whistle account email.\n\nCurrent email: ${currentEmail}\nNew email: [please enter your new email here]\n\nThank you.`);
        window.location.href = `mailto:ben@benparry.ca?subject=${subject}&body=${body}`;
    });


    // ============================================
    // EXPORT TO CSV
    // ============================================

    exportButton.addEventListener('click', async function() {
        // Disable button while processing
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';

        try {
            // Fetch all time entries
            const response = await fetch('/api/time/entries');
            const data = await response.json();

            if (!response.ok) {
                alert(data.error || 'Failed to export data');
                return;
            }

            // Convert entries to CSV format
            const csv = convertToCSV(data.entries);

            // Download the CSV file (with user's email in filename)
            const email = userEmail.textContent;
            downloadCSV(csv, `${email}-whistle-time-entries.csv`);

        } catch (error) {
            console.error('Export error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            // Re-enable button
            exportButton.disabled = false;
            exportButton.textContent = 'Export to CSV';
        }
    });

    function convertToCSV(entries) {
        // CSV header row
        const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Duration (Hours)'];

        // Convert each entry to a CSV row
        const rows = entries.map(entry => {
            return [
                entry.date,
                entry.day_of_week,
                entry.start_time,
                entry.end_time,
                entry.duration_hours
            ];
        });

        // Combine headers and rows
        const allRows = [headers, ...rows];

        // Convert to CSV string
        // Each value is wrapped in quotes to handle any commas in the data
        const csvContent = allRows.map(row => {
            return row.map(value => {
                // Escape any quotes in the value
                const escaped = String(value).replace(/"/g, '""');
                return '"' + escaped + '"';
            }).join(',');
        }).join('\n');

        return csvContent;
    }

    function downloadCSV(csv, filename) {
        // Create a Blob (file-like object) from the CSV string
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

        // Create a temporary link element
        const link = document.createElement('a');

        // Create a URL for the blob
        const url = URL.createObjectURL(blob);

        // Set link attributes
        link.href = url;
        link.download = filename;

        // Add link to page, click it, then remove it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        URL.revokeObjectURL(url);
    }


    // ============================================
    // DELETE ACCOUNT
    // ============================================

    // Show modal when delete button is clicked
    deleteButton.addEventListener('click', function() {
        deleteModal.hidden = false;
    });

    // Hide modal when cancel is clicked
    cancelDelete.addEventListener('click', function() {
        deleteModal.hidden = true;
    });

    // Hide modal when clicking outside the modal content
    deleteModal.addEventListener('click', function(event) {
        // Only close if clicking the backdrop (not the modal content)
        if (event.target === deleteModal) {
            deleteModal.hidden = true;
        }
    });

    // Actually delete the account when confirmed
    confirmDelete.addEventListener('click', async function() {
        // Disable button while processing
        confirmDelete.disabled = true;
        confirmDelete.textContent = 'Deleting...';

        try {
            const response = await fetch('/api/account/delete', {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                // Account deleted, redirect to login
                alert('Your account has been deleted.');
                window.location.href = '/index.html';
            } else {
                alert(data.error || 'Failed to delete account');
                deleteModal.hidden = true;
            }

        } catch (error) {
            console.error('Delete error:', error);
            alert('Something went wrong. Please try again.');
            deleteModal.hidden = true;
        } finally {
            confirmDelete.disabled = false;
            confirmDelete.textContent = 'Yes, Delete My Account';
        }
    });


    // ============================================
    // LOGOUT
    // ============================================

    logoutButton.addEventListener('click', async function() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST'
            });

            window.location.href = '/index.html';

        } catch (error) {
            console.error('Logout error:', error);
            // Redirect anyway
            window.location.href = '/index.html';
        }
    });

});
