// ============================================
// PROFILE.JS - Profile Page Logic
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userCuteId = document.getElementById('user-cute-id');
    const userShiftLength = document.getElementById('user-shift-length');
    const statsSentence = document.getElementById('stats-text');
    const userLink = document.getElementById('user-link');
    const userLinkEmpty = document.getElementById('user-link-empty');
    const linkEditBtn = document.getElementById('link-edit-btn');
    const linkEditForm = document.getElementById('link-edit-form');
    const linkInput = document.getElementById('link-input');
    const linkSaveBtn = document.getElementById('link-save-btn');
    const linkCancelBtn = document.getElementById('link-cancel-btn');
    const sessionsList = document.getElementById('sessions-list');
    const editsInfo = document.getElementById('edits-info');
    const exportButton = document.getElementById('export-button');
    const deleteButton = document.getElementById('delete-button');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDelete = document.getElementById('cancel-delete');
    const confirmDelete = document.getElementById('confirm-delete');
    const modalExportButton = document.getElementById('modal-export-button');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const cancelEdit = document.getElementById('cancel-edit');
    const editError = document.getElementById('edit-error');
    const editWarning = document.getElementById('edit-warning');
    const passwordForm = document.getElementById('password-form');
    const passwordMessage = document.getElementById('password-message');
    const logoutButton = document.getElementById('logout-button');
    const deleteSessionModal = document.getElementById('delete-session-modal');
    const cancelDeleteSession = document.getElementById('cancel-delete-session');
    const confirmDeleteSession = document.getElementById('confirm-delete-session');

    let currentEditsRemaining = 3;
    let currentShiftLength = 8;
    let deleteSessionEntryId = null;

    // ============================================
    // CHECK AUTH AND LOAD DATA
    // ============================================

    checkAuth();

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (!data.user) {
                window.location.href = '/index.html';
                return;
            }

            userName.textContent = data.user.name;
            userEmail.textContent = data.user.email;
            userCuteId.textContent = data.user.cute_id;

            currentShiftLength = data.user.shift_length || 8;
            userShiftLength.textContent = currentShiftLength + ' hours';

            // Display shift changes info
            var shiftChangesInfo = document.getElementById('shift-changes-info');
            var remaining = data.user.shift_changes_remaining;
            if (remaining !== undefined) {
                shiftChangesInfo.hidden = false;
                if (remaining > 0) {
                    shiftChangesInfo.textContent = remaining + ' change' + (remaining !== 1 ? 's' : '') + ' remaining this month';
                } else {
                    shiftChangesInfo.textContent = 'You can change your shift length at the start of next month';
                }
            }

            // Display link
            var linkVal = data.user.link || '';
            displayLink(linkVal);

            const imgNum = Math.floor(Math.random() * 9) + 1;
            document.getElementById('profile-header-img').src = '/pics/profile-headers/mucha-' + imgNum + '.png';

            loadStats();
            loadSessions();
            loadProfileHeatmap();
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/index.html';
        }
    }


    // ============================================
    // LINK EDITING
    // ============================================

    function displayLink(linkVal) {
        if (linkVal) {
            userLink.href = linkVal;
            userLink.textContent = linkVal;
            userLink.hidden = false;
            userLinkEmpty.hidden = true;
            linkEditBtn.hidden = false;
        } else {
            userLink.hidden = true;
            userLinkEmpty.hidden = false;
            linkEditBtn.hidden = true;
        }
    }

    linkEditBtn.addEventListener('click', function() {
        linkInput.value = userLink.hidden ? '' : userLink.href;
        linkEditForm.hidden = false;
        linkEditBtn.hidden = true;
    });

    userLinkEmpty.addEventListener('click', function() {
        linkInput.value = '';
        linkEditForm.hidden = false;
        userLinkEmpty.hidden = true;
    });

    linkCancelBtn.addEventListener('click', function() {
        linkEditForm.hidden = true;
        if (userLink.hidden) {
            userLinkEmpty.hidden = false;
        } else {
            linkEditBtn.hidden = false;
        }
    });

    linkSaveBtn.addEventListener('click', async function() {
        var newLink = linkInput.value.trim();

        linkSaveBtn.disabled = true;
        try {
            const response = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: newLink })
            });

            const data = await response.json();

            if (response.ok) {
                displayLink(data.link || '');
                linkEditForm.hidden = true;
                linkEditBtn.hidden = false;
            } else {
                alert(data.error || 'Failed to save link.');
            }
        } catch (error) {
            console.error('Link save error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            linkSaveBtn.disabled = false;
        }
    });


    // ============================================
    // STATISTICS
    // ============================================

    function formatMinutesToTime(totalMinutes) {
        var h = Math.floor(totalMinutes / 60);
        var m = totalMinutes % 60;
        var ampm = h >= 12 ? 'PM' : 'AM';
        var displayH = h % 12 || 12;
        return displayH + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    async function loadStats() {
        try {
            const response = await fetch('/api/time/stats');
            const data = await response.json();

            const medianHours = Math.floor(data.median_minutes / 60);
            const medianMins = data.median_minutes % 60;
            let medianStr = '';
            if (medianHours > 0) {
                medianStr = medianHours + ' hour' + (medianHours !== 1 ? 's' : '');
                if (medianMins > 0) medianStr += ' and ' + medianMins + ' minute' + (medianMins !== 1 ? 's' : '');
            } else {
                medianStr = medianMins + ' minute' + (medianMins !== 1 ? 's' : '');
            }

            var html =
                'In <span class="stat-highlight">' + data.year + '</span> you have clocked in on ' +
                '<span class="stat-highlight">' + data.total_days + ' day' + (data.total_days !== 1 ? 's' : '') + '</span> and completed ' +
                '<span class="stat-highlight">' + data.total_hours + ' hour' + (data.total_hours !== 1 ? 's' : '') + '</span> of work. ' +
                'On a median day you worked <span class="stat-highlight">' + medianStr + '</span>.';

            if (data.median_clock_in_minutes !== null && data.median_clock_out_minutes !== null) {
                html += '<br>You usually clock in at <span class="stat-highlight">' +
                    formatMinutesToTime(data.median_clock_in_minutes) +
                    '</span> and clock out at <span class="stat-highlight">' +
                    formatMinutesToTime(data.median_clock_out_minutes) +
                    '</span>.';
            }

            statsSentence.innerHTML = html;
        } catch (error) {
            console.error('Stats error:', error);
            statsSentence.textContent = 'Unable to load statistics.';
        }
    }


    // ============================================
    // SESSION HISTORY
    // ============================================

    async function loadSessions() {
        try {
            const response = await fetch('/api/time/sessions');
            const data = await response.json();

            currentEditsRemaining = data.edits_remaining;

            if (data.edits_remaining < 3) {
                editsInfo.hidden = false;
                editsInfo.textContent = data.edits_remaining + ' edit' + (data.edits_remaining !== 1 ? 's' : '') + ' remaining this month.';
            } else {
                editsInfo.hidden = true;
            }

            if (data.sessions.length === 0) {
                sessionsList.innerHTML = '<p class="loading-state">No sessions yet.</p>';
                return;
            }

            sessionsList.innerHTML = '';
            data.sessions.forEach(function(session) {
                const item = document.createElement('div');
                item.className = 'session-item';

                const startDate = new Date(session.start_time);
                const endDate = new Date(session.end_time);

                const dateStr = startDate.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                });

                const startTimeStr = startDate.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true
                });

                const endTimeStr = endDate.toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', hour12: true
                });

                const durationStr = session.duration_hours.toFixed(1) + 'h';

                // Star icon for shift met
                var starHtml = '';
                if (session.shift_met) {
                    starHtml = '<span class="session-star" title="Shift goal met">&#9733;</span>';
                }

                // Edit button: only when editable AND edits remaining
                let editButton = '';
                if (session.editable && currentEditsRemaining > 0) {
                    editButton = '<button class="session-edit-btn" data-id="' + session.id +
                        '" data-start="' + session.start_time +
                        '" data-end="' + session.end_time + '">Edit</button>';
                }

                // Delete button: always shown
                var deleteButton = '<button class="session-delete-btn" data-id="' + session.id + '">Delete</button>';

                item.innerHTML =
                    '<div>' +
                        '<span class="session-date">' + dateStr + '</span><br>' +
                        '<span class="session-times">' + startTimeStr + ' – ' + endTimeStr + '</span>' +
                    '</div>' +
                    '<div style="text-align: right;">' +
                        starHtml +
                        '<span class="session-duration">' + durationStr + '</span>' +
                        editButton +
                        deleteButton +
                    '</div>';

                sessionsList.appendChild(item);
            });

            // Bind edit buttons
            sessionsList.querySelectorAll('.session-edit-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    openEditModal(btn.dataset.id, btn.dataset.start, btn.dataset.end);
                });
            });

            // Bind delete buttons
            sessionsList.querySelectorAll('.session-delete-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    deleteSessionEntryId = parseInt(btn.dataset.id, 10);
                    deleteSessionModal.hidden = false;
                });
            });

        } catch (error) {
            console.error('Sessions error:', error);
            sessionsList.innerHTML = '<p class="error-message">Failed to load sessions.</p>';
        }
    }


    // ============================================
    // DELETE SESSION MODAL
    // ============================================

    cancelDeleteSession.addEventListener('click', function() {
        deleteSessionModal.hidden = true;
        deleteSessionEntryId = null;
    });

    deleteSessionModal.addEventListener('click', function(event) {
        if (event.target === deleteSessionModal) {
            deleteSessionModal.hidden = true;
            deleteSessionEntryId = null;
        }
    });

    confirmDeleteSession.addEventListener('click', async function() {
        if (!deleteSessionEntryId) return;

        confirmDeleteSession.disabled = true;
        confirmDeleteSession.textContent = 'Deleting...';

        try {
            const response = await fetch('/api/time/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: deleteSessionEntryId })
            });

            const data = await response.json();

            if (response.ok) {
                deleteSessionModal.hidden = true;
                deleteSessionEntryId = null;
                loadSessions();
                loadStats();
                loadProfileHeatmap();
            } else {
                alert(data.error || 'Failed to delete session.');
            }
        } catch (error) {
            console.error('Delete session error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            confirmDeleteSession.disabled = false;
            confirmDeleteSession.textContent = 'Yes, Delete';
        }
    });


    // ============================================
    // EDIT SESSION MODAL
    // ============================================

    function openEditModal(entryId, startTime, endTime) {
        document.getElementById('edit-entry-id').value = entryId;
        editError.hidden = true;

        editWarning.textContent = 'You have ' + currentEditsRemaining +
            ' edit' + (currentEditsRemaining !== 1 ? 's' : '') +
            ' remaining this month. This action cannot be undone.';

        // Format for datetime-local input
        const start = new Date(startTime);
        const end = new Date(endTime);
        document.getElementById('edit-start-time').value = formatDatetimeLocal(start);
        document.getElementById('edit-end-time').value = formatDatetimeLocal(end);

        editModal.hidden = false;
    }

    function formatDatetimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
    }

    cancelEdit.addEventListener('click', function() {
        editModal.hidden = true;
    });

    editModal.addEventListener('click', function(event) {
        if (event.target === editModal) editModal.hidden = true;
    });

    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        editError.hidden = true;

        const entryId = document.getElementById('edit-entry-id').value;
        const startTime = new Date(document.getElementById('edit-start-time').value);
        const endTime = new Date(document.getElementById('edit-end-time').value);

        try {
            const response = await fetch('/api/time/sessions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_id: parseInt(entryId),
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString()
                })
            });

            const data = await response.json();

            if (response.ok) {
                editModal.hidden = true;
                loadSessions();
                loadStats();
            } else {
                editError.textContent = data.error || 'Failed to save changes.';
                editError.hidden = false;
            }
        } catch (error) {
            console.error('Edit error:', error);
            editError.textContent = 'Something went wrong. Please try again.';
            editError.hidden = false;
        }
    });


    // ============================================
    // CHANGE PASSWORD
    // ============================================

    passwordForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        passwordMessage.hidden = true;

        const currentPwd = document.getElementById('current-password').value;
        const newPwd = document.getElementById('new-password').value;
        const confirmPwd = document.getElementById('confirm-new-password').value;

        if (newPwd !== confirmPwd) {
            showPasswordMessage('New passwords do not match.', true);
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPwd,
                    new_password: newPwd
                })
            });

            const data = await response.json();

            if (response.ok) {
                showPasswordMessage('Password changed successfully.', false);
                passwordForm.reset();
            } else {
                showPasswordMessage(data.error || 'Failed to change password.', true);
            }
        } catch (error) {
            console.error('Change password error:', error);
            showPasswordMessage('Something went wrong. Please try again.', true);
        }
    });

    function showPasswordMessage(message, isError) {
        passwordMessage.textContent = message;
        passwordMessage.className = isError ? 'error-message' : 'success-message';
        passwordMessage.hidden = false;
    }


    // ============================================
    // EXPORT TO CSV
    // ============================================

    async function exportCSV() {
        try {
            const response = await fetch('/api/time/sessions?export=csv');
            const data = await response.json();

            if (!response.ok) {
                alert(data.error || 'Failed to export data');
                return;
            }

            const csv = convertToCSV(data.entries);
            const email = userEmail.textContent;
            downloadCSV(csv, email + '-whistle-time-entries.csv');
        } catch (error) {
            console.error('Export error:', error);
            alert('Something went wrong. Please try again.');
        }
    }

    exportButton.addEventListener('click', async function() {
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting...';
        await exportCSV();
        exportButton.disabled = false;
        exportButton.textContent = 'Export to CSV';
    });

    modalExportButton.addEventListener('click', async function() {
        modalExportButton.disabled = true;
        modalExportButton.textContent = 'Downloading...';
        await exportCSV();
        modalExportButton.disabled = false;
        modalExportButton.textContent = 'Download CSV First';
    });

    function convertToCSV(entries) {
        const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Duration (Hours)'];
        const rows = entries.map(function(entry) {
            return [entry.date, entry.day_of_week, entry.start_time, entry.end_time, entry.duration_hours];
        });
        const allRows = [headers].concat(rows);
        return allRows.map(function(row) {
            return row.map(function(value) {
                return '"' + String(value).replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }


    // ============================================
    // DELETE ACCOUNT
    // ============================================

    deleteButton.addEventListener('click', function() {
        deleteModal.hidden = false;
    });

    cancelDelete.addEventListener('click', function() {
        deleteModal.hidden = true;
    });

    deleteModal.addEventListener('click', function(event) {
        if (event.target === deleteModal) deleteModal.hidden = true;
    });

    confirmDelete.addEventListener('click', async function() {
        confirmDelete.disabled = true;
        confirmDelete.textContent = 'Deleting...';

        try {
            const response = await fetch('/api/account/delete', { method: 'DELETE' });
            const data = await response.json();

            if (response.ok) {
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
    // HEATMAP
    // ============================================

    async function loadProfileHeatmap() {
        try {
            const response = await fetch('/api/time/heatmap');
            const data = await response.json();
            renderProfileHeatmap(data.year, data.days, data.shift_length || currentShiftLength);
        } catch (error) {
            console.error('Load heatmap error:', error);
        }
    }

    function getOrdinalSuffix(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function getHeatLevel(hours) {
        if (hours === 0) return 0;
        if (hours < 3) return 1;
        if (hours < 6) return 2;
        if (hours < 10) return 3;
        return 4;
    }

    function renderProfileHeatmap(year, daysData, heatmapShiftLength) {
        const heatmapGrid = document.getElementById('profile-heatmap-grid');
        const heatmapMonths = document.getElementById('profile-heatmap-months');
        heatmapGrid.innerHTML = '';
        heatmapMonths.innerHTML = '';

        const heatColors = {
            0: '#EDE9E2',
            1: 'rgba(108, 122, 97, 0.25)',
            2: 'rgba(108, 122, 97, 0.5)',
            3: 'rgba(108, 122, 97, 0.75)',
            4: '#6C7A61'
        };
        const sundayColor = '#EEBC8B';

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
                var day = weeks[weekIndex][dayOfWeek];
                var cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                if (day === null) {
                    cell.classList.add('empty');
                } else if (day.isSunday) {
                    cell.style.backgroundColor = sundayColor;
                    cell.title = day.date + ' (Sunday)';
                } else if (day.isFuture) {
                    cell.classList.add('future');
                    cell.title = day.date;
                } else {
                    var level = getHeatLevel(day.hours);
                    cell.style.backgroundColor = heatColors[level];
                    if (day.hours >= heatmapShiftLength && day.hours > 0) {
                        cell.classList.add('shift-met');
                    }
                    cell.title = day.date + ': ' + day.hours + ' hours';

                    // Add hover interaction for cells with data
                    (function(dayData) {
                        cell.addEventListener('mouseenter', function() {
                            var hoverText = document.getElementById('heatmap-hover-text');
                            var date = new Date(dayData.date);
                            var d = date.getDate();
                            var suffix = getOrdinalSuffix(d);
                            var month = date.toLocaleString('en-US', { month: 'long' });
                            var yr = date.getFullYear();
                            var h = Math.floor(dayData.hours);
                            var m = Math.round((dayData.hours - h) * 60);
                            hoverText.textContent = 'On the ' + d + suffix + ' of ' + month + ', ' + yr + ' you worked ' + h + ' hours and ' + m + ' minutes.';
                        });

                        cell.addEventListener('mouseleave', function() {
                            document.getElementById('heatmap-hover-text').innerHTML = '&nbsp;';
                        });
                    })(day);
                }

                heatmapGrid.appendChild(cell);
            }
        }

        // Render month labels
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var lastMonth = -1;

        for (var weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            var firstDayInWeek = weeks[weekIndex].find(function(d) { return d !== null; });
            if (firstDayInWeek) {
                var month = parseInt(firstDayInWeek.date.split('-')[1], 10) - 1;
                if (month !== lastMonth) {
                    var label = document.createElement('span');
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
            var statusRes = await fetch('/api/time/status');
            var statusData = await statusRes.json();
            if (statusData.is_working) {
                if (!confirm('Signing out will clock you out. Continue?')) return;
            }
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/index.html';
        }
    });

});
