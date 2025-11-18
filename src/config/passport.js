// src/config/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../utils/db");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "manhtientoz14042008@gmail.com").toLowerCase();

// GOOGLE STRATEGY (PostgreSQL version)
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    // Cho phép dùng async/await trong verify callback
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;
        const name =
          profile.displayName || email || `google_${googleId.slice(0, 6)}`;

        const isAdminFromEmail =
          email && email.toLowerCase() === ADMIN_EMAIL ? 1 : 0;

        // 1. Tìm user theo google_id
        const userResult = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [googleId]
        );
        let user = userResult.rows[0];

        if (user) {
          // Nếu email trùng admin nhưng user chưa phải admin -> update
          if (isAdminFromEmail && user.is_admin !== 1) {
            await db.query(
              "UPDATE users SET is_admin = 1 WHERE id = $1",
              [user.id]
            );
            user.is_admin = 1;
          }

          return done(null, user);
        }

        // 2. Chưa có user → tạo mới
        const username = email || `google_${googleId}`;

        const insertResult = await db.query(
          `
          INSERT INTO users (username, password, is_admin, email, google_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
          [username, "", isAdminFromEmail, email, googleId]
        );

        const newUser = insertResult.rows[0];
        return done(null, newUser);
      } catch (err) {
        console.error("GoogleStrategy error:", err);
        return done(err);
      }
    }
  )
);

// SESSION CHO PASSPORT
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    const user = result.rows[0] || null;
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});

module.exports = passport;
