const bcrypt = require('bcrypt');

// Function to hash a password securely
async function hashPassword(plaintextPassword) {
    const saltRounds = 12; // Cost factor (adjustable for security vs. performance)
    const salt = await bcrypt.genSalt(saltRounds); // Generate a unique salt
    const hashedPassword = await bcrypt.hash(plaintextPassword, salt); // Hash the password with the salt
    return hashedPassword;
}

// Function to verify a password against a stored hash
async function verifyPassword(plaintextPassword, hashedPassword) {
    const isMatch = await bcrypt.compare(plaintextPassword, hashedPassword); // Compare the password with the hash
    return isMatch;
}

module.exports = { hashPassword, verifyPassword };
