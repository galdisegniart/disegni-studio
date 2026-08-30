// Merges an item's per-locale override over its shared/default-locale fields.
//
// Two on-disk shapes are supported, additively:
// - Native Decap i18n (current): { he: {...}, en: {...} }. `en` holds only
//   the fields marked i18n: true in admin/config.yml. Works the same whether
//   or not a data loader already ran the item through flattenLocale() first
//   (that step exists only for the handful of places that read fields off
//   the raw item without going through this filter at all).
// - Legacy `translations.{locale}` (not yet migrated): merged the old way.
// Items with neither shape pass through unchanged for every locale - this
// keeps migrating one content file at a time safe and non-breaking.
module.exports = function localize(item, locale) {
  if (!item) return item;
  if (item.he && typeof item.he === "object") {
    return Object.assign({}, item.he, item[locale]);
  }
  const t = item.translations && item.translations[locale];
  if (!t) return item;
  return Object.assign({}, item, t);
};
