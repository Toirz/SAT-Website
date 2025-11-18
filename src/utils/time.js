// src/utils/time.js
function getVNTime() {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
    .replace("T", " ");
}
function getVNDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

module.exports = {
  getVNTime,
  getVNDate,
};
