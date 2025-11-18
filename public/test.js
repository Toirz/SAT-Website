let questions = [];
let current = 0;

// answers: { questionId: "A" }
let answers = {};
// review list: [ questionIndex ]
let reviewList = [];

/* ----------------------------------------------------------
   LẤY THÔNG TIN TỪ URL
---------------------------------------------------------- */
const params = new URLSearchParams(window.location.search);
const file = params.get("file");            // tên file test
const gotoParam = params.get("goto");       // có thể là số hoặc "LAST"

document.getElementById("save-exit-btn").onclick = () => {
  // Dừng đếm giờ
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Lưu state rồi mới thoát
  saveState()
    .finally(() => {
      window.location.href = "index.html";
    });
};

let gotoIndex = null;
if (gotoParam === "LAST") {
  gotoIndex = "LAST";
} else if (!isNaN(parseInt(gotoParam))) {
  gotoIndex = parseInt(gotoParam);
}

/* ----------------------------------------------------------
   TIMER
---------------------------------------------------------- */
let timeLimit = 32 * 60; // 32 phút
let timerInterval = null;

function startTimer() {
  updateTimerUI(timeLimit);

  timerInterval = setInterval(() => {
    timeLimit--;

    updateTimerUI(timeLimit);
    saveState(); // lưu DB mỗi giây

    if (timeLimit <= 0) {
      clearInterval(timerInterval);
      window.location.href = "score.html?file=" + file;
    }
  }, 1000);
}

function updateTimerUI(seconds) {
  if (seconds < 0) seconds = 0;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const display = `${min}:${sec < 10 ? "0" + sec : sec}`;

  const tm = document.getElementById("timer-value");
  if (tm) tm.innerText = display;
}

/* ----------------------------------------------------------
   SAVE STATE -> LƯU TRÊN DB
---------------------------------------------------------- */
function saveState() {
  return fetch("/api/test-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file,
      answers,
      reviewList,
      currentIndex: current,
      remainingTime: timeLimit,
    }),
  }).catch((err) => console.error("Save state error:", err));
}

// ----------------------------------------------------------
// FORMAT TEXT: *italic*, **bold**, __underline__ + xuống dòng
// ----------------------------------------------------------
function formatText(raw) {
  if (!raw) return "";

  // 1. Escape HTML trước cho an toàn
  let text = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // 3. Underline: __text__
  //    Chỉ match khi bên trong CÓ ít nhất 1 ký tự KHÔNG phải "_"
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

/* ----------------------------------------------------------
   LOAD TEST + LOAD STATE TỪ DB
---------------------------------------------------------- */
async function load() {
  // 1. Lấy đề
  const res = await fetch("/api/parsed-test/" + file);
  const data = await res.json();
  questions = data.questions;
  document.getElementById("total-question").innerText = questions.length;

  // 2. Lấy state từ database
  let state = null;
  try {
    state = await fetch(`/api/test-state?file=${file}`).then((r) => r.json());
  } catch (e) {
    console.error("Error loading state from DB:", e);
  }

  if (state && state.hasData) {
    answers = state.answers || {};
    reviewList = state.reviewList || [];
    current = state.currentIndex || 0;
    if (typeof state.remainingTime === "number" && state.remainingTime > 0) {
      timeLimit = state.remainingTime;
    }
  } else {
    // nếu chưa có state, bắt đầu mới
    answers = {};
    reviewList = [];
    current = 0;
    timeLimit = 32 * 60;
  }

  // 3. Nếu có goto (từ review)
  if (gotoIndex !== null) {
    if (gotoIndex === "LAST") {
      current = questions.length - 1;
    } else if (gotoIndex >= 0 && gotoIndex < questions.length) {
      current = gotoIndex;
    }
  }

  // 4. Đảm bảo current nằm trong [0, questions.length-1]
  if (current < 0 || current >= questions.length) {
    current = 0;
  }

  // 5. Render lần đầu + start timer
  render();
  renderGrid();
  startTimer();
}

/* ----------------------------------------------------------
   LOAD ẢNH — CHỈ HÀM NÀY LÀ MỚI
---------------------------------------------------------- */
function loadQuestionImage(questionId) {
  const imgWrapper = document.getElementById("question-image-wrapper");
  const imgEl = document.getElementById("question-image");

  // Nếu HTML chưa có wrapper/img → không làm gì, tránh crash
  if (!imgWrapper || !imgEl) return;

  const folderName = file;  // folder test trong /tests
  const imagePath = `/tests/${folderName}/${questionId}.jpg`;

  fetch(imagePath)
    .then((res) => {
      if (res.ok) {
        imgEl.src = imagePath;
        imgEl.alt = `Question ${questionId} illustration`;
        imgWrapper.classList.remove("hidden");
      } else {
        imgEl.removeAttribute("src");
        imgWrapper.classList.add("hidden");
      }
    })
    .catch(() => {
      imgEl.removeAttribute("src");
      imgWrapper.classList.add("hidden");
    });
}

/* ----------------------------------------------------------
   RENDER MAIN UI
---------------------------------------------------------- */
function render() {
  const q = questions[current];
  if (!q) return;

  // --- Bookmark ---
  const icon = document.getElementById("bookmark-icon");
  const text = document.getElementById("mark-text");

  if (reviewList.includes(current)) {
    icon.src = "/bookmark/bookmark-outline-red.svg";
    text.textContent = "Marked for Review";
  } else {
    icon.src = "/bookmark/bookmark-outline-gray.svg";
    text.textContent = "Mark for Review";
  }

  // --- Tách passage và question ---
  const lines = q.question.split("\n");
  const questionPrompt = lines[0];
  const passage = lines.slice(1).join("\n");

  // Dùng innerHTML + formatText để áp dụng * ** __
  document.getElementById("passage").innerHTML = formatText(passage);
  document.getElementById("question-text").innerHTML = formatText(questionPrompt);

  document.getElementById("q-number-text").innerText = current + 1;
  document.getElementById("current-question").innerText = current + 1;

  // --- ẢNH CÂU HỎI (GỌI HÀM MỚI) ---
  loadQuestionImage(q.id);

  // --- Đáp án ---
  const box = document.getElementById("choices");
  box.innerHTML = "";

  ["A", "B", "C", "D"].forEach((opt) => {
    const wrapper = document.createElement("div");
    wrapper.className =
      "choice" + (answers[q.id] === opt ? " selected" : "");

    wrapper.onclick = () => {
      answers[q.id] = opt;
      render();
      renderGrid();
      saveState();
    };

    wrapper.innerHTML = `<b>${opt}</b> <span>${formatText(q.choices[opt])}</span>`;

    box.appendChild(wrapper);
  });
}

/* ----------------------------------------------------------
   GRID RENDER
---------------------------------------------------------- */
function renderGrid() {
  const grid = document.getElementById("question-grid");
  if (!grid) return;

  grid.innerHTML = "";

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const div = document.createElement("div");
    div.className = "q-item";
    div.textContent = i + 1;

    if (i === current) div.classList.add("current");
    if (answers[q.id]) div.classList.add("answered");
    if (reviewList.includes(i)) div.classList.add("marked");

    div.onclick = () => {
      current = i;
      hidePopover();
      render();
      renderGrid();
      saveState();
    };

    grid.appendChild(div);
  }
}

/* ----------------------------------------------------------
   NEXT / BACK
---------------------------------------------------------- */
document.getElementById("next-btn").onclick = () => {
  if (current < questions.length - 1) {
    current++;
    render();
    renderGrid();
    saveState();
  } else {
    // Đi hết -> sang review
    window.location.href = "review.html?file=" + file;
  }
};

document.getElementById("back-btn").onclick = () => {
  if (current > 0) {
    current--;
    render();
    renderGrid();
    saveState();
  }
};

/* ----------------------------------------------------------
   POPUP
---------------------------------------------------------- */
const popover = document.getElementById("question-popover");

function hidePopover() {
  popover.classList.add("hidden");
}

/* ----------------------------------------------------------
   MARK FOR REVIEW BUTTON (KHÔI PHỤC)
---------------------------------------------------------- */
document.getElementById("mark-review-btn").onclick = () => {
  if (reviewList.includes(current)) {
    // Bỏ mark
    reviewList = reviewList.filter(i => i !== current);
  } else {
    // Thêm mark
    reviewList.push(current);
  }

  // Cập nhật UI
  render();
  renderGrid();
  saveState();
};

document.getElementById("question-toggle-btn").onclick = () => {
  popover.classList.toggle("hidden");
};

document.getElementById("close-popover").onclick = hidePopover;

/* ----------------------------------------------------------
   GO REVIEW
---------------------------------------------------------- */
document.getElementById("go-review-btn").onclick = () => {
  window.location.href = "review.html?file=" + file;
};

/* ----------------------------------------------------------
   LOAD PAGE
---------------------------------------------------------- */
load();
