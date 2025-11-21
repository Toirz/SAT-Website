// src/controllers/historyController.js
const db = require("../utils/db");
const { getVNTime } = require("../utils/time");

// POST /api/test-history
async function saveTestHistory(req, res) {
  const userId = req.session.userId;
  const { file, score, totalQuestions, answers } = req.body;

  const answers_json = JSON.stringify(answers || {});

  try {
    // INSERT + RETURNING id
    const insertResult = await db.query(
      `
      INSERT INTO test_history (user_id, test_file, score, total_questions, answers_json, taken_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [userId, file, score, totalQuestions, answers_json, getVNTime()]
    );

    const insertedId = insertResult.rows[0].id;

    // Ghi heatmap
    const today = getVNTime().split(" ")[0]; // YYYY-MM-DD

    // Mỗi lần nộp bài tính là 1 lần luyện tập trong heatmap
    const solvedCount = 1;

    await db.query(
      `
      INSERT INTO user_activity (user_id, date, problems_solved)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        problems_solved = user_activity.problems_solved + EXCLUDED.problems_solved
    `,
     [userId, today, solvedCount]
    );

    res.json({ ok: true, id: insertedId });
  } catch (err) {
    console.error("INSERT test_history error:", err);
    return res
      .status(500)
      .json({ error: "Lưu lịch sử thất bại", detail: err.message });
  }
}

// GET /api/test-history
async function getTestHistory(req, res) {
  const userId = req.session.userId;
  const file = req.query.file;

  try {
    const result = await db.query(
      `
      SELECT id, score, total_questions, taken_at
      FROM test_history
      WHERE user_id = $1 AND test_file = $2
      ORDER BY taken_at DESC
      LIMIT 50
    `,
      [userId, file]
    );

    res.json({ history: result.rows });
  } catch (err) {
    console.error("getTestHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// GET /api/review-detail/:attemptId
async function getReviewDetail(req, res) {
  const userId = req.session.userId;
  const attemptId = req.params.attemptId;

  try {
    const result = await db.query(
      `
      SELECT id, test_file, answers_json, score, total_questions, taken_at
      FROM test_history
      WHERE id = $1 AND user_id = $2
    `,
      [attemptId, userId]
    );

    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Attempt not found" });

    res.json({
      file: row.test_file,
      answers: JSON.parse(row.answers_json),
      score: row.score,
      totalQuestions: row.total_questions,
      taken_at: row.taken_at,
    });
  } catch (err) {
    console.error("getReviewDetail error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// GET /api/test-state
async function getTestState(req, res) {
  const file = req.query.file;
  const userId = req.session.userId;

  try {
    const result = await db.query(
      `SELECT * FROM test_progress WHERE user_id = $1 AND test_file = $2`,
      [userId, file]
    );
    const row = result.rows[0];

    if (!row) {
      return res.json({
        hasData: false,
        answers: {},
        reviewList: [],
        highlights: {},
        eliminatedChoices: {},
        currentIndex: 0,
        remainingTime: null,
      });
    }

    res.json({
      hasData: true,
      answers: JSON.parse(row.answers || "{}"),
      reviewList: JSON.parse(row.review_list || "[]"),
      highlights: JSON.parse(row.highlights || "{}"),
      eliminatedChoices: JSON.parse(row.eliminated_choices || "{}"),
      currentIndex: row.current_index || 0,
      remainingTime: row.remaining_time || null,
    });
  } catch (err) {
    console.error("getTestState error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// POST /api/test-state
async function saveTestState(req, res) {
  const userId = req.session.userId;
  const {
    file,
    answers,
    eliminatedChoices,
    reviewList,
    highlights,
    currentIndex,
    remainingTime,
  } = req.body;

  try {
    await db.query(
      `
      INSERT INTO test_progress (user_id, test_file, answers, review_list, highlights, eliminated_choices, current_index, remaining_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, test_file) DO UPDATE SET
        answers = EXCLUDED.answers,
        review_list = EXCLUDED.review_list,
        highlights = EXCLUDED.highlights,
        eliminated_choices = EXCLUDED.eliminated_choices,
        current_index = EXCLUDED.current_index,
        remaining_time = EXCLUDED.remaining_time,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        userId,
        file,
        JSON.stringify(answers),
        JSON.stringify(reviewList),
        JSON.stringify(highlights || {}),
        JSON.stringify(eliminatedChoices || {}),
        currentIndex,
        remainingTime,
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("saveTestState error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// GET /api/test-completed
async function checkTestCompleted(req, res) {
  const userId = req.session.userId;
  const file = req.query.file;

  try {
    const result = await db.query(
      `
      SELECT score, total_questions
      FROM test_history
      WHERE user_id = $1 AND test_file = $2
      ORDER BY taken_at DESC
      LIMIT 1
    `,
      [userId, file]
    );

    const row = result.rows[0];
    res.json({
      completed: !!row,
      lastScore: row ? Number(row.score) : null,
      lastTotal: row ? Number(row.total_questions) : null,
    });
  } catch (err) {
    console.error("checkTestCompleted error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// POST /api/test-reset
async function resetTest(req, res) {
  const userId = req.session.userId;
  const { file } = req.body;

  try {
    await db.query(
      `DELETE FROM test_progress WHERE user_id = $1 AND test_file = $2`,
      [userId, file]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("resetTest error:", err);
    return res
      .status(500)
      .json({ error: "Lỗi server khi reset test" });
  }
}

// GET /api/heatmap
async function getHeatmap(req, res) {
  const userId = req.session.userId;

  res.set("Cache-Control", "no-store");

  try {
    const result = await db.query(
      `
      SELECT date, problems_solved
      FROM user_activity
      WHERE user_id = $1
      ORDER BY date ASC
    `,
      [userId]
    );

    const activity = result.rows.map((row) => {
      const dateObj = row.date instanceof Date ? row.date : new Date(row.date);
      const dateStr = dateObj.toLocaleDateString("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh",
      });

      return {
        date: dateStr,
        problems_solved: row.problems_solved,
      };
    });

    res.json({ activity });
  } catch (err) {
    console.error("getHeatmap error:", err);
    return res.status(500).json({ error: "Lỗi server" });
  }
}

module.exports = {
  saveTestHistory,
  getTestHistory,
  getReviewDetail,
  getTestState,
  saveTestState,
  checkTestCompleted,
  resetTest,
  getHeatmap,
};
