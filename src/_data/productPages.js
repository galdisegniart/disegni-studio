// Pilot: cross-joins artworks x locales into one flat array Eleventy can
// paginate (size: 1) to build one product page per artwork per locale.
// Each artwork is pre-localized here, at the data-cascade level, so both
// eleventyComputed (title/description) and the template body see the same
// already-merged object.
const localesLoader = require("./locales.js");
const artworksLoader = require("./artworks.js");
const localize = require("../_lib/localize.js");

module.exports = () => {
  const locales = localesLoader();
  const artworks = artworksLoader();
  const pages = [];
  locales.forEach((locale) => {
    artworks.forEach((raw) => {
      pages.push({ locale, artwork: localize(raw, locale) });
    });
  });
  return pages;
};
