const { User } = require('../models');
const { recordAudit } = require('../services/audit');

/**
 * List all users within the organization (Admin only)
 * GET /api/users
 */
const getUsers = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const users = await User.find({ orgId })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    console.error('[User Controller Error]', error);
    res.status(500).json({ message: 'Failed to retrieve team members' });
  }
};

/**
 * Create a new team user with a specific role and temporary password (Admin only)
 * POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const validRoles = ['admin', 'reviewer', 'employee', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const passwordHash = await User.hashPassword(password);

    const newUser = await User.create({
      orgId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
      isActive: true
    });

    // Record audit event
    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name || 'Admin',
      userRole: req.user.role,
      action: 'edit',
      targetType: 'user',
      targetId: newUser._id.toString(),
      details: { actionType: 'create_user', targetUser: newUser.email, assignedRole: role }
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('[Create User Error]', error);
    res.status(500).json({ message: error.message || 'Failed to create user' });
  }
};

/**
 * Update user role or activate/deactivate user (Admin only)
 * PATCH /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { role, isActive, name } = req.body;

    const targetUser = await User.findOne({ _id: req.params.id, orgId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found in your organization' });
    }

    const updates = {};
    const auditDetails = {};

    if (role !== undefined) {
      const validRoles = ['admin', 'reviewer', 'employee', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: `Role must be one of: ${validRoles.join(', ')}` });
      }
      auditDetails.previousRole = targetUser.role;
      auditDetails.newRole = role;
      targetUser.role = role;
    }

    if (isActive !== undefined) {
      // Prevent admin from deactivating themselves
      if (req.params.id === req.user.id && isActive === false) {
        return res.status(400).json({ message: 'You cannot deactivate your own account' });
      }
      auditDetails.previousStatus = targetUser.isActive;
      auditDetails.newStatus = Boolean(isActive);
      targetUser.isActive = Boolean(isActive);
    }

    if (name && name.trim()) {
      targetUser.name = name.trim();
    }

    await targetUser.save();

    // Record audit event
    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name || 'Admin',
      userRole: req.user.role,
      action: 'edit',
      targetType: 'user',
      targetId: targetUser._id.toString(),
      details: { actionType: 'update_user', ...auditDetails }
    });

    res.status(200).json({
      message: 'User updated successfully',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive
      }
    });
  } catch (error) {
    console.error('[Update User Error]', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

/**
 * Delete a user from the organization (Admin only)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const orgId = req.user.orgId;

    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const targetUser = await User.findOne({ _id: req.params.id, orgId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found in your organization' });
    }

    await User.deleteOne({ _id: targetUser._id });

    // Record audit event
    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name || 'Admin',
      userRole: req.user.role,
      action: 'delete',
      targetType: 'user',
      targetId: targetUser._id.toString(),
      details: { actionType: 'delete_user', deletedUserEmail: targetUser.email }
    });

    res.status(200).json({ message: 'User deleted successfully', deletedId: req.params.id });
  } catch (error) {
    console.error('[Delete User Error]', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
