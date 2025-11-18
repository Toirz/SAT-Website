// src/routes/test.js
const express = require("express");
const router = express.Router();
const { requireLogin } = require("../middlewares/authMiddleware");
const testController = require("../controllers/testController");

// Danh sách bài test
router.get("/api/tests", requireLogin, testController.getTests);

// Parse bài test
router.get(
  "/api/parsed-test/:folder",
  requireLogin,
  testController.getParsedTest
);

module.exports = router;
