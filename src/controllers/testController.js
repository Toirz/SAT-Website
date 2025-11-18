// src/controllers/testController.js
const fs = require("fs");
const path = require("path");

const testsDir = path.join(__dirname, "..", "..", "tests");

// GET /api/tests
function getTests(req, res) {
  try {
    const files = fs.readdirSync(testsDir);
    const tests = files.filter((f) =>
      fs.statSync(path.join(testsDir, f)).isDirectory()
    );
    res.json(tests);
  } catch (err) {
    console.error("Error reading tests:", err);
    res.status(500).send("Cannot read tests folder");
  }
}

// GET /api/parsed-test/:folder
function getParsedTest(req, res) {
  const folder = decodeURIComponent(req.params.folder);
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
};
