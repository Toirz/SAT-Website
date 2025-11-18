let questions = [];
let current = 0;

// answers: { questionId: "A" }
let answers = {};
// eliminatedChoices: { questionId: ["A", "C"] }
let eliminatedChoices = {};
// review list: [ questionIndex ]
let reviewList = [];
// highlights: { questionId: [ { start, end, color } ] }
let highlights = {};
let pendingSelectionOffsets = null;
const DEFAULT_HIGHLIGHT_COLOR = "yellow";

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
      eliminatedChoices,
      reviewList,
      highlights,
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
  const res = await fetch(`/api/parsed-test?file=${encodeURIComponent(file)}`);
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
    eliminatedChoices = state.eliminatedChoices || {};
    reviewList = state.reviewList || [];
    highlights = state.highlights || {};
    current = state.currentIndex || 0;
    if (typeof state.remainingTime === "number" && state.remainingTime > 0) {
      timeLimit = state.remainingTime;
    }
  } else {
    // nếu chưa có state, bắt đầu mới
    answers = {};
    eliminatedChoices = {};
    reviewList = [];
    highlights = {};
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
   HIGHLIGHT HELPERS
---------------------------------------------------------- */
function getOffsetsWithinPassage(range, root) {
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(root);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const start = preSelectionRange.toString().length;

  const selectionRange = range.cloneRange();
  selectionRange.selectNodeContents(root);
  selectionRange.setEnd(range.endContainer, range.endOffset);
  const end = selectionRange.toString().length;

  const maxLen = root.textContent.length;
  const normalizedStart = Math.max(0, Math.min(start, maxLen));
  const normalizedEnd = Math.max(0, Math.min(end, maxLen));

  if (normalizedStart === normalizedEnd) return null;

  return {
    start: Math.min(normalizedStart, normalizedEnd),
    end: Math.max(normalizedStart, normalizedEnd),
  };
}

function findTextPosition(root, target) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node;
  while ((node = walker.nextNode())) {
    const next = offset + node.textContent.length;
    if (target <= next) {
      return { node, offset: target - offset };
    }
    offset = next;
  }
  return null;
}

function normalizeHighlightRanges(ranges) {
  return (ranges || [])
    .filter((r) => typeof r?.start === "number" && typeof r?.end === "number")
    .map((r) => ({
      start: r.start,
      end: r.end,
      color: r.color || DEFAULT_HIGHLIGHT_COLOR,
    }));
}

function wrapRangeInMark(root, start, end, color = DEFAULT_HIGHLIGHT_COLOR) {
  if (end <= start) return;
  const startPos = findTextPosition(root, start);
  const endPos = findTextPosition(root, end);
  if (!startPos || !endPos) return;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const mark = document.createElement("mark");
  mark.className = `highlight highlight-${color}`;
  range.surroundContents(mark);
}

function mergeRanges(list) {
  const sorted = normalizeHighlightRanges(list).sort((a, b) => a.start - b.start);  

  const merged = [];
  sorted.forEach((r) => {
    if (!merged.length) {
      merged.push({ start: r.start, end: r.end, color: r.color });
      return;
    }
    const last = merged[merged.length - 1];
    if (r.color === last.color && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end, color: r.color });
    }
  });

  return merged;
}

function applyHighlightsForQuestion(questionId) {
  const passageEl = document.getElementById("passage");
  const ranges = normalizeHighlightRanges(highlights[questionId]);
  if (!passageEl || !ranges.length) return;

  ranges.forEach((r) => wrapRangeInMark(passageEl, r.start, r.end, r.color));
}

function hideHighlightMenu() {
  const menu = document.getElementById("highlight-menu");
  if (menu) {
    menu.classList.add("hidden");
  }
  pendingSelectionOffsets = null;
}

function positionHighlightMenu(rect) {
  const menu = document.getElementById("highlight-menu");
  if (!menu) return;

  const top = rect.bottom + window.scrollY + 8;
  const left = rect.left + window.scrollX + rect.width / 2;
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.classList.remove("hidden");
}

function handlePassageSelection() {
  const passageEl = document.getElementById("passage");
  const selection = window.getSelection();
  if (!passageEl || !selection || selection.rangeCount === 0) {
    hideHighlightMenu();
    return;
  }

  if (selection.isCollapsed) {
    hideHighlightMenu();
    return;
  }

  const range = selection.getRangeAt(0);
  if (!passageEl.contains(range.commonAncestorContainer)) {
    hideHighlightMenu();
    return;
  }

  const offsets = getOffsetsWithinPassage(range, passageEl);
  if (!offsets) {
    hideHighlightMenu();
    return;
  }

  pendingSelectionOffsets = offsets;
  positionHighlightMenu(range.getBoundingClientRect());
}

function applyHighlightAction(action, color = DEFAULT_HIGHLIGHT_COLOR) {
  if (!pendingSelectionOffsets) return;

  const passageEl = document.getElementById("passage");
  const q = questions[current];
  if (!passageEl || !q) {
    hideHighlightMenu();
    return;
  }

  const qId = q.id;
  if (!highlights[qId]) highlights[qId] = [];
  highlights[qId] = normalizeHighlightRanges(highlights[qId]);

  if (action === "highlight") {
    highlights[qId].push({
      ...pendingSelectionOffsets,
      color,
    });
    highlights[qId] = mergeRanges(highlights[qId]);
  } else if (action === "erase") {
    highlights[qId] = (highlights[qId] || []).filter(
      (r) => pendingSelectionOffsets.end <= r.start || pendingSelectionOffsets.start >= r.end
    );
  }

  const lines = q.question.split("\n");
  const passage = lines.slice(1).join("\n");
  passageEl.innerHTML = formatText(passage);
  applyHighlightsForQuestion(qId);

  const selection = window.getSelection();
  if (selection) selection.removeAllRanges();

  hideHighlightMenu();
  saveState();
}

/* ----------------------------------------------------------
   ELIMINATION HELPERS
---------------------------------------------------------- */
function toggleChoiceElimination(questionId, option) {
  if (!eliminatedChoices[questionId]) eliminatedChoices[questionId] = [];

  const idx = eliminatedChoices[questionId].indexOf(option);
  let nowEliminated = false;
  if (idx >= 0) {
    eliminatedChoices[questionId].splice(idx, 1);
  } else {
    eliminatedChoices[questionId].push(option);
    nowEliminated = true;
  }

  if (nowEliminated && answers[questionId] === option) {
    delete answers[questionId];
  }

  render();
  renderGrid();
  saveState();
}

function isChoiceEliminated(questionId, option) {
  return (eliminatedChoices[questionId] || []).includes(option);
}

function clearEliminationForOption(questionId, option) {
  if (!eliminatedChoices[questionId]) return;
  eliminatedChoices[questionId] = eliminatedChoices[questionId].filter(
    (o) => o !== option
  );
}

/* ----------------------------------------------------------
   RENDER MAIN UI
---------------------------------------------------------- */
function render() {
  const q = questions[current];
  if (!q) return;

  hideHighlightMenu();

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

  applyHighlightsForQuestion(q.id);

  document.getElementById("q-number-text").innerText = current + 1;
  document.getElementById("current-question").innerText = current + 1;

  // --- ẢNH CÂU HỎI (GỌI HÀM MỚI) ---
  loadQuestionImage(q.id);

  // --- Đáp án ---
  const box = document.getElementById("choices");
  box.innerHTML = "";

  ["A", "B", "C", "D"].forEach((opt) => {
    const isEliminated = isChoiceEliminated(q.id, opt);
    const wrapper = document.createElement("div");
    wrapper.className =
      "choice" +
      (answers[q.id] === opt ? " selected" : "") +
      (isEliminated ? " eliminated" : "");

    wrapper.onclick = () => {
      clearEliminationForOption(q.id, opt);
      answers[q.id] = opt;
      render();
      renderGrid();
      saveState();
    };

    wrapper.innerHTML = `<b>${opt}</b> <span>${formatText(q.choices[opt])}</span>`;

    const eliminateBtn = document.createElement("button");
    eliminateBtn.type = "button";
    eliminateBtn.className = "eliminate-btn";
    eliminateBtn.innerHTML = isEliminated ? "⊝" : "⊘";
    eliminateBtn.onclick = (event) => {
      event.stopPropagation();
      toggleChoiceElimination(q.id, opt);
    };

    wrapper.appendChild(eliminateBtn);
    
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

const passageEl = document.getElementById("passage");
["mouseup", "touchend"].forEach((evt) => {
  passageEl.addEventListener(evt, handlePassageSelection);
});

const highlightColorButtons = document.querySelectorAll("[data-highlight-color]");
const eraseActionBtn = document.getElementById("erase-action");
highlightColorButtons.forEach((btn) => {
  btn.onclick = (e) => {
    e.stopPropagation();
    const color = btn.getAttribute("data-highlight-color") || DEFAULT_HIGHLIGHT_COLOR;
    applyHighlightAction("highlight", color);
  };
});

if (eraseActionBtn) {
  eraseActionBtn.onclick = (e) => {
    e.stopPropagation();
    applyHighlightAction("erase");
  };
}

["mousedown", "touchstart"].forEach((evt) => {
  document.addEventListener(evt, (event) => {
    const menu = document.getElementById("highlight-menu");
    if (!menu) return;
    if (!menu.contains(event.target)) {
      hideHighlightMenu();
    }
  });
});

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
