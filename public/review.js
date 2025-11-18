/* ------------------------------------------------------------
   ⭐ LẤY TÊN FILE TEST TỪ URL (bây giờ là TÊN FOLDER, vd: "Test 1")
------------------------------------------------------------ */
const params = new URLSearchParams(window.location.search);
const file = params.get("file");

if (!file) {
  alert("Missing file test");
  throw new Error("Missing file");
}

/* ------------------------------------------------------------
   ⭐ BIẾN TOÀN CỤC
------------------------------------------------------------ */
let answers = {};
let reviewList = [];
let totalQuestions = 0;
let remainingTime = 0;

/* ------------------------------------------------------------
   ⭐ LOAD STATE + LOAD ĐỀ
------------------------------------------------------------ */
async function load() {
  // 1) Lấy state từ database
  const state = await fetch(`/api/test-state?file=${encodeURIComponent(file)}`)
    .then(r => r.json());

  if (state.hasData) {
    answers = state.answers || {};
    reviewList = state.reviewList || [];
    remainingTime = state.remainingTime || 0;
  }

  // 2) Lấy đề để biết tổng số câu (theo FOLDER test)
  const res = await fetch(`/api/parsed-test/${encodeURIComponent(file)}`);
  const data = await res.json();
  totalQuestions = data.questions.length;

  // 3) Build grid sau khi có đủ thông tin
  buildGrid();

  // 4) Start timer (nếu còn thời gian)
  startTimer();
}

/* ------------------------------------------------------------
   ⭐ BUILD GRID
------------------------------------------------------------ */
function buildGrid() {
  const grid = document.getElementById("review-grid");
  grid.innerHTML = "";

  for (let i = 0; i < totalQuestions; i++) {
    const div = document.createElement("div");
    div.className = "q-item";
    div.innerText = i + 1;

    const qid = i + 1; // id câu trong answers

    if (answers[qid]) div.classList.add("answered");
    if (reviewList.includes(i)) div.classList.add("marked");

    div.onclick = () => goToQuestion(i);

    grid.appendChild(div);
  }
}

/* ------------------------------------------------------------
   ⭐ TIMER
------------------------------------------------------------ */
function startTimer() {
  updateTimerUI(remainingTime);

  // Nếu không còn thời gian (0 hoặc âm) thì không chạy countdown nữa,
  // chỉ hiển thị để review thôi.
  if (remainingTime <= 0) return;

  const intervalId = setInterval(() => {
    remainingTime--;

    updateTimerUI(remainingTime);

    // hết giờ → sang score
    if (remainingTime <= 0) {
      clearInterval(intervalId);
      window.location.href = `score.html?file=${encodeURIComponent(file)}`;
      return;
    }

    // CHỈ LƯU LẠI remainingTime + trạng thái lên DB
    fetch("/api/test-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file,
        answers,
        reviewList,
        currentIndex: -1, // review page không thay đổi câu hiện tại
        remainingTime
      })
    });
  }, 1000);
}

function updateTimerUI(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const display = `${min}:${sec < 10 ? "0" + sec : sec}`;

  const tm = document.getElementById("timer-value");
  if (tm) tm.textContent = display;
}

/* ------------------------------------------------------------
   ⭐ CLICK SỐ CÂU → VỀ test.html
------------------------------------------------------------ */
function goToQuestion(index) {
  window.location.href = `test.html?file=${encodeURIComponent(file)}&goto=${index}`;
}

/* ------------------------------------------------------------
   ⭐ BUTTON NEXT → sang score
------------------------------------------------------------ */
document.getElementById("next-btn").onclick = () => {
  window.location.href = `score.html?file=${encodeURIComponent(file)}`;
};

/* ------------------------------------------------------------
   ⭐ BUTTON BACK → về câu đang dở trong test.html
------------------------------------------------------------ */
document.getElementById("back-btn").onclick = async () => {
  const state = await fetch(`/api/test-state?file=${encodeURIComponent(file)}`)
    .then((r) => r.json());
  const idx = state.currentIndex ?? 0;
  window.location.href = `test.html?file=${encodeURIComponent(file)}&goto=${idx}`;
};

/* ------------------------------------------------------------
   ⭐ RUN
------------------------------------------------------------ */
load();
