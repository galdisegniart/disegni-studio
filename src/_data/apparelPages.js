// Same pattern as productPages.js: cross-joins apparel items x locales into
// one flat array Eleventy can paginate (size: 1) to build one product page
// per item per locale. Each item is pre-localized here so eleventyComputed
// and the template body see the same already-merged object.
const localesLoader = require("./locales.js");
const apparelItemsLoader = require("./apparelItems.js");
const localize = require("../_lib/localize.js");

module.exports = () => {
  const locales = localesLoader();
  const items = apparelItemsLoader();
  const pages = [];
  locales.forEach((locale) => {
    items.forEach((raw) => {
      pages.push({ locale, item: localize(raw, locale) });
    });
  });
  return pages;
};
