// ============================================
// APP.JS - Main Punch Clock Logic
// ============================================

const ANNUAL_HOURS_GOAL = 2333;
const WORK_END_HOUR = 21;
const MAX_DAILY_HOURS = 12;

let elapsedTimer = null;
let sessionStartTime = null;
let shiftLength = 8;
let shiftCompleted = false;
let isWorking = false;

// ============================================
// WAIT FOR PAGE TO LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const statusText = document.getElementById('status-text');
    const elapsedTime = document.getElementById('elapsed-time');
    const punchButton = document.getElementById('punch-button');
    const punchButtonText = document.getElementById('punch-button-text');
    const punchTimestamps = document.getElementById('punch-timestamps');
    const punchCompleted = document.getElementById('punch-completed');
    const yearTotal = document.getElementById('year-total');
    const currentYearSpan = document.getElementById('current-year');
    const progressBar = document.getElementById('progress-bar');
    const logoutButton = document.getElementById('logout-button');
    const shiftProgressWrapper = document.getElementById('shift-progress-wrapper');
    const shiftProgressBar = document.getElementById('shift-progress-bar');
    const shiftProgressLabel = document.getElementById('shift-progress-label');
    const shiftCompleteText = document.getElementById('shift-complete-text');

    checkAuth();

    // Re-fetch status when the tab becomes visible again
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && sessionStartTime) {
            loadStatus();
        }
    });

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
                document.querySelector('.punch-section').hidden = true;
                document.querySelector('.stats-section').hidden = true;
                document.getElementById('sunday-content').hidden = false;
                return;
            }

            loadStatus();
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

            shiftLength = data.shift_length || 8;

            currentYearSpan.textContent = new Date().getFullYear();
            yearTotal.textContent = formatHoursDisplay(data.year_total_hours);

            const progressPercent = Math.min((data.year_total_hours / ANNUAL_HOURS_GOAL) * 100, 100);
            progressBar.style.width = progressPercent + '%';
            progressBar.title = formatHoursDisplay(data.year_total_hours) + ' of ' + ANNUAL_HOURS_GOAL + ' hours (' + Math.round(progressPercent) + '%)';

            if (data.is_working && data.current_session) {
                sessionStartTime = new Date(data.current_session.start_time);
                isWorking = true;
                showWorkingState();
                startElapsedTimer();
                scheduleAutoCloseCheck();
            } else if (data.today_session) {
                showCompletedState(data.today_session);
            } else if (data.restriction) {
                showRestrictionState(data.restriction);
            } else {
                showReadyState();
            }

        } catch (error) {
            console.error('Load status error:', error);
            statusText.textContent = 'Error loading status';
        }
    }

    // Schedule auto-close at 9pm
    function scheduleAutoCloseCheck() {
        var now = new Date();
        if (now.getHours() < WORK_END_HOUR) {
            var ninePm = new Date(now);
            ninePm.setHours(WORK_END_HOUR, 0, 0, 0);
            setTimeout(function() {
                loadStatus();
            }, ninePm - now + 2000);
        }
    }


    // ============================================
    // PUNCH BUTTON CLICK
    // ============================================

    punchButton.addEventListener('click', async function() {
        punchButton.disabled = true;

        try {
            if (punchButton.classList.contains('working')) {
                // Warn if clocking out before shift is complete
                if (sessionStartTime && !shiftCompleted) {
                    var elapsedHours = (new Date() - sessionStartTime) / (1000 * 60 * 60);
                    if (elapsedHours < shiftLength) {
                        var remaining = shiftLength - elapsedHours;
                        var remH = Math.floor(remaining);
                        var remM = Math.round((remaining - remH) * 60);
                        var remStr = '';
                        if (remH > 0) remStr += remH + ' hour' + (remH !== 1 ? 's' : '');
                        if (remH > 0 && remM > 0) remStr += ' and ';
                        if (remM > 0 || remH === 0) remStr += remM + ' minute' + (remM !== 1 ? 's' : '');
                        if (!confirm('You still have ' + remStr + ' left on your shift. Clock out anyway?')) {
                            punchButton.disabled = false;
                            return;
                        }
                    }
                }
                await clockOut();
            } else {
                await clockIn();
            }
        } catch (error) {
            console.error('Punch error:', error);
            alert('Something went wrong. Please try again.');
            punchButton.disabled = false;
        }
    });


    // ============================================
    // CLOCK IN / CLOCK OUT
    // ============================================

    async function clockIn() {
        var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        var response = await fetch('/api/time/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: timezone })
        });

        var data = await response.json();

        if (response.ok) {
            sessionStartTime = new Date(data.entry.start_time);
            isWorking = true;
            showWorkingState();
            startElapsedTimer();
            scheduleAutoCloseCheck();
        } else {
            alert(data.error || 'Failed to clock in');
            punchButton.disabled = false;
        }
    }

    async function clockOut() {
        var response = await fetch('/api/time/clock-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        var data = await response.json();

        if (response.ok) {
            stopElapsedTimer();
            isWorking = false;
            showCompletedState({
                start_time: data.entry.start_time,
                end_time: data.entry.end_time
            });
            // Refresh year total
            loadStatus();
        } else {
            alert(data.error || 'Failed to clock out');
            punchButton.disabled = false;
        }
    }


    // ============================================
    // UI STATE HELPERS
    // ============================================

    function showWorkingState() {
        statusText.hidden = true;

        punchButton.hidden = false;
        punchButton.disabled = false;
        punchButtonText.textContent = 'Clock Out';
        punchButton.className = 'punch-button working';

        elapsedTime.hidden = false;
        shiftProgressWrapper.hidden = false;
        punchCompleted.hidden = true;

        // Show clock-in timestamp
        if (sessionStartTime) {
            punchTimestamps.innerHTML = 'Clocked in at <span class="timestamp-value">' + formatTime(sessionStartTime) + '</span>';
            punchTimestamps.hidden = false;
        }
    }

    function showCompletedState(session) {
        stopElapsedTimer();
        isWorking = false;
        var start = new Date(session.start_time);
        var end = new Date(session.end_time);

        statusText.hidden = true;
        punchButton.hidden = true;
        elapsedTime.hidden = true;
        shiftCompleteText.hidden = true;
        document.body.classList.remove('shift-complete');
        shiftCompleted = false;
        punchCompleted.hidden = true;

        // Show timestamps
        punchTimestamps.innerHTML =
            'Clocked in at <span class="timestamp-value">' + formatTime(start) + '</span><br>' +
            'Clocked out at <span class="timestamp-value">' + formatTime(end) + '</span>';
        punchTimestamps.hidden = false;

        // Show shift progress bar with final hours
        var durationHours = (end - start) / (1000 * 60 * 60);
        var shiftPercent = Math.min((durationHours / shiftLength) * 100, 100);
        shiftProgressBar.style.width = shiftPercent + '%';
        shiftProgressLabel.textContent = shiftLength + 'h';
        shiftProgressWrapper.hidden = false;
    }

    function showRestrictionState(restriction) {
        if (restriction === 'sunday') {
            statusText.textContent = 'It is Sunday, let us seize the means of relaxation.';
        } else if (restriction === 'before_hours') {
            statusText.textContent = 'Clock in/out is available from 5:00 AM.';
        } else if (restriction === 'after_hours') {
            statusText.textContent = 'Clock in/out is not available after 9:00 PM.';
        }
        statusText.className = 'status-text not-working';
        statusText.hidden = false;

        punchButton.hidden = true;
        elapsedTime.hidden = true;
        shiftProgressWrapper.hidden = true;
        shiftCompleteText.hidden = true;
        punchTimestamps.hidden = true;
        punchCompleted.hidden = true;
        document.body.classList.remove('shift-complete');
        shiftCompleted = false;
    }

    function showReadyState() {
        statusText.hidden = true;

        punchButton.hidden = false;
        punchButton.disabled = false;
        punchButtonText.textContent = 'Clock In';
        punchButton.className = 'punch-button not-working';

        elapsedTime.hidden = true;
        shiftProgressWrapper.hidden = true;
        shiftCompleteText.hidden = true;
        punchTimestamps.hidden = true;
        punchCompleted.hidden = true;
        document.body.classList.remove('shift-complete');
        shiftCompleted = false;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
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

        var now = new Date();
        var diffMs = now - sessionStartTime;
        if (diffMs < 0) diffMs = 0;

        // Calculate the cap: min(12 hours, 9pm today)
        var maxMs = MAX_DAILY_HOURS * 60 * 60 * 1000;
        var ninePm = new Date(sessionStartTime);
        ninePm.setHours(WORK_END_HOUR, 0, 0, 0);
        if (ninePm <= sessionStartTime) {
            ninePm.setDate(ninePm.getDate() + 1);
        }
        var ninePmMs = ninePm - sessionStartTime;
        if (ninePmMs > 0 && ninePmMs < maxMs) {
            maxMs = ninePmMs;
        }

        // If past the cap, the server should have auto-closed — re-fetch
        if (diffMs >= maxMs) {
            stopElapsedTimer();
            loadStatus();
            return;
        }

        var diffSeconds = Math.floor(diffMs / 1000);
        var hours = Math.floor(diffSeconds / 3600);
        var minutes = Math.floor((diffSeconds % 3600) / 60);
        var seconds = diffSeconds % 60;

        elapsedTime.textContent =
            String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');

        // Update shift progress bar
        var elapsedHours = diffMs / (1000 * 60 * 60);
        var shiftPercent = Math.min((elapsedHours / shiftLength) * 100, 100);
        shiftProgressBar.style.width = shiftPercent + '%';
        shiftProgressLabel.textContent = shiftLength + 'h';

        // Shift completion detection
        if (elapsedHours >= shiftLength && !shiftCompleted) {
            shiftCompleted = true;
            document.body.classList.add('shift-complete');
            shiftCompleteText.hidden = false;
        }
    }


    // ============================================
    // FORMAT HOURS
    // ============================================

    function formatHoursDisplay(hours) {
        var rounded = Math.round(hours * 10) / 10;
        if (rounded === 0) return '0';
        if (rounded === Math.floor(rounded)) return rounded.toString();
        return rounded.toFixed(1);
    }


    // ============================================
    // LOGOUT
    // ============================================

    logoutButton.addEventListener('click', async function() {
        try {
            if (isWorking) {
                if (!confirm('Signing out will clock you out. Continue?')) return;
            }
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.href = '/index.html';
    });

});
