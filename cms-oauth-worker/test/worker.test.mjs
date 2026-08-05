import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

const ENV = {
  SMARTBEE_TEST_API_BASE: "https://test.smartbee.example/api/v1",
  SMARTBEE_ALLOWED_ORIGINS: "https://disegni.studio",
  SMARTBEE_TEST_ACCESS_KEY: "test-access-key",
  SMARTBEE_TEST_CLIENT_ID: "test-client-id",
  SMARTBEE_TEST_PASSWORD: "test-password",
  SMARTBEE_PROVIDER_USER_TOKEN: "test-provider-token",
  SMARTBEE_API_BASE: "https://smartbee.example/api/v1",
  MAKE_BIT_RECEIPTS_SECRET: "test-bit-receipts-secret",
  SMARTBEE_CLIENT_ID: "live-client-id",
  SMARTBEE_PASSWORD: "live-password",
  SMARTBEE_LIVE_PROVIDER_USER_TOKEN: "live-provider-token",
  GROW_TEST_ENABLED: "true",
};

function createMockKV() {
  const store = new Map();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, options = {}) {
      const expiresAt = options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = "" } = {}) {
      const keys = [...store.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: "" };
    },
  };
}

const PURCHASE_CATALOG_URL = "https://disegni.studio/purchase-catalog.json";

const TEST_CATALOG = [
  {
    artworkSlug: "orin",
    productType: "poster",
    sizeId: "5x7",
    catalogNumber: "ORIN-POSTER-5X7",
    productName: "Orin – פוסטר 13×18 ס״מ",
    imageUrl: "https://disegni.studio/images/products/mockups/orin/orin-payment.jpg",
    unitPriceILS: 89,
    shippingFirstILS: 45,
    shippingAdditionalILS: 4,
  },
  {
    artworkSlug: "orin",
    productType: "poster",
    sizeId: "20x30",
    catalogNumber: "ORIN-POSTER-20X30",
    productName: "Orin – פוסטר 50×75 ס״מ",
    unitPriceILS: 319,
    shippingFirstILS: 55,
    shippingAdditionalILS: 4,
  },
  {
    artworkSlug: "orin",
    productType: "framed-print",
    sizeId: "8x10",
    catalogNumber: "ORIN-FRAMED-8X10-BLACK",
    productName: "Orin – פוסטר ממוסגר שחור 20×25 ס״מ",
    unitPriceILS: 329,
    shippingFirstILS: 59,
    shippingAdditionalILS: 29,
  },
  {
    artworkSlug: "orin",
    productType: "canvas",
    sizeId: "16x20",
    catalogNumber: "ORIN-CANVAS-16X20",
    productName: "Orin – קנבס מתוח 40×50 ס״מ",
    unitPriceILS: 449,
    shippingFirstILS: 379,
    shippingAdditionalILS: 379,
  },
];

// Installs a fetch mock that serves the (fake) purchase catalog for the
// catalog URL and delegates everything else (the Make webhook call) to
// makeHandler. Returns a restore() to put the real fetch back, and captures
// every non-catalog call for assertions.
function mockGrowFetch(makeHandler, catalog = TEST_CATALOG) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === PURCHASE_CATALOG_URL) {
      return Response.json(catalog);
    }
    calls.push({ url, options });
    return makeHandler ? makeHandler(url, options) : Response.json({ url: "https://sandbox.grow.link/test-payment" });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function growRequest(overrides = {}) {
  return new Request("https://worker.example/payments/grow/create", {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          artworkSlug: "orin",
          productType: "poster",
          sizeId: "5x7",
          quantity: 1,
          imageUrl: "https://disegni.studio/images/products/mockups/orin/orin-payment.jpg",
        },
      ],
      customer: {
        fullName: "לקוח בדיקה",
        phone: "0500000000",
        email: "test@example.com",
        address: "כתובת בדיקה",
      },
      ...overrides,
    }),
  });
}

function connectionRequest(accessKey = ENV.SMARTBEE_TEST_ACCESS_KEY) {
  return new Request("https://worker.example/smartbee/connection-test", {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "X-Disegni-Test-Key": accessKey,
    },
  });
}

function receiptRequest(overrides = {}, accessKey = ENV.SMARTBEE_TEST_ACCESS_KEY) {
  return new Request("https://worker.example/smartbee/create-receipt", {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "Content-Type": "application/json",
      "X-Disegni-Test-Key": accessKey,
    },
    body: JSON.stringify({
      artworkSlug: "orin",
      orderId: "GD-20260101-TEST01",
      items: [{ productType: "poster", sizeId: "5x7", quantity: 1 }],
      customer: {
        fullName: "לקוח בדיקה",
        phone: "0500000000",
        email: "test@example.com",
        address: "כתובת בדיקה",
      },
      ...overrides,
    }),
  });
}

function mockSmartBeeCreateFetch(createResponse) {
  return async (url) => {
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({
        token: "private-api-token",
        expirationUtcDate: "2026-08-01T10:00:00Z",
      });
    }
    if (url.endsWith("/Documents/create")) {
      return Response.json(
        createResponse || {
          resultCodeId: 101,
          result: "msg-123",
          validationErrors: {},
        }
      );
    }
    throw new Error(`Unexpected SmartBee URL in test: ${url}`);
  };
}

function bitReceiptRequest(overrides = {}, bearerToken = ENV.MAKE_BIT_RECEIPTS_SECRET) {
  const headers = {
    Origin: "https://disegni.studio",
    "Content-Type": "application/json",
  };
  if (bearerToken !== null) headers.Authorization = `Bearer ${bearerToken}`;
  return new Request("https://worker.example/smartbee/create-bit-receipt-live", {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId: "BIT-20260805-0001",
      customerName: "לקוחה בדיקה",
      phone: "0500000000",
      email: "customer@example.com",
      amount: 134,
      paymentDate: "2026-08-05T09:30:00+03:00",
      description: "יצירת אמנות",
      bitReference: "BIT-REF-10001",
      ...overrides,
    }),
  });
}

function bitReceiptStatusRequest(
  requestId = "BIT-20260805-0001",
  bearerToken = ENV.MAKE_BIT_RECEIPTS_SECRET
) {
  const headers = { Origin: "https://disegni.studio" };
  if (bearerToken !== null) headers.Authorization = `Bearer ${bearerToken}`;
  return new Request(
    `https://worker.example/smartbee/receipt-status-live?requestId=${encodeURIComponent(requestId)}`,
    { headers }
  );
}

function bitReceiptEnv(kv = createMockKV()) {
  return { ...ENV, ORDERS_KV: kv };
}

test("creates a server-priced Orin checkout request without exposing Make secrets", async () => {
  const mock = mockGrowFetch();

  try {
    const response = await worker.fetch(growRequest(), {
      ...ENV,
      MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
      MAKE_CHECKOUT_API_KEY: "private-make-key",
    });
    const body = await response.json();
    const makeCall = mock.calls[0];
    const payload = JSON.parse(makeCall.options.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.paymentUrl, "https://sandbox.grow.link/test-payment");
    assert.equal(payload.catalogNumber, "ORIN-POSTER-5X7");
    assert.equal(payload.unitPrice, 89);
    assert.equal(payload.shipping, 45);
    assert.equal(payload.total, 134);
    assert.equal(payload.imageUrl, "https://disegni.studio/images/products/mockups/orin/orin-payment.jpg");
    assert.deepEqual(payload.items, [
      {
        catalogNumber: "ORIN-POSTER-5X7",
        productName: "Orin – פוסטר 13×18 ס״מ",
        imageUrl: "https://disegni.studio/images/products/mockups/orin/orin-payment.jpg",
        unitPrice: 89,
        quantity: 1,
        lineTotal: 89,
      },
    ]);
    assert.equal(makeCall.options.headers["x-make-apikey"], "private-make-key");
    assert.equal(JSON.stringify(body).includes("private-make-key"), false);
  } finally {
    mock.restore();
  }
});

test("rejects products outside the approved catalog", async () => {
  const mock = mockGrowFetch();
  try {
    const response = await worker.fetch(
      growRequest({
        items: [{ artworkSlug: "orin", productType: "poster", sizeId: "not-a-size", quantity: 1 }],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "Product is not available for payment testing",
    });
  } finally {
    mock.restore();
  }
});

test("rejects a product that exists but belongs to a different artwork", async () => {
  const mock = mockGrowFetch();
  try {
    const response = await worker.fetch(
      growRequest({
        items: [{ artworkSlug: "some-other-artwork", productType: "poster", sizeId: "5x7", quantity: 1 }],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );

    assert.equal(response.status, 400);
  } finally {
    mock.restore();
  }
});

test("prices additional items from the same shipping category on the server", async () => {
  const mock = mockGrowFetch();

  try {
    const response = await worker.fetch(
      growRequest({
        items: [{ artworkSlug: "orin", productType: "poster", sizeId: "20x30", quantity: 2 }],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );
    const payload = JSON.parse(mock.calls[0].options.body);

    assert.equal(response.status, 200);
    assert.equal(payload.subtotal, 638);
    assert.equal(payload.shipping, 59);
    assert.equal(payload.total, 697);
  } finally {
    mock.restore();
  }
});

test("adds first-item shipping for each mixed product category", async () => {
  const mock = mockGrowFetch();

  try {
    const response = await worker.fetch(
      growRequest({
        items: [
          { artworkSlug: "orin", productType: "poster", sizeId: "5x7", quantity: 1 },
          { artworkSlug: "orin", productType: "framed-print", sizeId: "8x10", quantity: 1 },
          { artworkSlug: "orin", productType: "canvas", sizeId: "16x20", quantity: 1 },
        ],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );
    const payload = JSON.parse(mock.calls[0].options.body);

    assert.equal(response.status, 200);
    assert.equal(payload.subtotal, 867);
    assert.equal(payload.shipping, 483);
    assert.equal(payload.total, 1350);
    assert.equal(payload.unitPrice, 867);
    assert.equal(payload.quantity, 1);
  } finally {
    mock.restore();
  }
});

test("blocks Grow checkout when the server test flag is not enabled", async () => {
  const response = await worker.fetch(growRequest(), {
    ...ENV,
    GROW_TEST_ENABLED: undefined,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Payment testing is not currently enabled",
  });
});

test("reports whether Grow test checkout is enabled without requiring auth", async () => {
  const enabledResponse = await worker.fetch(
    new Request("https://worker.example/payments/grow/status", {
      headers: { Origin: "https://disegni.studio" },
    }),
    ENV
  );
  assert.deepEqual(await enabledResponse.json(), { ok: true, enabled: true });

  const disabledResponse = await worker.fetch(
    new Request("https://worker.example/payments/grow/status", {
      headers: { Origin: "https://disegni.studio" },
    }),
    { ...ENV, GROW_TEST_ENABLED: undefined }
  );
  assert.deepEqual(await disabledResponse.json(), { ok: true, enabled: false });
});

test("reusing the same idempotency key returns the original order instead of creating a second one", async () => {
  const mock = mockGrowFetch();

  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    ORDERS_KV: createMockKV(),
  };

  try {
    const first = await worker.fetch(growRequest({ idempotencyKey: "same-attempt-1" }), env);
    const firstBody = await first.json();

    const second = await worker.fetch(growRequest({ idempotencyKey: "same-attempt-1" }), env);
    const secondBody = await second.json();

    assert.equal(mock.calls.length, 1, "Make should only be called once for the same idempotency key");
    assert.equal(secondBody.orderId, firstBody.orderId);
    assert.equal(secondBody.paymentUrl, firstBody.paymentUrl);
  } finally {
    mock.restore();
  }
});

test("orders/status returns the stored status without leaking customer details", async () => {
  const mock = mockGrowFetch();

  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    ORDERS_KV: createMockKV(),
  };

  try {
    const createResponse = await worker.fetch(growRequest(), env);
    const { orderId } = await createResponse.json();

    const statusResponse = await worker.fetch(
      new Request(
        `https://worker.example/orders/status?orderId=${encodeURIComponent(orderId)}`,
        { headers: { Origin: "https://disegni.studio" } }
      ),
      env
    );
    const statusBody = await statusResponse.json();

    assert.equal(statusResponse.status, 200);
    assert.equal(statusBody.status, "pending");
    assert.equal(statusBody.orderId, orderId);
    assert.equal(JSON.stringify(statusBody).includes("לקוח בדיקה"), false);
  } finally {
    mock.restore();
  }
});

test("orders/status reports 404 for an unknown order", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/orders/status?orderId=GD-does-not-exist", {
      headers: { Origin: "https://disegni.studio" },
    }),
    { ...ENV, ORDERS_KV: createMockKV() }
  );

  assert.equal(response.status, 404);
});

test("grow/confirm requires the shared secret", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/payments/grow/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "GD-test", status: "paid" }),
    }),
    { ...ENV, GROW_CONFIRM_SECRET: "make-secret", ORDERS_KV: createMockKV() }
  );

  assert.equal(response.status, 401);
});

test("grow/confirm marks an order paid, and a duplicate notification is a no-op", async () => {
  const mock = mockGrowFetch();

  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    GROW_CONFIRM_SECRET: "make-secret",
    ORDERS_KV: createMockKV(),
  };

  try {
    const createResponse = await worker.fetch(growRequest(), env);
    const { orderId } = await createResponse.json();

    function confirmRequest(status) {
      return new Request("https://worker.example/payments/grow/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Grow-Confirm-Secret": "make-secret",
        },
        body: JSON.stringify({ orderId, status, providerRef: "grow-tx-1" }),
      });
    }

    const first = await worker.fetch(confirmRequest("paid"), env);
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.status, "paid");
    assert.equal(firstBody.alreadyApplied, undefined);

    const second = await worker.fetch(confirmRequest("paid"), env);
    const secondBody = await second.json();
    assert.equal(second.status, 200);
    assert.equal(secondBody.alreadyApplied, true);

    const statusResponse = await worker.fetch(
      new Request(
        `https://worker.example/orders/status?orderId=${encodeURIComponent(orderId)}`,
        { headers: { Origin: "https://disegni.studio" } }
      ),
      env
    );
    const statusBody = await statusResponse.json();
    assert.equal(statusBody.status, "paid");
  } finally {
    mock.restore();
  }
});

test("serves a no-index connection test page without exposing secrets", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/smartbee/connection-test"),
    ENV
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(html.includes("בדיקת חיבור SmartBee"), true);
  assert.equal(html.includes(ENV.SMARTBEE_TEST_ACCESS_KEY), false);
});

test("rejects a connection test without the private access key", async () => {
  const response = await worker.fetch(connectionRequest("wrong-key"), ENV);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized" });
});

test("allows the Worker test page to call its own endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({
        token: "private-api-token",
        expirationUtcDate: "2026-08-01T10:00:00Z",
      });
    }
    return Response.json({
      resultCodeId: 0,
      result: { totalItemCount: 0, page: 1, amountPerPage: 1, items: [] },
      validationErrors: {},
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://worker.example/smartbee/connection-test", {
        method: "POST",
        headers: {
          Origin: "https://worker.example",
          "X-Disegni-Test-Key": ENV.SMARTBEE_TEST_ACCESS_KEY,
        },
      }),
      ENV
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticates the API client and SmartBee user without exposing tokens", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({
        token: "private-api-token",
        expirationUtcDate: "2026-08-01T10:00:00Z",
      });
    }
    return Response.json({
      resultCodeId: 0,
      result: { totalItemCount: 0, page: 1, amountPerPage: 1, items: [] },
      validationErrors: {},
    });
  };

  try {
    const response = await worker.fetch(connectionRequest(), ENV);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      environment: "test",
      apiTokenExpiresAt: "2026-08-01T10:00:00Z",
      providerUserTokenVerified: true,
    });
    assert.equal(calls.length, 2);
    assert.equal(
      calls[1].options.headers.Authorization,
      "Bearer private-api-token"
    );
    assert.equal(JSON.stringify(body).includes("private-api-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not expose upstream errors or credentials", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => new Response("Invalid credentials", { status: 400 });
  console.error = () => {};

  try {
    const response = await worker.fetch(connectionRequest(), ENV);
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(body, {
      ok: false,
      error: "SmartBee connection test failed",
      stage: "client_authentication",
      diagnostic: {
        httpStatus: 400,
        resultCodeId: null,
        validationFields: [],
      },
    });
    assert.equal(JSON.stringify(body).includes(ENV.SMARTBEE_TEST_PASSWORD), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("serves a no-index receipt test page without exposing secrets", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/smartbee/create-receipt"),
    ENV
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(html.includes("בדיקת הפקת קבלת טסט"), true);
  assert.equal(html.includes(ENV.SMARTBEE_TEST_ACCESS_KEY), false);
});

test("rejects a receipt request without the private access key", async () => {
  const response = await worker.fetch(receiptRequest({}, "wrong-key"), ENV);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized" });
});

test("rejects receipt items outside the approved Orin variants", async () => {
  const response = await worker.fetch(
    receiptRequest({ items: [{ productType: "poster", sizeId: "not-a-size", quantity: 1 }] }),
    ENV
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Order is not available for receipt testing",
  });
});

test("rejects a receipt request with an invalid phone number", async () => {
  const response = await worker.fetch(
    receiptRequest({ customer: { fullName: "לקוח", phone: "+972501234567", address: "" } }),
    ENV
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Valid customer name and Israeli phone are required",
  });
});

test("creates a VAT-exempt Receipt document request without exposing tokens", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return mockSmartBeeCreateFetch()(url);
  };

  try {
    const response = await worker.fetch(receiptRequest(), ENV);
    const body = await response.json();
    const documentCall = calls.find((call) => call.url.endsWith("/Documents/create"));
    const documentRequest = JSON.parse(documentCall.options.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.orderId, "GD-20260101-TEST01");
    assert.equal(body.apiMessageId, "msg-123");
    assert.equal(body.resultCodeId, 101);
    assert.equal(documentRequest.docType, "Receipt");
    assert.equal(documentRequest.providerUserToken, ENV.SMARTBEE_PROVIDER_USER_TOKEN);
    assert.equal(documentRequest.providerMsgReferenceId, "GD-20260101-TEST01");
    assert.equal(documentRequest.customer.name, "לקוח בדיקה");
    assert.deepEqual(documentRequest.documentItems.paymentItems, [
      {
        catNum: "ORIN-POSTER-5X7",
        description: "Orin – פוסטר 13×18 ס״מ",
        quantity: 1,
        pricePerUnit: 89,
        vatOption: "Free",
      },
      {
        description: "משלוח",
        quantity: 1,
        pricePerUnit: 45,
        vatOption: "Free",
      },
    ]);
    assert.equal(documentRequest.receiptDetails.cashItems[0].sum, 134);
    assert.equal(documentCall.options.headers.Authorization, "Bearer private-api-token");
    assert.equal(JSON.stringify(body).includes("private-api-token"), false);
    assert.equal(JSON.stringify(body).includes(ENV.SMARTBEE_PROVIDER_USER_TOKEN), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("creates a single-line receipt from a total amount, for the Make automation", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return mockSmartBeeCreateFetch()(url);
  };

  try {
    const response = await worker.fetch(
      receiptRequest({ artworkSlug: undefined, items: undefined, totalAmount: 134 }),
      ENV
    );
    const body = await response.json();
    const documentCall = calls.find((call) => call.url.endsWith("/Documents/create"));
    const documentRequest = JSON.parse(documentCall.options.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(documentRequest.documentItems.paymentItems, [
      {
        description: "הזמנה מאתר גל דיסני",
        quantity: 1,
        pricePerUnit: 134,
        vatOption: "Free",
      },
    ]);
    assert.equal(documentRequest.receiptDetails.cashItems[0].sum, 134);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a non-positive total amount from the Make automation", async () => {
  const response = await worker.fetch(
    receiptRequest({ artworkSlug: undefined, items: undefined, totalAmount: 0 }),
    ENV
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "Invalid total amount" });
});

test("surfaces SmartBee validation errors from receipt creation without a fake success", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockSmartBeeCreateFetch({
    resultCodeId: 96,
    result: null,
    validationErrors: { "customer.address": "Address is required" },
  });

  try {
    const response = await worker.fetch(receiptRequest(), ENV);
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.deepEqual(body.validationFields, ["customer.address"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checks receipt status by proxying to SmartBee without exposing the access key", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-api-token" });
    }
    return Response.json({
      resultCodeId: 102,
      result: { documentId: "doc-1", linkToOriginal: "https://example.com/doc.pdf" },
    });
  };

  try {
    const response = await worker.fetch(
      new Request("https://worker.example/smartbee/receipt-status?id=msg-123", {
        headers: {
          Origin: "https://disegni.studio",
          "X-Disegni-Test-Key": ENV.SMARTBEE_TEST_ACCESS_KEY,
        },
      }),
      ENV
    );
    const body = await response.json();
    const statusCall = calls.find((call) => call.url.includes("/Documents/msg-123"));

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.linkToOriginal, "https://example.com/doc.pdf");
    assert.equal(statusCall.options.method, "GET");
    assert.equal(JSON.stringify(body).includes(ENV.SMARTBEE_TEST_ACCESS_KEY), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects missing Bit Bearer authorization before KV or SmartBee access", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const env = {
    ...ENV,
    ORDERS_KV: {
      async get() { throw new Error("KV must not be read"); },
      async put() { throw new Error("KV must not be written"); },
    },
  };
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("SmartBee must not be called");
  };

  try {
    const createResponse = await worker.fetch(bitReceiptRequest({}, null), env);
    const statusResponse = await worker.fetch(
      bitReceiptStatusRequest("BIT-20260805-0001", null),
      env
    );

    assert.equal(createResponse.status, 401);
    assert.equal(statusResponse.status, 401);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an incorrect Bit Bearer authorization before KV or SmartBee access", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const env = {
    ...ENV,
    ORDERS_KV: {
      async get() { throw new Error("KV must not be read"); },
      async put() { throw new Error("KV must not be written"); },
    },
  };
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("SmartBee must not be called");
  };

  try {
    const createResponse = await worker.fetch(bitReceiptRequest({}, "wrong-secret"), env);
    const statusResponse = await worker.fetch(
      bitReceiptStatusRequest("BIT-20260805-0001", "wrong-secret"),
      env
    );

    assert.equal(createResponse.status, 401);
    assert.equal(statusResponse.status, 401);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts the configured Bit Bearer authorization", async () => {
  const response = await worker.fetch(
    bitReceiptRequest({ email: undefined }),
    bitReceiptEnv()
  );

  assert.equal(response.status, 400);
});

test("keeps the public Grow test-status route unchanged", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/payments/grow/status", {
      headers: { Origin: "https://disegni.studio" },
    }),
    ENV
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.enabled, true);
});

test("creates a pending Bit receipt request with a stable id and no email delivery", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const env = bitReceiptEnv();
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-live-token" });
    }
    return Response.json({ resultCodeId: 101, result: "bit-msg-1", validationErrors: {} });
  };

  try {
    const response = await worker.fetch(bitReceiptRequest(), env);
    const body = await response.json();
    const documentCall = calls.find((call) => call.url.endsWith("/Documents/create"));
    const documentRequest = JSON.parse(documentCall.options.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, "processing");
    assert.equal(body.idempotent, false);
    assert.equal(documentRequest.providerMsgId, "BIT-20260805-0001");
    assert.equal(documentRequest.providerMsgReferenceId, "BIT-20260805-0001");
    assert.equal(documentRequest.comments, "אסמכתת Bit: BIT-REF-10001");
    assert.deepEqual(documentRequest.receiptDetails.otherItems, [
      {
        description: "Bit",
        date: "2026-08-05T06:30:00.000Z",
        sum: 134,
      },
    ]);
    assert.equal(documentRequest.receiptDetails.cashItems, undefined);
    assert.equal(documentRequest.creationMetadata.sendOriginalToCustomer, false);
    assert.equal(documentRequest.customer.email, "customer@example.com");
    assert.equal(JSON.stringify(body).includes("private-live-token"), false);
    assert.equal(JSON.stringify(body).includes(ENV.SMARTBEE_LIVE_PROVIDER_USER_TOKEN), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a Bit receipt request with a missing required field", async () => {
  const response = await worker.fetch(
    bitReceiptRequest({ email: undefined }),
    bitReceiptEnv()
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Missing required fields");
  assert.deepEqual(body.fields, ["email"]);
});

test("rejects a Bit receipt request with a non-positive amount", async () => {
  const response = await worker.fetch(bitReceiptRequest({ amount: 0 }), bitReceiptEnv());
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid fields");
  assert.deepEqual(body.fields, ["amount"]);
});

test("returns the stored processing result for a duplicate Bit requestId", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const env = bitReceiptEnv();
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-live-token" });
    }
    return Response.json({ resultCodeId: 101, result: "bit-msg-duplicate", validationErrors: {} });
  };

  try {
    const first = await worker.fetch(bitReceiptRequest(), env);
    const second = await worker.fetch(bitReceiptRequest(), env);
    const secondBody = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(secondBody.idempotent, true);
    assert.equal(secondBody.status, "processing");
    assert.equal(calls.filter((call) => call.url.endsWith("/Documents/create")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a Bit reference already assigned to another request", async () => {
  const originalFetch = globalThis.fetch;
  const env = bitReceiptEnv();
  globalThis.fetch = async (url) => {
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-live-token" });
    }
    return Response.json({ resultCodeId: 101, result: "bit-msg-reference", validationErrors: {} });
  };

  try {
    const first = await worker.fetch(bitReceiptRequest(), env);
    const second = await worker.fetch(
      bitReceiptRequest({ requestId: "BIT-20260805-0002" }),
      env
    );
    const secondBody = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 409);
    assert.equal(secondBody.code, "duplicate_bit_reference");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stores a failed state when SmartBee rejects a Bit receipt", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const kv = createMockKV();
  const env = bitReceiptEnv(kv);
  globalThis.fetch = async (url) => {
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-live-token" });
    }
    return Response.json(
      { resultCodeId: 96, result: null, validationErrors: { "receiptDetails.otherItems": "Invalid" } },
      { status: 200 }
    );
  };
  console.error = () => {};

  try {
    const response = await worker.fetch(bitReceiptRequest(), env);
    const body = await response.json();
    const stored = JSON.parse(await kv.get("smartbee-bit:request:BIT-20260805-0001"));

    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.status, "failed");
    assert.deepEqual(body.diagnostic.validationFields, ["receiptDetails.otherItems"]);
    assert.equal(stored.status, "failed");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("updates a pending Bit request with the SmartBee document id and PDF link", async () => {
  const originalFetch = globalThis.fetch;
  const env = bitReceiptEnv();
  globalThis.fetch = async (url) => {
    if (url.endsWith("/Login/authenticate")) {
      return Response.json({ token: "private-live-token" });
    }
    if (url.endsWith("/Documents/create")) {
      return Response.json({ resultCodeId: 101, result: "bit-msg-status", validationErrors: {} });
    }
    if (url.endsWith("/Documents/bit-msg-status")) {
      return Response.json({
        resultCodeId: 102,
        result: {
          documentId: "document-bit-1",
          linkToOriginal: "https://documents.example/bit-original.pdf",
          linkToCopy: "https://documents.example/bit-copy.pdf",
        },
        validationErrors: {},
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const creation = await worker.fetch(bitReceiptRequest(), env);
    const status = await worker.fetch(bitReceiptStatusRequest(), env);
    const body = await status.json();

    assert.equal(creation.status, 200);
    assert.equal(status.status, 200);
    assert.equal(body.status, "issued");
    assert.equal(body.documentId, "document-bit-1");
    assert.equal(body.linkToOriginal, "https://documents.example/bit-original.pdf");
    assert.equal(body.linkToCopy, "https://documents.example/bit-copy.pdf");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function adminCancelRequest(orderId, adminKey = "admin-secret") {
  return new Request("https://worker.example/admin/orders/cancel", {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "Content-Type": "application/json",
      "X-Disegni-Admin-Key": adminKey,
    },
    body: JSON.stringify({ orderId }),
  });
}

async function createPaidOrderForTest(env) {
  const mock = mockGrowFetch();
  try {
    const createResponse = await worker.fetch(growRequest(), env);
    const { orderId } = await createResponse.json();

    const confirmResponse = await worker.fetch(
      new Request("https://worker.example/payments/grow/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Grow-Confirm-Secret": env.GROW_CONFIRM_SECRET,
        },
        body: JSON.stringify({
          orderId,
          status: "paid",
          providerRef: "531811",
          transactionToken: "e997c445a0d35018064c1972ce902388",
        }),
      }),
      env
    );
    assert.equal(confirmResponse.status, 200);
    return orderId;
  } finally {
    mock.restore();
  }
}

test("admin cancel: requires the admin key", async () => {
  const response = await worker.fetch(
    adminCancelRequest("GD-test", "wrong-key"),
    { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() }
  );
  assert.equal(response.status, 401);
});

test("admin cancel: rejects an unknown order", async () => {
  const response = await worker.fetch(
    adminCancelRequest("GD-does-not-exist"),
    {
      ...ENV,
      DISEGNI_ADMIN_KEY: "admin-secret",
      ADMIN_CANCEL_ORDER_WEBHOOK_URL: "https://hook.example/cancel",
      ORDERS_KV: createMockKV(),
    }
  );
  assert.equal(response.status, 404);
});

test("admin cancel: rejects an order that isn't paid", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    DISEGNI_ADMIN_KEY: "admin-secret",
    ADMIN_CANCEL_ORDER_WEBHOOK_URL: "https://hook.example/cancel",
    ORDERS_KV: createMockKV(),
  };
  const mock = mockGrowFetch();
  let orderId;
  try {
    const createResponse = await worker.fetch(growRequest(), env);
    orderId = (await createResponse.json()).orderId;
  } finally {
    mock.restore();
  }

  const response = await worker.fetch(adminCancelRequest(orderId), env);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /not "paid"/);
});

test("admin cancel: starts a refund for a paid order without changing its status itself", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    GROW_CONFIRM_SECRET: "grow-confirm-secret",
    DISEGNI_ADMIN_KEY: "admin-secret",
    ADMIN_CANCEL_ORDER_WEBHOOK_URL: "https://hook.example/cancel",
    ORDERS_KV: createMockKV(),
  };

  const orderId = await createPaidOrderForTest(env);

  const originalFetch = globalThis.fetch;
  let cancelWebhookCall;
  globalThis.fetch = async (url, options) => {
    cancelWebhookCall = { url, options };
    return new Response(null, { status: 200 });
  };

  try {
    const response = await worker.fetch(adminCancelRequest(orderId), env);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    const sentPayload = JSON.parse(cancelWebhookCall.options.body);
    assert.equal(sentPayload.orderId, orderId);
    assert.equal(sentPayload.transactionId, "531811");
    assert.equal(sentPayload.transactionToken, "e997c445a0d35018064c1972ce902388");
    assert.equal(sentPayload.refundSum, 134);

    // Status is NOT flipped by this endpoint - only Make's confirmation of the
    // actual refund (via /payments/grow/confirm) does that.
    const statusResponse = await worker.fetch(
      new Request(`https://worker.example/orders/status?orderId=${encodeURIComponent(orderId)}`, {
        headers: { Origin: "https://disegni.studio" },
      }),
      env
    );
    const statusBody = await statusResponse.json();
    assert.equal(statusBody.status, "paid");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function adminCouponsRequest(path, body, adminKey = "admin-secret") {
  return new Request(`https://worker.example/admin/coupons/${path}`, {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "Content-Type": "application/json",
      "X-Disegni-Admin-Key": adminKey,
    },
    body: JSON.stringify(body),
  });
}

test("coupon admin: requires the admin key to create a coupon", async () => {
  const env = { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() };
  const response = await worker.fetch(
    adminCouponsRequest("create", { code: "SUMMER10", percentOff: 10 }, "wrong-key"),
    env
  );
  assert.equal(response.status, 401);
});

test("coupon admin: rejects an invalid percent-off value", async () => {
  const env = { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() };
  const response = await worker.fetch(
    adminCouponsRequest("create", { code: "SUMMER10", percentOff: 150 }),
    env
  );
  assert.equal(response.status, 400);
});

test("coupon admin: creates and lists a coupon", async () => {
  const env = { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() };
  const createResponse = await worker.fetch(
    adminCouponsRequest("create", { code: "summer10", percentOff: 10 }),
    env
  );
  assert.equal(createResponse.status, 200);
  const createBody = await createResponse.json();
  assert.equal(createBody.coupon.code, "SUMMER10");
  assert.equal(createBody.coupon.usesCount, 0);

  const listResponse = await worker.fetch(
    new Request("https://worker.example/admin/coupons/list", {
      headers: { Origin: "https://disegni.studio", "X-Disegni-Admin-Key": "admin-secret" },
    }),
    env
  );
  const listBody = await listResponse.json();
  assert.equal(listBody.coupons.length, 1);
  assert.equal(listBody.coupons[0].code, "SUMMER10");
});

test("coupon admin: deletes a coupon", async () => {
  const env = { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() };
  await worker.fetch(adminCouponsRequest("create", { code: "SUMMER10", percentOff: 10 }), env);
  const deleteResponse = await worker.fetch(adminCouponsRequest("delete", { code: "SUMMER10" }), env);
  assert.equal(deleteResponse.status, 200);

  const listResponse = await worker.fetch(
    new Request("https://worker.example/admin/coupons/list", {
      headers: { Origin: "https://disegni.studio", "X-Disegni-Admin-Key": "admin-secret" },
    }),
    env
  );
  const listBody = await listResponse.json();
  assert.equal(listBody.coupons.length, 0);
});

test("coupon check: reports an unknown code as invalid without exposing internals", async () => {
  const env = { ...ENV, DISEGNI_ADMIN_KEY: "admin-secret", ORDERS_KV: createMockKV() };
  const response = await worker.fetch(
    new Request("https://worker.example/payments/coupons/check", {
      method: "POST",
      headers: { Origin: "https://disegni.studio", "Content-Type": "application/json" },
      body: JSON.stringify({ code: "NOPE", phone: "0500000000", subtotal: 100 }),
    }),
    env
  );
  const body = await response.json();
  assert.equal(body.valid, false);
});

test("coupon checkout: applies a percent discount to the order total and the amount actually charged", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    DISEGNI_ADMIN_KEY: "admin-secret",
    ORDERS_KV: createMockKV(),
  };
  await worker.fetch(adminCouponsRequest("create", { code: "SUMMER10", percentOff: 10 }), env);

  const mock = mockGrowFetch();
  let orderId;
  try {
    const response = await worker.fetch(growRequest({ couponCode: "summer10" }), env);
    assert.equal(response.status, 200);
    const body = await response.json();
    orderId = body.orderId;

    // subtotal 89, 10% off = 8.9 -> rounds to 9; shipping 45 stays untouched.
    const makeCall = mock.calls[0];
    const sentBody = JSON.parse(makeCall.options.body);
    assert.equal(sentBody.couponCode, "SUMMER10");
    assert.equal(sentBody.discountILS, 9);
    assert.equal(sentBody.unitPrice, 80);
    assert.equal(sentBody.total, 89 - 9 + 45);
  } finally {
    mock.restore();
  }

  const statusResponse = await worker.fetch(
    new Request(`https://worker.example/orders/status?orderId=${encodeURIComponent(orderId)}`, {
      headers: { Origin: "https://disegni.studio" },
    }),
    env
  );
  const statusBody = await statusResponse.json();
  assert.equal(statusBody.total, 89 - 9 + 45);
});

test("coupon checkout: rejects an unknown coupon code instead of silently ignoring it", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    ORDERS_KV: createMockKV(),
  };
  const mock = mockGrowFetch();
  try {
    const response = await worker.fetch(growRequest({ couponCode: "NOPE" }), env);
    assert.equal(response.status, 400);
  } finally {
    mock.restore();
  }
});

test("coupon checkout: blocks reusing the same code twice with the same phone number after payment", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    GROW_CONFIRM_SECRET: "grow-confirm-secret",
    DISEGNI_ADMIN_KEY: "admin-secret",
    ORDERS_KV: createMockKV(),
  };
  await worker.fetch(adminCouponsRequest("create", { code: "SUMMER10", percentOff: 10 }), env);

  const mock = mockGrowFetch();
  let firstOrderId;
  try {
    const first = await worker.fetch(growRequest({ couponCode: "SUMMER10" }), env);
    firstOrderId = (await first.json()).orderId;
  } finally {
    mock.restore();
  }

  await worker.fetch(
    new Request("https://worker.example/payments/grow/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Grow-Confirm-Secret": env.GROW_CONFIRM_SECRET },
      body: JSON.stringify({ orderId: firstOrderId, status: "paid", providerRef: "531811" }),
    }),
    env
  );

  const mock2 = mockGrowFetch();
  try {
    const second = await worker.fetch(growRequest({ couponCode: "SUMMER10" }), env);
    assert.equal(second.status, 400);
    const body = await second.json();
    assert.match(body.error, /כבר נעשה שימוש/);
  } finally {
    mock2.restore();
  }

  const listResponse = await worker.fetch(
    new Request("https://worker.example/admin/coupons/list", {
      headers: { Origin: "https://disegni.studio", "X-Disegni-Admin-Key": "admin-secret" },
    }),
    env
  );
  const listBody = await listResponse.json();
  assert.equal(listBody.coupons[0].usesCount, 1);
});

test("admin cancel: rejects a second cancel attempt once already refunded", async () => {
  const env = {
    ...ENV,
    MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
    MAKE_CHECKOUT_API_KEY: "private-make-key",
    GROW_CONFIRM_SECRET: "grow-confirm-secret",
    DISEGNI_ADMIN_KEY: "admin-secret",
    ADMIN_CANCEL_ORDER_WEBHOOK_URL: "https://hook.example/cancel",
    ORDERS_KV: createMockKV(),
  };

  const orderId = await createPaidOrderForTest(env);

  // Simulate Make confirming the refund succeeded.
  await worker.fetch(
    new Request("https://worker.example/payments/grow/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Grow-Confirm-Secret": env.GROW_CONFIRM_SECRET,
      },
      body: JSON.stringify({ orderId, status: "refunded" }),
    }),
    env
  );

  const response = await worker.fetch(adminCancelRequest(orderId), env);
  assert.equal(response.status, 400);
});
