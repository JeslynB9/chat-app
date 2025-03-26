document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');

    loginButton.addEventListener('click', (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (username && password) {
            fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Login successful!');
                    window.location.href = 'home.html';
                } else {
                    alert(data.message || 'Login failed!');
                }
            })
            .catch(error => console.error('Error:', error));
        } else {
            alert('Please fill in all fields.');
        }
    });

    registerButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = 'register.html'; // Navigate to the register page
    });
});
