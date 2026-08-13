const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dir = path.join(__dirname, "..", "content", "apparel");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
  );
  items.sort((a, b) => a.order - b.order);
  return items;
};
