// Same pattern as productPages.js / apparelPages.js: cross-joins workshops x
// locales into one flat array Eleventy can paginate (size: 1). Each workshop
// is pre-localized here (a no-op until a workshop file gains a translations
// block), so eleventyComputed and the template body see the same object.
const localesLoader = require("./locales.js");
const workshopsLoader = require("./workshops.js");
const localize = require("../_lib/localize.js");

module.exports = () => {
  const locales = localesLoader();
  const workshops = workshopsLoader();
  const pages = [];
  locales.forEach((locale) => {
    workshops.forEach((raw) => {
      pages.push({ locale, w: localize(raw, locale) });
    });
  });
  return pages;
};
