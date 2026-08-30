// Normalizes Decap's native i18n on-disk shape ({ he: {...}, en: {...} })
// back into the flat shape the rest of the codebase already expects: every
// "he" field spread to the top level (so raw, unlocalized reads like
// `artwork.slug` or `site.whatsappNumber` keep working unchanged), plus the
// original `he`/`en` sub-objects kept intact for `localize()` to merge per
// page locale. Items still using the old `translations.{locale}` shape (not
// yet migrated) pass through untouched.
module.exports = function flattenLocale(raw) {
  if (!raw || typeof raw.he !== "object" || raw.he === null) return raw;
  return Object.assign({}, raw.he, { he: raw.he, en: raw.en });
};
