document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');

    authForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            alert('Please fill in all fields.');
            return;
        }

        fetch('https://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Login successful!');
                localStorage.setItem('username', data.user.username); // store for later
                window.location.href = 'home.html'; // or chat.html, etc.
            } else {
                alert(data.message || 'Login failed!');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Something went wrong. Try again later.');
        });
    });
});