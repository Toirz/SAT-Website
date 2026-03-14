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
      `SELECT test_file FROM class_test_deadlines WHERE class_id = $1`,
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
      SELECT ctd.test_file, ctd.category, ctd.updated_at AS assigned_at, ctd.deadline
      FROM class_test_deadlines ctd
      WHERE ctd.class_id = $1
        AND ctd.deadline >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM test_history th
          WHERE th.user_id = $2 AND th.test_file = ctd.test_file
        )
      ORDER BY ctd.deadline ASC, ctd.updated_at DESC
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
  return res.status(410).json({
    error:
      "Đã bỏ chức năng giao bài thủ công. Bài có deadline sẽ tự động được tính là đã giao.",
  });
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
      SELECT ctd.test_file, ctd.category, ctd.updated_at AS assigned_at, ctd.deadline
      FROM class_test_deadlines ctd
      WHERE ctd.class_id = $1
        AND ctd.deadline >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM test_history th
          WHERE th.user_id = $2 AND th.test_file = ctd.test_file
        )
      ORDER BY ctd.deadline ASC, ctd.updated_at DESC
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