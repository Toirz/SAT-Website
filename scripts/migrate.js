// scripts/migrate.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../src/utils/db");

(async () => {
  try {
    const schemaPath = path.join(__dirname, "..", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("🚀 Running migrations from schema.sql...");
    await pool.query(sql);
    console.log("✅ Migrations done!");
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
