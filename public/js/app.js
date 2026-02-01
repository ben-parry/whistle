// ============================================
// APP.JS - Main Punch Clock Logic
// ============================================
// This file handles:
// - Checking login status
// - Clock in / clock out functionality
// - Displaying elapsed time
// - Loading year totals
// - Rendering the heatmap
// - Logout
// ============================================


// ============================================
// GLOBAL VARIABLES
// ============================================

// Timer for updating elapsed time every second
let elapsedTimer = null;

// When the current session started (if working)
let sessionStartTime = null;

// Whether the user is currently working
let isWorking = false;

// Annual hours goal
const ANNUAL_HOURS_GOAL = 2333;

// ============================================
// WEEKEND RESTRICTION HELPER
// ============================================
// Returns true if clock in/out is currently restricted
// (after 6pm Saturday or all day Sunday in user's local timezone)

function isRestrictedTime() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // Sunday - all day restricted
    if (dayOfWeek === 0) {
        return true;
    }

    // Saturday after 6pm (18:00) - restricted
    if (dayOfWeek === 6 && hour >= 18) {
        return true;
    }

    return false;
}

function getRestrictionMessage() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    if (dayOfWeek === 0) {
        return 'Clock in/out is not available on Sundays.';
    }
    if (dayOfWeek === 6) {
        return 'Clock in/out is not available after 6pm on Saturdays.';
    }
    return '';
}


// ============================================
// WAIT FOR PAGE TO LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // ============================================
    // GET REFERENCES TO HTML ELEMENTS
    // ============================================

    const statusText = document.getElementById('status-text');
    const elapsedTime = document.getElementById('elapsed-time');
    const punchButton = document.getElementById('punch-button');
    const punchButtonText = document.getElementById('punch-button-text');
    const yearTotal = document.getElementById('year-total');
    const currentYearSpan = document.getElementById('current-year');
    const progressBar = document.getElementById('progress-bar');
    const logoutButton = document.getElementById('logout-button');
    const heatmapGrid = document.getElementById('heatmap-grid');
    const heatmapMonths = document.getElementById('heatmap-months');


    // ============================================
    // CHECK IF LOGGED IN
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

            // User is logged in, load the app data
            loadStatus();
            loadHeatmap();

        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/index.html';
        }
    }


    // ============================================
    // LOAD CURRENT STATUS
    // ============================================

    async function loadStatus() {
        try {
            const response = await fetch('/api/time/status');
            const data = await response.json();

            // Update year display
            const currentYear = new Date().getFullYear();
            currentYearSpan.textContent = currentYear;

            // Update year total
            yearTotal.textContent = formatHours(data.year_total_hours);

            // Update progress bar (capped at 100%)
            const progressPercent = Math.min((data.year_total_hours / ANNUAL_HOURS_GOAL) * 100, 100);
            progressBar.style.width = progressPercent + '%';
            progressBar.title = `${formatHours(data.year_total_hours)} of ${ANNUAL_HOURS_GOAL} hours (${Math.round(progressPercent)}%)`;

            // Update working status
            isWorking = data.is_working;

            // Check for weekend restriction
            const restricted = isRestrictedTime();

            if (isWorking && data.current_session) {
                // User is currently working
                if (restricted) {
                    // Auto clock-out during restricted time
                    await autoClockOut();
                    return;
                }
                sessionStartTime = new Date(data.current_session.start_time);
                showWorkingState();
                startElapsedTimer();
            } else {
                // User is not working
                showNotWorkingState(restricted);
            }

            // Enable the punch button (unless restricted)
            punchButton.disabled = restricted;

        } catch (error) {
            console.error('Load status error:', error);
            statusText.textContent = 'Error loading status';
        }
    }


    // ============================================
    // PUNCH BUTTON CLICK
    // ============================================

    punchButton.addEventListener('click', async function() {
        // Check for weekend restriction
        if (isRestrictedTime()) {
            alert(getRestrictionMessage());
            return;
        }

        // Disable button while processing
        punchButton.disabled = true;

        try {
            if (isWorking) {
                // Clock out
                await clockOut();
            } else {
                // Clock in
                await clockIn();
            }
        } catch (error) {
            console.error('Punch error:', error);
            alert('Something went wrong. Please try again.');
        }

        // Re-enable button
        punchButton.disabled = false;
    });


    // ============================================
    // CLOCK IN
    // ============================================

    async function clockIn() {
        // Get user's timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await fetch('/api/time/clock-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timezone })
        });

        const data = await response.json();

        if (response.ok) {
            // Successfully clocked in
            isWorking = true;
            sessionStartTime = new Date(data.entry.start_time);
            showWorkingState();
            startElapsedTimer();
        } else {
            alert(data.error || 'Failed to clock in');
        }
    }


    // ============================================
    // CLOCK OUT
    // ============================================

    async function clockOut() {
        const response = await fetch('/api/time/clock-out', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.ok) {
            // Successfully clocked out
            isWorking = false;
            sessionStartTime = null;
            showNotWorkingState();
            stopElapsedTimer();

            // Reload status to update year total and heatmap
            loadStatus();
            loadHeatmap();
        } else {
            alert(data.error || 'Failed to clock out');
        }
    }


    // ============================================
    // AUTO CLOCK OUT (for weekend restriction)
    // ============================================

    async function autoClockOut() {
        try {
            const response = await fetch('/api/time/clock-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ auto: true })
            });

            if (response.ok) {
                // Successfully auto-clocked out
                isWorking = false;
                sessionStartTime = null;
                showNotWorkingState(true);
                stopElapsedTimer();

                // Reload heatmap
                loadHeatmap();
            }
        } catch (error) {
            console.error('Auto clock-out error:', error);
        }
    }


    // ============================================
    // UI STATE HELPERS
    // ============================================

    function showWorkingState() {
        statusText.textContent = 'Currently Working';
        statusText.classList.add('working');
        statusText.classList.remove('not-working');

        punchButtonText.textContent = 'Clock Out';
        punchButton.classList.add('working');
        punchButton.classList.remove('not-working');

        elapsedTime.hidden = false;
    }

    function showNotWorkingState(restricted = false) {
        if (restricted) {
            statusText.textContent = getRestrictionMessage();
            statusText.classList.add('not-working');
            statusText.classList.remove('working');

            punchButtonText.textContent = 'Clock In';
            punchButton.classList.add('not-working');
            punchButton.classList.remove('working');
            punchButton.disabled = true;
        } else {
            statusText.textContent = 'Not Working';
            statusText.classList.add('not-working');
            statusText.classList.remove('working');

            punchButtonText.textContent = 'Clock In';
            punchButton.classList.add('not-working');
            punchButton.classList.remove('working');
        }

        elapsedTime.hidden = true;
        elapsedTime.textContent = '00:00:00';
    }


    // ============================================
    // ELAPSED TIME TIMER
    // ============================================

    function startElapsedTimer() {
        // Clear any existing timer
        stopElapsedTimer();

        // Update immediately
        updateElapsedTime();

        // Then update every second
        elapsedTimer = setInterval(updateElapsedTime, 1000);
    }

    function stopElapsedTimer() {
        if (elapsedTimer) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
        }
    }

    function updateElapsedTime() {
        if (!sessionStartTime) return;

        const now = new Date();
        const diffMs = now - sessionStartTime;
        const diffSeconds = Math.floor(diffMs / 1000);

        // Convert to hours:minutes:seconds
        const hours = Math.floor(diffSeconds / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;

        // Format with leading zeros
        const formatted =
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');

        elapsedTime.textContent = formatted;
    }


    // ============================================
    // FORMAT HOURS
    // ============================================

    function formatHours(hours) {
        // Round to 1 decimal place
        const rounded = Math.round(hours * 10) / 10;

        // Format nicely
        if (rounded === 0) {
            return '0';
        } else if (rounded === Math.floor(rounded)) {
            // Whole number
            return rounded.toString();
        } else {
            // Has decimal
            return rounded.toFixed(1);
        }
    }


    // ============================================
    // LOAD AND RENDER HEATMAP
    // ============================================

    async function loadHeatmap() {
        try {
            const response = await fetch('/api/time/heatmap');
            const data = await response.json();

            renderHeatmap(data.year, data.days);

        } catch (error) {
            console.error('Load heatmap error:', error);
        }
    }

    function renderHeatmap(year, daysData) {
        // Clear existing grid
        heatmapGrid.innerHTML = '';
        heatmapMonths.innerHTML = '';

        // Get first day of the year
        const firstDay = new Date(year, 0, 1);
        const lastDay = new Date(year, 11, 31);
        const today = new Date();

        // Calculate the number of weeks
        // We need to start from the Sunday of the week containing Jan 1
        const startOffset = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Create all day cells
        // GitHub-style: columns are weeks, rows are days of week
        const weeks = [];
        let currentWeek = [];

        // Add empty cells for days before Jan 1
        for (let i = 0; i < startOffset; i++) {
            currentWeek.push(null); // null = empty cell
        }

        // Add all days of the year
        const currentDate = new Date(firstDay);
        while (currentDate <= lastDay) {
            // Format date as YYYY-MM-DD
            const dateString = currentDate.toISOString().split('T')[0];

            // Get hours for this day (0 if no data)
            const hours = daysData[dateString] || 0;

            // Determine if this is in the future
            const isFuture = currentDate > today;

            currentWeek.push({
                date: dateString,
                hours: hours,
                isFuture: isFuture
            });

            // If we've completed a week (7 days), start a new one
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Add any remaining days in the last week
        if (currentWeek.length > 0) {
            // Fill remaining days with nulls
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        // Render the grid
        // CSS grid uses grid-auto-flow: column, so we render week by week
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const day = weeks[weekIndex][dayOfWeek];

                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                // Add sunday class for Sunday cells (dayOfWeek 0)
                if (dayOfWeek === 0) {
                    cell.classList.add('sunday');
                }

                if (day === null) {
                    // Empty cell (before Jan 1 or after Dec 31)
                    cell.classList.add('empty');
                } else if (day.isFuture) {
                    // Future day
                    cell.classList.add('future');
                    cell.title = day.date;
                } else {
                    // Past or today
                    const level = getHeatLevel(day.hours);
                    cell.classList.add('level-' + level);
                    cell.title = day.date + ': ' + formatHours(day.hours) + ' hours';
                }

                heatmapGrid.appendChild(cell);
            }
        }

        // Render month labels
        renderMonthLabels(weeks, year);
    }

    function getHeatLevel(hours) {
        // Levels 0-4 based on hours (max 15 hours)
        if (hours === 0) return 0;
        if (hours < 2) return 1;
        if (hours < 5) return 2;
        if (hours < 10) return 3;
        return 4;
    }

    function renderMonthLabels(weeks, year) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Find the first week of each month
        let lastMonth = -1;

        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            // Find the first non-null day in this week
            const firstDay = weeks[weekIndex].find(d => d !== null);

            if (firstDay) {
                const month = parseInt(firstDay.date.split('-')[1], 10) - 1; // 0-indexed

                if (month !== lastMonth) {
                    // New month starts in this week
                    const label = document.createElement('span');
                    label.className = 'month-label';
                    label.textContent = monthNames[month];
                    label.style.gridColumn = weekIndex + 1;
                    heatmapMonths.appendChild(label);

                    lastMonth = month;
                }
            }
        }
    }


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
