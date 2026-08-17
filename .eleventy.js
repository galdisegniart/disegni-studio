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

  // Isolates each maximal RUN of same-script words (not each word alone).
  // This matters for multi-word foreign phrases: isolating "Seed", "Of"
  // and "Joy" as three SEPARATE isolates let the outer RTL paragraph
  // position each isolate independently by source order, which reverses
  // their *mutual* order into "Joy Of Seed" whenever the phrase isn't
  // preceded by a real (non-isolated) Hebrew character - confirmed by
  // directly measuring word positions on the live site, and confirmed
  // wrong again by the user after that "fix" shipped. Grouping "Seed Of
  // Joy" into ONE isolate fixes this: a single isolate's own resolved
  // direction (LTR here) governs its internal word order regardless of
  // where the isolate sits in the outer RTL flow, so "Seed Of Joy"
  // always reads left-to-right internally, no matter what precedes or
  // follows it. Hebrew runs are left bare (unwrapped) - they already
  // match the page's own RTL direction, so isolating them adds nothing.
  // Because runs strictly alternate script class, no two isolates can
  // ever end up directly adjacent to each other (there's always at
  // least one bare Hebrew character - or the start/end of the paragraph
  // - between any two foreign isolates), which is what makes this safe
  // for cases like "2\" עד 6\"" too: "2\"" and "6\"" are separate
  // isolates, but "עד" is a real Hebrew character sitting between them,
  // not another isolate, so there's no adjacency ambiguity to resolve.
  const HEBREW_CHAR = /[֐-׿]/;
  // A token only counts as "foreign" if it has an actual Latin letter or
  // digit in it. A standalone separator like "-" between a quoted phrase
  // and a Hebrew word has neither, so without this check it greedily
  // joined whichever run happened to precede it - dragging it to that
  // run's own far edge (isolate-internal order puts it last, at the
  // isolate's own right edge) instead of sitting where it visually
  // belongs, between the two runs. Confirmed on the live site: dash
  // ended up glued to the end of the English block instead of between
  // it and the following Hebrew word. Punctuation-only tokens now stay
  // bare/unwrapped like Hebrew, so they flow with the surrounding RTL
  // text via the browser's normal neutral-character resolution instead
  // of being captured by an isolate.
  const HAS_LATIN_OR_DIGIT = /[A-Za-z0-9]/;
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // Splits into alternating runs of {isForeign, text} - text includes any
  // trailing whitespace up to (but not including) the next run, so
  // rejoining the pieces reproduces the original string exactly.
  function splitRuns(str) {
    const tokens = String(str).split(/(\s+)/).filter((t) => t !== "");
    const runs = [];
    tokens.forEach((token) => {
      const isForeign = HAS_LATIN_OR_DIGIT.test(token) && !HEBREW_CHAR.test(token);
      const isWhitespace = /^\s+$/.test(token);
      const last = runs[runs.length - 1];
      if (isWhitespace) {
        if (last) last.text += token;
        return;
      }
      if (last && last.isForeign === isForeign && !last.sealed) {
        last.text += token;
      } else {
        if (last) last.sealed = true;
        runs.push({ isForeign, text: token, sealed: false });
      }
    });
    return runs;
  }
  // U+200F RIGHT-TO-LEFT MARK - invisible, zero-width. Prepended because
  // when the text *starts* with a foreign-script run, the browser has
  // nothing but that isolate itself to infer the surrounding paragraph's
  // base direction from, and that can still resolve ambiguously. A real
  // RTL character isn't ambiguous, so this anchors the paragraph
  // correctly no matter what script the text happens to start with -
  // harmless (a no-op) when the text already starts with Hebrew.
  const RLM = "‏";
  function wrapRuns(str, wrapFn) {
    return (
      RLM +
      splitRuns(str)
        .map((run) => (run.isForeign ? wrapFn(run.text) : escapeHtml(run.text)))
        .join("")
    );
  }

  // For real rendered HTML (headings, descriptions, captions).
  //
  // This does NOT use <bdi>/isolates for positioning. Three separate
  // isolate-based attempts each failed differently across real browsers
  // (confirmed independently in Chrome, Brave AND Edge on the user's own
  // machine, not just this project's own test tooling) - because
  // isolate-based positioning ultimately still runs through the Unicode
  // Bidi Algorithm's paragraph-level reordering rules, which have real,
  // inconsistently-implemented edge cases for adjacent isolates and
  // isolates with no preceding strong character.
  //
  // Instead: each run becomes its own flex item in a `display: inline-
  // flex` container with explicit `dir="rtl"`. Flexbox item order is
  // pure CSS layout - deterministic by DOM order, completely independent
  // of bidi text algorithm resolution. This sidesteps the whole class of
  // bug rather than chasing another edge case: item order can't become
  // ambiguous because it was never derived from text-direction analysis
  // in the first place. Each foreign run gets `direction: ltr` so its
  // OWN words still read correctly within themselves.
  eleventyConfig.addFilter("bidiWrap", function (value) {
    const str = String(value == null ? "" : value);
    const spans = splitRuns(str)
      .map((run) => {
        const text = escapeHtml(run.text);
        return run.isForeign
          ? '<span style="direction:ltr;unicode-bidi:isolate;">' + text + "</span>"
          : "<span>" + text + "</span>";
      })
      .join("");
    return '<span style="display:inline-flex;flex-wrap:wrap;" dir="rtl">' + spans + "</span>";
  });

  // For plain-text-only contexts that can't hold HTML markup - <option>
  // text, alt/title/aria-label attributes - uses the Unicode First Strong
  // Isolate / Pop Directional Isolate characters instead of a <bdi> tag.
  eleventyConfig.addFilter("bidiIsolatePlain", function (value) {
    const str = String(value == null ? "" : value);
    return wrapRuns(str, (run) => "⁨" + run + "⁩");
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
