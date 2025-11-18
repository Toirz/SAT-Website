// src/controllers/authController.js
const path = require("path");
const crypto = require("crypto");
const db = require("../utils/db");
const { getVNTime } = require("../utils/time");

// Trang login (GET '/')
function showLoginPage(req, res) {
  res.sendFile(path.join(__dirname, "..", "..", "public", "login.html"));
}

// /login chỉ redirect về '/'
function redirectLogin(req, res) {
  res.redirect("/");
}

// Trang index chính
function showIndex(req, res) {
  res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
}

// Logout
function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
}

// Hàm dùng chung cho login (Google + login thường)
async function handleDeviceLogin(req, res, user) {
  let deviceToken = req.cookies.device_token;
  if (!deviceToken) deviceToken = crypto.randomBytes(16).toString("hex");

  const finishLogin = () => {
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;

    res.cookie("device_token", deviceToken, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    return res.redirect("/index");
  };

  try {
    // 1) Kiểm tra thiết bị đã tồn tại chưa
    const existingDeviceResult = await db.query(
      `SELECT * FROM devices WHERE user_id = $1 AND device_token = $2`,
      [user.id, deviceToken]
    );
    const device = existingDeviceResult.rows[0];

    if (device) {
      if (device.approved === 1) return finishLogin();
      return res.send("Thiết bị đã ghi nhận nhưng CHỜ ADMIN DUYỆT.");
    }

    // 2) Thiết bị mới → đếm số thiết bị đã approved
    const countResult = await db.query(
      `SELECT COUNT(*) AS count
       FROM devices
       WHERE user_id = $1 AND approved = 1`,
      [user.id]
    );
    const approvedCount = Number(countResult.rows[0].count);

    // CASE A — auto approve nếu <= 2 thiết bị
    if (approvedCount < 2) {
      await db.query(
        `INSERT INTO devices (user_id, device_token, approved, created_at_vn)
         VALUES ($1, $2, 1, $3)`,
        [user.id, deviceToken, getVNTime()]
      );
      return finishLogin();
    }

    // CASE B — >2 thiết bị → chờ admin duyệt
    await db.query(
      `INSERT INTO devices (user_id, device_token, approved, created_at_vn)
       VALUES ($1, $2, 0, $3)`,
      [user.id, deviceToken, getVNTime()]
    );
    return res.send(
      "Tài khoản này đã đăng nhập trên 2 thiết bị. Thiết bị mới đang CHỜ ADMIN DUYỆT."
    );
  } catch (err) {
    console.error("handleDeviceLogin error:", err);
    return res.status(500).send("Lỗi server");
  }
}

// Callback sau khi Google auth thành công
function handleGoogleCallback(req, res) {
  const user = req.user;
  return handleDeviceLogin(req, res, user);
}

// Login thường (POST /login)
async function handleLocalLogin(req, res) {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      `SELECT * FROM users WHERE username = $1 AND password = $2`,
      [username, password]
    );
    const user = result.rows[0];

    if (!user) return res.send("Sai tài khoản hoặc mật khẩu");

    return handleDeviceLogin(req, res, user);
  } catch (err) {
    console.error("handleLocalLogin error:", err);
    return res.status(500).send("Lỗi server");
  }
}

module.exports = {
  showLoginPage,
  redirectLogin,
  showIndex,
  logout,
  handleGoogleCallback,
  handleLocalLogin,
};
