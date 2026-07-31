import "dotenv/config";

import http from "node:http";

import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "../src/integrations/orangehrm/oauth";

import { saveToken } from "../src/integrations/orangehrm/token-store";

const BASE_URL = process.env.ORANGEHRM_BASE_URL;
const CLIENT_ID = process.env.ORANGEHRM_CLIENT_ID;
const CLIENT_SECRET = process.env.ORANGEHRM_CLIENT_SECRET;
const REDIRECT_URI = process.env.ORANGEHRM_REDIRECT_URI;

const PORT = Number(process.env.ORANGEHRM_AUTH_SERVER_PORT ?? 3001);

if (!BASE_URL) {
  throw new Error("Missing ORANGEHRM_BASE_URL");
}

if (!CLIENT_ID) {
  throw new Error("Missing ORANGEHRM_CLIENT_ID");
}

if (!CLIENT_SECRET) {
  throw new Error("Missing ORANGEHRM_CLIENT_SECRET");
}

if (!REDIRECT_URI) {
  throw new Error("Missing ORANGEHRM_REDIRECT_URI");
}

/**
 * PKCE
 */
const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);
const state = generateState();

/**
 * OrangeHRM authorization URL.
 */
const authorizationParams = new URLSearchParams({
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  code_challenge_method: "S256",
  code_challenge: codeChallenge,
  state,
});

const authorizationUrl =
  `${BASE_URL}/web/index.php/oauth2/authorize?` + authorizationParams.toString();

console.log("\n======================================");
console.log(" OrangeHRM OAuth Authorization");
console.log("======================================\n");

console.log("Open this URL in your browser:\n");
console.log(authorizationUrl);

console.log("\nWaiting for OAuth callback...\n");

/**
 * Exchange authorization code for tokens.
 */
async function exchangeCode(code: string): Promise<void> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID ?? "",
    client_secret: CLIENT_SECRET ?? "",
    code,
    redirect_uri: REDIRECT_URI ?? "",
    code_verifier: codeVerifier,
  });

  console.log("🔐 Exchanging authorization code...");

  const response = await fetch(`${BASE_URL}/web/index.php/oauth2/token`, {
    method: "POST",

    headers: {
      "Content-Type": "application/x-www-form-urlencoded",

      Accept: "application/json",
    },

    body: params.toString(),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`OrangeHRM token exchange failed: ` + `${response.status} ${text}`);
  }

  let data: {
    token_type?: string;
    expires_in?: number;
    access_token?: string;
    refresh_token?: string;
  };

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON returned by OrangeHRM: ${text}`);
  }

  if (!data.access_token) {
    throw new Error(`OrangeHRM did not return an access_token: ${text}`);
  }

  if (!data.refresh_token) {
    throw new Error(`OrangeHRM did not return a refresh_token: ${text}`);
  }

  const expiresIn = data.expires_in ?? 1800;

  const expiresAt = Date.now() + expiresIn * 1000 - 60_000;

  await saveToken({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  });

  console.log("\n======================================");
  console.log(" OrangeHRM OAuth SUCCESS");
  console.log("======================================\n");

  console.log(`Access token expires in: ${expiresIn} seconds`);

  console.log("\n✅ Access token saved.");
  console.log("✅ Refresh token saved.");

  console.log("\nYou can now run:");

  console.log("\n  npx tsx scripts/test-orangehrm-connection.ts\n");
}

/**
 * OAuth callback server.
 *
 * Browser:
 *   localhost:8080/oauth/orangehrm/callback
 *
 * Vite proxy:
 *   localhost:8080
 *          ↓
 *   localhost:3001
 */
const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (requestUrl.pathname !== "/oauth/orangehrm/callback") {
      res.writeHead(404, {
        "Content-Type": "text/plain",
      });

      res.end("Not found");
      return;
    }

    const returnedState = requestUrl.searchParams.get("state");

    const code = requestUrl.searchParams.get("code");

    const error = requestUrl.searchParams.get("error");

    if (error) {
      res.writeHead(400, {
        "Content-Type": "text/html",
      });

      res.end(`
          <h1>OrangeHRM OAuth Failed</h1>
          <p>${escapeHtml(error)}</p>
        `);

      return;
    }

    if (!returnedState) {
      res.writeHead(400, {
        "Content-Type": "text/html",
      });

      res.end("<h1>Missing OAuth state</h1>");

      return;
    }

    if (returnedState !== state) {
      res.writeHead(400, {
        "Content-Type": "text/html",
      });

      res.end("<h1>Invalid OAuth state</h1>");

      return;
    }

    if (!code) {
      res.writeHead(400, {
        "Content-Type": "text/html",
      });

      res.end("<h1>Missing authorization code</h1>");

      return;
    }

    console.log("Authorization code received.");

    await exchangeCode(code);

    res.writeHead(200, {
      "Content-Type": "text/html",
    });

    res.end(`
        <!doctype html>
        <html>
          <head>
            <title>OrangeHRM Connected</title>
          </head>

          <body
            style="
              font-family: Arial;
              padding: 40px;
            "
          >
            <h1>✅ OrangeHRM Connected</h1>

            <p>
              OAuth authorization completed successfully.
            </p>

            <p>
              You can close this browser tab.
            </p>
          </body>
        </html>
      `);

    setTimeout(() => {
      server.close(() => {
        process.exit(0);
      });
    }, 500);
  } catch (error) {
    console.error("\nOAuth callback error:", error);

    if (!res.headersSent) {
      res.writeHead(500, {
        "Content-Type": "text/html",
      });

      res.end(`
          <h1>OrangeHRM OAuth Failed</h1>

          <pre>${escapeHtml(error instanceof Error ? error.message : String(error))}</pre>
        `);
    }
  }
});

server.listen(PORT, () => {
  console.log(`OAuth callback server listening on http://localhost:${PORT}`);
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
