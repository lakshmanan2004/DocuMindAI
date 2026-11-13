/**
 * Role-Based Access Control (RBAC) Middleware
 * Verifies whether the authenticated user has one of the allowed roles.
 * Usage: router.post('/endpoint', authenticate, allow('admin', 'reviewer'), handler);
 */
const allow = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Forbidden: No role assigned' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

module.exports = {
  allow
};

