// src/controllers/classAssignmentController.js
const db = require("../utils/db");
const { getAllTests } = require("../utils/tests");

function buildCategoryPayload() {
  const allTests = getAllTests();
  const categories = {};

  Object.entries(allTests).forEach(([category, names]) => {
    categories[category] = names.map((name) => ({
      name,
      test_file: `${category}/${name}`,
    }));
  });

  return categories;
}

async function getClassAssignments(req, res) {
  const classId = Number(req.params.id || req.query.classId);

  if (!classId || Number.isNaN(classId)) {
    return res.status(400).json({ error: "Lớp không hợp lệ" });
  }

  try {
    const classResult = await db.query(
      `SELECT id, name FROM classes WHERE id = $1 LIMIT 1`,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy lớp" });
    }

    const assignmentsResult = await db.query(
      `SELECT test_file FROM class_assignments WHERE class_id = $1`,
      [classId]
    );

    const categories = buildCategoryPayload();
    const assignedTests = new Set(assignmentsResult.rows.map((row) => row.test_file));

    res.json({
      classId,
      className: classResult.rows[0].name,
      categories,
      assigned: Array.from(assignedTests),
    });
  } catch (err) {
    console.error("getClassAssignments error:", err);
    return res.status(500).json({ error: "Lỗi server" });
  }
}

async function getUserMissingAssignments(req, res) {
  const classId = Number(req.params.classId);
  const userId = Number(req.params.userId);

  if (!classId || Number.isNaN(classId)) {
    return res.status(400).json({ error: "Lớp không hợp lệ" });
  }

  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: "Người dùng không hợp lệ" });
  }

  try {
    const classResult = await db.query(
      `SELECT id, name FROM classes WHERE id = $1 LIMIT 1`,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy lớp" });
    }

    const userResult = await db.query(
      `SELECT id, username, class_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const user = userResult.rows[0];
    if (user.class_id !== classId) {
      return res
        .status(400)
        .json({ error: "Học sinh không thuộc lớp đã chọn" });
    }

    const missingResult = await db.query(
      `
      SELECT ca.test_file, ca.category, ca.assigned_at, ctd.deadline
      FROM class_assignments ca
      LEFT JOIN class_test_deadlines ctd
        ON ctd.class_id = ca.class_id
       AND ctd.test_file = ca.test_file
      WHERE ca.class_id = $1
        AND (ctd.deadline IS NULL OR ctd.deadline >= CURRENT_DATE)    
        AND NOT EXISTS (
          SELECT 1 FROM test_history th
          WHERE th.user_id = $2 AND th.test_file = ca.test_file
        )
      ORDER BY ctd.deadline ASC NULLS LAST, ca.assigned_at DESC
      `,
      [classId, userId]
    );

    return res.json({
      classId,
      className: classResult.rows[0].name,
      userId,
      username: user.username,
      missingAssignments: missingResult.rows,
    });
  } catch (err) {
    console.error("getUserMissingAssignments error:", err);
    return res.status(500).json({ error: "Không thể tải danh sách còn thiếu" });
  }
}

async function toggleClassAssignment(req, res) {
  const classId = Number(req.params.id);
  const testFile = (req.body.test_file || "").trim();
  const category = (req.body.category || "").trim();

  if (!classId || Number.isNaN(classId)) {
    return res.status(400).json({ error: "Lớp không hợp lệ" });
  }

  if (!testFile) {
    return res.status(400).json({ error: "Thiếu thông tin bài tập" });
  }

  try {
    const classResult = await db.query(
      `SELECT id FROM classes WHERE id = $1 LIMIT 1`,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy lớp" });
    }

    const categories = buildCategoryPayload();
    const allTests = new Set(
      Object.values(categories)
        .flat()
        .map((item) => item.test_file)
    );

    if (!allTests.has(testFile)) {
      return res.status(400).json({ error: "Bài tập không hợp lệ" });
    }

    const existing = await db.query(
      `SELECT id FROM class_assignments WHERE class_id = $1 AND test_file = $2 LIMIT 1`,
      [classId, testFile]
    );

    if (existing.rows.length > 0) {
      await db.query(
        `DELETE FROM class_assignments WHERE class_id = $1 AND test_file = $2`,
        [classId, testFile]
      );

      return res.json({ assigned: false });
    }

    const effectiveCategory = category || testFile.split("/")[0] || "";

    await db.query(
      `INSERT INTO class_assignments (class_id, test_file, category, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, test_file) DO NOTHING`,
      [classId, testFile, effectiveCategory, req.session.userId || null]
    );

    return res.json({ assigned: true });
  } catch (err) {
    console.error("toggleClassAssignment error:", err);
    return res.status(500).json({ error: "Không thể cập nhật giao bài" });
  }
}

async function getMyAssignments(req, res) {
  const userId = req.session.userId;

  try {
    const userResult = await db.query(
      `SELECT u.class_id, c.name AS class_name FROM users u
       LEFT JOIN classes c ON u.class_id = c.id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    const user = userResult.rows[0];
    if (!user || !user.class_id) {
      return res.json({ classId: null, className: null, assignments: [] });
    }

    const assignmentsResult = await db.query(
      `
      SELECT ca.test_file, ca.category, ca.assigned_at, ctd.deadline
      FROM class_assignments ca
      LEFT JOIN class_test_deadlines ctd
        ON ctd.class_id = ca.class_id
       AND ctd.test_file = ca.test_file
      WHERE ca.class_id = $1
        AND (ctd.deadline IS NULL OR ctd.deadline >= CURRENT_DATE)
        AND NOT EXISTS (
          SELECT 1 FROM test_history th
          WHERE th.user_id = $2 AND th.test_file = ca.test_file
        )
      ORDER BY ctd.deadline ASC NULLS LAST, ca.assigned_at DESC
      `,
      [user.class_id, userId]
    );

    res.json({
      classId: user.class_id,
      className: user.class_name || null,
      assignments: assignmentsResult.rows,
    });
  } catch (err) {
    console.error("getMyAssignments error:", err);
    return res.status(500).json({ error: "Không thể tải bài tập" });
  }
}

module.exports = {
  getClassAssignments,
  toggleClassAssignment,
  getMyAssignments,
  getUserMissingAssignments,
};