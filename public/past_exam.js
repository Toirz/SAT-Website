// Lấy param từ URL: past_exam.html?attempt=3&file=Test%202&q=0
const params = new URLSearchParams(window.location.search);
const attemptId = params.get("attempt");
let currentIndex = parseInt(params.get("q") || "0", 10);
const hasQParam = params.has("q");              // ✅ mới
const fileFromQuery = params.get("file"); // tên folder test nếu có

if (!attemptId) {
  console.error("[PAST] Missing attempt id in URL");
  const main = document.querySelector(".past-main");
  if (main) main.innerHTML = "<p>Missing attempt id.</p>";
  throw new Error("Missing attempt id");
}

let questions = [];
let answers = {};
let fileName = "";

// ================== FORMAT TEXT (*, **, __, xuống dòng) ==================
function formatText(raw) {
  if (!raw) return "";

  // 1. Escape HTML cho an toàn
  let text = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // 3. Underline: __text__
  text = text.replace(/__([^_]+?)__/g, "<u>$1</u>");

  // 4. Italic: *text*
  text = text.replace(/\*(.+?)\*/g, "<i>$1</i>");

  // 5. Xuống dòng
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\n\n+/g, "<br><br>")
    .replace(/\n/g, "<br>");

  return text;
}


// ================== LOAD DATA ==================
async function loadPastExam() {
  try {
    console.log("[PAST] Loading meta for attempt", attemptId);
    const metaRes = await fetch(
      `/api/review-detail/${encodeURIComponent(attemptId)}`,
      { credentials: "same-origin" }
    );

    let meta;
    try {
      meta = await metaRes.json();
    } catch (e) {
      console.error("[PAST] Cannot parse meta JSON:", e);
      const main = document.querySelector(".past-main");
      if (main) main.innerHTML = "<p>Error: cannot parse server response.</p>";
      return;
    }

    if (!metaRes.ok || meta.error) {
      console.error("[PAST] Meta error:", meta.error || metaRes.status);
      const main = document.querySelector(".past-main");
      if (main) main.innerHTML =
        `<p style="color:#b91c1c;">${meta.error || "Cannot load attempt meta."}</p>`;
      return;
    }

    fileName = meta.file;
    answers = meta.answers || {};

    const testFile = fileFromQuery || fileName;
    if (!testFile) {
      const main = document.querySelector(".past-main");
      if (main) main.innerHTML = "<p>Missing test file for this attempt.</p>";
      return;
    }

    console.log("[PAST] Loading questions from", testFile);

    const testRes = await fetch(
     `/api/parsed-test?file=${encodeURIComponent(testFile)}`,
      { credentials: "same-origin" }
    );

    const testData = await testRes.json();
    if (!testRes.ok || testData.error) {
      console.error("[PAST] parsed-test error:", testData.error || testRes.status);
      const main = document.querySelector(".past-main");
      if (main) main.innerHTML =
        `<p style="color:#b91c1c;">${testData.error || "Cannot load test data."}</p>`;
      return;
    }

    questions = (testData.questions || []).map((q) => ({
      ...q,
      userAnswer: answers[q.id] || null,
    }));

    if (!questions.length) {
      const main = document.querySelector(".past-main");
      if (main) main.innerHTML = "<p>No questions found for this attempt.</p>";
      return;
    }

    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= questions.length) currentIndex = questions.length - 1;

    // ===== TÍNH SỐ CÂU ĐÚNG =====
    let correctCount = 0;
    questions.forEach((q) => {
      if (q.userAnswer && q.userAnswer === q.correct) correctCount++;
    });

    // ===== ĐỔ DỮ LIỆU VÀO PANEL INFO (KHÔNG CÒN SCORE) =====
    const nameEl = document.getElementById("attempt-test-name");
    if (nameEl) {
      // Hiển thị tên test không kèm tiền tố thư mục (ví dụ: real_tests/ hoặc practice_tests/)
      const rawName = fileFromQuery || meta.file || "SAT Test";
      const displayName = String(rawName).replace(/^(?:real_tests|practice_tests)\/+/, "");
      nameEl.textContent = displayName;
    }

    const correctEl = document.getElementById("attempt-correct");
    if (correctEl) {
      correctEl.textContent = `Correct: ${correctCount} / ${questions.length}`;
    }

    // Thời gian đã bị loại khỏi giao diện (không hiển thị)

    // render bảng + popup
    renderQuestion();
    renderSummaryTable();

    if (hasQParam) {
      openOverlay();
    }

  } catch (err) {
    console.error("[PAST] loadPastExam error:", err);
    const main = document.querySelector(".past-main");
    if (main) {
      main.innerHTML =
        "<p style='color:#b91c1c;'>Error loading review data.</p>";
    }
  }
}



// ================== RENDER 1 CÂU ==================
function renderQuestion() {
  const q = questions[currentIndex];
  if (!q) return;

  // Tiêu đề + vị trí
  const titleEl = document.getElementById("past-title");
  const posEl = document.getElementById("position-text");
  if (titleEl) titleEl.textContent = `Review Question ${q.id}`;
  if (posEl) posEl.textContent = `Question ${q.id} of ${questions.length}`;

  // Nội dung câu hỏi
  const qEl = document.getElementById("question-text");
  if (qEl) {
    qEl.innerHTML = formatText(q.question || "");
  }

  // Ảnh
  const imgWrapper = document.getElementById("question-image-wrapper");
  const imgEl = document.getElementById("question-image");
  if (imgWrapper && imgEl) {
    if (q.image) {
      imgEl.src = q.image;
      imgEl.alt = `Question ${q.id} illustration`;
      imgWrapper.classList.remove("hidden");
    } else {
      imgEl.removeAttribute("src");
      imgWrapper.classList.add("hidden");
    }
  }

  // Đáp án
  const box = document.getElementById("choices");
  if (box) {
    box.innerHTML = "";
    ["A", "B", "C", "D"].forEach((opt) => {
      const wrapper = document.createElement("div");
      wrapper.className = "choice";

      const label = document.createElement("div");
      label.className = "choice-label";
      label.textContent = opt;

      const text = document.createElement("div");
      text.className = "choice-text";
      text.innerHTML = formatText(q.choices[opt] || "");

      wrapper.appendChild(label);
      wrapper.appendChild(text);

      if (!q.userAnswer) wrapper.classList.add("unanswered");

      if (q.correct === opt && q.userAnswer === opt) {
        wrapper.classList.add("correct-user");
      } else if (q.correct === opt) {
        wrapper.classList.add("correct");
      } else if (q.userAnswer === opt) {
        wrapper.classList.add("wrong-user");
      }

      box.appendChild(wrapper);
    });
  }

  // Tóm tắt
  const summary = document.getElementById("summary-text");
  if (summary) {
    if (!q.userAnswer) {
      summary.textContent = "You did not answer this question.";
    } else if (q.userAnswer === q.correct) {
      summary.textContent = "You answered this question correctly.";
    } else {
      summary.textContent = `Correct answer: ${q.correct}. Your answer: ${q.userAnswer}.`;
    }
  }

  renderNavigator();
}

// ================== BẢNG 4 CỘT ==================
// ================== BẢNG 4 CỘT ==================
// ================== BẢNG 4 CỘT ==================
// ================== BẢNG 4 CỘT ==================
function renderSummaryTable() {
  const tbody = document.getElementById("summary-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  questions.forEach((q, index) => {
    const tr = document.createElement("tr");

    // No
    const tdNo = document.createElement("td");
    tdNo.textContent = q.id;
    tr.appendChild(tdNo);

    // ============================
    // ⚡ QUESTION STEM (chỉ lấy phần có dấu ?)
    // ============================
    const tdQ = document.createElement("td");
    tdQ.className = "summary-question-text";

    let full = q.question || "";

    // Tách thành từng dòng, loại bỏ dòng trống
    let lines = full.split("\n").map(l => l.trim()).filter(Boolean);

    // Tìm dòng có chứa dấu ?
    let questionLine = lines.find(line => line.includes("?"));

    // Nếu không tìm thấy dấu ?, dùng dòng cuối như fallback
    if (!questionLine) {
      questionLine = lines[lines.length - 1] || "";
    }

    // Lấy đến dấu ? đầu tiên
    let stem = questionLine.split("?")[0].trim() + "?";

    tdQ.textContent = stem;
    tr.appendChild(tdQ);

    // Status
    const tdStatus = document.createElement("td");
    let statusText = "";
    if (!q.userAnswer) {
      statusText = "Omitted";
      tdStatus.classList.add("status-omitted");
    } else if (q.userAnswer === q.correct) {
      statusText = "Correct";
      tdStatus.classList.add("status-correct");
    } else {
      statusText = "Incorrect";
      tdStatus.classList.add("status-incorrect");
    }
    tdStatus.textContent = statusText;
    tr.appendChild(tdStatus);

    // Action button
    const tdAction = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "Review";
    btn.className = "summary-review-btn";
    btn.onclick = () => {
      currentIndex = index;
      renderQuestion();
      updateUrlQuery();
      openOverlay();
    };
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}




// ================== NAVIGATOR BÊN PHẢI ==================
function renderNavigator() {
  const nav = document.getElementById("navigator");
  if (!nav) return;

  nav.innerHTML = "";

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "nav-item";
    div.textContent = q.id;

    if (!q.userAnswer) {
      div.classList.add("unanswered");
    } else if (q.userAnswer === q.correct) {
      div.classList.add("correct");
    } else {
      div.classList.add("wrong");
    }

    if (index === currentIndex) {
      div.classList.add("current");
    }

    div.onclick = () => {
      currentIndex = index;
      renderQuestion();
      updateUrlQuery();
    };

    nav.appendChild(div);
  });
}


// ================== NAVIGATION PREV/NEXT ==================
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

if (prevBtn) {
  prevBtn.onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
      updateUrlQuery();
    }
  };
}

if (nextBtn) {
  nextBtn.onclick = () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderQuestion();
      updateUrlQuery();
    }
  };
}

// ================== OVERLAY OPEN/CLOSE ==================
const overlayEl = document.getElementById("review-overlay");
const closeOverlayBtn = document.getElementById("close-overlay");

function openOverlay() {
  if (overlayEl) overlayEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeOverlay() {
  if (overlayEl) overlayEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

// ❗ Thêm tính năng click ra ngoài để đóng panel:
overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) {
    closeOverlay();
  }
});

if (closeOverlayBtn) {
  closeOverlayBtn.onclick = closeOverlay;
}


// ================== UPDATE URL ==================
function updateUrlQuery() {
  const url = new URL(window.location.href);
  url.searchParams.set("attempt", attemptId);
  url.searchParams.set("q", currentIndex.toString());
  if (fileFromQuery) url.searchParams.set("file", fileFromQuery);
  window.history.replaceState({}, "", url.toString());
}

// ================== RUN ==================
loadPastExam();
