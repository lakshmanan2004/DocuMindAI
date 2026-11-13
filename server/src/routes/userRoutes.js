const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { allow } = require('../middleware/role');
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');

// All user management routes require authentication and Admin role (Spec M1 & API Ref)
router.use(authenticate);
router.use(allow('admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.put('/:id', updateUser); // backward-compatible alias
router.delete('/:id', deleteUser);

module.exports = router;
