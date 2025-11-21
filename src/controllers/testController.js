// src/controllers/testController.js
const fs = require("fs");
const path = require("path");
const db = require("../utils/db");

const testsDir = path.join(__dirname, "..", "..", "tests");
const CATEGORY_DIRS = {
  real_tests: path.join(testsDir, "real_tests"),
  practice_tests: path.join(testsDir, "practice_tests"),
};

function isPracticeCategory(category) {
  return category === "practice_tests";
}

function isPracticeFolder(folder = "") {
  return folder.startsWith("practice_tests/");
}

function listCategory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs
    .readdirSync(dirPath)
    .filter((name) => fs.statSync(path.join(dirPath, name)).isDirectory());
}

function getCategoryTotals() {
  return Object.fromEntries(
    Object.entries(CATEGORY_DIRS).map(([key, dirPath]) => [
      key,
      listCategory(dirPath).length,
    ])
  );
}

async function ensureProFlag(req) {
  if (typeof req.session.isPro !== "undefined") {
    return !!req.session.isPro;
  }
  if (!req.session.userId) return false;

  try {
    const result = await db.query(
      `SELECT is_pro FROM users WHERE id = $1`,
      [req.session.userId]
    );
    const isPro = result.rows[0]?.is_pro === 1;
    req.session.isPro = isPro;
    return isPro;
  } catch (err) {
    console.error("ensureProFlag error:", err);
    return false;
  }
}

// GET /api/tests
async function getTests(req, res) {
  try {
    const isPro = await ensureProFlag(req);
    const category = req.query.category;

    if (category) {
      if (isPracticeCategory(category) && !isPro) {
        return res
          .status(403)
          .json({ error: "Chỉ tài khoản Pro mới truy cập được đề luyện." });
      }
      const dirPath = CATEGORY_DIRS[category];
      if (!dirPath) {
        return res.status(400).json({ error: "Invalid category" });
      }

      return res.json({ category, tests: listCategory(dirPath) });
    }

    const payload = {};
    Object.entries(CATEGORY_DIRS).forEach(([key, dirPath]) => {
      if (isPracticeCategory(key) && !isPro) {
        payload[key] = [];
      } else {
        payload[key] = listCategory(dirPath);
      }
    });

    res.json(payload);
  } catch (err) {
    console.error("Error reading tests:", err);
    res.status(500).send("Cannot read tests folder");
  }
}

// GET /api/home-stats
async function getHomeStats(req, res) {
  const userId = req.session.userId;

  try {
    const totals = getCategoryTotals();

    const result = await db.query(
      `
      SELECT
        COUNT(DISTINCT test_file) FILTER (WHERE test_file LIKE 'real_tests/%') AS real_completed,
        COUNT(DISTINCT test_file) FILTER (WHERE test_file LIKE 'practice_tests/%') AS practice_completed
      FROM test_history
      WHERE user_id = $1
    `,
      [userId]
    );

    const row = result.rows[0] || {};

    res.json({
      totals,
      completed: {
        real_tests: Number(row.real_completed || 0),
        practice_tests: Number(row.practice_completed || 0),
      },
    });
  } catch (err) {
    console.error("getHomeStats error:", err);
    res.status(500).json({ error: "Cannot load stats" });
  }
}

// GET /api/parsed-test
async function getParsedTest(req, res) {
  const folder = req.query.file;
  if (!folder) {
    return res.status(400).json({ error: "Missing file parameter" });
  }
  
  const isPro = await ensureProFlag(req);

  if (isPracticeFolder(folder) && !isPro) {
    return res
      .status(403)
      .json({ error: "Bạn cần tài khoản Pro để mở đề luyện." });
  }
  
  const folderPath = path.join(testsDir, folder);

  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: "Folder not found: " + folder });
  }

  const files = fs.readdirSync(folderPath);
  const txtFile = files.find((f) => f.toLowerCase().endsWith(".txt"));
  if (!txtFile) {
    return res
      .status(404)
      .json({ error: "No .txt file found in folder: " + folder });
  }

  const txt = fs.readFileSync(path.join(folderPath, txtFile), "utf8");
  const blocks = txt.split(/Question\s+\d+:/g).slice(1);

  const questions = blocks.map((block, index) => {
    const lines = block
      .trim()
      .split("\n")
      .map((l) => l.trim());
    const indexA = lines.findIndex((l) => /^A\./.test(l));
    const questionTextLines =
      indexA === -1 ? lines : lines.slice(0, indexA);

    const choices = {
      A: lines.find((l) => l.startsWith("A."))?.slice(2).trim(),
      B: lines.find((l) => l.startsWith("B."))?.slice(2).trim(),
      C: lines.find((l) => l.startsWith("C."))?.slice(2).trim(),
      D: lines.find((l) => l.startsWith("D."))?.slice(2).trim(),
    };

    const correct = lines
      .find((l) => l.startsWith("Answer:"))
      ?.split(":")[1]
      .trim();

    let imgPath = null;
    const imageCandidates = [
      `Q${index + 1}.png`,
      `Q${index + 1}.jpg`,
      `Q${index + 1}.jpeg`,
      `${index + 1}.png`,
      `${index + 1}.jpg`,
      `${index + 1}.jpeg`,
    ];

    for (const name of imageCandidates) {
      const fullImg = path.join(folderPath, name);
      if (fs.existsSync(fullImg)) {
        imgPath = "/tests/" + folder + "/" + name;
        break;
      }
    }

    return {
      id: index + 1,
      question: questionTextLines.join("\n"),
      choices,
      correct,
      image: imgPath,
    };
  });

  res.json({
    file: folder,
    questions,
  });
}

module.exports = {
  getTests,
  getParsedTest,
  getHomeStats,
};