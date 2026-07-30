const site = require("./src/_data/site.json");

module.exports = function (eleventyConfig) {
  eleventyConfig.addWatchTarget("css");
  eleventyConfig.addWatchTarget("js");

  eleventyConfig.addFilter("arraySlice", function (arr, start, end) {
    return arr.slice(start, end);
  });

  eleventyConfig.addFilter("startsWith", function (str, prefix) {
    return typeof str === "string" && str.indexOf(prefix) === 0;
  });

  eleventyConfig.addFilter("numberFormat", function (n) {
    return Number(n).toLocaleString("en-US");
  });

  eleventyConfig.addFilter("productTypeThumbnails", function (gallery, fallbackImage) {
    const byType = {};
    (gallery || []).forEach((item) => {
      if (item.productType && !byType[item.productType]) {
        byType[item.productType] = item.thumb || item.image;
      }
    });
    ["poster", "canvas", "framed-print"].forEach((type) => {
      if (!byType[type]) byType[type] = fallbackImage;
    });
    return byType;
  });

  eleventyConfig.addFilter("minPrice", function (items, key) {
    var nums = (items || []).map(function (i) {
      var v = i[key];
      if (typeof v === "number") return v;
      var n = parseFloat(String(v).replace(/[^\d.]/g, ""));
      return isNaN(n) ? Infinity : n;
    });
    var min = Math.min.apply(null, nums);
    return isFinite(min) ? min : 0;
  });

  eleventyConfig.addFilter("relatedAvailableOriginals", function (artworks, currentSlug) {
    return (artworks || []).filter((a) => a.originalAvailable && a.slug !== currentSlug);
  });

  eleventyConfig.addFilter("artworksBySlugs", function (artworks, slugs) {
    const bySlug = new Map((artworks || []).map((artwork) => [artwork.slug, artwork]));
    return (slugs || []).map((slug) => bySlug.get(slug)).filter(Boolean);
  });

  eleventyConfig.addFilter("priceRange", function (materials, extraMaterials) {
    const extras = extraMaterials || [];
    let low = null;
    let high = 0;
    (materials || []).forEach((m) => {
      if (m.id !== "paper" && extras.indexOf(m.id) === -1) return;
      (m.sizes || []).forEach((s) => {
        if (!s.available) return;
        if (low === null || s.priceILS < low) low = s.priceILS;
        if (s.priceILS > high) high = s.priceILS;
      });
    });
    return { low: low || 0, high };
  });

  eleventyConfig.addFilter("printfulOptions", function (catalog, artwork, pricing, shipping) {
    const target = String((artwork && artwork.name) || artwork || "").toLowerCase();
    const approvedVariants = (artwork && artwork.purchaseVariants) || [];
    const products = (catalog || []).filter((product) =>
      String(product.name || "").toLowerCase().includes(target)
    );

    const manualMaterials = (pricing && pricing.materials) || [];
    const manualPrice = (style, sizeId) => {
      const material = manualMaterials.find((item) => item.id === style);
      return material && (material.sizes || []).find((size) => size.id === sizeId);
    };

    const shippingVariants = (shipping && shipping.variants) || [];
    const defaultShipping = (productType, sizeId) =>
      shippingVariants.find((item) => item.productType === productType && item.sizeId === sizeId);

    return products.flatMap((product) => {
      const name = String(product.name || "").toLowerCase();
      const style = name.includes("canvas") ? "canvas" : "paper";
      const frame = name.includes("framed") ? "framed" : "none";
      const productType = style === "canvas"
        ? "canvas"
        : frame === "framed"
          ? "framed-print"
          : "poster";
      const productTypeName = productType === "canvas"
        ? "קנבס מתוח"
        : productType === "framed-print"
          ? "הדפס ממוסגר"
          : "פוסטר";

      return (product.variants || []).map((variant) => {
        const readableSize = String(variant.size || "")
          .replace(/â€³/g, "″")
          .replace(/Ã—/g, "×");
        const dimensions = readableSize.match(/(\d+)\D+(\d+)/);
        if (!dimensions) return null;

        const width = Number(dimensions[1]);
        const height = Number(dimensions[2]);
        const sizeId = width + "x" + height;
        const fallback = manualPrice(productType === "poster" ? "paper" : productType, sizeId);
        const approved = approvedVariants.find((item) =>
          item.productType === productType && item.sizeId === sizeId
        );
        const shippingFallback = defaultShipping(productType, sizeId);
        const retailUSD = Number(variant.retailPriceUSD);

        return {
          productId: product.id,
          syncVariantId: variant.syncVariantId || null,
          variantId: variant.variantId || null,
          sizeId,
          labelIn: (approved && approved.labelIn) || width + "×" + height + " אינץ'",
          labelCm: (approved && approved.labelCm) ||
            Math.round(width * 2.54) + "×" + Math.round(height * 2.54) + ' ס"מ',
          style,
          styleName: style === "canvas" ? "קנבס מתוח" : "נייר אמנותי",
          frame,
          frameName: frame === "framed" ? "ממוסגר" : "ללא מסגרת",
          productType,
          productTypeName,
          catalogNumber: approved && approved.catalogNumber,
          priceUSD: (approved && approved.priceUSD) ||
            (fallback && fallback.priceUSD) ||
            (Number.isFinite(retailUSD) && retailUSD > 0 ? retailUSD : undefined),
          priceILS: (approved && approved.priceILS) || (fallback && fallback.priceILS),
          shippingFirstILS: (approved && approved.shippingFirstILS) ||
            (shippingFallback && shippingFallback.shippingFirstILS),
          shippingAdditionalILS: (approved && approved.shippingAdditionalILS) ||
            (shippingFallback && shippingFallback.shippingAdditionalILS),
          shippingFirstUSD: (approved && approved.shippingFirstUSD) ||
            (shippingFallback && shippingFallback.shippingFirstUSD),
          shippingAdditionalUSD: (approved && approved.shippingAdditionalUSD) ||
            (shippingFallback && shippingFallback.shippingAdditionalUSD),
        };
      }).filter(Boolean);
    });
  });

  eleventyConfig.addFilter("uniqueProductTypes", function (options) {
    const seen = [];
    (options || []).forEach((option) => {
      if (option.productType && !seen.includes(option.productType)) {
        seen.push(option.productType);
      }
    });
    return seen;
  });

  eleventyConfig.addFilter("optionPriceRange", function (options) {
    const prices = (options || [])
      .map((option) => Number(option.priceILS))
      .filter((price) => Number.isFinite(price) && price > 0);
    return {
      low: prices.length ? Math.min(...prices) : 0,
      high: prices.length ? Math.max(...prices) : 0,
    };
  });

  eleventyConfig.addFilter("waLink", function (message) {
    return "https://wa.me/" + site.whatsappNumber + "?text=" + encodeURIComponent(message);
  });

  eleventyConfig.addFilter("artworkSequence", function (artworks, current) {
    const n = artworks.length;
    const idx0 = artworks.findIndex((a) => a.slug === current.slug);
    const prev = artworks[(idx0 - 1 + n) % n];
    const next = artworks[(idx0 + 1) % n];
    const more = [];
    for (let k = 1; k < n; k++) {
      more.push(artworks[(idx0 + k) % n]);
    }
    return { prev, next, more };
  });

  return {
    dir: {
      input: "src",
      output: ".",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
