const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const artworkDir = path.join(root, "artwork");
const outDir = path.join(root, "src", "content", "artworks");
fs.mkdirSync(outDir, { recursive: true });

const order = [
  "light", "precious", "dreaming-reality", "orin", "vulnerability-is-strength",
  "seed-of-joy", "pure-masculine-and-feminine", "moon-cycle-of-healing",
  "third-eye-engine", "power-crystal", "exaltation", "soul-dna",
  "the-pyramid-of-the-one", "ying-yang-couple", "release-control",
  "divine-feminine-rivers", "absorbing-fire", "peace-with-femininity",
  "mystical-yoni", "transforming-fire-to-water",
];

const galleryMedium = {
  light: "רישום · פורטרט",
  precious: "מיקס-מדיה",
  "dreaming-reality": "מיקס-מדיה",
  orin: "מיקס-מדיה",
};

for (let i = 0; i < order.length; i++) {
  const slug = order[i];
  const file = path.join(artworkDir, slug, "index.html");
  const html = fs.readFileSync(file, "utf8");

  const title = html.match(/<title>([^|]+)\|/)[1].trim();
  const medium = html.match(/class="artwork-detail-medium">([^<]*)</)[1];
  const description = html.match(/class="artwork-detail-description">([^<]*)</)[1];
  const altMatch = html.match(/class="artwork-stage">\s*<img src="[^"]*" alt="([^"]*)"/);
  const alt = altMatch ? altMatch[1] : `${title}, ${description}`;

  const data = {
    slug,
    order: i + 1,
    name: title,
    galleryMedium: galleryMedium[slug] || "טכניקה משולבת",
    detailMedium: medium,
    description,
    alt,
    image: `/images/artworks/${slug}+WEB.webp`,
    thumb: `/images/gallery/${slug}+thumb.webp`,
  };

  fs.writeFileSync(
    path.join(outDir, `${slug}.json`),
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
  console.log("wrote", slug);
}
