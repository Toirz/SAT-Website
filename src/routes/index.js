// src/routes/index.js
const express = require("express");
const router = express.Router();

const authRoutes = require("./auth");
const testRoutes = require("./test");
const historyRoutes = require("./history");
const adminRoutes = require("./admin");

router.use(authRoutes);
router.use(testRoutes);
router.use(historyRoutes);
router.use(adminRoutes);

module.exports = router;
