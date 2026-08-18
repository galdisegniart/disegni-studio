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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Renders CMS-authored text (product names, descriptions, breadcrumb
  // labels) so it displays exactly the way it looked in the CMS field
  // the user typed it into - which is the actual requirement, and the
  // thing every previous attempt here got wrong.
  //
  // Earlier approaches all tried to FORCE a direction (per-word <bdi>
  // isolates, per-run isolates, a leading RLM anchor, then flexbox item
  // ordering). Each one fixed some names and broke others, because each
  // was imposing RTL on strings that do not necessarily start in Hebrew.
  //
  // A text input decides its line direction from the FIRST STRONG
  // character in the value: a name starting with "Seed" lays out
  // left-to-right, one starting with Hebrew lays out right-to-left.
  // That is why the CMS field always looked right. The CSS property
  // "unicode-bidi: plaintext" applies that exact same rule to rendered
  // text, so the site now matches the CMS by construction rather than
  // by guessing a direction per name - and it needs no markup injected
  // into the string, so no split/merge heuristic can mis-classify a
  // dash, a quote mark or an inches symbol ever again.
  eleventyConfig.addFilter("bidiWrap", function (value) {
    const str = String(value == null ? "" : value);
    return '<span style="unicode-bidi:plaintext;">' + escapeHtml(str) + "</span>";
  });

  // For product NAMES specifically (catalog captions, product page H1).
  //
  // Required reading order, stated by the author: starting from the RIGHT
  // edge - English name, then " - ", then Hebrew, then (if present)
  // " - " and the measurements. i.e. an ordinary right-to-left line whose
  // first item happens to be English. Reading right-to-left:
  //     Seed Of Joy - מדבקה - 2" עד 6"
  //
  // The previous attempt laid every word out LEFT-to-right to make the
  // visual sequence match the typed sequence. That reversed the Hebrew:
  // "גופייה רקומה" was placed with גופייה leftmost, so reading it the
  // Hebrew way (right to left) gave "רקומה גופייה" - exactly the error
  // reported. Hebrew words must keep their normal right-to-left order
  // among themselves; only each foreign RUN needs its own internal
  // left-to-right order.
  //
  // So: the wrapper is explicitly dir="rtl" (first item = rightmost),
  // and each maximal run of Latin/digit tokens is wrapped in ONE <bdi>
  // so it reads left-to-right internally as a unit ("Seed Of Joy", not
  // "Joy Of Seed"; 2", not "2). Hebrew and standalone punctuation are
  // left bare so they flow in the RTL line normally - a lone "-" has no
  // letters of its own, so isolating it would only drag it to the edge
  // of whichever run captured it.
  //
  // Guarded to mixed-script strings: an all-Hebrew or all-Latin name
  // needs nothing. Deliberately NOT used for descriptions - those are
  // Hebrew prose and already render correctly.
  const HAS_HEBREW = /[֐-׿]/;
  const HAS_LATIN = /[A-Za-z]/;
  const HAS_LATIN_OR_DIGIT = /[A-Za-z0-9]/;
  eleventyConfig.addFilter("bidiName", function (value) {
    const str = String(value == null ? "" : value);
    if (!HAS_HEBREW.test(str) || !HAS_LATIN.test(str)) {
      return escapeHtml(str);
    }
    // Group consecutive same-class tokens into runs, so a multi-word
    // English phrase becomes a single isolate (its words stay together,
    // reading left-to-right as a unit). Whitespace is handled specially:
    // a space BETWEEN two words of the same run stays inside that run's
    // text (needed for "Seed Of Joy" to read as one phrase); a space at
    // a RUN BOUNDARY (the class is about to change) is emitted as its
    // own plain text node, outside any <bdi>. Earlier this boundary
    // space was appended onto the end of the preceding run's text -
    // sitting right at the isolate's own edge - and the browser's
    // rendering of a space exactly at an isolate boundary turned out to
    // be unreliable (missing on one side, doubled on the other, per the
    // live site). Keeping every boundary space as neutral text between
    // two isolates - never inside one - removes that edge entirely.
    const tokens = str.split(/(\s+)/).filter((t) => t !== "");
    const isForeignToken = (t) => HAS_LATIN_OR_DIGIT.test(t) && !HAS_HEBREW.test(t);
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (/^\s+$/.test(token)) {
        const prev = items[items.length - 1];
        const prevIsForeign = prev && prev.type === "run" ? prev.isForeign : null;
        const next = tokens[i + 1];
        const nextIsForeign = next != null ? isForeignToken(next) : null;
        if (prev && prev.type === "run" && prevIsForeign === nextIsForeign) {
          prev.text += token;
        } else {
          items.push({ type: "space", text: token });
        }
        continue;
      }
      const isForeign = isForeignToken(token);
      const last = items[items.length - 1];
      if (last && last.type === "run" && last.isForeign === isForeign) {
        last.text += token;
      } else {
        items.push({ type: "run", isForeign, text: token });
      }
    }
    const parts = items
      .map((item) =>
        item.type === "run" && item.isForeign
          ? "<bdi>" + escapeHtml(item.text) + "</bdi>"
          : escapeHtml(item.text)
      )
      .join("");
    return '<span dir="rtl">' + parts + "</span>";
  });

  // Plain-text-only contexts (<option> text, alt/title/aria-label) can
  // hold no markup, so they cannot carry the CSS above. They also do not
  // need it: an <option> is laid out by its <select>, and the surrounding
  // page is already RTL. Previous versions injected invisible Unicode
  // isolate characters here; that is dropped, both because it never
  // addressed a reported problem and because those characters leaked
  // into copied text.
  eleventyConfig.addFilter("bidiIsolatePlain", function (value) {
    return String(value == null ? "" : value);
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
