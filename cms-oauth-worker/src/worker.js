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

    if (url.pathname === "/smartbee/connection-test") {
      return handleSmartBeeConnectionTest(request, env);
    }

    if (url.pathname === "/smartbee/create-receipt") {
      return handleSmartBeeCreateReceipt(request, env);
    }

    if (url.pathname === "/smartbee/receipt-status") {
      return handleSmartBeeReceiptStatus(request, env);
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

  if (!env.MAKE_CHECKOUT_WEBHOOK_URL || !env.MAKE_CHECKOUT_API_KEY) {
    return jsonResponse(
      { ok: false, error: "Payment service is not configured" },
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

  const requestedItems = Array.isArray(input.items) ? input.items : [];
  if (input.artworkSlug !== "orin" || requestedItems.length < 1 || requestedItems.length > 11) {
    return jsonResponse(
      { ok: false, error: "Product is not available for payment testing" },
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
        { ok: false, error: "Product is not available for payment testing" },
        400,
        corsHeaders
      );
    }
    items.push({
      ...product,
      quantity,
      lineTotal: product.unitPrice * quantity,
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
  const total = subtotal + shipping;
  const orderId = `GD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const singleItem = items.length === 1 ? items[0] : null;
  const payload = {
    orderId,
    fullName,
    phone,
    email,
    address,
    catalogNumber: singleItem ? singleItem.catalogNumber : `ORIN-ORDER-${orderId}`,
    productName: singleItem
      ? singleItem.productName
      : `הזמנת Orin – ${items.reduce((sum, item) => sum + item.quantity, 0)} פריטים`,
    unitPrice: singleItem ? singleItem.unitPrice : subtotal,
    quantity: singleItem ? singleItem.quantity : 1,
    items: items.map((item) => ({
      catalogNumber: item.catalogNumber,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal,
    shipping,
    total,
    successUrl: "https://disegni.studio/thank-you/",
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
    console.error("Grow checkout webhook request failed", error);
    return jsonResponse(
      { ok: false, error: "Payment service is unavailable" },
      502,
      corsHeaders
    );
  }

  if (!makeResponse.ok) {
    console.error("Grow checkout webhook rejected the request", makeResponse.status);
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

  return jsonResponse({ ok: true, orderId, paymentUrl }, 200, corsHeaders);
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

// docType: "InvoiceReceipt" (חשבונית מס קבלה). vatOption fixed to "Free" because
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
  const shipping = calculateShipping(items);
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) + shipping;

  try {
    const apiBase = (env.SMARTBEE_TEST_API_BASE || "https://test.smartbee.co.il/api/v1").replace(
      /\/+$/,
      ""
    );
    const token = await smartBeeAuthenticate(apiBase, env);

    const paymentItems = items.map((item) => ({
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
      docType: "InvoiceReceipt",
      currency: { currencyType: "ILS" },
      documentItems: { paymentItems },
      receiptDetails: {
        otherItems: [
          {
            description: "תשלום בכרטיס אשראי",
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
    "Access-Control-Allow-Headers": "Content-Type, X-Disegni-Test-Key",
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
