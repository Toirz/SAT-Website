// src/controllers/adminController.js
const path = require("path");
const db = require("../utils/db");

// GET /admin
function getAdminPage(req, res) {
  res.sendFile(path.join(__dirname, "..", "..", "public", "admin.html"));
}

// GET /admin/devices
async function getAdminDevices(req, res) {
  try {
    const result = await db.query(
      `
      SELECT d.id, u.username, d.device_token, d.approved, d.created_at_vn AS created_at, d.user_id
      FROM devices d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at_vn DESC
    `,
      []
    );

    const usersResult = await db.query(
      `
      SELECT id, username, is_admin, is_pro
      FROM users
      ORDER BY id ASC
    `,
      []
    );

    res.json({
      adminUsername: req.session.username,
      devices: result.rows,
      users: usersResult.rows,
    });
  } catch (err) {
    console.error("getAdminDevices error:", err);
    return res.status(500).json({ error: "Lỗi server" });
  }
}

// POST /admin/create-user
async function createUser(req, res) {
  const { username, password, is_admin } = req.body;
  const isAdminFlag = is_admin === "on" ? 1 : 0;

  try {
    await db.query(
      `
      INSERT INTO users (username, password, is_admin)
      VALUES ($1, $2, $3)
    `,
      [username, password, isAdminFlag]
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("createUser error:", err);
    // Unique constraint trong Postgres là mã lỗi 23505
    if (err.code === "23505") {
      return res.send("Username đã tồn tại.");
    }
    return res.status(500).send("Lỗi server");
  }
}

// POST /admin/approve/:id
async function approveDevice(req, res) {
  const deviceId = req.params.id;

  try {
    const result = await db.query(
      `SELECT * FROM devices WHERE id = $1`,
      [deviceId]
    );
    const device = result.rows[0];

    if (!device) return res.status(404).send("Không tìm thấy thiết bị");
    if (device.approved === 1) return res.redirect("/admin");

    await db.query(
      `UPDATE devices SET approved = 1 WHERE id = $1`,
      [deviceId]
    );

    res.redirect("/admin");
  } catch (err) {
    console.error("approveDevice error:", err);
    return res.status(500).send("Lỗi server");
  }
}

// POST /admin/revoke/:id
async function revokeDevice(req, res) {
  const deviceId = req.params.id;

  try {
    await db.query(
      `DELETE FROM devices WHERE id = $1`,
      [deviceId]
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("revokeDevice error:", err);
    return res.status(500).send("Lỗi server");
  }
}

async function updateUserProStatus(req, res) {
  const userId = req.params.id;
  const action = req.body.action;

  if (!userId || !["grant", "revoke"].includes(action)) {
    return res.status(400).send("Thiếu thông tin hợp lệ");
  }

  const isPro = action === "grant" ? 1 : 0;

  try {
    await db.query(`UPDATE users SET is_pro = $1 WHERE id = $2`, [isPro, userId]);
    res.redirect("/admin");
  } catch (err) {
    console.error("updateUserProStatus error:", err);
    return res.status(500).send("Lỗi server");
  }
}

module.exports = {
  getAdminPage,
  getAdminDevices,
  createUser,
  approveDevice,
  revokeDevice,
  updateUserProStatus,
};
