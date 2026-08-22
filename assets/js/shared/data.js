const BUILD_VERSION = "20260821-v6";
const STORAGE_KEYS = {
  products: "ckft_corporate_products",
  dealers: "ckft_corporate_dealers",
  applications: "ckft_corporate_applications",
  siteContent: "ckft_corporate_site_content",
  adminAuth: "ckft_corporate_admin_auth",
  siteLogo: "siteLogo",
  franchisePackages: "ckft_corporate_franchise_packages",
  pageTitles: "ckft_corporate_page_titles",
  migrationSentinel: "ckft_corporate_migration_sentinel",
  deploySignature: "ckft_corporate_deploy_signature",
  datasetContentVersion: "ckft_corporate_dataset_content_version",
  appDataVersion: "app_data_version",
  datasetStructuralHash: "ckft_corporate_dataset_structural_hash",
  buildVersion: "ckft_corporate_build_version",
};
export const CURRENT_DATA_VERSION = BUILD_VERSION;

/* =========================================================
 * Python FastAPI PostgreSQL Sync Yardımcıları (Sunucu-Önce)
 * Eğer PySyncClient tanımlıysa (HTML'de include edilmiş) ve sunucu
 * erişilebilir durumdaysa → /api/db/sync sonucunu localStorage'a OVERWRITE eder.
 * ========================================================= */
function _getPySyncClient() {
  try {
    if (typeof window !== "undefined" && window && typeof window.PySyncClient === "object" && window.PySyncClient && typeof window.PySyncClient.syncFullSnapshot === "function") {
      return window.PySyncClient;
    }
    if (typeof globalThis !== "undefined" && globalThis && typeof globalThis.PySyncClient === "object" && globalThis.PySyncClient && typeof globalThis.PySyncClient.syncFullSnapshot === "function") {
      return globalThis.PySyncClient;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function _writeStorageKeyFromServerPayload(storageKey, payloadValue) {
  // Sürüm anahtarı localStorage'da JSON değil düz metin tutulur. JSON.stringify
  // uygulanırsa değer tırnaklı kalır ve admin/site sürüm kontrolü yenileme döngüsüne girer.
  if (storageKey === STORAGE_KEYS.buildVersion && typeof payloadValue === "string") {
    return !!safeStorageSet(STORAGE_KEYS.buildVersion, payloadValue);
  }
  if (storageKey === STORAGE_KEYS.siteLogo && typeof payloadValue === "string") {
    try { storageWriteJson(STORAGE_KEYS.siteLogo, payloadValue); return true; } catch (_) { return false; }
  }
  const asJson = typeof payloadValue === "string" ? payloadValue : JSON.stringify(payloadValue == null ? null : payloadValue);
  const ok = !!safeStorageSet(storageKey, asJson);
  if (!ok) {
    try { storageWriteJson(storageKey, (typeof payloadValue === "string" ? JSON.parse(payloadValue) : payloadValue)); return true; }
    catch (_2) { /* ignore */ }
  }
  return ok;
}

/**
 * initializeData'dan ÖNCE çağrılır.
 * 1) /api/db/sync dene (server = TEK KAYNAK)
 * 2) 200 OK ise gelen her storage_key → localStorage.setItem ile OVERWRITE
 * 3) Offline/DB pasif ise hiçbir şey yapma → localStorage legacy değerler korunsun
 * 4) Sonra initializeData() 5-tier guard uygular
 *
 * @returns {Promise<{serverFirstApplied: boolean, keysWritten: number, fallback: boolean}>}
 */
export async function initializeDataServerFirstIfPossible() {
  const sync = _getPySyncClient();
  if (!sync) {
    initializeData();
    return { serverFirstApplied: false, keysWritten: 0, fallback: true, reason: "pySyncClient include edilmemiş (yalnız localStorage modu)" };
  }
  try {
    const r = await sync.syncFullSnapshot();
    if (r && r.ok && r.data && typeof r.data === "object" && r.data) {
      let written = 0;
      const keys = Object.keys(r.data);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!k) continue;
        try {
          const v = r.data[k];
          if (v === undefined) continue;
          const w = _writeStorageKeyFromServerPayload(k, v);
          if (w) written = written + 1;
        } catch (_err) { /* bir anahtar yazılamazsa diğerlerini devam ettir */ }
      }
      initializeData();
      return { serverFirstApplied: true, keysWritten: written, fallback: false, buildVersion: r.buildVersion, count: r.count || 0 };
    }
    initializeData();
    return { serverFirstApplied: false, keysWritten: 0, fallback: true, reason: r && (r.offline || r.status === 503) ? "Sunucu DB pasif veya offline (localStorage kullanılıyor)" : ("Sunucu yanıtı geçersiz (status=" + (r && r.status) + ")") };
  } catch (err) {
    initializeData();
    return { serverFirstApplied: false, keysWritten: 0, fallback: true, reason: "Sunucu sync hatası (offline?): " + (err && err.message ? err.message : String(err)) };
  }
}

/**
 * Tüm saveXxx() fonksiyonları için SUNUCUYA arka plan yazımı (fire-and-forget best effort).
 * Storage her zaman yazılır → admin akışı asla KIRILMAZ.
 *
 * @param {string} pyTableName - PySyncClient.resolveStorageKey() kabul eder (dealers/products/franchise_packages ...)
 * @param {*} payload - array veya object
 */
function _pySyncWriteBestEffort(pyTableName, payload) {
  try {
    const sync = _getPySyncClient();
    if (!sync || typeof sync.writeTable !== "function") return;
    Promise.resolve()
      .then(function () { return sync.writeTable(pyTableName, payload); })
      .then(function (r) {
        if (!r || !r.ok) {
          if (r && r.unauthorized) {
            console.warn("[pySync] " + pyTableName + " yazılamadı: Admin DB secret eksik/yanlış (X-DB-API-Key). LocalStorage kullanılıyor.");
          } else if (r && r.offline) {
            console.info("[pySync] " + pyTableName + " yazılamadı: Ağ yok / offline. LocalStorage kullanılıyor.");
          } else {
            console.warn("[pySync] " + pyTableName + " sunucuya yazılamadı (status=" + (r && r.status) + "). LocalStorage kullanılıyor.");
          }
        }
      })
      .catch(function (e) {
        console.info("[pySync] " + pyTableName + " yazarken hata (localStorage yazıldı, sunucuya yazılamadı): " + (e && e.message ? e.message : String(e)));
      });
  } catch (_) { /* ignore */ }
}

const DATASET_DEPLOY_SIGNATURE = "v2.1-production-2026-08-20-01";
const DATASET_CONTENT_VERSION = 4;
const APP_DATA_VERSION = "2026-v3";

function computeStructuralHash() {
  try {
    const payload = {
      dealers: Array.isArray(defaultDealers) ? defaultDealers.map(function (d) { return d ? { id: d.id, title: d.branchName || d.title || d.name, phone: d.phone, image: d.image } : null; }) : [],
      products: Array.isArray(defaultProducts) ? defaultProducts.map(function (p) { return p ? { id: p.id, name: p.name, image: p.image, price: p.price } : null; }) : [],
      packages: Array.isArray(defaultFranchisePackages) ? defaultFranchisePackages.map(function (p) { return p ? { id: p.id, title: p.title, price: p.price, media: p.media } : null; }) : [],
      siteContent: defaultSiteContent ? { counters: defaultSiteContent.counters || null, heroTitle: defaultSiteContent.heroTitle || null } : null,
    };
    const json = JSON.stringify(payload);
    let h1 = 0x811c9dc5, h2 = 0xdeadbeef;
    for (let i = 0; i < json.length; i++) {
      const c = json.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761) >>> 0;
      h2 = Math.imul(h2 ^ c, 1597334677) >>> 0;
    }
    return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
  } catch (_) {
    return APP_DATA_VERSION + "-fallback";
  }
}

const STORAGE_SIZE_WARN_BYTES = 4 * 1024 * 1024;
let storageQuotaWarningShown = false;

function computeApproxBytes(str) {
  if (typeof str !== "string") return 0;
  try { return str.length * 2; } catch (_) { return 0; }
}

function isQuotaLikeError(err) {
  if (!err) return false;
  const name = err && err.name ? String(err.name) : "";
  const code = err && err.code ? Number(err.code) : 0;
  const msg = err && err.message ? String(err.message).toLowerCase() : "";
  return name === "QuotaExceededError" ||
    code === 22 ||
    msg.indexOf("quota") >= 0 ||
    msg.indexOf("storage") >= 0 ||
    msg.indexOf("not enough space") >= 0;
}

function safeGetStorageTotalBytes() {
  try {
    if (typeof localStorage !== "object" || localStorage === null) return 0;
    if (typeof Storage !== "undefined" && localStorage instanceof Storage === false) return 0;
  } catch (_) { return 0; }
  let total = 0;
  try {
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      total = total + computeApproxBytes(k) + computeApproxBytes(v);
    }
  } catch (_) { /* ignore */ }
  return total;
}

function storageEmergencyClearLargest(neededHintBytes) {
  try {
    if (typeof localStorage !== "object" || localStorage === null) return false;
    const entries = [];
    const len = localStorage.length;
    for (let i = 0; i < len; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === STORAGE_KEYS.adminAuth) continue;
      const v = localStorage.getItem(k);
      entries.push({ key: k, bytes: computeApproxBytes(k) + computeApproxBytes(v) });
    }
    entries.sort(function (a, b) { return b.bytes - a.bytes; });
    let cleared = 0;
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j];
      try {
        localStorage.removeItem(e.key);
        cleared = cleared + e.bytes;
        if (cleared >= Math.max(neededHintBytes || 0, 512 * 1024)) return true;
      } catch (_) { /* ignore */ }
    }
    return cleared > 0;
  } catch (_) { return false; }
}

function safeStorageGet(key, fallbackRaw) {
  try {
    if (typeof localStorage === "undefined" || localStorage === null) return fallbackRaw;
    const raw = localStorage.getItem(key);
    return raw === null ? fallbackRaw : raw;
  } catch (_) {
    return fallbackRaw;
  }
}

function safeStorageSet(key, rawValue, opts) {
  const options = opts || {};
  if (typeof localStorage === "undefined" || localStorage === null) {
    if (options.onError) options.onError(new Error("Storage unavailable"));
    return false;
  }
  const valStr = typeof rawValue === "string" ? rawValue : String(rawValue == null ? "" : rawValue);
  const sizeBytes = computeApproxBytes(valStr);
  try {
    localStorage.setItem(key, valStr);
    if (sizeBytes > STORAGE_SIZE_WARN_BYTES && !storageQuotaWarningShown) {
      storageQuotaWarningShown = true;
      console.warn("[storage] Büyük anahtar kaydedildi: " + key + " (~" + Math.round(sizeBytes / 1024) + " KB)");
    }
    return true;
  } catch (firstErr) {
    if (!isQuotaLikeError(firstErr)) {
      if (options.onError) options.onError(firstErr);
      return false;
    }
    try { storageEmergencyClearLargest(sizeBytes + 256 * 1024); } catch (_) { /* ignore */ }
    try {
      localStorage.setItem(key, valStr);
      console.warn("[storage] Kota hatası sonrası temizle/kaydet başarılı: " + key);
      return true;
    } catch (secondErr) {
      console.error("[storage] Kayıt başarısız (kota aşıldı): " + key);
      if (options.onError) options.onError(secondErr);
      return false;
    }
  }
}

function safeStorageRemove(key) {
  try {
    if (typeof localStorage === "undefined" || localStorage === null) return;
    localStorage.removeItem(key);
  } catch (_) { /* ignore */ }
}

export function getStorageStatus() {
  const used = safeGetStorageTotalBytes();
  return {
    usedBytes: used,
    usedKb: Math.round(used / 1024),
    limitWarn: used >= STORAGE_SIZE_WARN_BYTES,
  };
}

function storageReadCollection(key, fallback) {
  const raw = safeStorageGet(key, null);
  if (raw === null) return Array.isArray(fallback) ? fallback.slice() : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (Array.isArray(fallback) ? fallback.slice() : []);
  } catch (_) {
    try { storageWriteJson(key, []); } catch (_2) { /* ignore */ }
    return [];
  }
}

function storageReadObject(key, fallback) {
  const raw = safeStorageGet(key, null);
  if (raw === null) {
    return fallback && typeof fallback === "object" ? { ...fallback } : {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...(fallback || {}), ...parsed };
    }
    return parsed && typeof parsed === "object" ? parsed : (fallback ? { ...fallback } : {});
  } catch (_) {
    const emptyObj = fallback && typeof fallback === "object" ? { ...fallback } : {};
    try { storageWriteJson(key, emptyObj); } catch (_2) { /* ignore */ }
    return emptyObj;
  }
}

function storageWriteJson(key, value, opts) {
  let raw = "";
  try {
    raw = JSON.stringify(value);
  } catch (err) {
    if (opts && opts.onError) opts.onError(err);
    return false;
  }
  return safeStorageSet(key, raw, opts);
}

function readMigrationSentinel() {
  try {
    const raw = safeStorageGet(STORAGE_KEYS.migrationSentinel, null);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch (_) {
    safeStorageRemove(STORAGE_KEYS.migrationSentinel);
    return null;
  }
}

function writeMigrationSentinel(key, revision) {
  try {
    const current = readMigrationSentinel() || {};
    const next = { ...current };
    next[key] = { rev: String(revision || 1), ts: Date.now() };
    safeStorageSet(STORAGE_KEYS.migrationSentinel, JSON.stringify(next));
  } catch (_) { /* ignore */ }
}

function isMigrationDone(key, minRevision) {
  const state = readMigrationSentinel();
  if (!state || !state[key]) return false;
  return Number(state[key].rev || 0) >= Number(minRevision || 1);
}

export const defaultCategories = [
  { id: "all", label: "Tüm Ürünler" },
  { id: "durumler", label: "Dürümler" },
  { id: "porsiyonlar", label: "Porsiyonlar" },
  { id: "etsiz-cigkofte", label: "Etsiz Çiğköfte Çeşitleri" },
  { id: "ikramliklar", label: "Özel İkramlıklar" },
];

export const defaultProducts = [
  {
    id: "usta-durumu",
    name: "Usta Dürümü",
    category: "durumler",
    description:
      "İnce lavaş, özenle yoğrulmuş çiğköfte, kıvırcık, taze nane, limon ve nar ekşisi ile hazırlanır. Geleneksel sunumunun kurumsal versiyonudur.",
    image: "./images/Usta Durumu.jpg",
    badges: ["Günlük Taze", "Özel Soslu"],
    active: true,
  },
  {
    id: "mega-durum",
    name: "Mega Dürüm",
    category: "durumler",
    description:
      "Daha dolgun içerik, güçlü baharat dengesi ve kurumsal sunum çizgisiyle öne çıkan özel seri dürüm. Büyük porsiyon arayanlar için hazırlanmıştır.",
    image: "./images/Mega Durum.jpg",
    badges: ["Dolgun İçerik", "İmza Lezzet"],
    active: true,
  },
  {
    id: "klasik-porsiyon",
    name: "Klasik Porsiyon",
    category: "porsiyonlar",
    description:
      "Marul yaprakları, limon dilimleri, taze yeşillikler ve nar ekşisi ile tamamlanan geleneksel porsiyon sunumu. Her lokmada eşsiz lezzet.",
    image: "./images/Klasik Porsiyon çiğ köfte.png",
    badges: ["Geleneksel Sunum", "Hijyenik Hazırlık"],
    active: true,
  },
  {
    id: "gurme-porsiyon",
    name: "Gurme Porsiyon",
    category: "porsiyonlar",
    description:
      "Seçilmiş baharat dengesi ve zengin garnitür eşliğinde kurumsal davetlere uygun özel tabak sunumu. Görsel ve lezzet olarak üst seviye.",
    image: "./images/Klasik Porsiyon çiğ köfte - Copy.png",
    badges: ["Seçili Baharat", "Özel Sunum"],
    active: true,
  },
  {
    id: "geleneksel-etsiz",
    name: "Geleneksel Etsiz Çiğköfte",
    category: "etsiz-cigkofte",
    description:
      "Kaliteli ince bulgur, isot, domates ve biber salçası ile günlük hazırlanan otantik tarifin kurumsal yorumu. Vegan ve vejetaryen seçenektir.",
    image: "./images/Geleneksel Etsiz Çiğköfte.jpg",
    badges: ["Otantik Tarif", "Günlük Üretim"],
    active: true,
  },
  {
    id: "yoresel-ozel-seri",
    name: "Yöresel Özel Seri",
    category: "etsiz-cigkofte",
    description:
      "Yöresel lezzet profilini yansıtan, dengeli acılık ve yoğun aroma karakterine sahip özel marka ürünü. Sınırlı sayıda üretilir.",
    image: "./images/Yoresel Ozel Seri.webp",
    badges: ["Yöresel Dokunuş", "Marka Özel"],
    active: true,
  },
  {
    id: "mini-ikramlik-kutu",
    name: "Mini İkramlık Kutu",
    category: "ikramliklar",
    description:
      "Toplantı, davet ve kurumsal etkinliklerde pratik servis için hazırlanan özel kutu sunumu. Tek kullanımlık, hijyenik paketleme.",
    image: "./images/Aile Ikram Paketi.jpg",
    badges: ["Kurumsal Etkinlik", "Pratik Servis"],
    active: true,
  },
  {
    id: "aile-ikram-paketi",
    name: "Aile İkram Paketi",
    category: "ikramliklar",
    description:
      "Paylaşım odaklı sunumlar için yeşillikler, limon ve servis detaylarıyla tamamlanan geniş paket. Büyük aile davetleri için ideal.",
    image: "./images/Aile Ikram Paketi.jpg",
    badges: ["Paylaşım Odaklı", "Özel Paket"],
    active: true,
  },
];

export const defaultDealers = [
  {
    id: "istanbul-bagcilar",
    city: "İstanbul",
    district: "Bağcılar",
    branchName: "Adıyaman Osmanlı Çiğköfte",
    address: "Merkez Mahallesi İnönü Caddesi No:24, Bağcılar / İstanbul",
    phone: "+90 212 555 10 10",
    image: "./images/Usta Durumu.jpg",
    mapEmbedUrl:
      "https://www.google.com/maps?q=Bagcilar%20Istanbul&output=embed",
    active: true,
    workingHours: "Hafta içi 09:00 - 23:00 | Hafta sonu 10:00 - 23:00",
  },
  {
    id: "ankara-kecioren",
    city: "Ankara",
    district: "Keçiören",
    branchName: "Adıyaman Osmanlı Çiğköfte",
    address: "Güzeltepe Mahallesi Şehitler Sokak No:11, Keçiören / Ankara",
    phone: "+90 312 555 20 20",
    image: "./images/Mega Durum.jpg",
    mapEmbedUrl:
      "https://www.google.com/maps?q=Kecioren%20Ankara&output=embed",
    active: true,
    workingHours: "Hafta içi 09:00 - 22:30 | Hafta sonu 10:00 - 22:00",
  },
  {
    id: "izmir-bornova",
    city: "İzmir",
    district: "Bornova",
    branchName: "Adıyaman Osmanlı Çiğköfte",
    address: "Kazımdirik Mahallesi 372 Sokak No:8, Bornova / İzmir",
    phone: "+90 232 555 30 30",
    image: "./images/Klasik Porsiyon çiğ köfte.png",
    mapEmbedUrl:
      "https://www.google.com/maps?q=Bornova%20Izmir&output=embed",
    active: true,
    workingHours: "Hafta içi 09:30 - 22:00 | Hafta sonu 10:00 - 22:00",
  },
  {
    id: "gaziantep-sehitkamil",
    city: "Gaziantep",
    district: "Şehitkamil",
    branchName: "Adıyaman Osmanlı Çiğköfte",
    address: "Mücahitler Mahallesi 52012 Nolu Sokak No:4, Şehitkamil / Gaziantep",
    phone: "+90 342 555 40 40",
    image: "./images/Geleneksel Etsiz Çiğköfte.jpg",
    mapEmbedUrl:
      "https://www.google.com/maps?q=Sehitkamil%20Gaziantep&output=embed",
    active: true,
    workingHours: "Hafta içi 08:30 - 23:30 | Hafta sonu 09:00 - 23:30",
  },
];

export const defaultApplications = [
  {
    id: "APP-1001",
    fullName: "Emre Karataş",
    phone: "+90 533 555 11 22",
    email: "emre@example.com",
    packageId: "standart-paket",
    packageName: "Standart Paket",
    cityDistrict: "Bursa / Nilüfer",
    message: "Kurumsal bayilik modeli ve yatırım süreci hakkında detaylı bilgi almak istiyorum. Lokasyon desteği sunuyor musunuz?",
    submittedAt: "2026-08-12T09:20:00",
    status: "Yeni",
  },
  {
    id: "APP-1002",
    fullName: "Merve Akbulut",
    phone: "+90 532 444 77 88",
    email: "merve@example.com",
    packageId: "premium-paket",
    packageName: "Premium Paket",
    cityDistrict: "Konya / Selçuklu",
    message: "Bölgemde şube açmak için uygun lokasyon ve destek koşullarını öğrenmek istiyorum. Menü eğitim ve stok detayları hakkında bilgi talep ediyorum.",
    submittedAt: "2026-08-14T11:05:00",
    status: "İletişime Geçildi",
  },
];

export const defaultFranchisePackages = [
  {
    id: "express-paketi",
    title: "Express Paket",
    description: "Yeni girişimciler için tasarlanmış, düşük yatırımlı hızlı başlangıç modeli. Standart ekipman ve temel operasyon desteği içerir. Mobil veya küçük metrekareli lokasyonlar için uygundur.",
    price: "₺250.000",
    features: [
      "Standart tezgah ve ekipman seti",
      "Temel operasyon eğitimi (3 gün)",
      "Marka kimliği materyalleri (logo, tabela, menü)",
      "İlk ay stok desteği",
      "Telefonla teknik destek",
      "Standart ambalaj ve servis ekipmanı",
    ],
    media: "./images/Usta Durumu.jpg",
    mediaType: "image",
    gallery: [
      { id: "pkg-express-1", url: "./images/Usta Durumu.jpg", alt: "Express Paket - Usta Dürümü sunumu" },
      { id: "pkg-express-2", url: "./images/Klasik Porsiyon çiğ köfte.png", alt: "Express Paket - Klasik Porsiyon" },
      { id: "pkg-express-3", url: "./images/Mega Durum.jpg", alt: "Express Paket - Mega Dürüm" },
      { id: "pkg-express-4", url: "./images/Aile Ikram Paketi.jpg", alt: "Express Paket - Aile İkramı" },
    ],
    active: true,
    order: 1,
  },
  {
    id: "standart-paket",
    title: "Standart Paket",
    description: "Orta ölçekli yatırımcılar için en çok tercih edilen paket. Tam ekipman, geniş eğitim ve sürekli saha desteği sunar. Cadde üzeri veya AVM girişleri için en uygun seçenektir.",
    price: "₺450.000",
    features: [
      "Tam tezgah ve endüstriyel ekipman seti",
      "Detaylı operasyon eğitimi (7 gün)",
      "Şube açılış organizasyon desteği",
      "3 ay stok avantajı ve kargo indirimi",
      "Aylık saha ziyareti ve kontrol desteği",
      "Reklam ve tanıtım materyalleri (açılış davetiyesi, poster)",
      "Standart Dijital Menü ve TV ekran desteği",
    ],
    media: "./images/Mega Durum.jpg",
    mediaType: "image",
    gallery: [
      { id: "pkg-standart-1", url: "./images/Mega Durum.jpg", alt: "Standart Paket - Mega Dürüm kapak" },
      { id: "pkg-standart-2", url: "./images/Usta Durumu.jpg", alt: "Standart Paket - Usta Dürümü" },
      { id: "pkg-standart-3", url: "./images/Yoresel Ozel Seri.webp", alt: "Standart Paket - Yöresel Özel Seri" },
      { id: "pkg-standart-4", url: "./images/Klasik Porsiyon çiğ köfte.png", alt: "Standart Paket - Klasik Porsiyon" },
      { id: "pkg-standart-5", url: "./images/Geleneksel Etsiz Çiğköfte.jpg", alt: "Standart Paket - Etsiz Çiğköfte" },
      { id: "pkg-standart-6", url: "./images/Aile Ikram Paketi.jpg", alt: "Standart Paket - Aile İkramı" },
    ],
    active: true,
    order: 2,
  },
  {
    id: "premium-paket",
    title: "Premium Paket",
    description: "Yüksek hacimli lokasyonlar ve büyük yatırımcılar için tasarlanmış üst seviye paket. Tam hizmet, lokasyon ve mimari proje desteği ile öncelikli destek içerir. AVM, büyük cadde ve plaza lokasyonları için tasarlanmıştır.",
    price: "₺750.000",
    features: [
      "Endüstriyel üst seviye ekipman seti",
      "Kapsamlı eğitim + personel eğitimi (14 gün)",
      "Lokasyon analizi ve mimari proje desteği",
      "6 ay stok avantajı ve özel fiyatlandırma",
      "Haftalık saha danışmanlığı ve denetim",
      "Bölge tanıtım kampanyası desteği",
      "Öncelikli müşteri hizmetleri hattı",
      "Menü ve ürün geliştirme desteği",
      "Dijital pazarlama ve sosyal medya desteği",
    ],
    media: "./images/Klasik Porsiyon çiğ köfte - Copy.png",
    mediaType: "image",
    gallery: [
      { id: "pkg-premium-1", url: "./images/Klasik Porsiyon çiğ köfte - Copy.png", alt: "Premium Paket - Gurme Porsiyon kapak" },
      { id: "pkg-premium-2", url: "./images/Mega Durum.jpg", alt: "Premium Paket - Mega Dürüm" },
      { id: "pkg-premium-3", url: "./images/Usta Durumu.jpg", alt: "Premium Paket - Usta Dürümü" },
      { id: "pkg-premium-4", url: "./images/Yoresel Ozel Seri.webp", alt: "Premium Paket - Yöresel Özel Seri" },
      { id: "pkg-premium-5", url: "./images/Geleneksel Etsiz Çiğköfte.jpg", alt: "Premium Paket - Etsiz Çiğköfte" },
      { id: "pkg-premium-6", url: "./images/Aile Ikram Paketi.jpg", alt: "Premium Paket - Aile İkramı" },
      { id: "pkg-premium-7", url: "./images/Klasik Porsiyon çiğ köfte.png", alt: "Premium Paket - Klasik Porsiyon" },
    ],
    active: true,
    order: 3,
  },
];

export const defaultPageTitles = {
  "index.html": { title: "Ana Sayfa | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
  "urunlerimiz.html": { title: "Ürünlerimiz | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
  "hakkimizda.html": { title: "Hakkımızda | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
  "bayilerimiz.html": { title: "Bayilerimiz | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
  "bayilik-basvurusu.html": { title: "Bayimiz Olun | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
  "iletisim.html": { title: "İletişim | Osmanlı Adıyaman Çiğköfte", headerTitle: "", headerSubtitle: "" },
};

export const applicationStatuses = ["Yeni", "İncelendi", "İletişime Geçildi", "Onaylandı", "Reddedildi", "Tamamlandı"];

export const defaultAdminAuth = {
  username: "admin",
  password: "Cigkofte123!",
};

const defaultFoodImages = [
  {
    id: "food-gallery-1",
    url: "./images/Usta Durumu.jpg",
    alt: "Usta Dürümü kurumsal sunumu",
  },
  {
    id: "food-gallery-2",
    url: "./images/Mega Durum.jpg",
    alt: "Mega Dürüm günlük hazırlık görünümü",
  },
  {
    id: "food-gallery-3",
    url: "./images/Klasik Porsiyon çiğ köfte.png",
    alt: "Klasik Porsiyon çiğköfte tabak sunumu",
  },
  {
    id: "food-gallery-4",
    url: "./images/Yoresel Ozel Seri.webp",
    alt: "Yöresel Özel Seri özel üretim",
  },
  {
    id: "food-gallery-5",
    url: "./images/Geleneksel Etsiz Çiğköfte.jpg",
    alt: "Geleneksel Etsiz Çiğköfte günlük üretim",
  },
  {
    id: "food-gallery-6",
    url: "./images/Aile Ikram Paketi.jpg",
    alt: "Aile İkram Paketi servis görünümü",
  },
];

const defaultStoreImages = [
  {
    id: "store-gallery-1",
    url: "./images/Usta Durumu.jpg",
    alt: "Modern bayi vitrin ve tezgah görünümü",
  },
  {
    id: "store-gallery-2",
    url: "./images/Mega Durum.jpg",
    alt: "Kurumsal şube iç mekan ve bekleme alanı",
  },
  {
    id: "store-gallery-3",
    url: "./images/Klasik Porsiyon çiğ köfte.png",
    alt: "Marka servis standartları hazırlık alanı",
  },
];

export const defaultSiteContent = {
  brandName: "Osmanlı Adıyaman Çiğköfte",
  logoUrl: "./images/logo.png",
  slogan: "Gelenekten gelen gerçek çiğköfte lezzeti",
  heroDescription:
    "Günlük hazırlanan özel karışım, hijyenik üretim anlayışı ve güçlü bayi yapımızla kurumsal çiğköfte deneyimini yeniden tanımlıyoruz. Her lokasyonda aynı kalite, aynı lezzet.",
  heroCardProductLabel: "Ürün Portföyü",
  heroCardProductValue: "8 vitrin ürünü",
  heroCardDealerLabel: "Bayi Ağı",
  heroCardDealerValue: "4 aktif bayi noktası",
  heroCardApplicationLabel: "Başvuru Akışı",
  heroCardApplicationValue: "2 güncel başvuru",
  heroCardSummaryLabel: "Marka Özeti",
  heroCardSummaryText:
    "2012 yılından bu yana üretim disiplini, güçlü bayi yapısı ve kurumsal hizmet anlayışıyla lezzet yolculuğumuzu istikrarlı şekilde büyütüyoruz.",
  journeyImageUrl: "./images/journey.svg",
  journeyImageAlt: "Konya'da başlayan lezzet yolculuğunu temsil eden kurumsal infografik",
  visionImageUrl: "./images/Usta Durumu.jpg",
  visionImageAlt: "Kurumsal vizyonu ve büyüme hedeflerini temsil eden profesyonel sunum",
  franchiseImageUrl: "./images/Mega Durum.jpg",
  franchiseImageAlt: "Anahtar teslim bayilik iş ortaklığını temsil eden kurumsal şube fotoğrafı",
  journeyTitle: "Lezzet Yolculuğumuz (2012 - Bugün)",
  journeyText:
    "2012 yılında Konya'da bir ortaklıkla başladığımız çiğköfte sektörü yolculuğumuza, 2015 yılından itibaren aile şirketi olarak devam etme kararı aldık. Bu işe ilk başladığımız günden bu yana üretimimizi tamamen kendimiz yapıyor, ürünlerimizi her gün taze ve hijyenik koşullarda hazırlıyoruz.",
  qualityTitle: "Kalite ve Müşteri Memnuniyeti Önceliğimizdir",
  qualityText:
    "İlk üç yıl boyunca sürekli yeni tarifler deneyerek bugünkü eşsiz lezzetimize ve yüksek kalite standardımıza ulaştık. Üretim sürecimizde her zaman en kaliteli malzemeleri kullandık. En büyük önceliğimiz daima müşteri memnuniyeti oldu; müşterilerimize en iyisini sunmak için her gün yeni yöntemler geliştirdik. Bugüne kadar büyük bir emek ve özveriyle çalıştık.",
  franchiseTitle: "Anahtar Teslim Bayilik Fırsatları",
  franchiseSlogan: "Dükkanı tut, her şeyi bize bırak",
  franchiseText:
    "Lezzetimizi ve tecrübemizi daha geniş kitlelerle buluşturmak amacıyla bayilikler veriyoruz. \"Dükkanı tut, her şeyi bize bırak\" anlayışıyla, anahtar teslim konseptimizle yatırımcılarımızın yanında yer alıyor, bu lezzet yolculuğunda birlikte büyümeyi hedefliyoruz.",
  visionTitle: "Vizyonumuz",
  visionPoint1Title: "Geleneksel Lezzeti Geleceğe Taşımak",
  visionPoint1Text:
    "2012 yılından bu yana Konya'da başlayan lezzet yolculuğumuzu, ilk günkü üretim titizliğimizden ve en üst kalite malzeme standartlarımızdan ödün vermeden daha geniş kitlelere ulaştırmak.",
  visionPoint2Title: "Sektörde Güvenilir Lider Olmak",
  visionPoint2Text:
    "Kaliteyi ve müşteri memnuniyetini her zaman en ön sırada tutan yaklaşımımızla, çiğköfte sektöründe örnek alınan ve güven duyulan öncü bir marka haline gelmek.",
  visionPoint3Title: "Büyüyen Bayilik Ağı",
  visionPoint3Text:
    "\"Dükkanı tut, her şeyi bize bırak\" anahtar teslim konseptimizle yeni girişimcilere destek olmak, güçlü bir iş ortaklığı ağı kurarak bu lezzeti Türkiye'nin dört bir yanında paylaşmak.",
  whyUsTitle: "NEDEN BİZ?",
  whyUsText1:
    "Güçlü marka dili, standartlaşmış sunum ve sürekli kalite takibi ile fark yaratan bir operasyon modeli.",
  whyUsText2:
    "Lokasyon seçimi, açılış süreci, kurumsal iletişim ve saha süreçlerinde yönlendirme odaklı destek yapısı.",
  whyUsText3:
    "Uzun vadeli iş ortaklığı anlayışı ile büyümeyi hedefleyen profesyonel bayilik yaklaşımı.",
  aboutStory:
    "2012 yılında Konya'da bir ortaklıkla başladığımız çiğköfte sektörü yolculuğumuza, 2015 yılından itibaren aile şirketi olarak devam etme kararı aldık. Bu işe ilk başladığımız günden bu yana üretimimizi tamamen kendimiz yapıyoruz.",
  aboutQuality:
    "İlk üç yıl boyunca sürekli yeni tarifler deneyerek bugünkü eşsiz lezzetimize ve yüksek kalite standardımıza ulaştık. Üretim sürecimizde her zaman en kaliteli malzemeleri kullandık. En büyük önceliğimiz daima müşteri memnuniyeti oldu.",
  aboutVision:
    "Geleneksel lezzeti geleceğe taşımak, sektörde güvenilir lider olmak ve büyüyen bayilik ağımızla Türkiye'nin dört bir yanında aynı kaliteyi sunmak temel vizyonumuzdur.",
  contactPhone: "+90 850 555 00 00",
  whatsappPhone: "905505550000",
  contactEmail: "info@acilicigkofte.com",
  contactHours: "Hafta içi 09:00 - 18:30 | Hafta sonu 10:00 - 17:00",
  contactAddress: "Cebeci Mahallesi 2537. Sokak No:9, Sultangazi / İstanbul",
  headquartersTitle: "Genel Müdürlük",
  mapPlaceholder: "Harita entegrasyonu ve konum modülü için ayrılmış alandır.",
  headquartersMapEmbedUrl:
    "https://www.google.com/maps?q=Cebeci%20Mahallesi%202537%20Sokak%20No%209%20Sultangazi%20Istanbul&output=embed",
  homeText: {
    headerSubtitle: "Kurumsal Lezzet Markası",
    mobileMenu: "Menü",
    navHome: "Ana Sayfa",
    navProducts: "Ürünlerimiz",
    navAbout: "Hakkımızda",
    navDealers: "Bayilerimiz",
    navFranchise: "Bayimiz Olun",
    navContact: "İletişim",
    heroBadge: "Otantik tarif, kurumsal kalite, güçlü bayi yapısı",
    heroProductsButton: "Ürünlerimiz",
    heroFranchiseButton: "Bayimiz Olun",
    featuredEyebrow: "Öne Çıkan Lezzetler",
    featuredTitle: "Markamızın dikkat çeken ürün seçkisi",
    featuredLink: "Tüm ürünleri incele",
    galleryEyebrow: "Lezzet Galerisi",
    galleryTitle: "Yüklenen yemek görselleri",
    dealersEyebrow: "Şubelerimiz",
    dealersTitle: "Bayi noktalarımız ve konum bilgileri",
    dealersLink: "Tüm şubeleri görüntüle",
    aboutEyebrow: "Hakkımızda",
    qualityEyebrow: "Kalite Anlayışımız",
    qualityPill1: "Günlük Taze Üretim",
    qualityPill2: "Hijyenik Hazırlık",
    qualityPill3: "Memnuniyet Odaklı Hizmet",
    qualityFeature1Title: "Kaliteli Ham Madde",
    qualityFeature1Text: "Üretimin her aşamasında özenle seçilmiş malzeme",
    qualityFeature2Title: "Güvenli Üretim",
    qualityFeature2Text: "Hijyen ve standartlara uygun hazırlık süreci",
    qualityFeature3Title: "Müşteri Odaklılık",
    qualityFeature3Text: "Her zaman en iyi deneyim için sürekli iyileştirme",
    franchiseEyebrow: "Bayilik Fırsatı",
    franchiseButton: "Bayimiz Olun",
    visionEyebrow: "Kurumsal Yön",
    visionCardEyebrow: "Vizyon & Büyüme",
    visionCardText: "Markamız; sürdürülebilir üretim, dürüst iş ortaklığı ve müşteri odaklı hizmet anlayışı ile Türkiye genelinde güçlü bir bayilik ağı kurmayı hedeflemektedir.",
    visionBullet1: "Şeffaf: Tüm süreçler öngörülebilir ve standart.",
    visionBullet2: "Öğretici: Açılış, eğitim ve operasyon desteği.",
    visionBullet3: "Birlikte Büyüme: Bayilerimizle ortak hedefler ve kazan-kazan.",
    headquartersEyebrow: "Genel Müdürlük",
    headquartersTitle: "Merkez konumumuz",
    footerSubtitle: "Kurumsal Marka Kimliği",
    footerDescription: "Güçlü bayi yapısı, standart üretim ve sürdürülebilir kalite anlayışıyla hizmet veriyoruz.",
    footerPhoneLabel: "Telefon",
    footerEmailLabel: "E-posta",
    footerHoursLabel: "Çalışma Saatleri",
    footerInfoTitle: "Kurumsal Bilgi Alanı",
    footerInfoText: "Harita ve sosyal medya alanı\nInstagram • Facebook • LinkedIn kurumsal hesapları",
    whatsappTitle: "WhatsApp",
    whatsappSubtitle: "Destek",
  },
  foodImages: defaultFoodImages,
  storeImages: defaultStoreImages,
};

const LEGACY_PLACEHOLDER_FINGERPRINTS = {
  products: [
    "./images/usta.jpg",
    "./images/mega.jpg",
    "./images/urun1.jpg",
    "./images/urun2.jpg",
    "./images/urun3.jpg",
    "./images/urun4.jpg",
  ],
  dealers: [
    "0212 000 00 00",
    "0312 000 00 00",
    "0232 000 00 00",
    "Tanımlanmamış Görsel",
  ],
  franchisePackages: [
    "./images/bayilik-placeholder.jpg",
    "./images/franchise-header.jpg",
    "Başlangıç Paketi (Eski)",
  ],
  siteContent: [
    "Kalite ve lezzet sözü veriyoruz",
    "Yakında bayiliklerimiz hizmetinizde",
  ],
};

function isStorageContentLegacyPlaceholder(key, raw) {
  if (raw === null || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let parsed = null;
  try { parsed = JSON.parse(trimmed); } catch (_) { return true; }
  const keyName = Object.keys(STORAGE_KEYS).find(function (k) { return STORAGE_KEYS[k] === key; }) || "";
  const fingerprints = LEGACY_PLACEHOLDER_FINGERPRINTS[keyName] || null;
  if (Array.isArray(parsed) && fingerprints && fingerprints.length) {
    let hits = 0;
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] && typeof parsed[i] === "object" ? parsed[i] : null;
      if (!item) { hits++; continue; }
      const values = Object.values(item).map(function (v) { return typeof v === "string" ? v.toLowerCase() : ""; });
      for (let fi = 0; fi < fingerprints.length; fi++) {
        const fp = fingerprints[fi].toLowerCase();
        if (values.some(function (s) { return s.indexOf(fp) >= 0; })) { hits++; break; }
      }
    }
    const ratio = parsed.length ? (hits / parsed.length) : 0;
    if (parsed.length <= 2 && hits >= 1) return true;
    if (ratio >= 0.5) return true;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && fingerprints && fingerprints.length) {
    const values = Object.values(parsed).map(function (v) { return typeof v === "string" ? v.toLowerCase() : ""; });
    const hit = fingerprints.some(function (fp) {
      const needle = fp.toLowerCase();
      return values.some(function (s) { return s.indexOf(needle) >= 0; });
    });
    if (hit) return true;
  }
  return false;
}

function smartReseedPreservingEdits(key, defaultValue) {
  try {
    const raw = safeStorageGet(key, null);
    if (raw === null) {
      storageWriteJson(key, defaultValue);
      return true;
    }
    if (!isStorageContentLegacyPlaceholder(key, raw)) {
      return false;
    }
    const isCollection = Array.isArray(defaultValue);
    const isObject = !isCollection && defaultValue && typeof defaultValue === "object";
    if (isCollection) {
      let storedParsed = [];
      try { storedParsed = JSON.parse(raw); } catch (_) { storedParsed = []; }
      if (!Array.isArray(storedParsed)) storedParsed = [];
      const defaultIds = new Map();
      for (let di = 0; di < defaultValue.length; di++) {
        const d = defaultValue[di] && typeof defaultValue[di] === "object" ? defaultValue[di] : null;
        if (d && d.id) defaultIds.set(String(d.id), d);
      }
      const adminCustomItems = [];
      for (let si = 0; si < storedParsed.length; si++) {
        const it = storedParsed[si];
        if (!it || typeof it !== "object") continue;
        const inDefaults = it.id && defaultIds.has(String(it.id));
        if (inDefaults) continue;
        const itemJson = JSON.stringify(it);
        const isLegacyItem = isStorageContentLegacyPlaceholder(key, itemJson);
        if (!isLegacyItem) {
          adminCustomItems.push(it);
        }
      }
      const merged = defaultValue.slice().concat(adminCustomItems);
      storageWriteJson(key, merged);
      return true;
    }
    if (isObject) {
      let storedParsed = null;
      try { storedParsed = JSON.parse(raw); } catch (_) { storedParsed = null; }
      const merged = { ...defaultValue, ...(storedParsed && typeof storedParsed === "object" ? storedParsed : {}) };
      storageWriteJson(key, merged);
      return true;
    }
    return false;
  } catch (_) {
    try { storageWriteJson(key, defaultValue); } catch (_2) { /* ignore */ }
    return false;
  }
}

export function initializeData() {
  let deploySignatureCurrent = null;
  try { deploySignatureCurrent = safeStorageGet(STORAGE_KEYS.deploySignature, null); } catch (_) { deploySignatureCurrent = null; }
  const signatureMatches = deploySignatureCurrent === DATASET_DEPLOY_SIGNATURE;

  let contentVersionCurrent = null;
  try { contentVersionCurrent = Number(safeStorageGet(STORAGE_KEYS.datasetContentVersion, 0) || 0); } catch (_) { contentVersionCurrent = 0; }
  const contentVersionMatches = contentVersionCurrent === DATASET_CONTENT_VERSION;

  let appDataVersionCurrent = null;
  try { appDataVersionCurrent = safeStorageGet(STORAGE_KEYS.appDataVersion, null); } catch (_) { appDataVersionCurrent = null; }
  const appDataVersionMatches = appDataVersionCurrent === APP_DATA_VERSION;

  let buildVersionCurrent = null;
  try { buildVersionCurrent = safeStorageGet(STORAGE_KEYS.buildVersion, null); } catch (_) { buildVersionCurrent = null; }
  const buildVersionMatches = buildVersionCurrent === BUILD_VERSION;

  const structuralHashExpected = computeStructuralHash();
  let structuralHashCurrent = null;
  try { structuralHashCurrent = safeStorageGet(STORAGE_KEYS.datasetStructuralHash, null); } catch (_) { structuralHashCurrent = null; }
  const structuralHashMatches = structuralHashCurrent === structuralHashExpected;

  const obsoleteMajorMismatch = !buildVersionMatches || !appDataVersionMatches || !structuralHashMatches;
  const staleMinorMismatch = !signatureMatches || !contentVersionMatches;

  const WIPE_COLLECTION_KEYS = [
    STORAGE_KEYS.products,
    STORAGE_KEYS.dealers,
    STORAGE_KEYS.applications,
    STORAGE_KEYS.siteContent,
    STORAGE_KEYS.franchisePackages,
    STORAGE_KEYS.pageTitles,
    STORAGE_KEYS.siteLogo,
    STORAGE_KEYS.migrationSentinel,
  ];

  function versionWrite() {
    try { safeStorageSet(STORAGE_KEYS.buildVersion, BUILD_VERSION); } catch (_) { /* ignore */ }
    try { safeStorageSet(STORAGE_KEYS.deploySignature, DATASET_DEPLOY_SIGNATURE); } catch (_) { /* ignore */ }
    try { safeStorageSet(STORAGE_KEYS.datasetContentVersion, String(DATASET_CONTENT_VERSION)); } catch (_) { /* ignore */ }
    try { safeStorageSet(STORAGE_KEYS.appDataVersion, APP_DATA_VERSION); } catch (_) { /* ignore */ }
    try { safeStorageSet(STORAGE_KEYS.datasetStructuralHash, structuralHashExpected); } catch (_) { /* ignore */ }
  }

  function writeProductionDefaultsOverwrite(applySmartReseed) {
    try {
      if (applySmartReseed) {
        smartReseedPreservingEdits(STORAGE_KEYS.products, defaultProducts);
        smartReseedPreservingEdits(STORAGE_KEYS.dealers, defaultDealers);
        smartReseedPreservingEdits(STORAGE_KEYS.siteContent, defaultSiteContent);
        smartReseedPreservingEdits(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
      } else {
        storageWriteJson(STORAGE_KEYS.products, defaultProducts);
        storageWriteJson(STORAGE_KEYS.dealers, defaultDealers);
        storageWriteJson(STORAGE_KEYS.siteContent, defaultSiteContent);
        storageWriteJson(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
      }
      storageWriteJson(STORAGE_KEYS.applications, defaultApplications);
      storageWriteJson(STORAGE_KEYS.pageTitles, defaultPageTitles);
      seedIfMissing(STORAGE_KEYS.adminAuth, defaultAdminAuth);
      seedIfMissing(STORAGE_KEYS.siteLogo, defaultSiteContent.logoUrl);
    } catch (_) { /* ignore */ }
  }

  if (obsoleteMajorMismatch) {
    try {
      const authKeep = safeStorageGet(STORAGE_KEYS.adminAuth, null);
      for (let wi = 0; wi < WIPE_COLLECTION_KEYS.length; wi++) {
        try { safeStorageRemove(WIPE_COLLECTION_KEYS[wi]); } catch (_) { /* ignore */ }
      }
      if (authKeep !== null) {
        try { safeStorageSet(STORAGE_KEYS.adminAuth, authKeep); } catch (_) { /* ignore */ }
      }
      writeProductionDefaultsOverwrite(false);
    } catch (_) {
      try { writeProductionDefaultsOverwrite(false); } catch (_fatal) { /* ignore */ }
    }
    versionWrite();
  } else if (staleMinorMismatch) {
    try {
      const keysMissing = [];
      const keysLegacyPlaceholder = [];
      const productTest = safeStorageGet(STORAGE_KEYS.products, null);
      if (productTest === null) keysMissing.push(STORAGE_KEYS.products);
      else if (isStorageContentLegacyPlaceholder(STORAGE_KEYS.products, productTest)) keysLegacyPlaceholder.push(STORAGE_KEYS.products);
      const dealerTest = safeStorageGet(STORAGE_KEYS.dealers, null);
      if (dealerTest === null) keysMissing.push(STORAGE_KEYS.dealers);
      else if (isStorageContentLegacyPlaceholder(STORAGE_KEYS.dealers, dealerTest)) keysLegacyPlaceholder.push(STORAGE_KEYS.dealers);
      const appTest = safeStorageGet(STORAGE_KEYS.applications, null);
      if (appTest === null) keysMissing.push(STORAGE_KEYS.applications);
      const contentTest = safeStorageGet(STORAGE_KEYS.siteContent, null);
      if (contentTest === null) keysMissing.push(STORAGE_KEYS.siteContent);
      else if (isStorageContentLegacyPlaceholder(STORAGE_KEYS.siteContent, contentTest)) keysLegacyPlaceholder.push(STORAGE_KEYS.siteContent);
      const authTest = safeStorageGet(STORAGE_KEYS.adminAuth, null);
      if (authTest === null) keysMissing.push(STORAGE_KEYS.adminAuth);
      const franchiseTest = safeStorageGet(STORAGE_KEYS.franchisePackages, null);
      if (franchiseTest === null) keysMissing.push(STORAGE_KEYS.franchisePackages);
      else if (isStorageContentLegacyPlaceholder(STORAGE_KEYS.franchisePackages, franchiseTest)) keysLegacyPlaceholder.push(STORAGE_KEYS.franchisePackages);
      const titleTest = safeStorageGet(STORAGE_KEYS.pageTitles, null);
      if (titleTest === null) keysMissing.push(STORAGE_KEYS.pageTitles);

      if (keysMissing.indexOf(STORAGE_KEYS.products) >= 0) seedIfMissing(STORAGE_KEYS.products, defaultProducts);
      if (keysMissing.indexOf(STORAGE_KEYS.dealers) >= 0) seedIfMissing(STORAGE_KEYS.dealers, defaultDealers);
      if (keysMissing.indexOf(STORAGE_KEYS.applications) >= 0) seedIfMissing(STORAGE_KEYS.applications, defaultApplications);
      if (keysMissing.indexOf(STORAGE_KEYS.siteContent) >= 0) seedIfMissing(STORAGE_KEYS.siteContent, defaultSiteContent);
      if (keysMissing.indexOf(STORAGE_KEYS.adminAuth) >= 0) seedIfMissing(STORAGE_KEYS.adminAuth, defaultAdminAuth);
      const logoTest = safeStorageGet(STORAGE_KEYS.siteLogo, null);
      if (logoTest === null) seedIfMissing(STORAGE_KEYS.siteLogo, defaultSiteContent.logoUrl);
      if (keysMissing.indexOf(STORAGE_KEYS.franchisePackages) >= 0) seedIfMissing(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
      if (keysMissing.indexOf(STORAGE_KEYS.pageTitles) >= 0) seedIfMissing(STORAGE_KEYS.pageTitles, defaultPageTitles);

      if (keysLegacyPlaceholder.indexOf(STORAGE_KEYS.products) >= 0) smartReseedPreservingEdits(STORAGE_KEYS.products, defaultProducts);
      if (keysLegacyPlaceholder.indexOf(STORAGE_KEYS.dealers) >= 0) smartReseedPreservingEdits(STORAGE_KEYS.dealers, defaultDealers);
      if (keysLegacyPlaceholder.indexOf(STORAGE_KEYS.siteContent) >= 0) smartReseedPreservingEdits(STORAGE_KEYS.siteContent, defaultSiteContent);
      if (keysLegacyPlaceholder.indexOf(STORAGE_KEYS.franchisePackages) >= 0) smartReseedPreservingEdits(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);

      if ((keysMissing.length + keysLegacyPlaceholder.length) > 0) {
        try { safeStorageRemove(STORAGE_KEYS.migrationSentinel); } catch (_) { /* ignore */ }
      }
    } catch (_) {
      try { writeProductionDefaultsOverwrite(true); } catch (_fatal) { /* ignore */ }
    }
    versionWrite();
  } else {
    seedIfMissing(STORAGE_KEYS.adminAuth, defaultAdminAuth);
    seedIfMissing(STORAGE_KEYS.siteLogo, defaultSiteContent.logoUrl);
  }

  try { migrateLegacyDealers(); } catch (_) { /* ignore */ }
  try { migrateLegacyProducts(); } catch (_) { /* ignore */ }
  try { migrateLegacySiteContent(); } catch (_) { /* ignore */ }
  try { migrateLegacyFranchiseGallery(); } catch (_) { /* ignore */ }
}

export function getFranchisePackages() {
  const raw = safeStorageGet(STORAGE_KEYS.franchisePackages, null);
  if (raw !== null) {
    const fromStorage = storageReadCollection(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
    if (Array.isArray(fromStorage)) {
      return normalizePackageVisibility(fromStorage).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  }
  try { seedIfMissing(STORAGE_KEYS.franchisePackages, defaultFranchisePackages); } catch (_) { /* ignore */ }
  const out = Array.isArray(defaultFranchisePackages) ? normalizePackageVisibility(defaultFranchisePackages) : [];
  return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Yalnız bayi listesini sunucudan alır; mobilde büyük tam site paketini bekletmez. */
export async function refreshDealersServerFirst() {
  const sync = _getPySyncClient();
  if (!sync || typeof sync.readTable !== "function") {
    return { ok: false, fallback: true, reason: "Veri bağlantısı hazır değil." };
  }
  try {
    const result = await sync.readTable("dealers");
    if (result && result.ok && Array.isArray(result.payload)) {
      const normalized = normalizeDealerNames(result.payload);
      const written = storageWriteJson(STORAGE_KEYS.dealers, normalized);
      return { ok: true, serverFirstApplied: true, written: written, count: normalized.length };
    }
    return { ok: false, fallback: true, status: result && result.status };
  } catch (error) {
    return { ok: false, fallback: true, status: 0 };
  }
}

/** Yalnız bayilik paketlerini sunucudan alır; mobil başvuru sayfasını hızlandırır. */
export async function refreshFranchisePackagesServerFirst() {
  const sync = _getPySyncClient();
  if (!sync || typeof sync.readTable !== "function") {
    return { ok: false, fallback: true, reason: "Veri bağlantısı hazır değil." };
  }
  try {
    const result = await sync.readTable("franchise_packages");
    if (result && result.ok && Array.isArray(result.payload)) {
      const normalized = normalizePackageVisibility(result.payload);
      const written = storageWriteJson(STORAGE_KEYS.franchisePackages, normalized);
      return { ok: true, serverFirstApplied: true, written: written, count: normalized.length };
    }
    return { ok: false, fallback: true, status: result && result.status };
  } catch (error) {
    return { ok: false, fallback: true, status: 0 };
  }
}

function normalizePackageVisibility(packages) {
  return packages.map(function (pkg) {
    if (!pkg || typeof pkg !== "object") return pkg;
    if (!Object.prototype.hasOwnProperty.call(pkg, "active")) return { ...pkg, active: true };
    const value = pkg.active;
    const active = value === true || value === 1 || value === "1" || value === "true" || value === "on";
    return active === value ? pkg : { ...pkg, active };
  });
}

export function saveFranchisePackages(packages) {
  const normalized = normalizePackageVisibility(Array.isArray(packages) ? packages : []);
  _pySyncWriteBestEffort("franchise_packages", normalized);
  return storageWriteJson(STORAGE_KEYS.franchisePackages, normalized, {
    onError: function () {
      console.error("[storage] Bayilik paketleri kaydedilemedi (kota dolu).");
    }
  });
}

export function createFranchisePackage(payload) {
  const packages = storageReadCollection(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
  const nextItem = {
    id: slugify(payload.title || Date.now().toString()),
    order: packages.length + 1,
    active: true,
    mediaType: "image",
    features: [],
    gallery: [],
    ...payload,
  };
  const nextPackages = [nextItem, ...packages];
  saveFranchisePackages(nextPackages);
  return nextItem;
}

export function updateFranchisePackage(packageId, payload) {
  const packages = storageReadCollection(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
  const nextPackages = packages.map((pkg) =>
    pkg.id === packageId ? { ...pkg, ...payload } : pkg
  );
  saveFranchisePackages(nextPackages);
  return nextPackages.find((pkg) => pkg.id === packageId) ?? null;
}

export function deleteFranchisePackage(packageId) {
  const packages = storageReadCollection(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
  const nextPackages = packages.filter((pkg) => pkg.id !== packageId);
  saveFranchisePackages(nextPackages);
}

export function getPageTitles() {
  const raw = safeStorageGet(STORAGE_KEYS.pageTitles, null);
  if (raw !== null) {
    const stored = storageReadObject(STORAGE_KEYS.pageTitles, defaultPageTitles);
    if (stored && typeof stored === "object") {
      return { ...defaultPageTitles, ...stored };
    }
  }
  try { seedIfMissing(STORAGE_KEYS.pageTitles, defaultPageTitles); } catch (_) { /* ignore */ }
  return { ...defaultPageTitles };
}

export function savePageTitles(titles) {
  const current = getPageTitles();
  const next = {
    ...defaultPageTitles,
    ...current,
    ...titles,
  };
  _pySyncWriteBestEffort("page_titles", next);
  return storageWriteJson(
    STORAGE_KEYS.pageTitles,
    next
  );
}

export function getPageTitle(pageKey) {
  const titles = getPageTitles();
  return titles[pageKey] ?? defaultPageTitles[pageKey] ?? { title: pageKey, headerTitle: "", headerSubtitle: "" };
}

export function getCategories() {
  return defaultCategories;
}

export function getProducts() {
  const raw = safeStorageGet(STORAGE_KEYS.products, null);
  if (raw !== null) {
    const fromStorage = storageReadCollection(STORAGE_KEYS.products, defaultProducts);
    if (Array.isArray(fromStorage) && fromStorage.length > 0) return fromStorage;
    if (Array.isArray(fromStorage)) {
      const buildCheck = safeStorageGet(STORAGE_KEYS.buildVersion, null);
      if (buildCheck === null) {
        try { seedIfMissing(STORAGE_KEYS.products, defaultProducts); } catch (_) {}
        return Array.isArray(defaultProducts) ? defaultProducts.slice() : [];
      }
      return fromStorage;
    }
  }
  try { seedIfMissing(STORAGE_KEYS.products, defaultProducts); } catch (_) { /* ignore */ }
  return Array.isArray(defaultProducts) ? defaultProducts.slice() : [];
}

export function saveProducts(products) {
  _pySyncWriteBestEffort("products", products);
  return storageWriteJson(STORAGE_KEYS.products, products);
}

export function deleteProduct(productId) {
  if (!productId) return false;
  const products = getProducts();
  const next = products.filter(function (p) { return p && p.id !== productId; });
  return saveProducts(next);
}

const STANDARD_DEALER_NAME = "Adıyaman Osmanlı Çiğköfte";

const DEMO_DEALER_IDS = new Set([
  "istanbul-bagcilar",
  "ankara-kecioren",
  "izmir-bornova",
  "gaziantep-sehitkamil",
]);

function normalizeDealerNames(dealers) {
  if (!Array.isArray(dealers)) return [];
  return dealers.filter(function (dealer) {
    return dealer && !DEMO_DEALER_IDS.has(String(dealer.id || ""));
  }).map(function (dealer) {
    return dealer && dealer.branchName !== STANDARD_DEALER_NAME
      ? { ...dealer, branchName: STANDARD_DEALER_NAME }
      : dealer;
  });
}

export async function saveFranchisePackagesConfirmed(packages) {
  const normalized = normalizePackageVisibility(Array.isArray(packages) ? packages : []);
  const localOk = storageWriteJson(STORAGE_KEYS.franchisePackages, normalized);
  const sync = _getPySyncClient();
  if (!sync || typeof sync.writeTable !== "function") {
    return { ok: false, localOk: localOk, serverOk: false, offline: true, status: 0 };
  }
  try {
    const result = await sync.writeTable("franchise_packages", normalized);
    return {
      ...(result && typeof result === "object" ? result : {}),
      ok: Boolean(result && result.ok),
      localOk: localOk,
      serverOk: Boolean(result && result.ok),
    };
  } catch (error) {
    return { ok: false, localOk: localOk, serverOk: false, offline: true, status: 0 };
  }
}

export function getDealers() {
  const raw = safeStorageGet(STORAGE_KEYS.dealers, null);
  if (raw !== null) {
    const fromStorage = storageReadCollection(STORAGE_KEYS.dealers, defaultDealers);
    if (Array.isArray(fromStorage) && fromStorage.length > 0) {
      const normalized = normalizeDealerNames(fromStorage);
      if (
        normalized.length !== fromStorage.length ||
        normalized.some((dealer, index) => dealer !== fromStorage[index])
      ) {
        try { storageWriteJson(STORAGE_KEYS.dealers, normalized); } catch (_) {}
      }
      return normalized;
    }
    if (Array.isArray(fromStorage)) {
      const buildCheck = safeStorageGet(STORAGE_KEYS.buildVersion, null);
      if (buildCheck === null) {
        try { seedIfMissing(STORAGE_KEYS.dealers, defaultDealers); } catch (_) {}
        return normalizeDealerNames(defaultDealers);
      }
      return fromStorage;
    }
  }
  // Sunucuya ulaşılamadığında sahte/örnek şubeler göstermeyiz. Gerçek bayi
  // verisi gelene kadar boş liste kullanılır.
  return [];
}

export function saveDealers(dealers) {
  const normalized = normalizeDealerNames(dealers);
  _pySyncWriteBestEffort("dealers", normalized);
  return storageWriteJson(STORAGE_KEYS.dealers, normalized);
}

/**
 * Bayi listesini önce tarayıcıya anında yazar, ardından kalıcı sunucu
 * kaydının sonucunu bekler. Admin paneli böylece kullanıcıya gecikmeden
 * güncellenirken başarısız bir Supabase yazımını da başarılı göstermemiş olur.
 */
export async function saveDealersConfirmed(dealers) {
  const normalized = normalizeDealerNames(Array.isArray(dealers) ? dealers : []);
  const localOk = storageWriteJson(STORAGE_KEYS.dealers, normalized);
  const sync = _getPySyncClient();
  if (!sync || typeof sync.writeTable !== "function") {
    return { ok: false, localOk: localOk, serverOk: false, offline: true, status: 0 };
  }
  try {
    const result = await sync.writeTable("dealers", normalized);
    return {
      ...(result && typeof result === "object" ? result : {}),
      ok: Boolean(result && result.ok),
      localOk: localOk,
      serverOk: Boolean(result && result.ok),
    };
  } catch (error) {
    return {
      ok: false,
      localOk: localOk,
      serverOk: false,
      offline: true,
      status: 0,
      error: error && error.message ? error.message : String(error),
    };
  }
}

export function deleteDealer(dealerId) {
  if (!dealerId) return false;
  const dealers = getDealers();
  const next = dealers.filter(function (d) { return d && d.id !== dealerId; });
  return saveDealers(next);
}

export function getApplications() {
  const raw = safeStorageGet(STORAGE_KEYS.applications, null);
  if (raw !== null) {
    const fromStorage = storageReadCollection(STORAGE_KEYS.applications, defaultApplications);
    if (Array.isArray(fromStorage) && fromStorage.length > 0) return fromStorage;
    if (Array.isArray(fromStorage)) {
      const buildCheck = safeStorageGet(STORAGE_KEYS.buildVersion, null);
      if (buildCheck === null) {
        try { seedIfMissing(STORAGE_KEYS.applications, defaultApplications); } catch (_) {}
        return Array.isArray(defaultApplications) ? defaultApplications.slice() : [];
      }
      return fromStorage;
    }
  }
  try { seedIfMissing(STORAGE_KEYS.applications, defaultApplications); } catch (_) { /* ignore */ }
  return Array.isArray(defaultApplications) ? defaultApplications.slice() : [];
}

export function saveApplications(applications) {
  _pySyncWriteBestEffort("applications", applications);
  return storageWriteJson(STORAGE_KEYS.applications, applications);
}

export function deleteApplication(applicationId) {
  if (!applicationId) return false;
  const applications = getApplications();
  const next = applications.filter(function (a) { return a && a.id !== applicationId; });
  return saveApplications(next);
}

export function createApplication(payload) {
  const applications = getApplications();
  const nextItem = {
    id: `APP-${1000 + applications.length + 1}`,
    submittedAt: new Date().toISOString(),
    status: "Yeni",
    ...payload,
  };
  saveApplications([nextItem, ...applications]);
  return nextItem;
}

function correctKnownTurkishTypos(content) {
  if (!content || typeof content !== "object") return content;
  const corrected = { ...content };
  const replacements = {
    journeyText: [
      "2012 yılında Konya şehrinde ortaklık ile adım attığımız çiğköfte sektörü yolculuğumuza, 2015 yılından itibaren aile şirketi olarak devam etme kararı aldık. Bu işe ilk başladığımız günden bu yana üretimimizi tamamen kendimiz yapıyor, her gün taze ve hijyenik koşullarda hazırlıyoruz.",
      defaultSiteContent.journeyText,
    ],
    aboutStory: [
      "2012 yılında Konya şehrinde ortaklık ile adım attığımız çiğköfte sektörü yolculuğumuza, 2015 yılından itibaren aile şirketi olarak devam etme kararı aldık. Bu işe ilk başladığımız günden bu yana üretimimizi tamamen kendimiz yapıyoruz.",
      defaultSiteContent.aboutStory,
    ],
    qualityText: [
      "İlk 3 yıl boyunca sürekli yeni tarifler deneyerek, bugünkü eşsiz lezzetimize ve yüksek kalitemize ulaştık. Üretim sürecimizde her zaman en üst kalite malzemeler kullandık. Bizim için en büyük öncelik her zaman müşteri memnuniyeti oldu; müşterilerimizi memnun etmek ve onlara en iyisini sunmak için her gün yeni yollar denedik. Bugünlere gelene kadar büyük bir emek ve özveriyle çalıştık.",
      defaultSiteContent.qualityText,
    ],
    aboutQuality: [
      "İlk 3 yıl boyunca sürekli yeni tarifler deneyerek, bugünkü eşsiz lezzetimize ve yüksek kalitemize ulaştık. Üretim sürecimizde her zaman en üst kalite malzemeler kullandık. Bizim için en büyük öncelik her zaman müşteri memnuniyeti oldu.",
      defaultSiteContent.aboutQuality,
    ],
  };
  Object.entries(replacements).forEach(([key, pair]) => {
    if (corrected[key] === pair[0]) corrected[key] = pair[1];
  });
  corrected.homeText = { ...defaultSiteContent.homeText, ...(corrected.homeText || {}) };
  if (corrected.homeText.qualityFeature1Title === "Kaliteli Hammadde") {
    corrected.homeText.qualityFeature1Title = "Kaliteli Ham Madde";
  }
  return corrected;
}

export function getSiteContent() {
  let stored = storageReadObject(STORAGE_KEYS.siteContent, defaultSiteContent);
  stored = correctKnownTurkishTypos(stored);
  // Önceki marka adları tarayıcı hafızasında kalmışsa yeni resmi ada bir kez taşı.
  if (stored && ["Acılı Çiğköfte", "Adıyaman Osmanlı Çiğköfte"].includes(String(stored.brandName || "").trim())) {
    stored = { ...stored, brandName: defaultSiteContent.brandName };
    try { storageWriteJson(STORAGE_KEYS.siteContent, stored); } catch (_) {}
  }
  function looksBrokenCounter(val) {
    if (typeof val !== "string") return true;
    const trimmed = val.trim();
    if (!trimmed) return true;
    if (/^0\b/.test(trimmed)) return true;
    return false;
  }
  const storedHasBrokenCounters = stored && (
    looksBrokenCounter(stored.heroCardProductValue) ||
    looksBrokenCounter(stored.heroCardDealerValue) ||
    looksBrokenCounter(stored.heroCardApplicationValue)
  );
  const hasAllKeys = stored &&
    typeof stored.brandName === "string" &&
    typeof stored.slogan === "string";
  if (hasAllKeys && !storedHasBrokenCounters) return correctKnownTurkishTypos({
    ...defaultSiteContent,
    ...stored,
    homeText: { ...defaultSiteContent.homeText, ...(stored.homeText || {}) },
  });
  try {
    if (storedHasBrokenCounters) {
      const repaired = {
        ...defaultSiteContent,
        ...(stored || {}),
        heroCardProductValue:
          (!looksBrokenCounter(stored?.heroCardProductValue) && stored?.heroCardProductValue) ||
          defaultSiteContent.heroCardProductValue,
        heroCardDealerValue:
          (!looksBrokenCounter(stored?.heroCardDealerValue) && stored?.heroCardDealerValue) ||
          defaultSiteContent.heroCardDealerValue,
        heroCardApplicationValue:
          (!looksBrokenCounter(stored?.heroCardApplicationValue) && stored?.heroCardApplicationValue) ||
          defaultSiteContent.heroCardApplicationValue,
      };
      try { storageWriteJson(STORAGE_KEYS.siteContent, repaired); } catch (_) {}
      return repaired;
    }
    seedIfMissing(STORAGE_KEYS.siteContent, defaultSiteContent);
  } catch (_) { /* ignore */ }
  return correctKnownTurkishTypos({
    ...defaultSiteContent,
    ...(stored || {}),
    homeText: { ...defaultSiteContent.homeText, ...((stored && stored.homeText) || {}) },
  });
}

export function saveSiteContent(content) {
  const currentContent = getSiteContent();
  const next = {
    ...defaultSiteContent,
    ...currentContent,
    ...content,
    homeText: {
      ...defaultSiteContent.homeText,
      ...(currentContent.homeText || {}),
      ...((content && content.homeText) || {}),
    },
  };
  _pySyncWriteBestEffort("site_content", next);
  return storageWriteJson(
    STORAGE_KEYS.siteContent,
    next
  );
}

export function getAdminAuth() {
  const stored = storageReadObject(STORAGE_KEYS.adminAuth, defaultAdminAuth);
  if (stored && typeof stored.username === "string" && typeof stored.password === "string") {
    return stored;
  }
  try { seedIfMissing(STORAGE_KEYS.adminAuth, defaultAdminAuth); } catch (_) { /* ignore */ }
  return { ...defaultAdminAuth, ...stored };
}

export function updateAdminPassword(oldPassword, newPassword) {
  const auth = getAdminAuth();
  if (auth.password !== oldPassword) {
    return { success: false, message: "Eski şifre doğrulanamadı." };
  }

  const nextAuth = {
    ...auth,
    password: newPassword,
  };
  const ok = storageWriteJson(STORAGE_KEYS.adminAuth, nextAuth);
  if (!ok) {
    return { success: false, message: "Şifre güncellenemedi (depolama alanı dolu)." };
  }
  _pySyncWriteBestEffort("admin_auth", nextAuth);
  return { success: true, message: "Şifreniz başarıyla güncellendi." };
}

export function getSiteLogo() {
  try {
    const raw = safeStorageGet(STORAGE_KEYS.siteLogo, null);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string" && parsed.trim()) {
      return parsed.trim();
    }
    return "";
  } catch {
    return "";
  }
}

export function saveSiteLogo(dataUrl) {
  const trimmed = typeof dataUrl === "string" ? dataUrl.trim() : "";
  if (trimmed) {
    _pySyncWriteBestEffort("site_logo", trimmed);
    return storageWriteJson(STORAGE_KEYS.siteLogo, trimmed);
  } else {
    try {
      const sync = typeof window !== "undefined" && window && typeof window.PySyncClient === "object" ? window.PySyncClient : null;
      if (sync && typeof sync.deleteTable === "function") {
        Promise.resolve()
          .then(() => sync.deleteTable("site_logo"))
          .catch(() => {});
      }
    } catch (_) { /* ignore */ }
    safeStorageRemove(STORAGE_KEYS.siteLogo);
    return true;
  }
}

export function getResolvedLogoUrl() {
  const custom = getSiteLogo();
  if (custom) return custom;
  const content = getSiteContent();
  const fromContent = typeof content?.logoUrl === "string" ? content.logoUrl.trim() : "";
  if (fromContent) return fromContent;
  const fromDefault = typeof defaultSiteContent?.logoUrl === "string" ? defaultSiteContent.logoUrl.trim() : "";
  if (fromDefault) return fromDefault;
  return "./images/logo.png";
}

export function categoryLabel(categoryId) {
  return getCategories().find((category) => category.id === categoryId)?.label ?? categoryId;
}

export function formatDate(dateValue) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue));
}

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function statusClassName(status) {
  return `status-${slugify(status)}`;
}

export function createImageId(prefix = "image") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedIfMissing(key, value) {
  try {
    const existing = safeStorageGet(key, null);
    if (existing === null) {
      storageWriteJson(key, value);
    }
  } catch (_) {
    try { storageWriteJson(key, value); } catch (_2) { /* ignore */ }
  }
}

function migrateLegacySiteContent() {
  if (isMigrationDone("migrateLegacySiteContent", 3)) return;
  const storedContent = storageReadObject(STORAGE_KEYS.siteContent, defaultSiteContent);
  const nextContent = { ...storedContent };

  const legacyPairs = [
    [
      "journeyText",
      "2012 yılında geleneksel çiğköfte kültürünü daha kurumsal, daha güvenilir ve daha sürdürülebilir bir yapıyla sunma hedefiyle yola çıktık. Bugün üretim disiplini, güçlü marka kimliği ve büyüyen bayi ağımızla lezzet yolculuğumuzu aynı heyecanla sürdürmeye devam ediyoruz.",
      defaultSiteContent.journeyText,
    ],
    [
      "qualityText",
      "Ham maddeden sunuma kadar tüm süreçlerde kalite, hijyen ve lezzet standardını koruyan bir sistemle çalışıyoruz. Her temas noktasında müşteri memnuniyetini ön planda tutarak güven veren bir marka deneyimi oluşturuyoruz.",
      defaultSiteContent.qualityText,
    ],
    [
      "franchiseText",
      "Lokasyon planlamasından açılış hazırlıklarına, kurumsal kimlik uygulamalarından operasyon desteğine kadar anahtar teslim bir bayilik modeli sunuyoruz. Girişimciler için süreci kolaylaştıran, markamız için standardı koruyan güçlü bir iş ortaklığı yapısı kuruyoruz.",
      defaultSiteContent.franchiseText,
    ],
    [
      "visionPoint1Text",
      "Çiğköftenin köklü lezzet mirasını modern üretim ve sunum anlayışıyla daha geniş kitlelere ulaştırmak.",
      defaultSiteContent.visionPoint1Text,
    ],
    [
      "visionPoint2Text",
      "Kalite, hijyen ve sürdürülebilir hizmet standardıyla sektörde güven veren öncü markalardan biri olmak.",
      defaultSiteContent.visionPoint2Text,
    ],
    [
      "visionPoint3Text",
      "Doğru iş ortaklıkları ve güçlü operasyon yapısıyla bayi ağımızı istikrarlı şekilde büyütmek.",
      defaultSiteContent.visionPoint3Text,
    ],
    [
      "aboutStory",
      "Acılı Çiğköfte, geleneksel tarif mirasını modern üretim disiplini ile buluşturan kurumsal bir lezzet markasıdır. Üretim süreçlerimizde kalite, süreklilik ve standardizasyon temel ilkemizdir.",
      defaultSiteContent.aboutStory,
    ],
    [
      "aboutQuality",
      "Ham madde seçiminden servis noktasına kadar her aşamada hijyen, tazelik ve lezzet bütünlüğünü koruyan bir sistemle çalışıyoruz. Her şubemizde aynı lezzet standardını sürdürmeyi hedefliyoruz.",
      defaultSiteContent.aboutQuality,
    ],
    [
      "aboutVision",
      "Hedefimiz, çiğköfte kültürünü daha geniş kitlelere profesyonel bir marka diliyle taşımak ve güçlü bayi ağımızla ülke genelinde güvenilir bir kurumsal yapı oluşturmaktır.",
      defaultSiteContent.aboutVision,
    ],
    [
      "contactAddress",
      "Merkez Ofis: Atatürk Bulvarı No:120 Kat:4 Çankaya / Ankara",
      defaultSiteContent.contactAddress,
    ],
    [
      "headquartersMapEmbedUrl",
      "https://www.google.com/maps?q=Cankaya%20Ankara&output=embed",
      defaultSiteContent.headquartersMapEmbedUrl,
    ],
    [
      "visionImageUrl",
      "./images/vision.svg",
      defaultSiteContent.visionImageUrl,
    ],
    [
      "franchiseImageUrl",
      "./images/franchise.svg",
      defaultSiteContent.franchiseImageUrl,
    ],
  ];

  let hasChanges = false;

  legacyPairs.forEach(([key, legacyValue, nextValue]) => {
    if (!storedContent[key] || storedContent[key] === legacyValue) {
      nextContent[key] = nextValue;
      hasChanges = true;
    }
  });

  const defaultFoodImageMap = new Map(
    defaultFoodImages.map((image) => [image.id, image])
  );
  const storedFoodImages = Array.isArray(storedContent.foodImages) ? storedContent.foodImages : [];
  const nextFoodImages = storedFoodImages.map((image) => {
    const nextImage = defaultFoodImageMap.get(image.id);
    if (
      nextImage &&
      (image.url !== nextImage.url || image.alt !== nextImage.alt)
    ) {
      hasChanges = true;
      return nextImage;
    }
    return image;
  });

  if (nextFoodImages.length) {
    nextContent.foodImages = nextFoodImages;
  }

  const defaultStoreImageMap = new Map(
    defaultStoreImages.map((image) => [image.id, image])
  );
  const storedStoreImages = Array.isArray(storedContent.storeImages)
    ? storedContent.storeImages
    : [];
  const nextStoreImages = storedStoreImages.map((image) => {
    const nextImage = defaultStoreImageMap.get(image.id);
    if (
      nextImage &&
      (image.url !== nextImage.url || image.alt !== nextImage.alt) &&
      /^\.\/images\/sube-[123]\.svg$/i.test(image.url ?? "")
    ) {
      hasChanges = true;
      return nextImage;
    }
    return image;
  });

  if (nextStoreImages.length) {
    nextContent.storeImages = nextStoreImages;
  }

  if (hasChanges) {
    storageWriteJson(STORAGE_KEYS.siteContent, nextContent);
  }
  writeMigrationSentinel("migrateLegacySiteContent", 3);
}

function migrateLegacyProducts() {
  if (isMigrationDone("migrateLegacyProducts", 2)) return;
  const storedProducts = storageReadCollection(STORAGE_KEYS.products, defaultProducts);
  const localImageById = new Map(
    defaultProducts.map((product) => [product.id, product.image])
  );

  let hasChanges = false;
  const nextProducts = storedProducts.map((product) => {
    const nextImage = localImageById.get(product.id);
    if (nextImage && product.image !== nextImage) {
      hasChanges = true;
      return {
        ...product,
        image: nextImage,
      };
    }
    return product;
  });

  if (hasChanges) {
    storageWriteJson(STORAGE_KEYS.products, nextProducts);
  }
  writeMigrationSentinel("migrateLegacyProducts", 2);
}

function migrateLegacyDealers() {
  if (isMigrationDone("migrateLegacyDealers", 2)) return;
  const storedDealers = storageReadCollection(STORAGE_KEYS.dealers, defaultDealers);
  const defaultDealerImageById = new Map(
    defaultDealers.map((dealer) => [dealer.id, dealer.image])
  );

  let hasChanges = false;
  const nextDealers = storedDealers.map((dealer) => {
    const nextImage = defaultDealerImageById.get(dealer.id);
    if (nextImage && !dealer.image) {
      hasChanges = true;
      return {
        ...dealer,
        image: nextImage,
      };
    }
    return dealer;
  });

  if (hasChanges) {
    storageWriteJson(STORAGE_KEYS.dealers, nextDealers);
  }
  writeMigrationSentinel("migrateLegacyDealers", 2);
}

function migrateLegacyFranchiseGallery() {
  if (isMigrationDone("migrateLegacyFranchiseGallery", 3)) return;
  const stored = storageReadCollection(STORAGE_KEYS.franchisePackages, defaultFranchisePackages);
  let hasChanges = false;
  const next = stored.map(function (pkg) {
    const pkgHasGallery = Array.isArray(pkg.gallery);
    let nextGallery = pkgHasGallery ? pkg.gallery.slice() : [];
    if (!pkgHasGallery) {
      hasChanges = true;
    }
    if (pkg.media && String(pkg.media).trim()) {
      const url = String(pkg.media).trim();
      const exists = nextGallery.some(function (item) { return item && String(item.url) === url; });
      if (!exists) {
        nextGallery.unshift({
          id: createImageId("pkg"),
          url: url,
          alt: String(pkg.title || ""),
        });
        hasChanges = true;
      }
    }
    const cleanGallery = [];
    const seen = new Set();
    for (let gi = 0; gi < nextGallery.length; gi++) {
      const it = nextGallery[gi];
      if (!it || !it.url) continue;
      const u = String(it.url);
      if (seen.has(u)) continue;
      seen.add(u);
      cleanGallery.push(it);
    }
    if (!hasChanges && cleanGallery.length !== nextGallery.length) {
      hasChanges = true;
    }
    if (!pkgHasGallery || cleanGallery.length !== (Array.isArray(pkg.gallery) ? pkg.gallery.length : -1)) {
      return {
        ...pkg,
        gallery: cleanGallery,
      };
    }
    return pkg;
  });
  if (hasChanges) {
    saveFranchisePackages(next);
  }
  writeMigrationSentinel("migrateLegacyFranchiseGallery", 3);
}
