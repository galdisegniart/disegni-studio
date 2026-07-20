const fs = require("fs");
const path = require("path");

module.exports = () => {
  const dir = path.join(__dirname, "..", "content", "workshops");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const workshops = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
  );
  workshops.sort((a, b) => a.order - b.order);
  return workshops;
};
