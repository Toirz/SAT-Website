// src/middlewares/authMiddleware.js

// Các path được truy cập khi chưa login
const PUBLIC_PATHS = [
  "/",                    // trang login
  "/login",               // redirect
  "/auth/google",         // bắt đầu Google login
  "/auth/google/callback" // callback
];

function loginGuard(req, res, next) {
  const requestPath = req.path;

  // Cho phép đường dẫn public
  if (PUBLIC_PATHS.includes(requestPath)) {
    return next();
  }

  // Cho phép static assets (css/js/img/font...)
  const isStaticAsset = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|woff|ttf|map)$/i.test(
    requestPath
  );
  if (isStaticAsset) {
    return next();
  }

  // Còn lại bắt buộc login
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  next();
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

module.exports = {
  loginGuard,
  requireLogin,
};
