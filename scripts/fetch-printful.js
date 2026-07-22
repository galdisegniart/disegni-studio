const fs = require("fs");
const path = require("path");

const TOKEN = process.env.PRINTFUL_API_TOKEN;
const OUT_PATH = path.join(__dirname, "..", "src", "_data", "printfulCatalog.json");

async function printfulGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Printful API error ${res.status} for ${url}: ${JSON.stringify(body)}`);
  }
  return body.result;
}

async function main() {
  if (!TOKEN) {
    console.log("PRINTFUL_API_TOKEN not set - skipping Printful catalog sync.");
    return;
  }

  const products = await printfulGet("https://api.printful.com/store/products");
  const catalog = [];

  for (const product of products) {
    const detail = await printfulGet(`https://api.printful.com/store/products/${product.id}`);
    const variants = [];

    for (const v of detail.sync_variants) {
      let printfulCostUSD = null;
      try {
        const priceInfo = await printfulGet(`https://api.printful.com/products/variant/${v.variant_id}`);
        printfulCostUSD = priceInfo && priceInfo.variant ? priceInfo.variant.price : null;
      } catch (err) {
        console.log(`Could not fetch cost for variant ${v.variant_id}: ${err.message}`);
      }
      variants.push({
        name: v.name,
        size: v.size || null,
        printfulCostUSD,
      });
    }

    catalog.push({
      id: product.id,
      name: detail.sync_product.name,
      variants,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Wrote Printful catalog with ${catalog.length} product(s) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
