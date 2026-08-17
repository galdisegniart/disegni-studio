const site = require("./src/_data/site.json");

module.exports = function (eleventyConfig) {
  eleventyConfig.addWatchTarget("css");
  eleventyConfig.addWatchTarget("js");
  eleventyConfig.addPassthroughCopy({ "src/images/uploads": "images/uploads" });

  eleventyConfig.addFilter("arraySlice", function (arr, start, end) {
    return arr.slice(start, end);
  });

  eleventyConfig.addFilter("startsWith", function (str, prefix) {
    return typeof str === "string" && str.indexOf(prefix) === 0;
  });

  eleventyConfig.addFilter("nl2br", function (str) {
    if (typeof str !== "string") return str;
    return str.split("\n").join("<br>");
  });

  eleventyConfig.addFilter("numberFormat", function (n) {
    return Number(n).toLocaleString("en-US");
  });

  // Wraps EVERY whitespace-delimited word (Hebrew or foreign, doesn't matter
  // which) in its own bidi isolate. Isolating only the foreign-script runs
  // and leaving Hebrew connector words bare (the previous approach) still
  // let the browser's bidi algorithm scramble the sequence whenever a short
  // Hebrew word sat *between* two foreign runs (e.g. "2\" עד 6\"" - "2 inch
  // to 6 inch"): the bare Hebrew word broke the isolation boundary. Giving
  // every single word its own isolate removes that ambiguity entirely -
  // only neutral whitespace is left between isolates, and isolates are laid
  // out strictly in source order - so this is immune to whatever mix of
  // scripts/numbers/punctuation ends up in the CMS text.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // U+200F RIGHT-TO-LEFT MARK - invisible, zero-width. Prepended before
  // the isolated words below because when the text *starts* with a
  // foreign-script word (e.g. "\"Seed Of Joy\" חולצה"), the browser has
  // nothing but the isolates themselves to infer the surrounding
  // paragraph's base direction from - and empirically (verified directly
  // against the live site, multiple browsers) that ambiguity resolves
  // wrong: the whole foreign-script block gets shifted to the visual
  // start of the line instead of following logical/source order,
  // dragging the Hebrew text out of place with it. A real RTL character
  // isn't ambiguous, so prepending one anchors the paragraph correctly
  // no matter what script the text happens to start with. Harmless when
  // the text already starts with Hebrew - it's already RTL then, so
  // this is a no-op in effect.
  const RLM = "‏";
  function wrapWords(str, wrapFn) {
    return (
      RLM +
      String(str)
        .split(/(\s+)/)
        .map((part) => (part === "" || /^\s+$/.test(part) ? escapeHtml(part) : wrapFn(part)))
        .join("")
    );
  }

  // For real rendered HTML (headings, descriptions, captions) - wraps each
  // word in <bdi>. Use with | safe: {{ x | bidiWrap | safe }}
  eleventyConfig.addFilter("bidiWrap", function (value) {
    const str = String(value == null ? "" : value);
    return wrapWords(str, (word) => "<bdi>" + escapeHtml(word) + "</bdi>");
  });

  // For plain-text-only contexts that can't hold HTML markup - <option>
  // text, alt/title/aria-label attributes - uses the Unicode First Strong
  // Isolate / Pop Directional Isolate characters instead of a <bdi> tag.
  eleventyConfig.addFilter("bidiIsolatePlain", function (value) {
    const str = String(value == null ? "" : value);
    return wrapWords(str, (word) => "⁨" + word + "⁩");
  });

  eleventyConfig.addFilter("workshopNavChildren", function (workshopList) {
    return (workshopList || []).map((w) => ({
      label: w.cardTitle,
      href: "/workshops/" + w.slug + "/",
      visible: true,
    }));
  });

  eleventyConfig.addFilter("realWorkshopTestimonials", function (workshopList, limit) {
    const out = [];
    (workshopList || []).forEach((w) => {
      if (w.hasReviews && w.reviews && w.reviews.length) {
        out.push({
          review: w.reviews[0],
          workshopSlug: w.slug,
          workshopTitle: w.cardTitle,
        });
      }
    });
    return out.slice(0, limit || 3);
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

  const apparelTypeNames = {
    "t-shirt": "חולצה",
    hoodie: "הודי",
    "crop-hoodie": "קרופ הודי",
    "muscle-shirt": "מאסל שירט",
    sticker: "מדבקה",
    apparel: "בגד/אביזר",
  };
  eleventyConfig.addFilter("apparelTypeName", function (productType) {
    return apparelTypeNames[productType] || "";
  });

  // Must match the colorSlug() in src/_data/purchaseCatalog.js exactly - both
  // build the same composite sizeId ("S-french-navy") so a cart add matches
  // its checkout-catalog entry for multi-color apparel.
  eleventyConfig.addFilter("colorSlug", function (value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  });

  eleventyConfig.addFilter("lowestPrice", function (variants) {
    let low = null;
    (variants || []).forEach((variant) => {
      const price = Number(variant.priceILS);
      if (!Number.isFinite(price)) return;
      if (low === null || price < low) low = price;
    });
    return low;
  });

  // pricing.json calls the paper material "paper"; shipping.json calls the same
  // thing "poster". Every other id matches. Keep this the single place that knows.
  const materialToProductType = (materialId) =>
    materialId === "paper" ? "poster" : materialId;

  eleventyConfig.addFilter("productTypeFor", materialToProductType);

  // Shipping row for a pricing.json material+size, so non-Printful product pages
  // can carry real shipping data instead of leaving it empty (which billed 0).
  eleventyConfig.addFilter("shippingFor", function (shipping, materialId, sizeId) {
    const variants = (shipping && shipping.variants) || [];
    const productType = materialToProductType(materialId);
    return (
      variants.find(
        (item) => item.productType === productType && item.sizeId === sizeId
      ) || null
    );
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
      const hasDoubleMat = name.includes("with mat");
      const productTypeName = productType === "canvas"
        ? "קנבס מתוח"
        : productType === "framed-print"
          ? (hasDoubleMat ? "פוסטר ממוסגר ופספרטו כפול" : "הדפס ממוסגר")
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
          paymentImage: (approved && approved.paymentImage) || (artwork && artwork.paymentImage) || "",
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
