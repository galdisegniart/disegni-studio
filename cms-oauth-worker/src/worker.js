/**
 * Minimal OAuth provider for Decap CMS, backed by GitHub, running on Cloudflare Workers.
 * Implements the standard Decap/Netlify CMS "auth" + "callback" handshake:
 * https://decapcms.org/docs/backends-overview/#custom-backend
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/payments/grow/create") {
      return handleGrowCheckout(request, env);
    }

    if (url.pathname === "/payments/grow/confirm") {
      return handleGrowConfirm(request, env);
    }

    if (url.pathname === "/payments/grow/status") {
      return handleGrowTestStatus(request, env);
    }

    if (url.pathname === "/orders/status") {
      return handleOrderStatus(request, env);
    }

    if (url.pathname === "/payments/coupons/check") {
      return handleCouponCheck(request, env);
    }

    if (url.pathname === "/admin/orders/cancel") {
      return handleAdminCancelOrder(request, env);
    }

    if (url.pathname === "/admin/coupons/list") {
      return handleAdminCouponsList(request, env);
    }

    if (url.pathname === "/admin/coupons/create") {
      return handleAdminCouponsCreate(request, env);
    }

    if (url.pathname === "/admin/coupons/delete") {
      return handleAdminCouponsDelete(request, env);
    }

    if (url.pathname === "/admin/contacts/list") {
      return handleAdminContactsList(request, env);
    }

    if (url.pathname === "/admin/contacts/create") {
      return handleAdminContactsCreate(request, env);
    }

    if (url.pathname === "/admin/contacts/delete") {
      return handleAdminContactsDelete(request, env);
    }

    if (url.pathname === "/admin/bit-receipts/intake") {
      return handleBitReceiptIntake(request, env);
    }

    if (url.pathname === "/bit-receipts/submit") {
      return handleBitReceiptPublicSubmit(request, env);
    }

    if (url.pathname === "/bit-receipts/extract") {
      return handleBitReceiptExtract(request, env);
    }

    if (url.pathname === "/admin/bit-receipts") {
      return handleAdminBitReceiptsList(request, env);
    }

    if (url.pathname === "/admin/bit-receipts/approve") {
      return handleAdminBitReceiptApprove(request, env);
    }

    if (url.pathname === "/admin/bit-receipts/reject") {
      return handleAdminBitReceiptReject(request, env);
    }

    if (url.pathname === "/admin/bit-receipts/check-status") {
      return handleAdminBitReceiptCheckStatus(request, env);
    }

    if (url.pathname === "/bookings/create") {
      return handleBookingCreate(request, env);
    }

    if (url.pathname === "/bookings/blocked-dates") {
      return handleBookingBlockedDates(request, env);
    }

    if (url.pathname === "/admin/bookings") {
      return handleAdminBookingsList(request, env);
    }

    if (url.pathname === "/smartbee/connection-test") {
      return handleSmartBeeConnectionTest(request, env);
    }

    if (url.pathname === "/smartbee/create-receipt") {
      return handleSmartBeeCreateReceipt(request, env);
    }

    if (url.pathname === "/smartbee/create-receipt-live") {
      return handleSmartBeeCreateReceiptLive(request, env);
    }

    if (url.pathname === "/smartbee/create-bit-receipt-live") {
      return handleSmartBeeCreateBitReceiptLive(request, env);
    }

    if (url.pathname === "/smartbee/receipt-status") {
      return handleSmartBeeReceiptStatus(request, env);
    }

    if (url.pathname === "/smartbee/receipt-status-live") {
      return handleSmartBeeBitReceiptStatusLive(request, env);
    }

    if (url.pathname === "/auth") {
      const authUrl = new URL("https://github.com/login/oauth/authorize");
      authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authUrl.searchParams.set("scope", "repo,user");
      authUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      return Response.redirect(authUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing code", { status: 400 });
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return htmlResponse(renderMessage("error", tokenData));
      }

      return htmlResponse(
        renderMessage("success", {
          token: tokenData.access_token,
          provider: "github",
        })
      );
    }

    return new Response("Decap CMS OAuth provider is running.", { status: 200 });
  },
};

const ORIN_PRODUCTS = [
  {
    productType: "poster",
    sizeId: "5x7",
    catalogNumber: "ORIN-POSTER-5X7",
    productName: "Orin – פוסטר 13×18 ס״מ",
    unitPrice: 89,
    shippingFirst: 45,
    shippingAdditional: 4,
  },
  {
    productType: "poster",
    sizeId: "12x18",
    catalogNumber: "ORIN-POSTER-12X18",
    productName: "Orin – פוסטר 30×45 ס״מ",
    unitPrice: 189,
    shippingFirst: 45,
    shippingAdditional: 4,
  },
  {
    productType: "poster",
    sizeId: "20x30",
    catalogNumber: "ORIN-POSTER-20X30",
    productName: "Orin – פוסטר 50×75 ס״מ",
    unitPrice: 319,
    shippingFirst: 55,
    shippingAdditional: 4,
  },
  {
    productType: "poster",
    sizeId: "24x36",
    catalogNumber: "ORIN-POSTER-24X36",
    productName: "Orin – פוסטר 60×90 ס״מ",
    unitPrice: 429,
    shippingFirst: 55,
    shippingAdditional: 4,
  },
  {
    productType: "framed-print",
    sizeId: "8x10",
    catalogNumber: "ORIN-FRAMED-8X10-BLACK",
    productName: "Orin – פוסטר ממוסגר שחור 20×25 ס״מ",
    unitPrice: 329,
    shippingFirst: 59,
    shippingAdditional: 29,
  },
  {
    productType: "framed-print",
    sizeId: "12x16",
    catalogNumber: "ORIN-FRAMED-12X16-BLACK",
    productName: "Orin – פוסטר ממוסגר שחור 30×40 ס״מ",
    unitPrice: 469,
    shippingFirst: 59,
    shippingAdditional: 29,
  },
  {
    productType: "framed-print",
    sizeId: "16x20",
    catalogNumber: "ORIN-FRAMED-16X20-BLACK",
    productName: "Orin – פוסטר ממוסגר שחור 40×50 ס״מ",
    unitPrice: 649,
    shippingFirst: 145,
    shippingAdditional: 75,
  },
  {
    productType: "framed-print",
    sizeId: "24x36",
    catalogNumber: "ORIN-FRAMED-24X36-BLACK",
    productName: "Orin – פוסטר ממוסגר שחור 60×90 ס״מ",
    unitPrice: 1290,
    shippingFirst: 185,
    shippingAdditional: 95,
  },
  {
    productType: "canvas",
    sizeId: "16x20",
    catalogNumber: "ORIN-CANVAS-16X20",
    productName: "Orin – קנבס מתוח 40×50 ס״מ",
    unitPrice: 449,
    shippingFirst: 379,
    shippingAdditional: 379,
  },
  {
    productType: "canvas",
    sizeId: "18x24",
    catalogNumber: "ORIN-CANVAS-18X24",
    productName: "Orin – קנבס מתוח 45×60 ס״מ",
    unitPrice: 549,
    shippingFirst: 379,
    shippingAdditional: 379,
  },
  {
    productType: "canvas",
    sizeId: "24x36",
    catalogNumber: "ORIN-CANVAS-24X36",
    productName: "Orin – קנבס מתוח 60×90 ס״מ",
    unitPrice: 899,
    shippingFirst: 379,
    shippingAdditional: 379,
  },
];

const ORDER_STATUSES = ["created", "pending", "paid", "failed", "cancelled", "refunded"];
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const IDEMPOTENCY_TTL_SECONDS = 60 * 15; // 15 minutes
const RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const RATE_LIMIT_MAX_REQUESTS = 8;
const COUPON_CODE_PATTERN = /^[A-Z0-9]{3,20}$/;
const COUPON_MAX_PERCENT_OFF = 90;
const COUPON_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BIT_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function kvGetJSON(env, key) {
  if (!env.ORDERS_KV) return null;
  const raw = await env.ORDERS_KV.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function kvPutJSON(env, key, value, ttlSeconds) {
  if (!env.ORDERS_KV) return;
  await env.ORDERS_KV.put(key, JSON.stringify(value), {
    expirationTtl: ttlSeconds,
  });
}

async function getOrder(env, orderId) {
  return kvGetJSON(env, `order:${orderId}`);
}

async function saveOrder(env, order) {
  await kvPutJSON(env, `order:${order.orderId}`, order, ORDER_TTL_SECONDS);
}

// Coupon records themselves are stored without a KV TTL - an optional
// expiresAt date is enforced at validation time instead, so an expired
// coupon stays visible (and editable) in the admin rather than vanishing.
async function kvPutJSONPermanent(env, key, value) {
  if (!env.ORDERS_KV) return;
  await env.ORDERS_KV.put(key, JSON.stringify(value));
}

async function getCoupon(env, code) {
  return kvGetJSON(env, `coupon:${code}`);
}

async function saveCoupon(env, coupon) {
  await kvPutJSONPermanent(env, `coupon:${coupon.code}`, coupon);
}

// Server-side only - never trusts a discount amount the browser might send.
// Re-validated here even if the cart already showed the customer a preview.
async function validateCoupon(env, rawCode, phone, subtotal) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { valid: false, error: "לא הוזן קוד קופון" };
  if (!COUPON_CODE_PATTERN.test(code)) {
    return { valid: false, error: "קוד קופון לא תקין" };
  }

  const coupon = await getCoupon(env, code);
  if (!coupon || !coupon.active) {
    return { valid: false, error: "קוד הקופון אינו קיים או אינו פעיל" };
  }
  if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
    return { valid: false, error: "קוד הקופון מוצה" };
  }
  // expiresAt is an inclusive last-valid day (YYYY-MM-DD). Compared as a
  // plain string against today's UTC date so there is no timezone drift;
  // in practice this keeps the code alive until ~03:00 Israel time the
  // following night, which errs generous rather than cutting a buyer off.
  if (coupon.expiresAt && new Date().toISOString().slice(0, 10) > coupon.expiresAt) {
    return { valid: false, error: "תוקף קוד הקופון פג" };
  }
  if (phone) {
    const alreadyUsed = await kvGetJSON(env, `couponuse:${code}:${phone}`);
    if (alreadyUsed) {
      return { valid: false, error: "כבר נעשה שימוש בקוד הזה עבור מספר הטלפון הזה" };
    }
  }

  const discountILS = Math.round(subtotal * (coupon.percentOff / 100));
  return { valid: true, code, percentOff: coupon.percentOff, discountILS };
}

// Best-effort request throttling. Cloudflare KV writes are not atomic, so under
// heavy concurrent load this can under-count — acceptable for this site's traffic,
// not a substitute for Cloudflare's own account-level rate limiting on abuse.
async function isRateLimited(env, bucketKey, limit = RATE_LIMIT_MAX_REQUESTS, windowSeconds = RATE_LIMIT_WINDOW_SECONDS) {
  if (!env.ORDERS_KV) return false;
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `ratelimit:${bucketKey}:${windowStart}`;
  const current = Number((await env.ORDERS_KV.get(key)) || "0");
  if (current >= limit) return true;
  await env.ORDERS_KV.put(key, String(current + 1), { expirationTtl: windowSeconds + 5 });
  return false;
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

const PURCHASE_CATALOG_URL = "https://disegni.studio/purchase-catalog.json";
const PURCHASE_CATALOG_CACHE_TTL_SECONDS = 5 * 60;

// The source of truth for price/product validation is the live site's own
// build output (regenerated on every deploy from the CMS content), not a
// hardcoded list in this file — so any artwork with approved purchaseVariants
// becomes purchasable here automatically, without a Worker code change.
async function fetchPurchaseCatalog(env) {
  const cached = await kvGetJSON(env, "purchase-catalog");
  if (cached) return cached;

  try {
    const response = await fetch(PURCHASE_CATALOG_URL, { cf: { cacheTtl: 60 } });
    if (!response.ok) return [];
    const catalog = await response.json();
    if (!Array.isArray(catalog)) return [];
    await kvPutJSON(env, "purchase-catalog", catalog, PURCHASE_CATALOG_CACHE_TTL_SECONDS);
    return catalog;
  } catch (error) {
    console.error("Failed to fetch purchase catalog", error.message);
    return [];
  }
}

async function handleGrowCheckout(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  // Test/sandbox checkout is off by default. It is enabled only via a Worker
  // secret set directly in Cloudflare (never a public URL parameter, never
  // visible in browser code), so an ordinary visitor has no way to turn it on.
  if (env.GROW_TEST_ENABLED !== "true") {
    return jsonResponse(
      { ok: false, error: "Payment testing is not currently enabled" },
      403,
      corsHeaders
    );
  }

  if (!env.MAKE_CHECKOUT_WEBHOOK_URL || !env.MAKE_CHECKOUT_API_KEY) {
    return jsonResponse(
      { ok: false, error: "Payment service is not configured" },
      503,
      corsHeaders
    );
  }

  if (await isRateLimited(env, `grow-create:${clientIp(request)}`)) {
    return jsonResponse(
      { ok: false, error: "Too many requests, please try again shortly" },
      429,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const idempotencyKey = cleanText(input.idempotencyKey, 80);
  if (idempotencyKey) {
    const existingOrderId = await kvGetJSON(env, `idem:${idempotencyKey}`);
    if (existingOrderId && existingOrderId.orderId) {
      const existingOrder = await getOrder(env, existingOrderId.orderId);
      if (existingOrder && existingOrder.paymentUrl) {
        // Same checkout attempt retried (double-click, refresh, back button):
        // return the original order instead of creating a second one with Make.
        return jsonResponse(
          { ok: true, orderId: existingOrder.orderId, paymentUrl: existingOrder.paymentUrl },
          200,
          corsHeaders
        );
      }
    }
  }

  const requestedItems = Array.isArray(input.items) ? input.items : [];
  if (requestedItems.length < 1 || requestedItems.length > 20) {
    return jsonResponse(
      { ok: false, error: "Product is not available for payment testing" },
      400,
      corsHeaders
    );
  }

  const purchaseCatalog = await fetchPurchaseCatalog(env);
  const items = [];
  for (const requestedItem of requestedItems) {
    const quantity = Number(requestedItem.quantity);
    const product = purchaseCatalog.find(
      (candidate) =>
        candidate.artworkSlug === requestedItem.artworkSlug &&
        candidate.productType === requestedItem.productType &&
        candidate.sizeId === requestedItem.sizeId
    );
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return jsonResponse(
        { ok: false, error: "Product is not available for payment testing" },
        400,
        corsHeaders
      );
    }
    items.push({
      productType: product.productType,
      catalogNumber: product.catalogNumber,
      productName: product.productName,
      imageUrl: product.imageUrl || "",
      unitPrice: product.unitPriceILS,
      shippingFirst: product.shippingFirstILS,
      shippingAdditional: product.shippingAdditionalILS,
      quantity,
      lineTotal: product.unitPriceILS * quantity,
    });
  }

  const customer = input.customer || {};
  const fullName = cleanText(customer.fullName, 120);
  const phone = cleanText(customer.phone, 20);
  const email = cleanText(customer.email, 160);
  const address = cleanText(customer.address, 300);
  if (fullName.length < 2 || !/^0\d{8,9}$/.test(phone)) {
    return jsonResponse(
      { ok: false, error: "Valid customer name and Israeli phone are required" },
      400,
      corsHeaders
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = calculateShipping(items);

  let couponCode = "";
  let discountILS = 0;
  const requestedCouponCode = cleanText(input.couponCode, 20);
  if (requestedCouponCode) {
    const couponResult = await validateCoupon(env, requestedCouponCode, phone, subtotal);
    if (!couponResult.valid) {
      return jsonResponse({ ok: false, error: couponResult.error }, 400, corsHeaders);
    }
    couponCode = couponResult.code;
    discountILS = couponResult.discountILS;
  }

  const total = subtotal - discountILS + shipping;
  const orderId = `GD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const singleItem = items.length === 1 ? items[0] : null;
  const nowIso = new Date().toISOString();

  await saveOrder(env, {
    orderId,
    status: "created",
    subtotal,
    shipping,
    couponCode,
    discountILS,
    total,
    currency: "ILS",
    phone,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // Grow only ever charges based on this single price × quantity line (plus
  // the separate shipping line) - there is no separate "total" field it
  // reads - so the coupon discount has to be baked into unitPrice itself,
  // not just recorded on our own order total.
  const discountedSubtotal = subtotal - discountILS;
  const payloadQuantity = singleItem ? singleItem.quantity : 1;
  const payloadUnitPrice = Math.round((discountedSubtotal / payloadQuantity) * 100) / 100;
  const discountSuffix = couponCode ? ` (קופון ${couponCode}: -${discountILS}₪)` : "";

  const payload = {
    orderId,
    fullName,
    phone,
    email,
    address,
    catalogNumber: singleItem ? singleItem.catalogNumber : `ORDER-${orderId}`,
    productName:
      (singleItem
        ? singleItem.productName
        : `הזמנה – ${items.reduce((sum, item) => sum + item.quantity, 0)} פריטים`) + discountSuffix,
    unitPrice: payloadUnitPrice,
    quantity: payloadQuantity,
    imageUrl: singleItem ? singleItem.imageUrl : "",
    items: items.map((item) => ({
      catalogNumber: item.catalogNumber,
      productName: item.productName,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal,
    shipping,
    couponCode,
    discountILS,
    total,
    successUrl: `https://disegni.studio/thank-you/?order=${encodeURIComponent(orderId)}`,
  };

  let makeResponse;
  try {
    makeResponse = await fetch(env.MAKE_CHECKOUT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-make-apikey": env.MAKE_CHECKOUT_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Grow checkout webhook request failed", orderId);
    await saveOrder(env, {
      orderId,
      status: "failed",
      subtotal,
      shipping,
      couponCode,
      discountILS,
      total,
      currency: "ILS",
      phone,
      createdAt: nowIso,
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse(
      { ok: false, error: "Payment service is unavailable" },
      502,
      corsHeaders
    );
  }

  if (!makeResponse.ok) {
    console.error("Grow checkout webhook rejected the request", orderId, makeResponse.status);
    await saveOrder(env, {
      orderId,
      status: "failed",
      subtotal,
      shipping,
      couponCode,
      discountILS,
      total,
      currency: "ILS",
      phone,
      createdAt: nowIso,
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse(
      { ok: false, error: "Payment service rejected the request" },
      502,
      corsHeaders
    );
  }

  let makeBody;
  try {
    makeBody = await makeResponse.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Payment service returned an invalid response" },
      502,
      corsHeaders
    );
  }

  const paymentUrl = cleanText(makeBody.url, 1000);
  if (!isAllowedGrowPaymentUrl(paymentUrl)) {
    return jsonResponse(
      { ok: false, error: "Payment service did not return a valid payment link" },
      502,
      corsHeaders
    );
  }

  await saveOrder(env, {
    orderId,
    status: "pending",
    subtotal,
    shipping,
    couponCode,
    discountILS,
    total,
    currency: "ILS",
    phone,
    paymentUrl,
    createdAt: nowIso,
    updatedAt: new Date().toISOString(),
  });

  if (idempotencyKey) {
    await kvPutJSON(env, `idem:${idempotencyKey}`, { orderId }, IDEMPOTENCY_TTL_SECONDS);
  }

  return jsonResponse({ ok: true, orderId, paymentUrl }, 200, corsHeaders);
}

// Called by the Make scenario after it has confirmed payment with Grow
// (i.e. after Grow's webhook fires and Make runs "Approve Transaction").
// Protected by a shared secret so only Make can move an order to a final state.
async function handleGrowConfirm(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  const sharedSecret = request.headers.get("X-Grow-Confirm-Secret");
  if (!env.GROW_CONFIRM_SECRET || sharedSecret !== env.GROW_CONFIRM_SECRET) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders || noStoreHeaders());
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const orderId = cleanText(input.orderId, 60);
  const status = cleanText(input.status, 20);
  if (!orderId || !ORDER_STATUSES.includes(status) || status === "created") {
    return jsonResponse({ ok: false, error: "Invalid orderId or status" }, 400, corsHeaders);
  }

  const order = await getOrder(env, orderId);
  if (!order) {
    return jsonResponse({ ok: false, error: "Order not found" }, 404, corsHeaders);
  }

  // Idempotent: a duplicate webhook/notification for an order already in this
  // (or a later, final) state is accepted as a no-op rather than reapplied,
  // so a retried "paid" notification can never trigger a second receipt.
  const finalStates = ["paid", "failed", "cancelled", "refunded"];
  if (order.status === status) {
    return jsonResponse({ ok: true, orderId, status: order.status, alreadyApplied: true }, 200, corsHeaders);
  }
  if (finalStates.includes(order.status) && status !== "refunded") {
    return jsonResponse({ ok: true, orderId, status: order.status, alreadyApplied: true }, 200, corsHeaders);
  }

  const providerRef = cleanText(input.providerRef, 200);
  const transactionToken = cleanText(input.transactionToken, 200);
  await saveOrder(env, {
    ...order,
    status,
    providerRef: providerRef || order.providerRef || "",
    transactionToken: transactionToken || order.transactionToken || "",
    updatedAt: new Date().toISOString(),
  });

  // Coupon usage is only recorded once a payment is actually confirmed paid -
  // not at checkout time - so an abandoned or failed payment attempt never
  // burns the customer's one-time use of the code.
  if (status === "paid" && order.couponCode && order.phone) {
    await kvPutJSONPermanent(env, `couponuse:${order.couponCode}:${order.phone}`, {
      orderId,
      usedAt: new Date().toISOString(),
    });
    const coupon = await getCoupon(env, order.couponCode);
    if (coupon) {
      coupon.usesCount = (coupon.usesCount || 0) + 1;
      await saveCoupon(env, coupon);
    }
  }

  return jsonResponse({ ok: true, orderId, status }, 200, corsHeaders);
}

// Public, non-sensitive flag: whether the Grow sandbox checkout button should
// be shown at all. Controlled only by a Worker secret set in Cloudflare —
// never a client-visible URL parameter — so a regular visitor cannot enable it.
async function handleGrowTestStatus(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "GET, OPTIONS" }
    );
  }

  return jsonResponse({ ok: true, enabled: env.GROW_TEST_ENABLED === "true" }, 200, corsHeaders);
}

// Lets the thank-you page ask "what actually happened to this order" instead
// of trusting that landing on /thank-you/ means payment succeeded. Returns only
// non-sensitive fields — no name/phone/email/address.
async function handleOrderStatus(request, env) {
  const corsHeaders = getCorsHeaders(request, env);
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "GET, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  if (await isRateLimited(env, `order-status:${clientIp(request)}`, 30, 60)) {
    return jsonResponse({ ok: false, error: "Too many requests" }, 429, corsHeaders);
  }

  const orderId = cleanText(url.searchParams.get("orderId"), 60);
  if (!orderId) {
    return jsonResponse({ ok: false, error: "Missing orderId" }, 400, corsHeaders);
  }

  const order = await getOrder(env, orderId);
  if (!order) {
    return jsonResponse({ ok: false, error: "Order not found" }, 404, corsHeaders);
  }

  return jsonResponse(
    {
      ok: true,
      orderId: order.orderId,
      status: order.status,
      total: order.total,
      currency: order.currency,
      updatedAt: order.updatedAt,
    },
    200,
    corsHeaders
  );
}

// Lets the cart show live feedback ("10% off applied") before the customer
// commits to checkout. Never marks the code as used - only the real checkout
// (handleGrowCheckout, re-validated there too) and a confirmed payment do that.
async function handleCouponCheck(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (await isRateLimited(env, `coupon-check:${clientIp(request)}`, 20, 60)) {
    return jsonResponse({ ok: false, error: "Too many requests, please try again shortly" }, 429, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const phone = cleanText(input.phone, 20);
  const subtotal = Number(input.subtotal);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return jsonResponse({ ok: false, error: "Invalid subtotal" }, 400, corsHeaders);
  }

  const result = await validateCoupon(env, input.code, phone, subtotal);
  return jsonResponse({ ok: true, ...result }, 200, corsHeaders);
}

const ADMIN_CANCEL_WEBHOOK_URL_ENV = "ADMIN_CANCEL_ORDER_WEBHOOK_URL";

// Internal-only: Gal manually triggers this from the admin page after a
// customer messages him about a mistaken order, before it's shipped. Only
// starts the refund - the order is not marked refunded until Make confirms
// Grow's refund actually succeeded (same "don't trust the request" pattern
// as payment confirmation), via the existing /payments/grow/confirm.
async function handleAdminCancelOrder(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  const adminKey = request.headers.get("X-Disegni-Admin-Key");
  if (!env.DISEGNI_ADMIN_KEY || adminKey !== env.DISEGNI_ADMIN_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  if (!env[ADMIN_CANCEL_WEBHOOK_URL_ENV]) {
    return jsonResponse(
      { ok: false, error: "Cancel/refund service is not configured" },
      503,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const orderId = cleanText(input.orderId, 60);
  if (!orderId) {
    return jsonResponse({ ok: false, error: "Missing orderId" }, 400, corsHeaders);
  }

  const order = await getOrder(env, orderId);
  if (!order) {
    return jsonResponse({ ok: false, error: "Order not found" }, 404, corsHeaders);
  }

  if (order.status !== "paid") {
    return jsonResponse(
      { ok: false, error: `Order status is "${order.status}", not "paid" - nothing to refund` },
      400,
      corsHeaders
    );
  }

  if (!order.providerRef || !order.transactionToken) {
    return jsonResponse(
      { ok: false, error: "Order is missing the Grow transaction details needed to refund it" },
      400,
      corsHeaders
    );
  }

  try {
    const makeResponse = await fetch(env[ADMIN_CANCEL_WEBHOOK_URL_ENV], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        transactionId: order.providerRef,
        transactionToken: order.transactionToken,
        refundSum: order.total,
      }),
    });
    if (!makeResponse.ok) {
      throw new Error(`Cancel webhook responded ${makeResponse.status}`);
    }
  } catch (error) {
    console.error("Admin cancel order webhook call failed", orderId);
    return jsonResponse(
      { ok: false, error: "Could not start the refund - please try again" },
      502,
      corsHeaders
    );
  }

  return jsonResponse(
    { ok: true, orderId, message: "Refund started - status will update once Grow confirms it" },
    200,
    corsHeaders
  );
}

function requireAdminKey(request, env, corsHeaders) {
  const adminKey = request.headers.get("X-Disegni-Admin-Key");
  if (!env.DISEGNI_ADMIN_KEY || adminKey !== env.DISEGNI_ADMIN_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }
  return null;
}

async function handleAdminCouponsList(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "GET, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: true, coupons: [] }, 200, corsHeaders);
  }

  const listing = await env.ORDERS_KV.list({ prefix: "coupon:" });
  const coupons = [];
  for (const key of listing.keys) {
    const coupon = await kvGetJSON(env, key.name);
    if (coupon) coupons.push(coupon);
  }
  coupons.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return jsonResponse({ ok: true, coupons }, 200, corsHeaders);
}

async function handleAdminCouponsCreate(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const code = String(input.code || "").trim().toUpperCase();
  if (!COUPON_CODE_PATTERN.test(code)) {
    return jsonResponse(
      { ok: false, error: "קוד קופון חייב להכיל 3-20 אותיות/ספרות באנגלית בלבד" },
      400,
      corsHeaders
    );
  }

  const percentOff = Number(input.percentOff);
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > COUPON_MAX_PERCENT_OFF) {
    return jsonResponse(
      { ok: false, error: `אחוז ההנחה חייב להיות בין 1 ל-${COUPON_MAX_PERCENT_OFF}` },
      400,
      corsHeaders
    );
  }

  let maxUses = null;
  if (input.maxUses !== undefined && input.maxUses !== null && input.maxUses !== "") {
    const parsedMaxUses = Number(input.maxUses);
    if (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1) {
      return jsonResponse({ ok: false, error: "מספר השימושים המרבי חייב להיות מספר שלם חיובי" }, 400, corsHeaders);
    }
    maxUses = parsedMaxUses;
  }

  let expiresAt = null;
  if (input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== "") {
    const requestedExpiry = String(input.expiresAt).trim();
    if (!COUPON_DATE_PATTERN.test(requestedExpiry) || Number.isNaN(Date.parse(requestedExpiry))) {
      return jsonResponse({ ok: false, error: "תאריך התפוגה חייב להיות בפורמט YYYY-MM-DD" }, 400, corsHeaders);
    }
    expiresAt = requestedExpiry;
  }

  const existing = await getCoupon(env, code);
  const coupon = {
    code,
    percentOff,
    maxUses,
    expiresAt,
    active: true,
    usesCount: existing ? existing.usesCount || 0 : 0,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveCoupon(env, coupon);

  return jsonResponse({ ok: true, coupon }, 200, corsHeaders);
}

async function handleAdminCouponsDelete(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const code = String(input.code || "").trim().toUpperCase();
  if (!code) {
    return jsonResponse({ ok: false, error: "Missing code" }, 400, corsHeaders);
  }

  if (env.ORDERS_KV) {
    await env.ORDERS_KV.delete(`coupon:${code}`);
  }

  return jsonResponse({ ok: true, code }, 200, corsHeaders);
}

// A small saved-contact book so a returning customer's phone/email - never
// present in a Bit transfer screenshot - can be auto-filled once Gal has
// entered them a first time. Deliberately admin-only (never exposed to the
// public form): looking someone's phone/email up by a guessed name is
// exactly the kind of lookup that shouldn't be open to anonymous requests.
async function handleAdminContactsList(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "GET, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: true, contacts: [] }, 200, corsHeaders);
  }

  const listing = await env.ORDERS_KV.list({ prefix: "contact:" });
  const contacts = [];
  for (const key of listing.keys) {
    const contact = await kvGetJSON(env, key.name);
    if (contact) contacts.push(contact);
  }
  contacts.sort((a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName, "he"));

  return jsonResponse({ ok: true, contacts }, 200, corsHeaders);
}

async function handleAdminContactsCreate(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;
  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Contact storage is not configured" }, 503, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const firstName = cleanText(input.firstName, 60);
  const lastName = cleanText(input.lastName, 60);
  if (!firstName || !lastName) {
    return jsonResponse({ ok: false, error: "שם פרטי ושם משפחה הם שדות חובה" }, 400, corsHeaders);
  }
  const email = cleanText(input.email, 160);
  const phone = cleanText(input.phone, 20);
  const serviceType = cleanText(input.serviceType, 200);
  // Matched case-insensitively against the free-text note the payer writes
  // in the Bit transfer itself - e.g. a keyword of "דוד" matches a note of
  // "עבודה עם דוד". Deliberately just a substring, not a name-parsing
  // heuristic: the payer chooses this text, so it's the most reliable
  // signal available for identifying them automatically.
  const descriptionKeyword = cleanText(input.descriptionKeyword, 100);

  // Editing an existing contact reuses its id; a new one gets a fresh id -
  // this is an upsert either way, matching how the admin form calls it.
  const id = cleanText(input.id, 60) || crypto.randomUUID();
  const key = `contact:${id}`;
  const existing = await kvGetJSON(env, key);

  const contact = {
    id,
    firstName,
    lastName,
    email,
    phone,
    serviceType,
    descriptionKeyword,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kvPutJSONPermanent(env, key, contact);

  return jsonResponse({ ok: true, contact }, 200, corsHeaders);
}

async function handleAdminContactsDelete(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const id = cleanText(input.id, 60);
  if (!id) {
    return jsonResponse({ ok: false, error: "Missing id" }, 400, corsHeaders);
  }

  if (env.ORDERS_KV) {
    await env.ORDERS_KV.delete(`contact:${id}`);
  }

  return jsonResponse({ ok: true, id }, 200, corsHeaders);
}

function calculateShipping(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.productType)) groups.set(item.productType, []);
    for (let index = 0; index < item.quantity; index += 1) {
      groups.get(item.productType).push(item);
    }
  }

  let total = 0;
  for (const units of groups.values()) {
    units.sort((a, b) => b.shippingFirst - a.shippingFirst);
    total += units[0].shippingFirst;
    for (const additionalItem of units.slice(1)) {
      total += additionalItem.shippingAdditional;
    }
  }
  return total;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isAllowedGrowPaymentUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "grow.link" ||
        url.hostname.endsWith(".grow.link") ||
        url.hostname === "grow.business" ||
        url.hostname.endsWith(".grow.business"))
    );
  } catch {
    return false;
  }
}

async function handleSmartBeeConnectionTest(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "GET") {
    return smartBeeTestPage(corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  const accessKey = request.headers.get("X-Disegni-Test-Key");
  if (!env.SMARTBEE_TEST_ACCESS_KEY || accessKey !== env.SMARTBEE_TEST_ACCESS_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const missingSecrets = [
    "SMARTBEE_TEST_CLIENT_ID",
    "SMARTBEE_TEST_PASSWORD",
    "SMARTBEE_PROVIDER_USER_TOKEN",
  ].filter((name) => !env[name]);

  if (missingSecrets.length) {
    return jsonResponse(
      { ok: false, error: "SmartBee test credentials are not configured" },
      503,
      corsHeaders
    );
  }

  try {
    const apiBase = (env.SMARTBEE_TEST_API_BASE || "https://test.smartbee.co.il/api/v1")
      .replace(/\/+$/, "");
    let authentication;
    try {
      authentication = await smartBeeRequest(
        `${apiBase}/Login/authenticate`,
        {
          clientId: env.SMARTBEE_TEST_CLIENT_ID,
          password: env.SMARTBEE_TEST_PASSWORD,
        }
      );
    } catch (error) {
      throw new SmartBeeConnectionError("client_authentication", error);
    }

    if (!authentication.token) {
      throw new SmartBeeConnectionError(
        "client_authentication",
        new Error("SmartBee authentication did not return a token")
      );
    }

    let documentSearch;
    try {
      documentSearch = await smartBeeRequest(
        `${apiBase}/Documents/search`,
        {
          providerUserToken: env.SMARTBEE_PROVIDER_USER_TOKEN,
          page: 1,
          amountPerPage: 1,
        },
        authentication.token
      );
    } catch (error) {
      throw new SmartBeeConnectionError("provider_user_token", error);
    }

    const hasValidationErrors =
      documentSearch.validationErrors &&
      Object.keys(documentSearch.validationErrors).length > 0;
    if ([94, 98, 99].includes(documentSearch.resultCodeId) || hasValidationErrors) {
      const requestError = new Error("SmartBee rejected the document search request");
      requestError.resultCodeId = documentSearch.resultCodeId;
      requestError.validationFields = Object.keys(
        documentSearch.validationErrors || {}
      );
      throw new SmartBeeConnectionError("document_search", requestError);
    }

    return jsonResponse(
      {
        ok: true,
        environment: "test",
        apiTokenExpiresAt: authentication.expirationUtcDate || null,
        providerUserTokenVerified: true,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("SmartBee connection test failed", error);
    return jsonResponse(
      {
        ok: false,
        error: "SmartBee connection test failed",
        stage: error instanceof SmartBeeConnectionError ? error.stage : "unknown",
        diagnostic:
          error instanceof SmartBeeConnectionError
            ? safeSmartBeeDiagnostic(error.cause)
            : null,
      },
      502,
      corsHeaders
    );
  }
}

class SmartBeeConnectionError extends Error {
  constructor(stage, cause) {
    super(`SmartBee connection failed at ${stage}`, { cause });
    this.name = "SmartBeeConnectionError";
    this.stage = stage;
  }
}

function safeSmartBeeDiagnostic(error) {
  if (!error) return null;
  return {
    httpStatus: Number.isInteger(error.httpStatus) ? error.httpStatus : null,
    resultCodeId: Number.isInteger(error.resultCodeId) ? error.resultCodeId : null,
    validationFields: Array.isArray(error.validationFields)
      ? error.validationFields
      : [],
  };
}

function smartBeeTestPage(corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>בדיקת חיבור SmartBee</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; }
    body { margin: 0; background: #0f1028; color: #f7f5f1; }
    main { width: min(520px, calc(100% - 40px)); margin: 12vh auto; }
    h1 { font-size: 1.8rem; }
    p { color: #c8c5ce; line-height: 1.6; }
    label { display: block; margin: 24px 0 8px; }
    input, button {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      border-radius: 8px;
      font: inherit;
    }
    input { border: 1px solid #4e5067; background: #171832; color: #fff; padding: 10px 12px; }
    button { margin-top: 12px; border: 0; background: #d9a13f; color: #111226; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    output { display: block; margin-top: 20px; padding: 14px; border-radius: 8px; background: #171832; line-height: 1.6; }
    .success { color: #8ee7af; }
    .error { color: #ff9a9a; }
  </style>
</head>
<body>
  <main>
    <h1>בדיקת חיבור SmartBee</h1>
    <p>הבדיקה מאמתת את החיבור לסביבת הטסט בלבד. היא אינה מחייבת ואינה יוצרת מסמך.</p>
    <form id="test-form">
      <label for="key">מפתח הבדיקה הפנימי</label>
      <input id="key" type="password" required autocomplete="off">
      <button type="submit">בדיקת חיבור</button>
    </form>
    <output id="result" hidden></output>
  </main>
  <script>
    const form = document.getElementById("test-form");
    const keyInput = document.getElementById("key");
    const button = form.querySelector("button");
    const result = document.getElementById("result");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      result.hidden = false;
      result.className = "";
      result.textContent = "בודק חיבור...";

      try {
        const response = await fetch(location.pathname, {
          method: "POST",
          headers: { "X-Disegni-Test-Key": keyInput.value },
        });
        const body = await response.json();
        if (!response.ok || !body.ok) {
          const stageMessages = {
            client_authentication: "החיבור נכשל בשלב אימות ה-ClientId והסיסמה.",
            provider_user_token: "החיבור נכשל בשלב אימות ה-Token.",
            document_search: "SmartBee דחה את בקשת חיפוש המסמכים.",
          };
          const diagnostic = body.diagnostic || {};
          const details = [
            Number.isInteger(diagnostic.httpStatus)
              ? "HTTP " + diagnostic.httpStatus
              : "",
            Number.isInteger(diagnostic.resultCodeId)
              ? "קוד SmartBee " + diagnostic.resultCodeId
              : "",
            Array.isArray(diagnostic.validationFields) &&
            diagnostic.validationFields.length
              ? "שדות: " + diagnostic.validationFields.join(", ")
              : "",
          ].filter(Boolean).join(" · ");
          throw new Error(
            (stageMessages[body.stage] || "החיבור נכשל מסיבה לא ידועה.") +
            (details ? " " + details : "")
          );
        }
        result.className = "success";
        result.textContent = "החיבור לסביבת הטסט הצליח.";
      } catch (error) {
        result.className = "error";
        result.textContent = error.message || "החיבור נכשל. יש לבדוק את הפרטים שהוגדרו.";
      } finally {
        keyInput.value = "";
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...noStoreHeaders(),
      ...(corsHeaders || {}),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function smartBeeAuthenticate(apiBase, env) {
  const authentication = await smartBeeRequest(`${apiBase}/Login/authenticate`, {
    clientId: env.SMARTBEE_TEST_CLIENT_ID,
    password: env.SMARTBEE_TEST_PASSWORD,
  });
  if (!authentication.token) {
    throw new Error("SmartBee authentication did not return a token");
  }
  return authentication.token;
}

// docType: "Receipt" (קבלה) - a VAT-exempt dealer (עוסק פטור) may not legally issue
// "InvoiceReceipt" (חשבונית מס קבלה), which includes a tax-invoice component.
// vatOption fixed to "Free" because
// the business is a VAT-exempt dealer (עוסק פטור) - update if that ever changes.
async function handleSmartBeeCreateReceipt(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "GET") {
    return smartBeeCreateReceiptTestPage(corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "GET, POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  const accessKey = request.headers.get("X-Disegni-Test-Key");
  if (!env.SMARTBEE_TEST_ACCESS_KEY || accessKey !== env.SMARTBEE_TEST_ACCESS_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const missingSecrets = [
    "SMARTBEE_TEST_CLIENT_ID",
    "SMARTBEE_TEST_PASSWORD",
    "SMARTBEE_PROVIDER_USER_TOKEN",
  ].filter((name) => !env[name]);
  if (missingSecrets.length) {
    return jsonResponse(
      { ok: false, error: "SmartBee test credentials are not configured" },
      503,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  // Two request shapes are supported:
  // 1. Itemized (used by the manual test page): artworkSlug + items[] matching
  //    ORIN_PRODUCTS, priced and validated server-side.
  // 2. Simple total (used by the Make automation, which only has the payment
  //    confirmation - name/phone/email/sum - not the original product/address
  //    details): totalAmount + customer, billed as one generic line item.
  const isSimpleTotal = input.items === undefined && input.totalAmount !== undefined;

  const customer = input.customer || {};
  const fullName = cleanText(customer.fullName, 100);
  const phone = cleanText(customer.phone, 20);
  const email = cleanText(customer.email, 160);
  const address = cleanText(customer.address, 100);
  if (fullName.length < 2 || !/^0\d{8,9}$/.test(phone)) {
    return jsonResponse(
      { ok: false, error: "Valid customer name and Israeli phone are required" },
      400,
      corsHeaders
    );
  }

  const orderId = cleanText(input.orderId, 60) || `GD-RECEIPT-${crypto.randomUUID().slice(0, 8)}`;

  let paymentItems;
  let total;

  if (isSimpleTotal) {
    const totalAmount = Number(input.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || totalAmount > 100000) {
      return jsonResponse({ ok: false, error: "Invalid total amount" }, 400, corsHeaders);
    }
    total = totalAmount;
    paymentItems = [
      {
        description: cleanText(input.description, 100) || "הזמנה מאתר גל דיסני",
        quantity: 1,
        pricePerUnit: total,
        vatOption: "Free",
      },
    ];
  } else {
    const requestedItems = Array.isArray(input.items) ? input.items : [];
    if (input.artworkSlug !== "orin" || requestedItems.length < 1 || requestedItems.length > 11) {
      return jsonResponse(
        { ok: false, error: "Order is not available for receipt testing" },
        400,
        corsHeaders
      );
    }

    const items = [];
    for (const requestedItem of requestedItems) {
      const quantity = Number(requestedItem.quantity);
      const product = ORIN_PRODUCTS.find(
        (candidate) =>
          candidate.productType === requestedItem.productType &&
          candidate.sizeId === requestedItem.sizeId
      );
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return jsonResponse(
          { ok: false, error: "Order is not available for receipt testing" },
          400,
          corsHeaders
        );
      }
      items.push({ ...product, quantity });
    }

    const shipping = calculateShipping(items);
    total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + shipping;

    paymentItems = items.map((item) => ({
      catNum: item.catalogNumber,
      description: item.productName,
      quantity: item.quantity,
      pricePerUnit: item.unitPrice,
      vatOption: "Free",
    }));
    if (shipping > 0) {
      paymentItems.push({
        description: "משלוח",
        quantity: 1,
        pricePerUnit: shipping,
        vatOption: "Free",
      });
    }
  }

  try {
    const apiBase = (env.SMARTBEE_TEST_API_BASE || "https://test.smartbee.co.il/api/v1").replace(
      /\/+$/,
      ""
    );
    const token = await smartBeeAuthenticate(apiBase, env);

    const documentRequest = {
      providerMsgId: crypto.randomUUID(),
      providerMsgReferenceId: orderId,
      providerUserToken: env.SMARTBEE_PROVIDER_USER_TOKEN,
      customer: {
        name: fullName,
        email: email || undefined,
        mainPhone: phone,
        address: address || undefined,
      },
      docType: "Receipt",
      currency: { currencyType: "ILS" },
      documentItems: { paymentItems },
      receiptDetails: {
        cashItems: [
          {
            sum: total,
            date: new Date().toISOString(),
          },
        ],
      },
    };

    const createResult = await smartBeeRequest(
      `${apiBase}/Documents/create`,
      documentRequest,
      token
    );

    if (createResult.validationErrors && Object.keys(createResult.validationErrors).length) {
      return jsonResponse(
        {
          ok: false,
          error: "SmartBee rejected the receipt request",
          resultCodeId: createResult.resultCodeId,
          validationFields: Object.keys(createResult.validationErrors),
        },
        502,
        corsHeaders
      );
    }

    return jsonResponse(
      {
        ok: true,
        orderId,
        apiMessageId: createResult.result,
        resultCodeId: createResult.resultCodeId,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("SmartBee receipt creation failed", error);
    return jsonResponse(
      {
        ok: false,
        error: "SmartBee receipt creation failed",
        diagnostic: safeSmartBeeDiagnostic(error),
      },
      502,
      corsHeaders
    );
  }
}

// Production SmartBee receipt creation, called only by the Make "Integration
// Grow" scenario right after a Grow payment is approved. Same "simple total"
// shape as the test path's automation case (Grow's own webhook only carries
// name/phone/email/sum, not the original itemized order) — no itemized/manual
// test-page shape here, since nothing else calls this in practice.
async function handleSmartBeeCreateReceiptLive(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  const liveKey = request.headers.get("X-SmartBee-Live-Key");
  if (!env.SMARTBEE_LIVE_KEY || liveKey !== env.SMARTBEE_LIVE_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  const missingSecrets = [
    "SMARTBEE_CLIENT_ID",
    "SMARTBEE_PASSWORD",
    "SMARTBEE_LIVE_PROVIDER_USER_TOKEN",
  ].filter((name) => !env[name]);
  if (missingSecrets.length) {
    return jsonResponse(
      { ok: false, error: "SmartBee production credentials are not configured" },
      503,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const customer = input.customer || {};
  const fullName = cleanText(customer.fullName, 100);
  const phone = cleanText(customer.phone, 20);
  const email = cleanText(customer.email, 160);
  const address = cleanText(customer.address, 100);
  if (fullName.length < 2 || !/^0\d{8,9}$/.test(phone)) {
    return jsonResponse(
      { ok: false, error: "Valid customer name and Israeli phone are required" },
      400,
      corsHeaders
    );
  }

  const totalAmount = Number(input.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || totalAmount > 100000) {
    return jsonResponse({ ok: false, error: "Invalid total amount" }, 400, corsHeaders);
  }

  const orderId = cleanText(input.orderId, 60) || `GD-RECEIPT-${crypto.randomUUID().slice(0, 8)}`;
  const paymentItems = [
    {
      description: cleanText(input.description, 100) || "הזמנה מאתר גל דיסני",
      quantity: 1,
      pricePerUnit: totalAmount,
      vatOption: "Free",
    },
  ];

  try {
    const apiBase = (env.SMARTBEE_API_BASE || "https://smartbee.co.il/api/v1").replace(/\/+$/, "");

    const authentication = await smartBeeRequest(`${apiBase}/Login/authenticate`, {
      clientId: env.SMARTBEE_CLIENT_ID,
      password: env.SMARTBEE_PASSWORD,
    });
    if (!authentication.token) {
      throw new Error("SmartBee authentication did not return a token");
    }

    const documentRequest = {
      providerMsgId: crypto.randomUUID(),
      providerMsgReferenceId: orderId,
      providerUserToken: env.SMARTBEE_LIVE_PROVIDER_USER_TOKEN,
      customer: {
        name: fullName,
        email: email || undefined,
        mainPhone: phone,
        address: address || undefined,
      },
      docType: "Receipt",
      currency: { currencyType: "ILS" },
      documentItems: { paymentItems },
      receiptDetails: {
        cashItems: [
          {
            sum: totalAmount,
            date: new Date().toISOString(),
          },
        ],
      },
    };

    const createResult = await smartBeeRequest(
      `${apiBase}/Documents/create`,
      documentRequest,
      authentication.token
    );

    if (createResult.validationErrors && Object.keys(createResult.validationErrors).length) {
      return jsonResponse(
        {
          ok: false,
          error: "SmartBee rejected the receipt request",
          resultCodeId: createResult.resultCodeId,
          validationFields: Object.keys(createResult.validationErrors),
        },
        502,
        corsHeaders
      );
    }

    return jsonResponse(
      {
        ok: true,
        orderId,
        apiMessageId: createResult.result,
        resultCodeId: createResult.resultCodeId,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("SmartBee live receipt creation failed", orderId);
    return jsonResponse(
      {
        ok: false,
        error: "SmartBee receipt creation failed",
        diagnostic: safeSmartBeeDiagnostic(error),
      },
      502,
      corsHeaders
    );
  }
}

// Separate production path for manually verified Bit payments. This endpoint
// does not share Make's Grow payload and never reads credentials from Make.
async function handleSmartBeeCreateBitReceiptLive(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  if (!isAuthorizedBitReceiptRequest(request, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }

  const missingSecrets = [
    "SMARTBEE_CLIENT_ID",
    "SMARTBEE_PASSWORD",
    "SMARTBEE_LIVE_PROVIDER_USER_TOKEN",
  ].filter((name) => !env[name]);
  if (missingSecrets.length) {
    return jsonResponse(
      { ok: false, error: "SmartBee production credentials are not configured" },
      503,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const validated = validateBitReceiptInput(input);
  if (!validated.ok) {
    return jsonResponse(
      { ok: false, error: validated.error, fields: validated.fields || [] },
      400,
      corsHeaders
    );
  }

  const receipt = validated.value;
  const requestKey = bitReceiptRequestKey(receipt.requestId);
  const referenceKey = bitReceiptReferenceKey(receipt.bitReference);
  const existingRequest = await kvGetJSON(env, requestKey);

  if (existingRequest && ["processing", "issued"].includes(existingRequest.status)) {
    return jsonResponse(bitReceiptPublicResponse(existingRequest, true), 200, corsHeaders);
  }

  const existingReference = await kvGetJSON(env, referenceKey);
  if (existingReference && existingReference.requestId !== receipt.requestId) {
    return jsonResponse(
      {
        ok: false,
        error: "Bit reference already belongs to another request",
        code: "duplicate_bit_reference",
      },
      409,
      corsHeaders
    );
  }

  const now = new Date().toISOString();
  const processingRecord = {
    ...receipt,
    status: "processing",
    apiMessageId: existingRequest?.apiMessageId || "",
    documentId: existingRequest?.documentId || "",
    linkToOriginal: existingRequest?.linkToOriginal || "",
    linkToCopy: existingRequest?.linkToCopy || "",
    createdAt: existingRequest?.createdAt || now,
    updatedAt: now,
  };
  await kvPutJSONPermanent(env, requestKey, processingRecord);
  await kvPutJSONPermanent(env, referenceKey, {
    requestId: receipt.requestId,
    status: "processing",
    updatedAt: now,
  });

  try {
    const apiBase = smartBeeLiveApiBase(env);
    const token = await smartBeeAuthenticateLive(apiBase, env);
    const documentRequest = {
      // SmartBee uses providerMsgId to identify retries. Keeping requestId
      // stable is what prevents a retry from creating another document.
      providerMsgId: receipt.requestId,
      providerMsgReferenceId: receipt.requestId,
      providerUserToken: env.SMARTBEE_LIVE_PROVIDER_USER_TOKEN,
      customer: {
        name: receipt.customerName,
        email: receipt.email,
        mainPhone: receipt.phone,
      },
      docType: "Receipt",
      createDraftOnFailure: false,
      comments: `אסמכתת Bit: ${receipt.bitReference}`,
      currency: { currencyType: "ILS" },
      documentItems: {
        paymentItems: [
          {
            description: receipt.description,
            quantity: 1,
            pricePerUnit: receipt.amount,
            vatOption: "Free",
          },
        ],
      },
      receiptDetails: {
        otherItems: [
          {
            description: "Bit",
            date: receipt.paymentDate,
            sum: receipt.amount,
          },
        ],
      },
      docDate: receipt.paymentDate,
      isDraft: false,
    };

    const createResult = await smartBeeRequest(
      `${apiBase}/Documents/create`,
      documentRequest,
      token
    );
    const outcome = smartBeeCreationOutcome(createResult, receipt.requestId);
    const updatedRecord = {
      ...processingRecord,
      ...outcome,
      resultCodeId: createResult.resultCodeId ?? null,
      updatedAt: new Date().toISOString(),
    };
    await saveBitReceiptRecord(env, updatedRecord);
    return jsonResponse(bitReceiptPublicResponse(updatedRecord, false), 200, corsHeaders);
  } catch (error) {
    const failedRecord = {
      ...processingRecord,
      status: "failed",
      updatedAt: new Date().toISOString(),
    };
    await saveBitReceiptRecord(env, failedRecord);
    console.error("SmartBee Bit receipt creation failed", receipt.requestId);
    return jsonResponse(
      {
        ok: false,
        requestId: receipt.requestId,
        status: "failed",
        error: "SmartBee receipt creation failed",
        diagnostic: safeSmartBeeDiagnostic(error),
      },
      502,
      corsHeaders
    );
  }
}

async function handleSmartBeeBitReceiptStatusLive(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "GET, OPTIONS" }
    );
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  if (!isAuthorizedBitReceiptRequest(request, env)) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }

  const requestId = cleanText(new URL(request.url).searchParams.get("requestId"), 80);
  if (!BIT_REQUEST_ID_PATTERN.test(requestId)) {
    return jsonResponse({ ok: false, error: "Invalid requestId" }, 400, corsHeaders);
  }

  const record = await kvGetJSON(env, bitReceiptRequestKey(requestId));
  if (!record) {
    return jsonResponse({ ok: false, error: "Receipt request not found" }, 404, corsHeaders);
  }

  if (record.status !== "processing" || !record.apiMessageId) {
    return jsonResponse(bitReceiptPublicResponse(record, false), 200, corsHeaders);
  }

  try {
    const apiBase = smartBeeLiveApiBase(env);
    const token = await smartBeeAuthenticateLive(apiBase, env);
    const statusResult = await smartBeeRequest(
      `${apiBase}/Documents/${encodeURIComponent(record.apiMessageId)}`,
      null,
      token,
      "GET"
    );
    const outcome = smartBeeCreationOutcome(statusResult, record.apiMessageId);
    const updatedRecord = {
      ...record,
      ...outcome,
      resultCodeId: statusResult.resultCodeId ?? null,
      updatedAt: new Date().toISOString(),
    };
    await saveBitReceiptRecord(env, updatedRecord);
    return jsonResponse(bitReceiptPublicResponse(updatedRecord, false), 200, corsHeaders);
  } catch (error) {
    console.error("SmartBee Bit receipt status check failed", requestId);
    return jsonResponse(
      {
        ok: false,
        requestId,
        status: record.status,
        error: "SmartBee receipt status check failed",
        diagnostic: safeSmartBeeDiagnostic(error),
      },
      502,
      corsHeaders
    );
  }
}

function validateBitReceiptInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawFields = {
    requestId: source.requestId,
    customerName: source.customerName,
    phone: source.phone,
    email: source.email,
    amount: source.amount,
    paymentDate: source.paymentDate,
    description: source.description,
    bitReference: source.bitReference,
  };
  const missing = Object.entries(rawFields)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === "")
    .map(([name]) => name);
  if (missing.length) {
    return { ok: false, error: "Missing required fields", fields: missing };
  }

  const requestId = cleanText(source.requestId, 80);
  const customerName = cleanText(source.customerName, 100);
  const phone = cleanText(source.phone, 20);
  const email = cleanText(source.email, 160);
  const description = cleanText(source.description, 500);
  const bitReference = cleanText(source.bitReference, 100);
  const amount = Number(source.amount);
  const parsedPaymentDate = new Date(source.paymentDate);
  const invalid = [];

  if (!BIT_REQUEST_ID_PATTERN.test(requestId)) invalid.push("requestId");
  if (customerName.length < 2) invalid.push("customerName");
  if (!/^0\d{8,9}$/.test(phone)) invalid.push("phone");
  if (!EMAIL_PATTERN.test(email)) invalid.push("email");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) invalid.push("amount");
  if (Number.isNaN(parsedPaymentDate.getTime())) invalid.push("paymentDate");
  if (!description) invalid.push("description");
  if (!bitReference) invalid.push("bitReference");

  if (invalid.length) {
    return { ok: false, error: "Invalid fields", fields: invalid };
  }

  return {
    ok: true,
    value: {
      requestId,
      customerName,
      phone,
      email,
      amount,
      paymentDate: parsedPaymentDate.toISOString(),
      description,
      bitReference,
    },
  };
}

function isAuthorizedBitReceiptRequest(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return Boolean(
    env.MAKE_BIT_RECEIPTS_SECRET &&
      match &&
      match[1] === env.MAKE_BIT_RECEIPTS_SECRET
  );
}

function smartBeeLiveApiBase(env) {
  return (env.SMARTBEE_API_BASE || "https://smartbee.co.il/api/v1").replace(/\/+$/, "");
}

async function smartBeeAuthenticateLive(apiBase, env) {
  const authentication = await smartBeeRequest(`${apiBase}/Login/authenticate`, {
    clientId: env.SMARTBEE_CLIENT_ID,
    password: env.SMARTBEE_PASSWORD,
  });
  if (!authentication.token) {
    throw new Error("SmartBee authentication did not return a token");
  }
  return authentication.token;
}

function bitReceiptRequestKey(requestId) {
  return `smartbee-bit:request:${requestId}`;
}

function bitReceiptReferenceKey(reference) {
  return `smartbee-bit:reference:${String(reference).trim().toLowerCase()}`;
}

async function saveBitReceiptRecord(env, record) {
  await kvPutJSONPermanent(env, bitReceiptRequestKey(record.requestId), record);
  await kvPutJSONPermanent(env, bitReceiptReferenceKey(record.bitReference), {
    requestId: record.requestId,
    status: record.status,
    updatedAt: record.updatedAt,
  });
}

function smartBeeCreationOutcome(result, fallbackMessageId) {
  const validationFields = Object.keys(result?.validationErrors || {});
  if (validationFields.length) {
    const error = new Error("SmartBee rejected the receipt request");
    error.resultCodeId = result?.resultCodeId ?? null;
    error.validationFields = validationFields;
    throw error;
  }

  if (result?.resultCodeId === 102 && result.result && typeof result.result === "object") {
    return {
      status: "issued",
      apiMessageId: fallbackMessageId,
      documentId: cleanText(result.result.documentId, 200),
      linkToOriginal: cleanText(result.result.linkToOriginal, 1000),
      linkToCopy: cleanText(result.result.linkToCopy, 1000),
    };
  }

  if (result?.resultCodeId === 101 && typeof result.result === "string" && result.result) {
    return {
      status: "processing",
      apiMessageId: cleanText(result.result, 200),
    };
  }

  // A retry with the same providerMsgId can be reported as duplicated. The
  // stable requestId remains safe to query through the status endpoint.
  if (result?.resultCodeId === 95) {
    return { status: "processing", apiMessageId: fallbackMessageId };
  }

  const error = new Error("SmartBee did not create the receipt");
  error.resultCodeId = result?.resultCodeId ?? null;
  throw error;
}

function bitReceiptPublicResponse(record, idempotent) {
  return {
    ok: true,
    requestId: record.requestId,
    status: record.status,
    idempotent,
    resultCodeId: record.resultCodeId ?? null,
    apiMessageId: record.apiMessageId || null,
    documentId: record.documentId || null,
    linkToOriginal: record.linkToOriginal || null,
    linkToCopy: record.linkToCopy || null,
  };
}

function bitReceiptAdminResponse(record) {
  return {
    requestId: record.requestId,
    status: record.status,
    customerName: record.customerName,
    phone: record.phone,
    email: record.email,
    amount: record.amount,
    paymentDate: record.paymentDate,
    description: record.description,
    bitReference: record.bitReference,
    documentId: record.documentId || null,
    linkToOriginal: record.linkToOriginal || null,
    linkToCopy: record.linkToCopy || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Called by Make (the new, still-inactive "Disegni – Bit Receipt Pending"
// scenario) the moment a Bit payment notification comes in - before Gal has
// looked at it. Only stores the record as "pending" for review; never
// touches SmartBee. Reuses the exact same validation/storage helpers as the
// live receipt endpoint above so a request that's later approved flows
// through the identical requestId/bitReference record, just with its status
// naturally progressing pending -> processing -> issued/failed.
async function handleBitReceiptIntake(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }

  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!env.BIT_RECEIPT_INTAKE_SECRET || !match || match[1] !== env.BIT_RECEIPT_INTAKE_SECRET) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders || noStoreHeaders());
  }

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const validated = validateBitReceiptInput(input);
  if (!validated.ok) {
    return jsonResponse({ ok: false, error: validated.error, fields: validated.fields || [] }, 400, corsHeaders);
  }

  const receipt = validated.value;
  const requestKey = bitReceiptRequestKey(receipt.requestId);
  const existing = await kvGetJSON(env, requestKey);
  if (existing) {
    // Same requestId sent twice (Make retry) - no-op, return what's there.
    return jsonResponse({ ok: true, requestId: existing.requestId, status: existing.status, idempotent: true }, 200, corsHeaders);
  }

  const referenceKey = bitReceiptReferenceKey(receipt.bitReference);
  const existingReference = await kvGetJSON(env, referenceKey);
  if (existingReference && existingReference.requestId !== receipt.requestId) {
    return jsonResponse(
      { ok: false, error: "Bit reference already belongs to another request", code: "duplicate_bit_reference" },
      409,
      corsHeaders
    );
  }

  const now = new Date().toISOString();
  const pendingRecord = {
    ...receipt,
    status: "pending",
    apiMessageId: "",
    documentId: "",
    linkToOriginal: "",
    linkToCopy: "",
    createdAt: now,
    updatedAt: now,
  };
  await saveBitReceiptRecord(env, pendingRecord);

  return jsonResponse({ ok: true, requestId: receipt.requestId, status: "pending" }, 200, corsHeaders);
}

// Public counterpart to handleBitReceiptIntake, for the on-site Bit payment
// form. The intake route needs a bearer secret that can't live in browser
// JS, which is the only reason submissions used to detour through Make -
// this removes that hop (and frees a scenario slot on the free plan).
// Everything Make did beyond forwarding (dedup, validation) already happens
// here, so the stored record is identical either way.
async function handleBitReceiptPublicSubmit(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }

  if (await isRateLimited(env, `bit-submit:${clientIp(request)}`, BIT_SUBMIT_RATE_LIMIT_MAX)) {
    return jsonResponse(
      { ok: false, error: "Too many requests, please try again shortly" },
      429,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  // The form has no requestId to give - Make used to mint one, so we do it
  // here instead, keeping the same BIT-<timestamp> shape already in KV.
  const validated = validateBitReceiptInput({
    ...input,
    requestId: `BIT-${Date.now()}${Math.floor(Math.random() * 1000)}`,
  });
  if (!validated.ok) {
    return jsonResponse({ ok: false, error: validated.error, fields: validated.fields || [] }, 400, corsHeaders);
  }

  const receipt = validated.value;
  const referenceKey = bitReceiptReferenceKey(receipt.bitReference);
  const existingReference = await kvGetJSON(env, referenceKey);
  if (existingReference) {
    return jsonResponse(
      { ok: false, error: "Bit reference already submitted", code: "duplicate_bit_reference" },
      409,
      corsHeaders
    );
  }

  const now = new Date().toISOString();
  await saveBitReceiptRecord(env, {
    ...receipt,
    status: "pending",
    apiMessageId: "",
    documentId: "",
    linkToOriginal: "",
    linkToCopy: "",
    createdAt: now,
    updatedAt: now,
  });

  return jsonResponse({ ok: true, requestId: receipt.requestId, status: "pending" }, 200, corsHeaders);
}

// Reads a Bit transfer-share screenshot with Gemini and returns a best-effort
// field guess for the public form to prefill. Purely a convenience layer in
// front of the same form the customer would otherwise type into by hand -
// nothing here touches KV or SmartBee; the actual save still happens only
// when the (still human-editable) form is submitted to /bit-receipts/submit.
const BIT_EXTRACT_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(String(dataUrl || ""));
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function handleBitReceiptExtract(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ ok: false, error: "Screenshot reading is not configured" }, 503, corsHeaders);
  }

  if (await isRateLimited(env, `bit-extract:${clientIp(request)}`, BIT_EXTRACT_RATE_LIMIT_MAX)) {
    return jsonResponse(
      { ok: false, error: "Too many requests, please try again shortly" },
      429,
      corsHeaders
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const parsed = parseDataUrl(input && input.image);
  if (!parsed) {
    return jsonResponse({ ok: false, error: "Missing or invalid image" }, 400, corsHeaders);
  }
  if (!BIT_EXTRACT_ALLOWED_MIME_TYPES.includes(parsed.mimeType)) {
    return jsonResponse({ ok: false, error: "Unsupported image type" }, 400, corsHeaders);
  }
  // base64 is ~4/3 the size of the decoded bytes.
  if (parsed.base64.length > (BIT_EXTRACT_MAX_IMAGE_BYTES * 4) / 3) {
    return jsonResponse({ ok: false, error: "Image is too large" }, 400, corsHeaders);
  }

  let geminiResponse;
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: 'אתה מחלץ נתונים מצילום מסך של שיתוף העברת Bit. החזר אך ורק JSON תקני (ללא טקסט נוסף) עם השדות: amount (מספר בלבד, ללא סימן מטבע), paymentDate (בפורמט YYYY-MM-DD), description (הטקסט המלא של ההערה/התיאור שהלקוח כתב בהעברה, אם קיים - אחרת null), bitReference. אם שדה לא ברור מהתמונה - השתמש ב-null עבורו. אל תחזיר שדות customerName, phone או email - הם לעולם לא מופיעים בצילום מסך של Bit (השם שמופיע בתמונה הוא בדרך כלל שם בעל העסק/הנמען, לא הלקוח ששילם), ומזוהים בנפרד מתוך שדה description. אם התמונה כלל לא נראית כמו שיתוף העברת Bit, החזר את כל השדות כ-null.',
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: parsed.mimeType, data: parsed.base64 } },
                { text: "חלץ מהתמונה הזו את פרטי ההעברה." },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );
  } catch (error) {
    console.error("Gemini request failed", error.message);
    return jsonResponse({ ok: false, error: "Screenshot reading failed" }, 502, corsHeaders);
  }

  if (!geminiResponse.ok) {
    console.error("Gemini API error", geminiResponse.status, await geminiResponse.text().catch(() => ""));
    return jsonResponse({ ok: false, error: "Screenshot reading failed" }, 502, corsHeaders);
  }

  const geminiResult = await geminiResponse.json().catch(() => null);
  const candidate = geminiResult?.candidates?.[0];
  const rawText = candidate?.content?.parts?.find((part) => typeof part.text === "string")?.text || "";

  if (!rawText) {
    console.error(
      "Gemini returned no text part",
      JSON.stringify({
        finishReason: candidate?.finishReason,
        promptFeedback: geminiResult?.promptFeedback,
        partsTypes: candidate?.content?.parts?.map((part) => Object.keys(part)),
      })
    );
  }

  let parsedFields;
  try {
    const jsonMatch = /\{[\s\S]*\}/.exec(rawText);
    parsedFields = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch (error) {
    console.error("Failed to parse Gemini JSON response", error.message, "rawText:", rawText.slice(0, 500));
    return jsonResponse({ ok: true, extracted: {}, confidence: "none" }, 200, corsHeaders);
  }

  const fieldNames = ["amount", "paymentDate", "description", "bitReference"];
  const extracted = {};
  let filledCount = 0;
  for (const field of fieldNames) {
    const value = parsedFields && parsedFields[field];
    if (value === null || value === undefined || String(value).trim() === "") continue;
    extracted[field] = value;
    filledCount += 1;
  }

  const confidence = filledCount === 0 ? "none" : filledCount === fieldNames.length ? "full" : "partial";

  if (confidence === "none") {
    console.error("Gemini returned all-null fields, parsedFields:", JSON.stringify(parsedFields).slice(0, 500));
  }

  const matchedContact = extracted.description
    ? await findContactByDescriptionKeyword(env, extracted.description)
    : null;

  return jsonResponse({ ok: true, extracted, confidence, matchedContact }, 200, corsHeaders);
}

// Server-side only - the public form never receives the full contact list,
// just the single matched record (or null). Matching is a plain substring
// check against the keyword the customer wrote in the Bit note themselves,
// which is a far more reliable signal than any name visible in the image.
async function findContactByDescriptionKeyword(env, descriptionText) {
  if (!env.ORDERS_KV) return null;
  const haystack = String(descriptionText).toLowerCase();

  const listing = await env.ORDERS_KV.list({ prefix: "contact:" });
  for (const key of listing.keys) {
    const contact = await kvGetJSON(env, key.name);
    if (!contact || !contact.descriptionKeyword) continue;
    if (haystack.includes(contact.descriptionKeyword.toLowerCase())) {
      return {
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone || "",
        email: contact.email || "",
        serviceType: contact.serviceType || "",
      };
    }
  }
  return null;
}

async function handleAdminBitReceiptsList(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "GET, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: true, receipts: [] }, 200, corsHeaders);
  }

  const listing = await env.ORDERS_KV.list({ prefix: "smartbee-bit:request:" });
  const receipts = [];
  for (const key of listing.keys) {
    const record = await kvGetJSON(env, key.name);
    if (record && record.status === "pending") receipts.push(bitReceiptAdminResponse(record));
  }
  receipts.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  return jsonResponse({ ok: true, receipts }, 200, corsHeaders);
}

// The only step that actually touches SmartBee. Re-validates whatever Gal
// corrected in the admin page, then hands off to the exact same
// handleSmartBeeCreateBitReceiptLive() the Make-facing endpoint uses -
// no duplicated SmartBee call logic - so a request that's approved goes
// through the identical pending -> processing -> issued/failed transition.
async function handleAdminBitReceiptApprove(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }
  if (!env.MAKE_BIT_RECEIPTS_SECRET) {
    return jsonResponse({ ok: false, error: "Bit receipt creation is not configured" }, 503, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const requestId = cleanText(input.requestId, 80);
  if (!BIT_REQUEST_ID_PATTERN.test(requestId)) {
    return jsonResponse({ ok: false, error: "Invalid requestId" }, 400, corsHeaders);
  }

  const record = await kvGetJSON(env, bitReceiptRequestKey(requestId));
  if (!record) {
    return jsonResponse({ ok: false, error: "Receipt request not found" }, 404, corsHeaders);
  }
  if (record.status !== "pending") {
    return jsonResponse(
      { ok: false, error: `Request status is "${record.status}", not "pending" - already resolved` },
      400,
      corsHeaders
    );
  }

  // Gal's corrected fields, falling back to what came in from Make.
  const correctedFields = {
    requestId,
    customerName: input.customerName !== undefined ? input.customerName : record.customerName,
    phone: input.phone !== undefined ? input.phone : record.phone,
    email: input.email !== undefined ? input.email : record.email,
    amount: input.amount !== undefined ? input.amount : record.amount,
    paymentDate: input.paymentDate !== undefined ? input.paymentDate : record.paymentDate,
    description: input.description !== undefined ? input.description : record.description,
    bitReference: input.bitReference !== undefined ? input.bitReference : record.bitReference,
  };

  const internalRequest = new Request("https://internal.worker/smartbee/create-bit-receipt-live", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: corsHeaders["Access-Control-Allow-Origin"],
      Authorization: `Bearer ${env.MAKE_BIT_RECEIPTS_SECRET}`,
    },
    body: JSON.stringify(correctedFields),
  });

  const liveResponse = await handleSmartBeeCreateBitReceiptLive(internalRequest, env);
  const liveBody = await liveResponse.json();

  return jsonResponse(liveBody, liveResponse.status, corsHeaders);
}

async function handleAdminBitReceiptReject(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const requestId = cleanText(input.requestId, 80);
  if (!BIT_REQUEST_ID_PATTERN.test(requestId)) {
    return jsonResponse({ ok: false, error: "Invalid requestId" }, 400, corsHeaders);
  }

  const record = await kvGetJSON(env, bitReceiptRequestKey(requestId));
  if (!record) {
    return jsonResponse({ ok: false, error: "Receipt request not found" }, 404, corsHeaders);
  }
  if (record.status !== "pending") {
    return jsonResponse(
      { ok: false, error: `Request status is "${record.status}", not "pending" - already resolved` },
      400,
      corsHeaders
    );
  }

  await saveBitReceiptRecord(env, { ...record, status: "rejected", updatedAt: new Date().toISOString() });

  return jsonResponse({ ok: true, requestId, status: "rejected" }, 200, corsHeaders);
}

// Read-only status check: never creates a document (uses the GET status
// endpoint, not Documents/create) and never invokes approve. Reuses the
// exact same handleSmartBeeBitReceiptStatusLive() the Make-facing status
// endpoint uses, called internally so MAKE_BIT_RECEIPTS_SECRET never
// reaches the browser.
async function handleAdminBitReceiptCheckStatus(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Receipt storage is not configured" }, 503, corsHeaders);
  }
  if (!env.MAKE_BIT_RECEIPTS_SECRET) {
    return jsonResponse({ ok: false, error: "Bit receipt status check is not configured" }, 503, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const requestId = cleanText(input.requestId, 80);
  if (!BIT_REQUEST_ID_PATTERN.test(requestId)) {
    return jsonResponse({ ok: false, error: "Invalid requestId" }, 400, corsHeaders);
  }

  const statusUrl = new URL("https://internal.worker/smartbee/receipt-status-live");
  statusUrl.searchParams.set("requestId", requestId);
  const internalRequest = new Request(statusUrl, {
    method: "GET",
    headers: {
      Origin: corsHeaders["Access-Control-Allow-Origin"],
      Authorization: `Bearer ${env.MAKE_BIT_RECEIPTS_SECRET}`,
    },
  });

  const statusResponse = await handleSmartBeeBitReceiptStatusLive(internalRequest, env);
  const statusBody = await statusResponse.json();

  return jsonResponse(statusBody, statusResponse.status, corsHeaders);
}

async function handleSmartBeeReceiptStatus(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders,
      { Allow: "GET, OPTIONS" }
    );
  }

  const apiMessageId = new URL(request.url).searchParams.get("id");
  const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");
  if (!apiMessageId && wantsHtml) {
    return smartBeeReceiptStatusPage(corsHeaders);
  }

  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }

  const accessKey = request.headers.get("X-Disegni-Test-Key");
  if (!env.SMARTBEE_TEST_ACCESS_KEY || accessKey !== env.SMARTBEE_TEST_ACCESS_KEY) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }

  if (!apiMessageId) {
    return jsonResponse({ ok: false, error: "Missing id" }, 400, corsHeaders);
  }

  try {
    const apiBase = (env.SMARTBEE_TEST_API_BASE || "https://test.smartbee.co.il/api/v1").replace(
      /\/+$/,
      ""
    );
    const token = await smartBeeAuthenticate(apiBase, env);
    const statusResult = await smartBeeRequest(
      `${apiBase}/Documents/${encodeURIComponent(apiMessageId)}`,
      null,
      token,
      "GET"
    );
    return jsonResponse({ ok: true, ...statusResult }, 200, corsHeaders);
  } catch (error) {
    console.error("SmartBee receipt status check failed", error);
    return jsonResponse(
      { ok: false, error: "SmartBee receipt status check failed", diagnostic: safeSmartBeeDiagnostic(error) },
      502,
      corsHeaders
    );
  }
}

function smartBeeCreateReceiptTestPage(corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>בדיקת הפקת קבלה - SmartBee</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; }
    body { margin: 0; background: #0f1028; color: #f7f5f1; }
    main { width: min(560px, calc(100% - 40px)); margin: 8vh auto; }
    h1 { font-size: 1.6rem; }
    p { color: #c8c5ce; line-height: 1.6; }
    label { display: block; margin: 20px 0 8px; }
    input, button {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      border-radius: 8px;
      font: inherit;
    }
    input { border: 1px solid #4e5067; background: #171832; color: #fff; padding: 10px 12px; }
    button { margin-top: 12px; border: 0; background: #d9a13f; color: #111226; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    output { display: block; margin-top: 20px; padding: 14px; border-radius: 8px; background: #171832; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .success { color: #8ee7af; }
    .error { color: #ff9a9a; }
    a { color: #8ee7af; }
  </style>
</head>
<body>
  <main>
    <h1>בדיקת הפקת קבלת טסט</h1>
    <p>יוצר חשבונית מס קבלה אמיתית בסביבת הטסט של SmartBee, עבור פריט בדיקה קבוע (Orin, פוסטר 5×7, לקוח בדיקה). זו כן יצירת מסמך אמיתית (בסביבת הטסט בלבד) - בשונה מבדיקת החיבור.</p>
    <form id="receipt-form">
      <label for="key">מפתח הבדיקה הפנימי</label>
      <input id="key" type="password" required autocomplete="off">
      <button type="submit">יצירת קבלת בדיקה</button>
    </form>
    <output id="result" hidden></output>
  </main>
  <script>
    const form = document.getElementById("receipt-form");
    const keyInput = document.getElementById("key");
    const button = form.querySelector("button");
    const result = document.getElementById("result");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      result.hidden = false;
      result.className = "";
      result.textContent = "יוצר קבלה...";

      try {
        const response = await fetch(location.pathname, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Disegni-Test-Key": keyInput.value },
          body: JSON.stringify({
            artworkSlug: "orin",
            items: [{ productType: "poster", sizeId: "5x7", quantity: 1 }],
            customer: {
              fullName: "בדיקה בדיקה",
              phone: "0500000000",
              email: "",
              address: "כתובת בדיקה"
            }
          }),
        });
        const body = await response.json();
        if (!response.ok || !body.ok) {
          throw new Error(body.error || "יצירת הקבלה נכשלה.");
        }
        result.className = "success";
        result.textContent = "בקשת היצירה נשלחה בהצלחה.\\nמזהה הודעה: " + body.apiMessageId + "\\nקוד תוצאה: " + body.resultCodeId + "\\n\\nהיצירה אסינכרונית - יש לבדוק את הסטטוס בנפרד עם המזהה הזה כדי לקבל את קישור המסמך.";
      } catch (error) {
        result.className = "error";
        result.textContent = error.message || "יצירת הקבלה נכשלה.";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...noStoreHeaders(),
      ...(corsHeaders || {}),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function smartBeeReceiptStatusPage(corsHeaders) {
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>סטטוס קבלת בדיקה - SmartBee</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; }
    body { margin: 0; background: #0f1028; color: #f7f5f1; }
    main { width: min(560px, calc(100% - 40px)); margin: 8vh auto; }
    h1 { font-size: 1.6rem; }
    p { color: #c8c5ce; line-height: 1.6; }
    label { display: block; margin: 20px 0 8px; }
    input, button {
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      border-radius: 8px;
      font: inherit;
    }
    input { border: 1px solid #4e5067; background: #171832; color: #fff; padding: 10px 12px; }
    button { margin-top: 12px; border: 0; background: #d9a13f; color: #111226; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    output { display: block; margin-top: 20px; padding: 14px; border-radius: 8px; background: #171832; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .success { color: #8ee7af; }
    .error { color: #ff9a9a; }
    a { color: #8ee7af; }
  </style>
</head>
<body>
  <main>
    <h1>בדיקת סטטוס קבלה</h1>
    <p>בודק את הסטטוס של מסמך שנוצר דרך בדיקת יצירת הקבלה, ומציג את קישור המסמך כשהוא מוכן.</p>
    <form id="status-form">
      <label for="key">מפתח הבדיקה הפנימי</label>
      <input id="key" type="password" required autocomplete="off">
      <label for="msgid">מזהה הודעה (apiMessageId)</label>
      <input id="msgid" type="text" required autocomplete="off">
      <button type="submit">בדיקת סטטוס</button>
    </form>
    <output id="result" hidden></output>
  </main>
  <script>
    const form = document.getElementById("status-form");
    const keyInput = document.getElementById("key");
    const msgIdInput = document.getElementById("msgid");
    const button = form.querySelector("button");
    const result = document.getElementById("result");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      result.hidden = false;
      result.className = "";
      result.textContent = "בודק סטטוס...";

      try {
        const response = await fetch(location.pathname + "?id=" + encodeURIComponent(msgIdInput.value), {
          method: "GET",
          headers: { "X-Disegni-Test-Key": keyInput.value },
        });
        const body = await response.json();
        if (!response.ok || !body.ok) {
          throw new Error(body.error || "בדיקת הסטטוס נכשלה.");
        }
        result.className = "success";
        result.textContent = JSON.stringify(body, null, 2);
      } catch (error) {
        result.className = "error";
        result.textContent = error.message || "בדיקת הסטטוס נכשלה.";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...noStoreHeaders(),
      ...(corsHeaders || {}),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function smartBeeRequest(url, body, bearerToken, method = "POST") {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const requestError = new Error(
        `SmartBee returned a non-JSON response (${response.status})`
      );
      requestError.httpStatus = response.status;
      throw requestError;
    }
  }

  if (!response.ok) {
    const requestError = new Error(`SmartBee request failed (${response.status})`);
    requestError.httpStatus = response.status;
    requestError.resultCodeId = Number.isInteger(data.resultCodeId)
      ? data.resultCodeId
      : null;
    requestError.validationFields = Object.keys(data.validationErrors || {});
    throw requestError;
  }

  return data;
}

const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_AVAILABILITY_URL = "https://disegni.studio/booking-availability.json";
const BOOKING_AVAILABILITY_CACHE_TTL_SECONDS = 5 * 60;
const BOOKING_RATE_LIMIT_MAX = 5;
const BIT_SUBMIT_RATE_LIMIT_MAX = 5;
const BIT_EXTRACT_RATE_LIMIT_MAX = 8;
const BIT_EXTRACT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Same approach as fetchPurchaseCatalog: the site's own build output is the
// source of truth for which slots exist, so changing availability in the CMS
// takes effect here without a Worker code change.
async function fetchBookingAvailability(env) {
  const cached = await kvGetJSON(env, "booking-availability");
  if (cached) return cached;

  try {
    const response = await fetch(BOOKING_AVAILABILITY_URL, { cf: { cacheTtl: 60 } });
    if (!response.ok) return null;
    const manifest = await response.json();
    if (!manifest || typeof manifest !== "object" || !manifest.workshops) return null;
    await kvPutJSON(env, "booking-availability", manifest, BOOKING_AVAILABILITY_CACHE_TTL_SECONDS);
    return manifest;
  } catch (error) {
    console.error("Failed to fetch booking availability", error.message);
    return null;
  }
}

// "18:00–20:00" -> 1080. Tolerates any separator (en-dash, hyphen) and is the
// single place slot times get interpreted, so a mangled/unknown format fails
// closed rather than silently reserving a nonexistent slot.
function slotStartMinutes(time) {
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(String(time || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function bookingSlotKey(date, time) {
  return `booking:slot:${date}:${time}`;
}

function bookingRecordKey(bookingId) {
  return `booking:record:${bookingId}`;
}

// Reserves a workshop slot immediately (no WhatsApp/manual-confirmation
// step) - the slot key is date+time only (not workshop-specific) so two
// workshops that happen to share the same weekly time window can never
// both be booked for the same date.
async function handleBookingCreate(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "POST, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: false, error: "Booking storage is not configured" }, 503, corsHeaders);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
  }

  const workshopSlug = cleanText(input.workshopSlug, 60);
  const date = cleanText(input.date, 10);
  const time = cleanText(input.time, 20);
  const customerName = cleanText(input.customerName, 100);
  const phone = cleanText(input.phone, 20);
  const email = cleanText(input.email, 200);
  const groupLabel = cleanText(input.groupLabel, 100);

  if (!workshopSlug || !BOOKING_DATE_PATTERN.test(date) || !time) {
    return jsonResponse({ ok: false, error: "Invalid booking details" }, 400, corsHeaders);
  }
  if (customerName.length < 2 || !/^0\d{8,9}$/.test(phone)) {
    return jsonResponse(
      { ok: false, error: "Valid customer name and Israeli phone are required" },
      400,
      corsHeaders
    );
  }

  if (await isRateLimited(env, `booking:${clientIp(request)}`, BOOKING_RATE_LIMIT_MAX)) {
    return jsonResponse(
      { ok: false, error: "Too many requests, please try again shortly" },
      429,
      corsHeaders
    );
  }

  // No same-day booking through the site - matches the note shown on
  // every booking page ("לא ניתן להזמין מהיום להיום דרך האתר").
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(date + "T00:00:00");
  if (!(bookingDate.getTime() > today.getTime())) {
    return jsonResponse(
      { ok: false, error: "Same-day booking is not available through the site" },
      400,
      corsHeaders
    );
  }

  // The calendar UI only offers legitimate slots, but the API is the actual
  // security boundary - without this a crafted request could reserve a slot
  // that doesn't exist (wrong weekday, invented time, after the cutoff).
  const availability = await fetchBookingAvailability(env);
  if (!availability) {
    return jsonResponse(
      { ok: false, error: "Booking availability is temporarily unavailable" },
      503,
      corsHeaders
    );
  }

  const workshop = availability.workshops[workshopSlug];
  if (!workshop || !Array.isArray(workshop.rules)) {
    return jsonResponse({ ok: false, error: "Unknown workshop" }, 400, corsHeaders);
  }

  const matchesRule = workshop.rules.some(
    (rule) => Number(rule.weekday) === bookingDate.getDay() && rule.time === time
  );
  if (!matchesRule) {
    return jsonResponse({ ok: false, error: "Slot is not available" }, 400, corsHeaders);
  }

  const startMinutes = slotStartMinutes(time);
  const maxStartMinutes = slotStartMinutes(availability.maxStartTime);
  if (startMinutes === null || maxStartMinutes === null || startMinutes > maxStartMinutes) {
    return jsonResponse({ ok: false, error: "Slot starts too late in the day" }, 400, corsHeaders);
  }

  const windowWeeks = Number(workshop.windowWeeks) || 8;
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowWeeks * 7);
  if (bookingDate.getTime() > windowEnd.getTime()) {
    return jsonResponse({ ok: false, error: "Slot is outside the booking window" }, 400, corsHeaders);
  }

  const slotKey = bookingSlotKey(date, time);
  const existing = await kvGetJSON(env, slotKey);
  if (existing) {
    return jsonResponse({ ok: false, error: "slot_taken" }, 409, corsHeaders);
  }

  const bookingId = `BK-${date.replace(/-/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    bookingId,
    workshopSlug,
    date,
    time,
    customerName,
    phone,
    email,
    groupLabel,
    createdAt: new Date().toISOString(),
  };

  await kvPutJSONPermanent(env, slotKey, record);
  await kvPutJSONPermanent(env, bookingRecordKey(bookingId), record);

  return jsonResponse({ ok: true, bookingId }, 200, corsHeaders);
}

// Public, read-only: lets the on-site calendar grey out slots that were
// already booked by someone else, without needing a rebuild/deploy.
async function handleBookingBlockedDates(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "GET, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: true, blocked: [] }, 200, corsHeaders);
  }

  const listing = await env.ORDERS_KV.list({ prefix: "booking:slot:" });
  const blocked = [];
  for (const key of listing.keys) {
    const record = await kvGetJSON(env, key.name);
    if (record && record.date && record.time) {
      blocked.push({ date: record.date, time: record.time });
    }
  }

  return jsonResponse({ ok: true, blocked }, 200, corsHeaders);
}

async function handleAdminBookingsList(request, env) {
  const corsHeaders = getCorsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders || noStoreHeaders(),
    });
  }
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, corsHeaders, { Allow: "GET, OPTIONS" });
  }
  if (!corsHeaders) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403);
  }
  const authError = requireAdminKey(request, env, corsHeaders);
  if (authError) return authError;

  if (!env.ORDERS_KV) {
    return jsonResponse({ ok: true, bookings: [] }, 200, corsHeaders);
  }

  const listing = await env.ORDERS_KV.list({ prefix: "booking:record:" });
  const bookings = [];
  for (const key of listing.keys) {
    const record = await kvGetJSON(env, key.name);
    if (record) bookings.push(record);
  }
  bookings.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return jsonResponse({ ok: true, bookings }, 200, corsHeaders);
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = (
    env.DISEGNI_ALLOWED_ORIGINS ||
    env.SMARTBEE_ALLOWED_ORIGINS ||
    "https://disegni.studio"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origin && origin !== requestOrigin && !allowedOrigins.includes(origin)) return null;

  return {
    ...noStoreHeaders(),
    "Access-Control-Allow-Origin": origin || allowedOrigins[0],
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Disegni-Test-Key, X-Grow-Confirm-Secret, X-SmartBee-Live-Key, X-Disegni-Admin-Key, X-Bit-Intake-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...noStoreHeaders(),
      ...(corsHeaders || {}),
      ...extraHeaders,
    },
  });
}

function htmlResponse(body) {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function renderMessage(status, content) {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  return `<!DOCTYPE html>
<html>
<body>
<script>
(function () {
  function receiveMessage(e) {
    window.opener.postMessage(${JSON.stringify(message)}, e.origin);
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body>
</html>`;
}
