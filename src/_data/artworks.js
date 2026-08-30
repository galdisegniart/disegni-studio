const fs = require("fs");
const path = require("path");
const flattenLocale = require("../_lib/flattenLocale.js");

module.exports = () => {
  const dir = path.join(__dirname, "..", "content", "artworks");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const artworks = files.map((f) =>
    flattenLocale(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
  );
  artworks.sort((a, b) => a.order - b.order);
  return artworks;
};
