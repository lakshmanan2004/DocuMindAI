const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates the JWT from the Authorization header: 'Bearer <token>'
 * Attaches the decoded payload { id, orgId, role } to req.user
 * Enforces immediate blocking for deactivated users (Spec M1)
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Access denied: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user exists and is active in database
    const user = await User.findById(decoded.id).select('isActive orgId role name');
    if (!user) {
      return res.status(401).json({ message: 'Access denied: User account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Access denied: Account has been deactivated' });
    }

    req.user = {
      id: user._id.toString(),
      orgId: user.orgId.toString(),
      role: user.role,
      name: user.name
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Access denied: Invalid or expired token' });
  }
};

module.exports = authenticate;
