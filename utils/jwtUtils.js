const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your_secret_key'; // Replace with a secure key from environment variables

// Generate a JWT token
function generateToken(payload, expiresIn = '1h') {
    return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

// Verify a JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (error) {
        return null; // Invalid token
    }
}

module.exports = { generateToken, verifyToken };
