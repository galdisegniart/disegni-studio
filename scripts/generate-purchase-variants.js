#!/usr/bin/env node
// Generates a draft `purchaseVariants` list for one artwork, from whatever
// Printful already has for it plus the site's normal pricing/shipping
// tables — so adding a new sellable artwork is "run this, then review in
// the CMS" instead of typing every size/price by hand.
//
// Usage: node scripts/generate-purchase-variants.js <artwork-slug>

const fs = require("fs");
const path = require("path");

const slug = process.argv[2];
const force = process.argv.includes("--force");
if (!slug) {
  console.error("Usage: node scripts/generate-purchase-variants.js <artwork-slug> [--force]");
  process.exit(1);
}

const rootDir = path.join(__dirname, "..");
const contentDir = path.join(rootDir, "src", "content");
const artworkPath = path.join(contentDir, "artworks", `${slug}.json`);

if (!fs.existsSync(artworkPath)) {
  console.error(`No artwork found at src/content/artworks/${slug}.json`);
  process.exit(1);
}

const artwork = JSON.parse(fs.readFileSync(artworkPath, "utf8"));

if (Array.isArray(artwork.purchaseVariants) && artwork.purchaseVariants.length && !force) {
  console.error(
    `${slug} already has ${artwork.purchaseVariants.length} purchaseVariants entries (likely reviewed/approved prices).\n` +
      "Re-run with --force to overwrite them with a fresh auto-generated draft."
  );
  process.exit(1);
}
const pricing = JSON.parse(
  fs.readFileSync(path.join(contentDir, "pages", "pricing.json"), "utf8")
);
const shipping = JSON.parse(
  fs.readFileSync(path.join(contentDir, "pages", "shipping.json"), "utf8")
);

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

const manualMaterials = pricing.materials || [];
const manualPrice = (style, sizeId) => {
  const material = manualMaterials.find((item) => item.id === style);
  return material && (material.sizes || []).find((size) => size.id === sizeId);
};

const shippingVariants = shipping.variants || [];
const defaultShipping = (productType, sizeId) =>
  shippingVariants.find(
    (item) => item.productType === productType && item.sizeId === sizeId
  );

// Whitespace-insensitive so Printful product titles with slightly different
// spacing still match (e.g. "masculine&feminine" vs. our "Masculine & Feminine").
const normalizeForMatch = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
const target = normalizeForMatch(artwork.name);
const products = printfulCatalog.filter((product) =>
  normalizeForMatch(product.name).includes(target)
);

if (!products.length) {
  console.error(
    `No Printful products matched the name "${artwork.name}". Make sure it's added in Printful and the product title contains this exact artwork name.`
  );
  process.exit(1);
}

const draft = [];
const needsAttention = [];

products.forEach((product) => {
  const name = String(product.name || "").toLowerCase();
  const style = name.includes("canvas") ? "canvas" : "paper";
  const frame = name.includes("framed") ? "framed" : "none";
  const productType =
    style === "canvas" ? "canvas" : frame === "framed" ? "framed-print" : "poster";

  (product.variants || []).forEach((variant) => {
    const readableSize = String(variant.size || "")
      .replace(/â€³/g, "″")
      .replace(/Ã—/g, "×");
    const dimensions = readableSize.match(/(\d+)\D+(\d+)/);
    if (!dimensions) return;

    const width = Number(dimensions[1]);
    const height = Number(dimensions[2]);
    const sizeId = width + "x" + height;

    const fallbackPrice = manualPrice(productType === "poster" ? "paper" : productType, sizeId);
    const fallbackShipping = defaultShipping(productType, sizeId);

    const entry = {
      productType,
      sizeId,
      catalogNumber: `${slug.toUpperCase()}-${productType.toUpperCase()}-${sizeId.toUpperCase()}`,
      priceILS: (fallbackPrice && fallbackPrice.priceILS) || 0,
      labelIn: width + "×" + height + " אינץ'",
      labelCm: Math.round(width * 2.54) + "×" + Math.round(height * 2.54) + ' ס"מ',
      shippingFirstILS: (fallbackShipping && fallbackShipping.shippingFirstILS) || 0,
      shippingAdditionalILS: (fallbackShipping && fallbackShipping.shippingAdditionalILS) || 0,
    };

    if (!entry.priceILS || !entry.shippingFirstILS) {
      needsAttention.push(`${productType}/${sizeId}`);
    }

    draft.push(entry);
  });
});

artwork.purchaseVariants = draft;
fs.writeFileSync(artworkPath, JSON.stringify(artwork, null, 2) + "\n", "utf8");

console.log(`Wrote ${draft.length} draft variant(s) into src/content/artworks/${slug}.json`);
if (needsAttention.length) {
  console.log(
    `\nThese need a manual price/shipping check in the CMS (no fallback found in pricing.json/shipping.json):`
  );
  needsAttention.forEach((item) => console.log(`  - ${item}`));
}
console.log(
  "\nAlso double-check every catalogNumber below actually matches a Printful sync variant - this script guesses a readable name, it does not read Printful's real catalog/SKU numbers:"
);
draft.forEach((entry) => console.log(`  - ${entry.productType}/${entry.sizeId}: ${entry.catalogNumber}`));
