// authMiddleware.js
const { verifyToken } = require('./jwtUtils');

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Missing token' });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(403).json({ success: false, message: 'Invalid token' });

    req.user = decoded;
    next();
}

module.exports = authenticate;