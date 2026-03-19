// ============================================
// APP.JS - Main Punch Clock Logic
// ============================================

let elapsedTimer = null;
let sessionStartTime = null;
let isWorking = false;
const ANNUAL_HOURS_GOAL = 2333;
const WORK_START_HOUR = 5;
const WORK_END_HOUR = 21;

// ============================================
// TIME RESTRICTION HELPERS
// ============================================

function isRestrictedTime() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    if (dayOfWeek === 0) return 'sunday';
    if (hour < WORK_START_HOUR) return 'before_hours';
    if (hour >= WORK_END_HOUR) return 'after_hours';
    return null;
}

function getRestrictionMessage(type) {
    switch (type) {
        case 'sunday':
            return 'It is Sunday, let us seize the means of relaxation.';
        case 'before_hours':
            return 'Clock in/out is available from 5:00 AM.';
        case 'after_hours':
            return 'Clock in/out is not available after 9:00 PM.';
        case 'daily_limit':
            return 'You have reached the 12-hour daily maximum.';
        default:
            return '';
    }
}

function getRestrictionHTML(type) {
    let msg = getRestrictionMessage(type);
    if (type === 'sunday') {
        msg += ' <a href="https://x.com/lavitalenta" target="_blank" rel="noopener" class="restriction-link">@lavitalenta</a>';
    }
    return msg;
}


// ============================================
// WAIT FOR PAGE TO LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {

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

    checkAuth();

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (!data.user) {
                window.location.href = '/index.html';
                return;
            }

            // Sunday: hide work UI, show sunday content
            if (new Date().getDay() === 0) {
                const punchSection = document.querySelector('.punch-section');
                const statsSection = document.querySelector('.stats-section');
                const heatmapSection = document.querySelector('.heatmap-section');
                if (punchSection) punchSection.hidden = true;
                if (statsSection) statsSection.hidden = true;
                if (heatmapSection) heatmapSection.hidden = true;
                const sundayContent = document.getElementById('sunday-content');
                if (sundayContent) sundayContent.hidden = false;
                return;
            }

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

            const currentYear = new Date().getFullYear();
            currentYearSpan.textContent = currentYear;

            yearTotal.textContent = formatHours(data.year_total_hours);

            const progressPercent = Math.min((data.year_total_hours / ANNUAL_HOURS_GOAL) * 100, 100);
            progressBar.style.width = progressPercent + '%';
            progressBar.title = `${formatHours(data.year_total_hours)} of ${ANNUAL_HOURS_GOAL} hours (${Math.round(progressPercent)}%)`;

            isWorking = data.is_working;

            const restriction = isRestrictedTime();

            if (isWorking && data.current_session) {
                if (restriction) {
                    await autoClockOut();
                    return;
                }
                sessionStartTime = new Date(data.current_session.start_time);
                showWorkingState();
                startElapsedTimer();
            } else {
                showNotWorkingState(restriction, data.daily_limit_reached);
            }

            punchButton.disabled = !!(restriction || data.daily_limit_reached);

        } catch (error) {
            console.error('Load status error:', error);
            statusText.textContent = 'Error loading status';
        }
    }

    // Set up 9pm auto-close check
    function scheduleAutoCloseCheck() {
        const now = new Date();
        const hour = now.getHours();
        if (hour < WORK_END_HOUR) {
            // Calculate ms until 9pm
            const ninePm = new Date(now);
            ninePm.setHours(WORK_END_HOUR, 0, 0, 0);
            const msUntil9pm = ninePm - now;
            setTimeout(function() {
                if (isWorking) {
                    autoClockOut();
                }
            }, msUntil9pm + 1000); // +1s buffer
        }
    }

    scheduleAutoCloseCheck();


    // ============================================
    // PUNCH BUTTON CLICK
    // ============================================

    punchButton.addEventListener('click', async function() {
        const restriction = isRestrictedTime();
        if (restriction) {
            alert(getRestrictionMessage(restriction));
            return;
        }

        punchButton.disabled = true;

        try {
            if (isWorking) {
                await clockOut();
            } else {
                await clockIn();
            }
        } catch (error) {
            console.error('Punch error:', error);
            alert('Something went wrong. Please try again.');
        }

        punchButton.disabled = false;
    });


    // ============================================
    // CLOCK IN / CLOCK OUT
    // ============================================

    async function clockIn() {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await fetch('/api/time/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone })
        });

        const data = await response.json();

        if (response.ok) {
            isWorking = true;
            sessionStartTime = new Date(data.entry.start_time);
            showWorkingState();
            startElapsedTimer();
            scheduleAutoCloseCheck();
        } else {
            alert(data.error || 'Failed to clock in');
        }
    }

    async function clockOut() {
        const response = await fetch('/api/time/clock-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.ok) {
            isWorking = false;
            sessionStartTime = null;
            showNotWorkingState();
            stopElapsedTimer();
            loadStatus();
            loadHeatmap();
        } else {
            alert(data.error || 'Failed to clock out');
        }
    }

    async function autoClockOut() {
        try {
            const response = await fetch('/api/time/clock-out', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto: true })
            });

            if (response.ok) {
                isWorking = false;
                sessionStartTime = null;
                const restriction = isRestrictedTime();
                showNotWorkingState(restriction);
                stopElapsedTimer();
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
        statusText.innerHTML = 'Currently Working';
        statusText.classList.add('working');
        statusText.classList.remove('not-working');

        punchButtonText.textContent = 'Clock Out';
        punchButton.classList.add('working');
        punchButton.classList.remove('not-working');

        elapsedTime.hidden = false;
    }

    function showNotWorkingState(restriction, dailyLimitReached) {
        if (restriction) {
            statusText.innerHTML = getRestrictionHTML(restriction);
            punchButton.disabled = true;
        } else if (dailyLimitReached) {
            statusText.innerHTML = getRestrictionMessage('daily_limit');
            punchButton.disabled = true;
        } else {
            statusText.innerHTML = 'Not Working';
        }

        statusText.classList.add('not-working');
        statusText.classList.remove('working');

        punchButtonText.textContent = 'Clock In';
        punchButton.classList.add('not-working');
        punchButton.classList.remove('working');

        elapsedTime.hidden = true;
        elapsedTime.textContent = '00:00:00';
    }


    // ============================================
    // ELAPSED TIME TIMER
    // ============================================

    function startElapsedTimer() {
        stopElapsedTimer();
        updateElapsedTime();
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

        const hours = Math.floor(diffSeconds / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;

        elapsedTime.textContent =
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
    }


    // ============================================
    // FORMAT HOURS
    // ============================================

    function formatHours(hours) {
        const rounded = Math.round(hours * 10) / 10;
        if (rounded === 0) return '0';
        if (rounded === Math.floor(rounded)) return rounded.toString();
        return rounded.toFixed(1);
    }


    // ============================================
    // HEATMAP
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
        heatmapGrid.innerHTML = '';
        heatmapMonths.innerHTML = '';

        const firstDay = new Date(year, 0, 1);
        const lastDay = new Date(year, 11, 31);
        const today = new Date();

        const startOffset = firstDay.getDay();
        const weeks = [];
        let currentWeek = [];

        for (let i = 0; i < startOffset; i++) {
            currentWeek.push(null);
        }

        const currentDate = new Date(firstDay);
        while (currentDate <= lastDay) {
            const dateString = currentDate.toISOString().split('T')[0];
            const hours = daysData[dateString] || 0;
            const isFuture = currentDate > today;
            const dayOfWeek = currentDate.getDay();

            currentWeek.push({
                date: dateString,
                hours: hours,
                isFuture: isFuture,
                isSunday: dayOfWeek === 0
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const day = weeks[weekIndex][dayOfWeek];
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                if (day === null) {
                    cell.classList.add('empty');
                } else if (day.isSunday) {
                    // Sundays are always uniformly greyed out
                    cell.classList.add('sunday');
                    cell.title = day.date + ' (Sunday)';
                } else if (day.isFuture) {
                    cell.classList.add('future');
                    cell.title = day.date;
                } else {
                    const level = getHeatLevel(day.hours);
                    cell.classList.add('level-' + level);
                    cell.title = day.date + ': ' + formatHours(day.hours) + ' hours';
                }

                heatmapGrid.appendChild(cell);
            }
        }

        renderMonthLabels(weeks, year);
    }

    function getHeatLevel(hours) {
        if (hours === 0) return 0;
        if (hours < 3) return 1;
        if (hours < 6) return 2;
        if (hours < 10) return 3;
        return 4;
    }

    function renderMonthLabels(weeks, year) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let lastMonth = -1;

        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            const firstDay = weeks[weekIndex].find(d => d !== null);
            if (firstDay) {
                const month = parseInt(firstDay.date.split('-')[1], 10) - 1;
                if (month !== lastMonth) {
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
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/index.html';
        }
    });

});
