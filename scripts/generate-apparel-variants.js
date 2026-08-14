#!/usr/bin/env node
// Generates a draft `purchaseVariants` list for one apparel item, from
// whatever Printful already has for it (garment kind + sizes) - so adding a
// new sellable apparel item is "run this, then fill in prices in the CMS"
// instead of typing every size by hand. Mirrors generate-purchase-variants.js.
//
// Usage: node scripts/generate-apparel-variants.js <apparel-slug>

const fs = require("fs");
const path = require("path");

const slug = process.argv[2];
const force = process.argv.includes("--force");
if (!slug) {
  console.error("Usage: node scripts/generate-apparel-variants.js <apparel-slug> [--force]");
  process.exit(1);
}

const rootDir = path.join(__dirname, "..");
const contentDir = path.join(rootDir, "src", "content");
const itemPath = path.join(contentDir, "apparel", `${slug}.json`);

if (!fs.existsSync(itemPath)) {
  console.error(`No apparel item found at src/content/apparel/${slug}.json`);
  process.exit(1);
}

const item = JSON.parse(fs.readFileSync(itemPath, "utf8"));

if (Array.isArray(item.purchaseVariants) && item.purchaseVariants.length && !force) {
  console.error(
    `${slug} already has ${item.purchaseVariants.length} purchaseVariants entries (likely reviewed/approved prices).\n` +
      "Re-run with --force to overwrite them with a fresh auto-generated draft."
  );
  process.exit(1);
}

let printfulCatalog = [];
try {
  printfulCatalog = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src", "_data", "printfulCatalog.json"), "utf8")
  );
} catch {
  console.error(
    "Could not read src/_data/printfulCatalog.json - run `node scripts/fetch-printful.js` first (needs PRINTFUL_API_TOKEN)."
  );
  process.exit(1);
}

// Whitespace-insensitive so Printful product titles with slightly different
// spacing still match (e.g. extra design-name suffixes).
const normalizeForMatch = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
const target = normalizeForMatch(item.matchName || item.name);
const products = printfulCatalog.filter((product) =>
  normalizeForMatch(product.name).includes(target)
);

if (!products.length) {
  console.error(
    `No Printful products matched the name "${item.name}". Make sure it's added in Printful and the product title contains this exact item name.`
  );
  process.exit(1);
}

const inferApparelProductType = (name) => {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("crop hoodie")) return "crop-hoodie";
  if (lower.includes("hoodie")) return "hoodie";
  if (lower.includes("muscle")) return "muscle-shirt";
  if (lower.includes("sticker")) return "sticker";
  if (lower.includes("shirt") || lower.includes("tee") || lower.includes("tshirt")) return "t-shirt";
  return "apparel";
};

const colorSlug = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const draft = [];
const seen = new Set();

// Same color derivation as purchaseCatalog.js at build time: prefer a real
// "color" field, else parse it out of "<product> / <color> / <size>".
const deriveColor = (variant) => {
  let color = variant.color ? String(variant.color).trim() : "";
  if (!color) {
    const parts = String(variant.name || "").split(" / ");
    if (parts.length >= 3) color = parts[parts.length - 2].trim();
  }
  return color;
};

products.forEach((product) => {
  const productType = inferApparelProductType(product.name);
  const variants = product.variants || [];

  // Printful tags every variant with a color, even single-color products
  // (e.g. "Black") - only treat it as a real, choosable attribute when a
  // size actually has more than one color option.
  const colorsBySize = {};
  variants.forEach((v) => {
    const sizeId = String(v.size || "").trim();
    if (!sizeId) return;
    const color = deriveColor(v);
    if (!color) return;
    (colorsBySize[sizeId] = colorsBySize[sizeId] || new Set()).add(color.toLowerCase());
  });

  variants.forEach((variant) => {
    const sizeId = String(variant.size || "").trim();
    if (!sizeId) return;

    const hasColorChoice = (colorsBySize[sizeId] || new Set()).size > 1;
    const color = hasColorChoice ? deriveColor(variant) : "";

    const key = productType + "|" + sizeId + "|" + color;
    if (seen.has(key)) return;
    seen.add(key);

    const compositeSizeId = color ? `${sizeId}-${colorSlug(color)}` : sizeId;

    draft.push({
      productType,
      sizeId,
      color: color || undefined,
      catalogNumber: `${slug.toUpperCase()}-${productType.toUpperCase()}-${compositeSizeId.toUpperCase()}`,
      priceILS: 0,
      priceUSD: 0,
      shippingFirstILS: 0,
      shippingAdditionalILS: 0,
      shippingFirstUSD: 0,
      shippingAdditionalUSD: 0,
    });
  });
});

item.purchaseVariants = draft;
fs.writeFileSync(itemPath, JSON.stringify(item, null, 2) + "\n", "utf8");

console.log(`Wrote ${draft.length} draft variant(s) into src/content/apparel/${slug}.json`);
console.log(
  "\nEvery price/shipping field was left at 0 - there is no shared pricing table for garments like there is for prints, so each row needs a manual price in the CMS before it's sellable (0-priced rows are skipped by the checkout catalog)."
);
draft.forEach((entry) =>
  console.log(`  - ${entry.productType}/${entry.sizeId}${entry.color ? " (" + entry.color + ")" : ""}`)
);
