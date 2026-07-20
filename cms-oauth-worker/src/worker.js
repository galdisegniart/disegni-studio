/**
 * Minimal OAuth provider for Decap CMS, backed by GitHub, running on Cloudflare Workers.
 * Implements the standard Decap/Netlify CMS "auth" + "callback" handshake:
 * https://decapcms.org/docs/backends-overview/#custom-backend
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
