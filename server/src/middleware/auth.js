const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates the JWT from the Authorization header: 'Bearer <token>'
 * Attaches the decoded payload { id, orgId, role } to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Access denied: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, orgId, role, iat, exp }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Access denied: Invalid or expired token' });
  }
};

module.exports = authenticate;

