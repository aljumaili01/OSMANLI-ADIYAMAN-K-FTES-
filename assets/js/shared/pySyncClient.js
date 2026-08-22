/* ============================================================
 * pySyncClient.js — Python FastAPI PostgreSQL Sync Katmanı (İstemci)
 * ------------------------------------------------------------
 * MİMARİ (ÇİFT YAZMA / ÇİFT OKUMA):
 *   OKUMA  YOLU: initializeData() /api/db/sync'ı İLK dene → 200 OK ise localStorage OVERWRITE (sunucu TEK KAYNAK = SERVER-FIRST)
 *   YAZMA  YOLU: saveProducts / saveDealers / saveFranchisePackages vb. → ÖNCE POST /api/db/{table} X-DB-API-Key ile → 2xx ise storage yaz → DEĞİLSE storage fallback (çevrimdışı güvenlik ağı)
 * 
 * EKLENDİ: 0 console error. Offline/DB pasif (503) durumunda localStorage legacy çalışır.
 * TÜRKÇE UI: Hata mesajları yok, tüm işlemler sessiz (console.warn / console.info).
 * ============================================================ */
(function (global) {
  'use strict';

  const BUILD_VERSION_EXPECTED = '20260821-v6';

  // Admin login başarılı olduğunda bu anahtar ayarlanır (X-DB-API-Key header ile gönderilir)
  const SECRET_LOCAL_STORAGE_KEY = 'ckft_py_db_api_secret_cache_v1';
  const LAST_SYNC_MS_KEY = 'ckft_py_db_last_sync_ms_v1';

  // Güvenli URL çözümlemesi: Vercel subdomain / localhost / custom domain aynı işlev
  function apiBase() {
    const proto = (global.location && global.location.protocol) || 'https:';
    const host = (global.location && global.location.host) || 'localhost:3000';
    return proto + '//' + host + '/api/db';
  }

  // Okuma (public endpoint) /api/db/sync veya /api/db/{table}
  async function _safeFetch(method, urlSuffix, bodyObj, needSecret) {
    const headers = { 'Accept': 'application/json' };
    const opts = { method: method, credentials: 'same-origin', cache: 'no-store', headers: headers };
    if (bodyObj) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      opts.body = JSON.stringify(bodyObj);
    }
    if (needSecret) {
      const secret = getStoredSecret();
      if (secret) headers['X-DB-API-Key'] = secret;
    }
    try {
      const resp = await fetch(apiBase() + urlSuffix, opts);
      // 503 = DB PASİF → null döndür (fallback localStorage)
      if (resp.status === 503) return { status: resp.status, ok: false, offline: true, data: null };
      // 401 = Yanlış secret → storage fallback
      if (resp.status === 401) return { status: resp.status, ok: false, unauthorized: true, data: null };
      const text = await resp.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) { /* ignore */ }
      return { status: resp.status, ok: resp.status >= 200 && resp.status < 300, data: json };
    } catch (err) {
      // Ağ hatası / offline → fallback
      console.info('[pySync] Ağ yok veya backend ulaşılabilir değil, localStorage kullanılıyor: ' + (err && err.message ? err.message : err));
      return { status: 0, ok: false, offline: true, data: null };
    }
  }

  function setStoredSecret(secret) {
    try {
      if (!secret) {
        localStorage.removeItem(SECRET_LOCAL_STORAGE_KEY);
        return;
      }
      localStorage.setItem(SECRET_LOCAL_STORAGE_KEY, String(secret));
    } catch (e) { /* ignore */ }
  }

  function getStoredSecret() {
    try {
      return String(localStorage.getItem(SECRET_LOCAL_STORAGE_KEY) || '');
    } catch (_) { return ''; }
  }

  // Public: endpoint health check
  async function health() { return await _safeFetch('GET', '/health', null, false); }

  // Public: TÜM storage key payloadlarını sunucudan al (SERVER-FIRST TEK KAYNAK)
  async function syncFullSnapshot() {
    const r = await _safeFetch('GET', '/sync', null, false);
    if (r.ok && r.data && r.data.ok && typeof r.data.data === 'object' && r.data.data) {
      try { localStorage.setItem(LAST_SYNC_MS_KEY, String(Date.now())); } catch (_) {}
      return { ok: true, buildVersion: r.data.build_version, count: r.data.count || 0, data: r.data.data };
    }
    return { ok: false, offline: r.offline || false, status: r.status, data: null };
  }

  // Public: Tek tablo payload oku
  async function readTable(table) {
    const r = await _safeFetch('GET', '/' + encodeURIComponent(table), null, false);
    if (r.ok && r.data && r.data.ok && Object.prototype.hasOwnProperty.call(r.data, 'payload')) {
      return { ok: true, payload: r.data.payload, storageKey: r.data.storage_key };
    }
    return { ok: false, offline: r.offline || false, status: r.status, payload: null };
  }

  // Admin YAZMA: payloadı tabloya POST et (secret required).
  async function writeTable(table, payload) {
    const r = await _safeFetch('POST', '/' + encodeURIComponent(table), { payload: payload }, true);
    if (r.ok && r.data && r.data.ok) {
      return { ok: true, written: true, storageRows: r.data.storage_rows || 0 };
    }
    return { ok: false, offline: r.offline || false, unauthorized: r.unauthorized || false, status: r.status };
  }

  async function createAdminSession(password) {
    const r = await _safeFetch('POST', '/session', { password: String(password || '') }, false);
    return { ok: Boolean(r.ok && r.data && r.data.ok), status: r.status, unauthorized: r.unauthorized || false };
  }

  async function endAdminSession() {
    return await _safeFetch('DELETE', '/session', null, false);
  }

  // Admin SİL: Tablo satırını sil (secret required)
  async function deleteTable(table) {
    const r = await _safeFetch('DELETE', '/' + encodeURIComponent(table), null, true);
    if (r.ok && r.data && r.data.ok) return { ok: true, deleted: true };
    return { ok: false, offline: r.offline || false, unauthorized: r.unauthorized || false, status: r.status };
  }

  // Admin login sonrası çağrılır: eğer window.DB_API_SECRET tanımlıysa cachele
  function bootstrapSecretFromWindow() {
    try {
      if (global.DB_API_SECRET && typeof global.DB_API_SECRET === 'string' && global.DB_API_SECRET.length > 6) {
        setStoredSecret(global.DB_API_SECRET);
        console.info('[pySync] DB_API_SECRET window nesnesinden yüklendi.');
      } else if (global.__CKFT_DB_SECRET__ && typeof global.__CKFT_DB_SECRET__ === 'string') {
        setStoredSecret(global.__CKFT_DB_SECRET__);
      }
    } catch (_) { /* ignore */ }
  }

  // Başarılı admin authenticate olduğunda login formundan çağrılır
  function onAdminAuthenticated(providedSecretOptional) {
    if (providedSecretOptional && typeof providedSecretOptional === 'string' && providedSecretOptional.length > 6) {
      setStoredSecret(providedSecretOptional);
    } else {
      bootstrapSecretFromWindow();
    }
  }

  function getLastSyncMs() {
    try { return parseInt(localStorage.getItem(LAST_SYNC_MS_KEY) || '0', 10) || 0; }
    catch (_) { return 0; }
  }

  const PySyncClient = {
    BUILD_VERSION_EXPECTED: BUILD_VERSION_EXPECTED,
    SECRET_LOCAL_STORAGE_KEY: SECRET_LOCAL_STORAGE_KEY,
    apiBase: apiBase,
    health: health,
    syncFullSnapshot: syncFullSnapshot,
    readTable: readTable,
    writeTable: writeTable,
    createAdminSession: createAdminSession,
    endAdminSession: endAdminSession,
    deleteTable: deleteTable,
    setStoredSecret: setStoredSecret,
    getStoredSecret: getStoredSecret,
    bootstrapSecretFromWindow: bootstrapSecretFromWindow,
    onAdminAuthenticated: onAdminAuthenticated,
    getLastSyncMs: getLastSyncMs,
  };

  global.PySyncClient = PySyncClient;
  if (typeof module !== 'undefined' && module.exports) module.exports = PySyncClient;
  if (typeof window !== 'undefined') window.PySyncClient = PySyncClient;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
