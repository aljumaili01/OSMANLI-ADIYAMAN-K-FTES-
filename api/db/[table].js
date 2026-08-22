import crypto from "node:crypto";

const KEY_MAP = {
  products: "ckft_corporate_products", dealers: "ckft_corporate_dealers",
  applications: "ckft_corporate_applications", site_content: "ckft_corporate_site_content",
  admin_auth: "ckft_corporate_admin_auth", site_logo: "siteLogo",
  franchise_packages: "ckft_corporate_franchise_packages",
  page_titles: "ckft_corporate_page_titles", build_version: "ckft_corporate_build_version",
};

function reply(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(body);
}

async function db(path, options = {}) {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) { const e = new Error("Supabase ayarları eksik."); e.status = 503; throw e; }
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json; charset=utf-8", ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) { const e = new Error("Veritabanı isteği başarısız."); e.status = response.status; throw e; }
  return data;
}

const SESSION_COOKIE = "ckft_admin_session";

function sessionSignature(expiresAt) {
  return crypto.createHmac("sha256", String(process.env.DB_API_SECRET || "")).update(String(expiresAt)).digest("hex");
}

function hasValidSession(req) {
  const cookie = String(req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return false;
  const value = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
  const [expiresRaw, signature] = value.split(".");
  const expiresAt = Number(expiresRaw);
  if (!expiresAt || expiresAt < Date.now() || !signature) return false;
  const expected = sessionSignature(expiresAt);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function isAuthorizedWrite(req) {
  const provided = String(req.headers["x-db-api-key"] || "");
  const deploymentSecret = String(process.env.DB_API_SECRET || "");
  return Boolean((deploymentSecret && provided === deploymentSecret) || hasValidSession(req));
}

export default async function handler(req, res) {
  const table = String(req.query.table || "").toLowerCase();
  try {
    if (table === "session") {
      if (req.method === "DELETE") {
        res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
        return reply(res, 200, { ok: true });
      }
      if (req.method !== "POST") return reply(res, 405, { ok: false });
      const password = String(req.body?.password || "");
      const rows = await db(`ckft_store?store_key=eq.${encodeURIComponent(KEY_MAP.admin_auth)}&select=payload&limit=1`);
      const currentPassword = rows?.[0]?.payload?.password;
      if (!password || password !== currentPassword) return reply(res, 401, { ok: false, error: "Yönetici doğrulanamadı." });
      const expiresAt = Date.now() + (2 * 60 * 60 * 1000);
      const token = `${expiresAt}.${sessionSignature(expiresAt)}`;
      res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`);
      return reply(res, 200, { ok: true });
    }
    if (table === "health") { await db("ckft_store?select=store_key&limit=1"); return reply(res, 200, { ok: true }); }
    if (table === "sync" && req.method === "GET") {
      const rows = await db("ckft_store?select=store_key,payload");
      const data = {};
      for (const row of Array.isArray(rows) ? rows : []) data[row.store_key] = row.payload;
      return reply(res, 200, { ok: true, count: Object.keys(data).length, build_version: data.ckft_corporate_build_version || null, data });
    }
    const storageKey = KEY_MAP[table];
    if (!storageKey) return reply(res, 404, { ok: false, error: "Bilinmeyen tablo." });
    if (req.method === "GET") {
      const rows = await db(`ckft_store?store_key=eq.${encodeURIComponent(storageKey)}&select=store_key,payload&limit=1`);
      return rows?.length ? reply(res, 200, { ok: true, storage_key: storageKey, payload: rows[0].payload }) : reply(res, 404, { ok: false });
    }
    if (!(await isAuthorizedWrite(req))) return reply(res, 401, { ok: false, error: "Yetkisiz işlem." });
    if (req.method === "POST") {
      if (!req.body || !("payload" in req.body)) return reply(res, 400, { ok: false, error: "Payload eksik." });
      await db("ckft_store?on_conflict=store_key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ store_key: storageKey, payload: req.body.payload }]) });
      return reply(res, 200, { ok: true, storage_rows: 1 });
    }
    if (req.method === "DELETE") { await db(`ckft_store?store_key=eq.${encodeURIComponent(storageKey)}`, { method: "DELETE" }); return reply(res, 200, { ok: true }); }
    res.setHeader("Allow", "GET, POST, DELETE");
    return reply(res, 405, { ok: false });
  } catch (error) { return reply(res, error.status || 500, { ok: false, error: error.message || "Sunucu hatası." }); }
}
