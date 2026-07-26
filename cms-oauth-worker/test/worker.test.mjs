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
      productType: "poster",
      sizeId: "5x7",
      quantity: 1,
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
    assert.equal(payload.shipping, 29);
    assert.equal(payload.total, 118);
    assert.equal(makeCall.options.headers["x-make-apikey"], "private-make-key");
    assert.equal(JSON.stringify(body).includes("private-make-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects products outside the single approved Orin test variant", async () => {
  const response = await worker.fetch(
    growRequest({ sizeId: "24x36" }),
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
