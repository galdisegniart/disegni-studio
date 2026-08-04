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

  artworks.forEach((artwork) => {
    const target = String(artwork.name || "").toLowerCase();
    const approvedVariants = artwork.purchaseVariants || [];

    const products = printfulCatalog.filter((product) =>
      String(product.name || "").toLowerCase().includes(target)
    );

    products.forEach((product) => {
      const name = String(product.name || "").toLowerCase();
      const style = name.includes("canvas") ? "canvas" : "paper";
      const frame = name.includes("framed") ? "framed" : "none";
      const productType =
        style === "canvas" ? "canvas" : frame === "framed" ? "framed-print" : "poster";
      const productTypeName =
        productType === "canvas"
          ? "קנבס מתוח"
          : productType === "framed-print"
            ? "הדפס ממוסגר"
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

  return catalog;
};
