const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dir = path.join(__dirname, "..", "content", "pages");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const pages = {};
  for (const f of files) {
    const key = f.replace(/\.json$/, "");
    pages[key] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return pages;
};
