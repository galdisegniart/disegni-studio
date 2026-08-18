const artworksLoader = require("./artworks.js");
const apparelItemsLoader = require("./apparelItems.js");

module.exports = () => {
  const artworks = artworksLoader();
  const apparelItems = apparelItemsLoader();
  const firstAvailableOriginal = artworks.find((a) => a.originalAvailable) || artworks[0];
  const clothingItems = apparelItems.filter((i) => i.category !== "stickers");
  const stickerItems = apparelItems.filter((i) => i.category === "stickers");

  return [
    {
      key: "prints",
      label: "הדפסים",
      href: "/collections/prints/",
      thumb: artworks[0] && artworks[0].thumb,
    },
    {
      key: "originals",
      label: "מקוריות זמינות",
      href: "/collections/originals/",
      thumb: firstAvailableOriginal && firstAvailableOriginal.thumb,
    },
    {
      key: "apparel",
      label: "ביגוד",
      href: "/collections/apparel/",
      thumb: clothingItems[0] && clothingItems[0].thumb,
    },
    {
      key: "stickers",
      label: "מדבקות",
      href: "/collections/stickers/",
      thumb: stickerItems[0] && stickerItems[0].thumb,
    },
  ];
};
