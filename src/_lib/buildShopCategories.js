// Locale-aware replacement for the old shopCategories.js global data file.
// Builds the 4 shop-category entries (thumb, href, label) for whichever
// locale the current page is rendering, so the category strip and the
// /collections/ overview page share one source of truth in both languages.
const localize = require("./localize.js");

const LABELS = {
  en: { prints: "Prints", originals: "Available Originals", apparel: "Apparel", stickers: "Stickers" },
  he: { prints: "הדפסים", originals: "מקוריות זמינות", apparel: "ביגוד", stickers: "מדבקות" },
};

module.exports = function buildShopCategories(artworks, apparelItems, locale) {
  const labels = LABELS[locale] || LABELS.he;
  const prefix = locale === "en" ? "" : "/" + locale;

  const localizedArtworks = (artworks || []).map((a) => localize(a, locale));
  const localizedApparel = (apparelItems || []).map((i) => localize(i, locale));
  const firstAvailableOriginal = localizedArtworks.find((a) => a.originalAvailable) || localizedArtworks[0];
  const clothingItems = localizedApparel.filter((i) => i.category !== "stickers");
  const stickerItems = localizedApparel.filter((i) => i.category === "stickers");

  return [
    {
      key: "prints",
      label: labels.prints,
      href: prefix + "/collections/prints/",
      thumb: localizedArtworks[0] && localizedArtworks[0].thumb,
    },
    {
      key: "originals",
      label: labels.originals,
      href: prefix + "/collections/originals/",
      thumb: firstAvailableOriginal && firstAvailableOriginal.thumb,
    },
    {
      key: "apparel",
      label: labels.apparel,
      href: prefix + "/collections/apparel/",
      thumb: clothingItems[0] && clothingItems[0].thumb,
    },
    {
      key: "stickers",
      label: labels.stickers,
      href: prefix + "/collections/stickers/",
      thumb: stickerItems[0] && stickerItems[0].thumb,
    },
  ];
};
