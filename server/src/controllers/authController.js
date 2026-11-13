const jwt = require('jsonwebtoken');
const { Organization, User, Template } = require('../models');
const { builtInTemplates } = require('../seed/templates');
const { recordAudit } = require('../services/audit');

/**
 * Generate a signed JWT token with 8-hour expiry (Spec M1)
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
      expiresIn: '8h'
    }
  );
};

/**
 * @desc    Register a new Organization and its primary Admin user
 *          Copies the 5 built-in templates into the new organization (Spec M1 & M4)
 * @route   POST /api/auth/register-org
 * @access  Public
 */
const registerOrg = async (req, res, next) => {
  try {
    const { orgName, name, adminName, email, password } = req.body;
    const finalAdminName = (name || adminName || '').trim();

    // 1. Validation
    if (!orgName || !finalAdminName || !email || !password) {
      return res.status(400).json({
        message: 'All fields (orgName, name, email, password) are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
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
      name: finalAdminName,
      email: normalizedEmail,
      passwordHash,
      role: 'admin',
      isActive: true
    });

    // 4. Seed 5 built-in templates into this organization (Spec Rule 1 & M1)
    const templatesToInsert = builtInTemplates.map((t) => ({
      orgId: organization._id,
      name: t.name,
      description: t.description,
      keywords: t.keywords,
      fields: t.fields,
      rules: t.rules,
      isBuiltIn: true,
      createdBy: user._id
    }));
    await Template.insertMany(templatesToInsert);

    // 5. Issue JWT (8 hour expiry)
    const token = generateToken(user, organization._id);

    // 6. Record audit
    await recordAudit({
      orgId: organization._id,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'register',
      targetType: 'organization',
      targetId: organization._id.toString(),
      details: { orgName: organization.name }
    });

    return res.status(201).json({
      message: 'Organization and admin account created successfully with 5 built-in templates',
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
 * @access  Public (Rate-limited)
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

    // Check deactivated status
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

    // Issue JWT (8h expiry)
    const token = generateToken(user, organization._id);

    // Record login audit event
    await recordAudit({
      orgId: organization._id,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'login',
      targetType: 'user',
      targetId: user._id.toString(),
      details: { ip: req.ip || '127.0.0.1' }
    });

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
 * @access  Private
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
        isActive: user.isActive,
        createdAt: user.createdAt
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

/**
 * @desc    Update user profile name
 * @route   PATCH /api/auth/me
 * @access  Private
 */
const updateMe = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name.trim();
    await user.save();

    await recordAudit({
      orgId: user.orgId,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'edit',
      targetType: 'user',
      targetId: user._id.toString(),
      details: { changedField: 'name', newName: user.name }
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user password
 * @route   PATCH /api/auth/me/password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password does not match' });
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    await recordAudit({
      orgId: user.orgId,
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: 'edit',
      targetType: 'user',
      targetId: user._id.toString(),
      details: { actionType: 'password_change' }
    });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerOrg,
  login,
  getMe,
  updateMe,
  changePassword
};
