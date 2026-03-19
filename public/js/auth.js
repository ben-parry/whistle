// ============================================
// AUTH.JS - Login and Registration Logic
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Check if already logged in
    checkIfLoggedIn();

    async function checkIfLoggedIn() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (data.user) {
                window.location.href = '/app.html';
            }
        } catch (error) {
            console.log('Not logged in');
        }
    }

    // Tab switching
    loginTab.addEventListener('click', function() {
        loginForm.hidden = false;
        registerForm.hidden = true;
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        hideMessages();
    });

    registerTab.addEventListener('click', function() {
        loginForm.hidden = true;
        registerForm.hidden = false;
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
        hideMessages();
    });

    // Login
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        hideMessages();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showSuccess('Login successful! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                showError(data.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Something went wrong. Please try again.');
        }
    });

    // Register
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        hideMessages();

        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        // Client-side name validation
        if (/\d/.test(name)) {
            showError('Names cannot contain numbers.');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const data = await response.json();

            if (response.ok) {
                showSuccess('Account created! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                showError(data.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('Something went wrong. Please try again.');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
        successMessage.hidden = true;
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.hidden = false;
        errorMessage.hidden = true;
    }

    function hideMessages() {
        errorMessage.hidden = true;
        successMessage.hidden = true;
    }

});
