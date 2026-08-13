const fs = require("fs");
const path = require("path");

// Flattened, server-verifiable list of every purchasable Printful-fulfilled
// print variant across the whole catalog (not just one test artwork).
// Consumed by the payment Worker (cms-oauth-worker) to validate price/product
// server-side instead of trusting the browser.
//
// For each artwork/productType/sizeId, an explicit entry in the artwork's
// "purchaseVariants" CMS field (a human-approved price/catalog-number
// override) wins if present. Otherwise the variant is auto-priced from the
// same site-wide pricing.json/shipping.json tables the rest of the site
// uses - no manual per-artwork approval required. Either way, a variant is
// only ever included if a real price AND real shipping value were found;
// there is no such thing as a 0-priced or unpriced entry here.
module.exports = () => {
  const siteOrigin = "https://disegni.studio";
  const paymentImageUrl = (value) => {
    const image = String(value || "").trim();
    if (!/\.(?:jpe?g|png)(?:\?.*)?$/i.test(image)) return "";
    if (/^https:\/\//i.test(image)) return image;
    return image.startsWith("/") ? siteOrigin + image : "";
  };

  const contentDir = path.join(__dirname, "..", "content");

  const artworksDir = path.join(contentDir, "artworks");
  const artworks = fs
    .readdirSync(artworksDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(artworksDir, f), "utf8")));

  const pricing = JSON.parse(
    fs.readFileSync(path.join(contentDir, "pages", "pricing.json"), "utf8")
  );
  const shipping = JSON.parse(
    fs.readFileSync(path.join(contentDir, "pages", "shipping.json"), "utf8")
  );

  let printfulCatalog = [];
  try {
    printfulCatalog = JSON.parse(
      fs.readFileSync(path.join(__dirname, "printfulCatalog.json"), "utf8")
    );
  } catch {
    printfulCatalog = [];
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

  const catalog = [];

  // Whitespace-insensitive so Printful product titles with slightly different
  // spacing (e.g. "masculine&feminine" vs. our "Masculine & Feminine") still match.
  const normalizeForMatch = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");

  // Same slugging the "colorSlug" Eleventy filter uses, so a composite
  // sizeId built here (e.g. "S-french-navy") matches the data-size-id the
  // apparel product template renders for the same CMS color value.
  const colorSlug = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  artworks.forEach((artwork) => {
    const target = normalizeForMatch(artwork.name);
    const approvedVariants = artwork.purchaseVariants || [];

    const products = printfulCatalog.filter((product) =>
      normalizeForMatch(product.name).includes(target)
    );

    products.forEach((product) => {
      const name = String(product.name || "").toLowerCase();
      const style = name.includes("canvas") ? "canvas" : "paper";
      const frame = name.includes("framed") ? "framed" : "none";
      const productType =
        style === "canvas" ? "canvas" : frame === "framed" ? "framed-print" : "poster";
      const hasDoubleMat = name.includes("with mat");
      const productTypeName =
        productType === "canvas"
          ? "קנבס מתוח"
          : productType === "framed-print"
            ? (hasDoubleMat ? "פוסטר ממוסגר ופספרטו כפול" : "הדפס ממוסגר")
            : "פוסטר";

      (product.variants || []).forEach((variant) => {
        const readableSize = String(variant.size || "")
          .replace(/â€³/g, "″")
          .replace(/Ã—/g, "×");
        const dimensions = readableSize.match(/(\d+)\D+(\d+)/);
        if (!dimensions) return;

        const width = Number(dimensions[1]);
        const height = Number(dimensions[2]);
        const sizeId = width + "x" + height;

        const approved = approvedVariants.find(
          (item) => item.productType === productType && item.sizeId === sizeId
        );

        const priceFallback = manualPrice(
          productType === "poster" ? "paper" : productType,
          sizeId
        );
        const shippingFallback = defaultShipping(productType, sizeId);

        const catalogNumber =
          (approved && approved.catalogNumber) ||
          `${artwork.slug}-${productType}-${sizeId}`.toUpperCase();
        const unitPriceILS = (approved && approved.priceILS) || (priceFallback && priceFallback.priceILS);
        const labelCm = (approved && approved.labelCm) || undefined;
        const shippingFirstILS =
          (approved && approved.shippingFirstILS) ||
          (shippingFallback && shippingFallback.shippingFirstILS);
        const shippingAdditionalILS =
          (approved && approved.shippingAdditionalILS) ||
          (shippingFallback && shippingFallback.shippingAdditionalILS);

        // Never emit a variant with no real price or no real shipping value -
        // an approved override with a partial price, or a size/material
        // combo pricing.json/shipping.json don't cover, is skipped rather
        // than sold at 0 or an unknown shipping cost.
        if (!Number.isFinite(unitPriceILS) || unitPriceILS <= 0) return;
        if (!Number.isFinite(shippingFirstILS)) return;

        catalog.push({
          artworkSlug: artwork.slug,
          productType,
          sizeId,
          catalogNumber,
          productName: `${artwork.name} – ${productTypeName} ${labelCm || ""}`.trim(),
          imageUrl: paymentImageUrl((approved && approved.paymentImage) || artwork.paymentImage),
          unitPriceILS,
          shippingFirstILS,
          shippingAdditionalILS: Number.isFinite(shippingAdditionalILS) ? shippingAdditionalILS : 0,
        });
      });
    });
  });

  // Apparel auto-matches against the same Printful sync data as prints
  // (same CI step, same name-substring technique) - a design like "Seed of
  // Joy" can have several garment products (hoodie, t-shirt, stickers...),
  // so the garment kind is inferred from the Printful product title itself,
  // same spirit as the canvas/framed keyword check above. There's no shared
  // pricing table for garment sizes though, so - like a print size pricing.json
  // doesn't cover - every size still needs a human-approved price in the
  // item's own purchaseVariants before it's sellable.
  const inferApparelProductType = (name) => {
    const lower = String(name || "").toLowerCase();
    if (lower.includes("crop hoodie")) return { type: "crop-hoodie", name: "קרופ הודי" };
    if (lower.includes("hoodie")) return { type: "hoodie", name: "הודי" };
    if (lower.includes("muscle")) return { type: "muscle-shirt", name: "מאסל שירט" };
    if (lower.includes("sticker")) return { type: "sticker", name: "מדבקה" };
    if (lower.includes("shirt") || lower.includes("tee") || lower.includes("tshirt")) {
      return { type: "t-shirt", name: "חולצה" };
    }
    return { type: "apparel", name: "בגד/אביזר" };
  };

  const apparelDir = path.join(contentDir, "apparel");
  const apparelItems = fs.existsSync(apparelDir)
    ? fs
        .readdirSync(apparelDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(apparelDir, f), "utf8")))
    : [];

  apparelItems.forEach((item) => {
    // "matchName" lets the CMS display name be readable Hebrew/short text
    // while still matching Printful's literal (often clunky) English product
    // title - falls back to "name" for items that don't need the split.
    const target = normalizeForMatch(item.matchName || item.name);
    const approvedVariants = item.purchaseVariants || [];
    const apparelProducts = printfulCatalog.filter((product) =>
      normalizeForMatch(product.name).includes(target)
    );

    apparelProducts.forEach((product) => {
      const kind = inferApparelProductType(product.name);

      (product.variants || []).forEach((variant) => {
        const sizeId = String(variant.size || "").trim();
        if (!sizeId) return;

        // Printful's API gives a real "color" field, but printfulCatalog.json
        // may predate that field being fetched - fall back to parsing it out
        // of "<product> / <color> / <size>" (the variant name convention)
        // so multi-color products (e.g. the t-shirt's Navy/Black) still
        // resolve to distinct variants instead of colliding on size alone.
        let variantColor = variant.color ? String(variant.color).trim() : "";
        if (!variantColor) {
          const parts = String(variant.name || "").split(" / ");
          if (parts.length >= 3) variantColor = parts[parts.length - 2].trim();
        }

        const approved = approvedVariants.find((v) => {
          if (v.productType !== kind.type || v.sizeId !== sizeId) return false;
          const approvedColor = String(v.color || "").trim();
          if (!variantColor) return true;
          return approvedColor.toLowerCase() === variantColor.toLowerCase();
        });
        if (!approved) return;

        const unitPriceILS = approved.priceILS;
        const shippingFirstILS = approved.shippingFirstILS;
        if (!Number.isFinite(unitPriceILS) || unitPriceILS <= 0) return;
        if (!Number.isFinite(shippingFirstILS)) return;

        const compositeSizeId = variantColor ? `${sizeId}-${colorSlug(variantColor)}` : sizeId;
        const catalogNumber =
          approved.catalogNumber ||
          `${item.slug}-${kind.type}-${compositeSizeId}`.toUpperCase();

        const sizeLabel = variantColor ? `${sizeId} / ${variantColor}` : sizeId;

        catalog.push({
          artworkSlug: item.slug,
          productType: kind.type,
          sizeId: compositeSizeId,
          catalogNumber,
          productName: `${item.name} – ${kind.name} ${sizeLabel}`.trim(),
          labelCm: sizeLabel,
          labelIn: sizeLabel,
          imageUrl: paymentImageUrl(item.image),
          unitPriceILS,
          shippingFirstILS,
          shippingAdditionalILS: Number.isFinite(approved.shippingAdditionalILS)
            ? approved.shippingAdditionalILS
            : 0,
        });
      });
    });
  });

  return catalog;
};
