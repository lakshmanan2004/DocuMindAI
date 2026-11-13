const jwt = require('jsonwebtoken');
const { Organization, User } = require('../models');

/**
 * Generate a signed JWT token
 */
const generateToken = (user, orgId) => {
  return jwt.sign(
    {
      id: user._id,
      orgId: orgId,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

/**
 * @desc    Register a new Organization and its primary Admin user
 * @route   POST /api/auth/register-org
 * @access  Public
 */
const registerOrg = async (req, res, next) => {
  try {
    const { orgName, name, email, password } = req.body;

    // 1. Validation
    if (!orgName || !name || !email || !password) {
      return res.status(400).json({
        message: 'All fields (orgName, name, email, password) are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        message: 'A user with this email address already exists'
      });
    }

    // 2. Create the tenant Organization
    const organization = await Organization.create({
      name: orgName.trim()
    });

    // 3. Hash password and create first Admin user
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      orgId: organization._id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'admin'
    });

    // 4. Issue JWT
    const token = generateToken(user, organization._id);

    return res.status(201).json({
      message: 'Organization and admin account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      organization: {
        id: organization._id,
        name: organization.name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user and get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact your organization admin.'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Fetch tenant organization
    const organization = await Organization.findById(user.orgId);
    if (!organization) {
      return res.status(404).json({
        message: 'Associated organization not found'
      });
    }

    // Issue JWT
    const token = generateToken(user, organization._id);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      organization: {
        id: organization._id,
        name: organization.name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged in user profile and org details
 * @route   GET /api/auth/me
 * @access  Private (Authenticated)
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const organization = await Organization.findById(req.user.orgId);

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      },
      organization: organization
        ? {
            id: organization._id,
            name: organization.name
          }
        : null
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerOrg,
  login,
  getMe
};

