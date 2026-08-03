const fs = require("fs");
const path = require("path");

// Flattened, server-verifiable list of every approved, Printful-fulfilled
// print variant across the whole catalog (not just one test artwork).
// Consumed by the payment Worker (cms-oauth-worker) to validate price/product
// server-side instead of trusting the browser. Only variants with an explicit
// approved catalogNumber (set per-artwork via the "purchaseVariants" CMS
// field) are included — an artwork with no approved variants yet contributes
// nothing here and stays on the manual WhatsApp/bank-transfer checkout path.
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

  const shippingVariants = shipping.variants || [];
  const defaultShipping = (productType, sizeId) =>
    shippingVariants.find(
      (item) => item.productType === productType && item.sizeId === sizeId
    );

  const catalog = [];

  artworks.forEach((artwork) => {
    const target = String(artwork.name || "").toLowerCase();
    const approvedVariants = artwork.purchaseVariants || [];
    if (!approvedVariants.length) return;

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
        if (!approved || !approved.catalogNumber || !approved.priceILS) return;

        const shippingFallback = defaultShipping(productType, sizeId);
        const shippingFirstILS = approved.shippingFirstILS || (shippingFallback && shippingFallback.shippingFirstILS);
        const shippingAdditionalILS = approved.shippingAdditionalILS || (shippingFallback && shippingFallback.shippingAdditionalILS);
        if (!Number.isFinite(shippingFirstILS)) return;

        catalog.push({
          artworkSlug: artwork.slug,
          productType,
          sizeId,
          catalogNumber: approved.catalogNumber,
          productName: `${artwork.name} – ${productTypeName} ${approved.labelCm || ""}`.trim(),
          imageUrl: paymentImageUrl(approved.paymentImage || artwork.paymentImage),
          unitPriceILS: approved.priceILS,
          shippingFirstILS,
          shippingAdditionalILS: Number.isFinite(shippingAdditionalILS) ? shippingAdditionalILS : 0,
        });
      });
    });
  });

  return catalog;
};
