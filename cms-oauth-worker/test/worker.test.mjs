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
};

function growRequest(overrides = {}) {
  return new Request("https://worker.example/payments/grow/create", {
    method: "POST",
    headers: {
      Origin: "https://disegni.studio",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      artworkSlug: "orin",
      items: [
        {
          productType: "poster",
          sizeId: "5x7",
          quantity: 1,
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

test("creates a server-priced Orin checkout request without exposing Make secrets", async () => {
  const originalFetch = globalThis.fetch;
  let makeCall;
  globalThis.fetch = async (url, options) => {
    makeCall = { url, options };
    return Response.json({ url: "https://sandbox.grow.link/test-payment" });
  };

  try {
    const response = await worker.fetch(growRequest(), {
      ...ENV,
      MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
      MAKE_CHECKOUT_API_KEY: "private-make-key",
    });
    const body = await response.json();
    const payload = JSON.parse(makeCall.options.body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.paymentUrl, "https://sandbox.grow.link/test-payment");
    assert.equal(payload.catalogNumber, "ORIN-POSTER-5X7");
    assert.equal(payload.unitPrice, 89);
    assert.equal(payload.shipping, 45);
    assert.equal(payload.total, 134);
    assert.deepEqual(payload.items, [
      {
        catalogNumber: "ORIN-POSTER-5X7",
        productName: "Orin – פוסטר 13×18 ס״מ",
        unitPrice: 89,
        quantity: 1,
        lineTotal: 89,
      },
    ]);
    assert.equal(makeCall.options.headers["x-make-apikey"], "private-make-key");
    assert.equal(JSON.stringify(body).includes("private-make-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects products outside the approved Orin variants", async () => {
  const response = await worker.fetch(
    growRequest({
      items: [{ productType: "poster", sizeId: "not-a-size", quantity: 1 }],
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
});

test("prices additional items from the same shipping category on the server", async () => {
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ url: "https://sandbox.grow.link/test-payment" });
  };

  try {
    const response = await worker.fetch(
      growRequest({
        items: [{ productType: "poster", sizeId: "20x30", quantity: 2 }],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.subtotal, 638);
    assert.equal(payload.shipping, 59);
    assert.equal(payload.total, 697);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("adds first-item shipping for each mixed product category", async () => {
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (url, options) => {
    payload = JSON.parse(options.body);
    return Response.json({ url: "https://sandbox.grow.link/test-payment" });
  };

  try {
    const response = await worker.fetch(
      growRequest({
        items: [
          { productType: "poster", sizeId: "5x7", quantity: 1 },
          { productType: "framed-print", sizeId: "8x10", quantity: 1 },
          { productType: "canvas", sizeId: "16x20", quantity: 1 },
        ],
      }),
      {
        ...ENV,
        MAKE_CHECKOUT_WEBHOOK_URL: "https://hook.example/orin",
        MAKE_CHECKOUT_API_KEY: "private-make-key",
      }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.subtotal, 867);
    assert.equal(payload.shipping, 483);
    assert.equal(payload.total, 1350);
    assert.equal(payload.unitPrice, 867);
    assert.equal(payload.quantity, 1);
  } finally {
    globalThis.fetch = originalFetch;
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
