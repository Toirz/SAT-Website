// src/app.js
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const sessionMiddleware = require("./config/session");
const passport = require("./config/passport");
const { loginGuard } = require("./middlewares/authMiddleware");
const routes = require("./routes");

const app = express();

// ====== MIDDLEWARE CƠ BẢN ======
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.json());

// ====== PASSPORT ======
app.use(passport.initialize());
app.use(passport.session());

// ====== CHẶN ROUTE CẦN LOGIN (giống logic PUBLIC_PATHS cũ) ======
app.use(loginGuard);

// ====== STATIC FILES ======
app.use(
  express.static(path.join(__dirname, "..", "public"), { index: false })
);
app.use("/tests", express.static(path.join(__dirname, "..", "tests")));

// ====== ROUTES ======
app.use(routes);

module.exports = app;
