const { Folder, Document } = require('../models');
const { recordAudit } = require('../services/audit');

/**
 * List all folders for the organization with document counts
 * GET /api/folders
 */
const getFolders = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const folders = await Folder.find({ orgId }).sort({ name: 1 }).lean();

    // Compute document counts per folder
    const counts = await Document.aggregate([
      { $match: { orgId: req.user.orgId } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    let unassignedCount = 0;
    for (const item of counts) {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      } else {
        unassignedCount = item.count;
      }
    }

    const foldersWithCounts = folders.map((f) => ({
      ...f,
      documentCount: countMap[f._id.toString()] || 0
    }));

    res.status(200).json({
      folders: foldersWithCounts,
      unassignedCount
    });
  } catch (error) {
    console.error('[Folder Controller Error]', error);
    res.status(500).json({ message: 'Failed to retrieve folders' });
  }
};

/**
 * Create a new single-level folder (Admin only)
 * POST /api/folders
 */
const createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const orgId = req.user.orgId;
    const trimmedName = name.trim();

    // Check duplicate folder in same organization
    const existing = await Folder.findOne({ orgId, name: trimmedName });
    if (existing) {
      return res.status(409).json({ message: 'A folder with this name already exists' });
    }

    const folder = await Folder.create({
      orgId,
      name: trimmedName,
      createdBy: req.user.id
    });

    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'create_folder',
      targetType: 'folder',
      targetId: folder._id.toString(),
      details: { folderName: folder.name }
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('[Create Folder Error]', error);
    res.status(500).json({ message: error.message || 'Failed to create folder' });
  }
};

/**
 * Rename a folder (Admin only)
 * PATCH /api/folders/:id
 */
const renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'New folder name is required' });
    }

    const orgId = req.user.orgId;
    const folder = await Folder.findOne({ _id: req.params.id, orgId });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const oldName = folder.name;
    folder.name = name.trim();
    await folder.save();

    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'rename_folder',
      targetType: 'folder',
      targetId: folder._id.toString(),
      details: { oldName, newName: folder.name }
    });

    res.status(200).json({
      message: 'Folder renamed successfully',
      folder
    });
  } catch (error) {
    console.error('[Rename Folder Error]', error);
    res.status(500).json({ message: error.message || 'Failed to rename folder' });
  }
};

/**
 * Delete a folder (Admin only)
 * Documents in this folder move to "No folder" (folderId: null)
 * DELETE /api/folders/:id
 */
const deleteFolder = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const folder = await Folder.findOne({ _id: req.params.id, orgId });
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Move associated documents to "No folder"
    const updateResult = await Document.updateMany(
      { orgId, folderId: folder._id },
      { $set: { folderId: null } }
    );

    await Folder.deleteOne({ _id: folder._id });

    await recordAudit({
      orgId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'delete_folder',
      targetType: 'folder',
      targetId: folder._id.toString(),
      details: { folderName: folder.name, documentsMoved: updateResult.modifiedCount }
    });

    res.status(200).json({
      message: `Folder deleted. ${updateResult.modifiedCount} document(s) moved to No folder.`,
      deletedId: folder._id
    });
  } catch (error) {
    console.error('[Delete Folder Error]', error);
    res.status(500).json({ message: error.message || 'Failed to delete folder' });
  }
};

module.exports = {
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder
};

