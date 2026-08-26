// Merges an item's per-locale `translations` block over its shared fields.
// Items with no `translations` key (not yet migrated) pass through unchanged
// for every locale - this keeps the bilingual rollout additive, so migrating
// one content file can never break pages for the other, un-migrated files.
module.exports = function localize(item, locale) {
  if (!item) return item;
  const t = item.translations && item.translations[locale];
  if (!t) return item;
  return Object.assign({}, item, t);
};
