import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const ROOT = join(process.cwd(), "dist");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";

/** Must match src/game/cosmetics.ts prices. */
const SKINS = {
  moss: { name: "Moss Kit", priceCents: 99 },
  glider: { name: "Dawn Glider", priceCents: 199 },
  sunset: { name: "Sunset Kite", priceCents: 299 },
  stormwing: { name: "Stormwing", priceCents: 399 },
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(raw),
  });
  res.end(raw);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${STRIPE_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || "Stripe request failed";
    throw new Error(message);
  }
  return data;
}

async function handleCheckout(req, res) {
  if (!STRIPE_KEY) {
    sendJson(res, 503, {
      error: "payments_not_configured",
      message: "Card checkout isn’t connected yet.",
    });
    return;
  }
  const body = await readBody(req);
  const skin = SKINS[body.skinId];
  if (!skin) {
    sendJson(res, 400, { error: "unknown_skin" });
    return;
  }
  const origin = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const session = await stripe("/checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(skin.priceCents),
    "line_items[0][price_data][product_data][name]": `Fold — ${skin.name}`,
    "metadata[skinId]": body.skinId,
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancel`,
  });
  sendJson(res, 200, { url: session.url });
}

async function handleConfirm(req, res) {
  if (!STRIPE_KEY) {
    sendJson(res, 503, { error: "payments_not_configured" });
    return;
  }
  const body = await readBody(req);
  const sessionId = String(body.sessionId || "");
  if (!sessionId.startsWith("cs_")) {
    sendJson(res, 400, { error: "bad_session" });
    return;
  }
  const session = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const skinId = session.metadata?.skinId;
  const skin = SKINS[skinId];
  if (!skin || session.payment_status !== "paid" || session.amount_total !== skin.priceCents) {
    sendJson(res, 402, { error: "not_paid" });
    return;
  }
  sendJson(res, 200, { skinId });
}

const PAGES = {
  "/privacy": "/privacy.html",
  "/eula": "/eula.html",
  "/support": "/support.html",
};

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  let path = PAGES[url.pathname] || normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (path === "/" || path === "\\") path = "/index.html";
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const data = await readFile(join(ROOT, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(data);
  }
}

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/checkout") {
      await handleCheckout(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/api/confirm") {
      await handleConfirm(req, res);
      return;
    }
    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }
    res.writeHead(405);
    res.end();
  } catch (err) {
    sendJson(res, 500, { error: "server", message: err instanceof Error ? err.message : "error" });
  }
}).listen(PORT, () => {
  console.log(`Fold listening on ${PORT}`);
});
