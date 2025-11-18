/* ------------------------------------------------------------
   ⭐ CHẶN BACK: không được quay lại test/review
------------------------------------------------------------ */
history.pushState(null, "", window.location.href);
window.onpopstate = () => {
  window.location.href = "index.html";
};

/* ------------------------------------------------------------
   ⭐ LẤY TÊN FILE TEST
------------------------------------------------------------ */
const params = new URLSearchParams(window.location.search);
const file = params.get("file");
let latestAttemptId = null;

if (!file) {
  document.getElementById("score-box").innerText = "Error: missing test file.";
  throw new Error("Missing file param in URL");
}

let answers = {};
let questions = [];
let score = 0;

/* ------------------------------------------------------------
   ⭐ MESSAGE THEO MỨC ĐIỂM
------------------------------------------------------------ */
function getMessage(score) {
  if (score >= 26) {
    return "Bạn đang Aura-farming đấy! Tiếp tục duy trì nhé.";
  }
  if (score >= 24) {
    return "Bạn đích thực là một Sigma SAT";
  }
  if (score >= 21) {
    return "Cố lên! Bạn sắp trở thành Sigma SAT rồi";
  }
  return "Beta quá! Bạn cần nỗ lực thêm";
}

/* ------------------------------------------------------------
   ⭐ LOAD + CHẤM ĐIỂM + LƯU LỊCH SỬ
------------------------------------------------------------ */
async function loadScore() {
  try {
    const state = await fetch(`/api/test-state?file=${file}`).then((r) => r.json());
    if (!state.hasData) {
      document.getElementById("score-box").innerText =
        "No saved progress found for this test.";
      return;
    }

    answers = state.answers || {};

    const data = await fetch(`/api/parsed-test/${file}`).then((r) => r.json());
    questions = data.questions;

    calculateScore();
    renderScore();

    const total = questions.length;

    // ⭐ Lưu lịch sử
    await fetch("/api/test-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, score, totalQuestions: total, answers }),
      credentials: "same-origin",
    });

    // ⭐ Lấy attempt mới nhất
    const hx = await fetch(`/api/test-history?file=${file}`).then((r) => r.json());
    if (hx.history && hx.history.length > 0) {
      latestAttemptId = hx.history[0].id;
    }

    // ⭐ Reset state
    await fetch("/api/test-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
      credentials: "same-origin",
    });

  } catch (err) {
    console.error("Error loading score:", err);
    document.getElementById("score-box").innerText = "Error loading score data.";
  }
}

/* ------------------------------------------------------------
   ⭐ CHẤM ĐIỂM
------------------------------------------------------------ */
function calculateScore() {
  score = 0;
  questions.forEach((q) => {
    if (answers[q.id] && answers[q.id] === q.correct) {
      score++;
    }
  });
}

/* ------------------------------------------------------------
   ⭐ RENDER SCORE + MESSAGE
------------------------------------------------------------ */
function renderScore() {
  const total = questions.length;

  // ⭐ Message trên cùng
  const message = getMessage(score);
  document.getElementById("score-message").innerHTML = `
    <div style="font-size:20px; font-weight:600; color:#059669; margin-bottom:6px;">
      ${message}
    </div>
  `;

  // ⭐ Box điểm
  const box = document.getElementById("score-box");
  box.innerHTML = `
    <div style="font-size:26px; font-weight:700; margin-bottom:10px;">
      ${score} / ${total}
    </div>
    <div style="font-size:17px; color:#4b5563; margin-bottom:12px;">
      Bạn trả lời đúng <b>${score}</b> / <b>${total}</b> câu hỏi.
    </div>
  `;
}

/* ------------------------------------------------------------
   ⭐ NÚT TRANG CHỦ
------------------------------------------------------------ */
document.getElementById("back-home-btn").onclick = () => {
  window.location.href = "index.html";
};

/* ------------------------------------------------------------
   ⭐ NÚT XEM CHI TIẾT
------------------------------------------------------------ */
document.getElementById("detail-btn").onclick = () => {
  if (!latestAttemptId) {
    alert("Không tìm thấy lịch sử làm bài.");
    return;
  }

  window.location.href =
    "past_exam.html?attempt=" +
    latestAttemptId +
    "&file=" +
    encodeURIComponent(file);
};

/* ------------------------------------------------------------
   ⭐ RUN
------------------------------------------------------------ */
loadScore();
