// src/routes/admin.js
const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middlewares/adminMiddleware");
const adminController = require("../controllers/adminController");

// Trang admin
router.get("/admin", requireAdmin, adminController.getAdminPage);

// Danh sách devices
router.get(
  "/admin/devices",
  requireAdmin,
  adminController.getAdminDevices
);

// Tạo user
router.post(
  "/admin/create-user",
  requireAdmin,
  adminController.createUser
);

// Approve device
router.post(
  "/admin/approve/:id",
  requireAdmin,
  adminController.approveDevice
);

// Revoke device
router.post(
  "/admin/revoke/:id",
  requireAdmin,
  adminController.revokeDevice
);

module.exports = router;
