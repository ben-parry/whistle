// ============================================
// AUTH.JS - Login and Registration Logic
// ============================================
// This file handles:
// - Switching between login and register forms
// - Submitting login form
// - Submitting register form
// - Showing error/success messages
// ============================================


// ============================================
// WAIT FOR PAGE TO LOAD
// ============================================
// We wrap everything in DOMContentLoaded to make sure
// the HTML elements exist before we try to use them

document.addEventListener('DOMContentLoaded', function() {

    // ============================================
    // GET REFERENCES TO HTML ELEMENTS
    // ============================================
    // We store references to elements we'll use multiple times

    // Tab buttons
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');

    // Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Messages
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');


    // ============================================
    // CHECK IF ALREADY LOGGED IN
    // ============================================
    // If user is already logged in, redirect to app

    checkIfLoggedIn();

    async function checkIfLoggedIn() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (data.user) {
                // User is logged in, redirect to app
                window.location.href = '/app.html';
            }
        } catch (error) {
            // Not logged in, stay on login page
            console.log('Not logged in');
        }
    }


    // ============================================
    // TAB SWITCHING
    // ============================================
    // When user clicks "Sign In" or "Create Account" tabs

    loginTab.addEventListener('click', function() {
        // Show login form, hide register form
        loginForm.hidden = false;
        registerForm.hidden = true;

        // Update active tab styling
        loginTab.classList.add('active');
        registerTab.classList.remove('active');

        // Clear any messages
        hideMessages();
    });

    registerTab.addEventListener('click', function() {
        // Show register form, hide login form
        loginForm.hidden = true;
        registerForm.hidden = false;

        // Update active tab styling
        loginTab.classList.remove('active');
        registerTab.classList.add('active');

        // Clear any messages
        hideMessages();
    });


    // ============================================
    // LOGIN FORM SUBMISSION
    // ============================================

    loginForm.addEventListener('submit', async function(event) {
        // Prevent the form from submitting normally (which would reload the page)
        event.preventDefault();

        // Hide any previous messages
        hideMessages();

        // Get the email and password from the form
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            // Send login request to the server
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            // Parse the response
            const data = await response.json();

            if (response.ok) {
                // Login successful! Redirect to the app
                showSuccess('Login successful! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                // Login failed, show error
                showError(data.error || 'Login failed. Please try again.');
            }

        } catch (error) {
            console.error('Login error:', error);
            showError('Something went wrong. Please try again.');
        }
    });


    // ============================================
    // REGISTER FORM SUBMISSION
    // ============================================

    registerForm.addEventListener('submit', async function(event) {
        // Prevent the form from submitting normally
        event.preventDefault();

        // Hide any previous messages
        hideMessages();

        // Get the values from the form
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;

        // Check that passwords match
        if (password !== passwordConfirm) {
            showError('Passwords do not match.');
            return;
        }

        try {
            // Send register request to the server
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            // Parse the response
            const data = await response.json();

            if (response.ok) {
                // Registration successful! Redirect to the app
                showSuccess('Account created! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                // Registration failed, show error
                showError(data.error || 'Registration failed. Please try again.');
            }

        } catch (error) {
            console.error('Registration error:', error);
            showError('Something went wrong. Please try again.');
        }
    });


    // ============================================
    // HELPER FUNCTIONS FOR MESSAGES
    // ============================================

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
