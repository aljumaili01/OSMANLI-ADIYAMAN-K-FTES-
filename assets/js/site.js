import {
  categoryLabel,
  createApplication,
  defaultProducts,
  defaultSiteContent,
  getApplications,
  getCategories,
  getDealers,
  getFranchisePackages,
  getPageTitle,
  getProducts,
  getSiteContent,
  initializeData,
  initializeDataServerFirstIfPossible,
} from "./shared/data.js?v=20260820-v5";
import { CURRENT_DATA_VERSION } from "./shared/data.js?v=20260820-v5";
const EXPECTED_BUILD = "20260820-v5";
if (typeof CURRENT_DATA_VERSION === "string" && CURRENT_DATA_VERSION !== EXPECTED_BUILD) {
  try { window.location.reload(true); } catch (_) { try { location.href = location.href; } catch (__) {} }
}

"use strict";

function __extractCurrentPath() {
  try {
    if (typeof window !== "undefined" && window.location && window.location.pathname) {
      const parts = String(window.location.pathname).split("/");
      const last = parts.pop() || parts.pop() || "index.html";
      return last && last.trim() ? last : "index.html";
    }
  } catch (_) {}
  return "index.html";
}
let currentPath = __extractCurrentPath();
if (typeof window !== "undefined") {
  try { window.__CKFT_CURRENT_PATH__ = currentPath; } catch (_) {}
}

/* ============================================================================
 *  3 KATMANLI BAŞLATMA GÜVENLİĞİ:
 *  Katman 1: Async IIFE (server-first sync) → DENE
 *  Katman 2: DOMContentLoaded sync fallback → Render henüz yapılmadıysa TETİKLE
 *  Katman 3: window.load + 250ms → Sayaçlar hala 0/boş ise FORCE-RENDER
 * ========================================================================== */
(function bootstrapSiteAsync() {
  function runFlow() {
    const initPromise = (typeof initializeDataServerFirstIfPossible === "function")
      ? initializeDataServerFirstIfPossible()
      : Promise.resolve({ serverFirstApplied: false, fallback: true, reason: "Yöntem yok" });

    initPromise
      .then(function (initResult) {
        try {
          if (window && window.console && typeof window.console.info === "function") {
            window.console.info("[site] Server-first init:", initResult && (initResult.serverFirstApplied ? ("Sunucu " + (initResult.keysWritten || 0) + " anahtar yüklendi.") : (initResult.reason || "LocalStorage kullanılıyor")));
            window.__CKFT_INIT_RESULT__ = initResult;
          }
        } catch (_logErr) { /* ignore */ }
        try { initializeData(); } catch (_initErr) { /* her durumda veri katmanını tohumlama garantisi */ }
        if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
          try {
            const storageBuild = localStorage.getItem("ckft_corporate_build_version");
            if (storageBuild !== EXPECTED_BUILD) {
              try { initializeData(); } catch (_) {}
              try {
                const retryBuild = localStorage.getItem("ckft_corporate_build_version");
                if (retryBuild !== EXPECTED_BUILD) {
                  try { window.location.reload(true); } catch (_reloadErr) {
                    try { location.href = location.href; } catch (__) {}
                  }
                  return;
                }
              } catch (_retryErr) {}
            }
          } catch (_chkErr) { /* ignore */ }
        }
        __safeMainRender("async-bootstrap");
      })
      .catch(function (fatal) {
        try { console.warn("[site] Init başarısız, localStorage fallback:", (fatal && fatal.message) || fatal); } catch (_) {}
        try { initializeData(); } catch (_) {}
        __safeMainRender("catch-fallback");
      });
  }
  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFlow, { once: true });
  } else {
    runFlow();
  }
})();

(function bootstrapSiteSyncFallback() {
  function syncFallback() {
    try {
      if (window && typeof window.__CKFT_MAIN_RENDERED__ === "boolean" && window.__CKFT_MAIN_RENDERED__ === true) return;
      try { initializeData(); } catch (_) {}
      __safeMainRender("domcontentloaded-sync-fallback");
    } catch (_fatalSync) {
      try { console.warn("[site] Sync fallback da başarısız, force render:", (_fatalSync && _fatalSync.message) || _fatalSync); } catch (_) {}
      try { initializeData(); } catch (_) {}
      try { __safeMainRender("ultimate-fallback"); } catch (__) {}
    }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", syncFallback, { once: true });
    } else {
      syncFallback();
    }
    window.addEventListener("load", function () {
      setTimeout(function () {
        try {
          const metricsStillZero = (function () {
            const pEl = document.querySelector("#brand-highlight-products");
            const dEl = document.querySelector("#brand-highlight-dealers");
            const aEl = document.querySelector("#brand-highlight-applications");
            if (pEl && /^\s*0\s*$/.test(pEl.textContent || "")) return true;
            if (dEl && /^\s*0\s*$/.test(dEl.textContent || "")) return true;
            if (aEl && /^\s*0\s*$/.test(aEl.textContent || "")) return true;
            if (pEl && !String(pEl.textContent || "").trim()) return true;
            return false;
          })();
          if (metricsStillZero) {
            try { initializeData(); } catch (_) {}
            try { __safeMainRender("load-zerocheck-recovery"); } catch (_) {}
          }
        } catch (_ignore) {}
      }, 250);
    }, { once: true });
  }
})();

function __safeMainRender(sourceTag) {
  try {
    currentPath = __extractCurrentPath();
    if (typeof window !== "undefined") {
      window.__CKFT_CURRENT_PATH__ = currentPath;
      window.__CKFT_MAIN_RENDERED__ = true;
      window.__CKFT_LAST_RENDER_SOURCE__ = sourceTag || "unknown";
    }
    mainSiteRender();
  } catch (renderErr) {
    try { console.error("[site] __safeMainRender başarısız (" + (sourceTag || "unknown") + "):", (renderErr && renderErr.message) || renderErr); } catch (_) {}
    try { initializeData(); } catch (_) {}
    try { mainSiteRender(); } catch (_fatal) {}
  }
}

function mainSiteRender() {
  currentPath = __extractCurrentPath();
  if (typeof window !== "undefined") {
    window.__CKFT_CURRENT_PATH__ = currentPath;
  }
  try { renderLayout(); } catch (_) {}
  try { renderHome(); } catch (_) {}
  try { renderProductsPage(); } catch (_) {}
  try { renderAboutPage(); } catch (_) {}
  try { renderDealersPage(); } catch (_) {}
  try { renderFranchisePage(); } catch (_) {}
  try { renderFranchiseForm(); } catch (_) {}
  try { renderWhyUsSection(); } catch (_) {}
  try { renderContactPage(); } catch (_) {}
  try { renderWhatsAppButton(); } catch (_) {}
  try {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      if (!window.__CKFT_STORAGE_LISTENER_ATTACHED__) {
        window.addEventListener("storage", function () {
          try { currentPath = __extractCurrentPath(); } catch (_) {}
          try { rerenderAllDynamicSections(); } catch (_rerenderErr) {
            try { console.warn("[site] storage-event yeniden render başarısız:", (_rerenderErr && _rerenderErr.message) || _rerenderErr); } catch (__) {}
          }
        });
        window.__CKFT_STORAGE_LISTENER_ATTACHED__ = true;
      }
    }
  } catch (_) {}
}

function renderLayout() {
  const content = getSiteContent();
  const logoLocalPath = "/images/logo.png";
  const header = document.querySelector("#site-header");
  const footer = document.querySelector("#site-footer");
  const pageTitleData = getPageTitle(currentPath || __extractCurrentPath());
  updateDocumentTitle(content.brandName, pageTitleData.title);
  applyPageHeaderTitles(pageTitleData);

  if (header) {
    header.innerHTML = `
      <header class="${currentPath === "index.html" ? "brand-hero" : "bg-[#6B1818]"} text-white">
        <div class="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <nav class="glass-card flex items-center justify-between rounded-full border border-white/10 px-4 py-3 sm:px-6 sm:py-4">
            <a href="/index.html" class="flex items-center justify-center gap-3 self-center">
              <span class="relative inline-flex h-14 min-h-[3.5rem] w-14 min-w-[3.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-red-100 bg-white shadow-sm">
                <img
                  src="${logoLocalPath}"
                  alt="${content.brandName} logosu"
                  class="block h-full w-full rounded-full object-cover"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
              </span>
              <div class="flex flex-col justify-center">
                <p class="text-lg font-extrabold tracking-[0.12em] text-[#6B1818]">${content.brandName}</p>
                <p class="text-xs uppercase tracking-[0.2em] text-stone-500">Kurumsal Lezzet Markası</p>
              </div>
            </a>
            <button id="mobile-menu-button" type="button" class="self-center rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-[#6B1818] md:hidden">
              Menü
            </button>
            <div class="hidden self-center items-center gap-6 text-sm font-medium md:flex">
              ${navLinks()}
            </div>
          </nav>
          <div id="mobile-menu" class="hidden mt-4 rounded-3xl border border-white/10 bg-[#FDFBF7] p-4 text-sm md:hidden">
            <div class="flex flex-col gap-3">
              ${navLinks("block rounded-2xl px-3 py-2 text-[#6B1818] hover:bg-[#F7F4EF]")}
            </div>
          </div>
        </div>
      </header>
    `;

    const mobileButton = document.querySelector("#mobile-menu-button");
    const mobileMenu = document.querySelector("#mobile-menu");
    mobileButton?.addEventListener("click", () => {
      mobileMenu?.classList.toggle("hidden");
    });
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="bg-[#F7F4EF] py-14">
        <div class="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[1fr_1fr_1.1fr] lg:px-8">
          <div>
            <div class="flex items-center gap-3">
              <span class="relative inline-flex h-16 min-h-[4rem] w-16 min-w-[4rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-red-100 bg-white shadow-sm">
                <img
                  src="${logoLocalPath}"
                  alt="${content.brandName} logosu"
                  class="block h-full w-full rounded-full object-cover"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
              </span>
              <div>
                <p class="text-lg font-extrabold tracking-[0.12em] text-[#6B1818]">${content.brandName}</p>
                <p class="text-xs uppercase tracking-[0.2em] text-stone-500">Kurumsal Marka Kimliği</p>
              </div>
            </div>
            <p class="mt-4 text-sm leading-7 text-stone-600">
              ${content.slogan}. Güçlü bayi yapısı, standart üretim ve sürdürülebilir kalite anlayışıyla hizmet veriyoruz.
            </p>
          </div>
          <div class="space-y-3 text-sm text-stone-600">
            <p class="font-semibold text-stone-900">${content.headquartersTitle}</p>
            <p>Telefon: ${content.contactPhone}</p>
            <p>E-posta: ${content.contactEmail}</p>
            <p>Çalışma Saatleri: ${content.contactHours}</p>
            <p>${content.contactAddress}</p>
          </div>
          <div>
            <p class="font-semibold text-stone-900">Kurumsal Bilgi Alanı</p>
            <div class="mt-3 rounded-[28px] border border-dashed border-stone-300 bg-[#FDFBF7] p-6 text-sm leading-7 text-stone-500">
              Harita ve sosyal medya alanı
              <br />
              Instagram • Facebook • LinkedIn kurumsal hesapları
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

function renderHome() {
  const heroTitle = document.querySelector("#hero-title");
  if (!heroTitle) return;

  const content = getSiteContent();
  heroTitle.textContent = content.slogan;
  setText("#hero-description", content.heroDescription);
  setText("#brand-story-preview", content.heroCardSummaryText);

  const safeProducts = Array.isArray(getProducts()) ? getProducts().slice() : [];
  const safeDealers = Array.isArray(getDealers()) ? getDealers().slice() : [];
  const safeApplications = Array.isArray(getApplications()) ? getApplications().slice() : [];
  const activeProductCount = safeProducts.filter(function (p) { return p && p.active !== false; }).length || 0;
  const activeDealerCount = safeDealers.filter(function (d) { return d && d.active !== false; }).length || 0;
  const recentAppCount = safeApplications.length || 0;

  const defaultProductText = (defaultSiteContent && defaultSiteContent.heroCardProductValue) || "8 vitrin ürünü";
  const defaultDealerText = (defaultSiteContent && defaultSiteContent.heroCardDealerValue) || "4 aktif bayi noktası";
  const defaultAppText = (defaultSiteContent && defaultSiteContent.heroCardApplicationValue) || "2 güncel başvuru";

  const productCountFinal = activeProductCount > 0
    ? (activeProductCount + " vitrin ürünü")
    : ((content.heroCardProductValue && !/^\s*0\b/.test(content.heroCardProductValue) && content.heroCardProductValue) || defaultProductText);
  const dealerCountFinal = activeDealerCount > 0
    ? (activeDealerCount + " aktif bayi noktası")
    : ((content.heroCardDealerValue && !/^\s*0\b/.test(content.heroCardDealerValue) && content.heroCardDealerValue) || defaultDealerText);
  const appCountFinal = recentAppCount > 0
    ? (recentAppCount + " güncel başvuru")
    : ((content.heroCardApplicationValue && !/^\s*0\b/.test(content.heroCardApplicationValue) && content.heroCardApplicationValue) || defaultAppText);

  setText("#brand-highlight-products-label", content.heroCardProductLabel || "Ürün Portföyü");
  setText("#brand-highlight-products", productCountFinal);
  setText("#brand-highlight-dealers-label", content.heroCardDealerLabel || "Bayi Ağı");
  setText("#brand-highlight-dealers", dealerCountFinal);
  setText("#brand-highlight-applications-label", content.heroCardApplicationLabel || "Başvuru Akışı");
  setText("#brand-highlight-applications", appCountFinal);
  setText("#brand-summary-label", content.heroCardSummaryLabel || "Marka Özeti");
  setImage("#journey-image", content.journeyImageUrl, content.journeyImageAlt);
  setImage("#vision-image", content.visionImageUrl, content.visionImageAlt);
  setImage("#franchise-image", content.franchiseImageUrl, content.franchiseImageAlt);
  setText("#journey-title", content.journeyTitle);
  setText("#journey-text", content.journeyText);
  setText("#quality-title", content.qualityTitle);
  setText("#quality-text", content.qualityText);
  setText("#franchise-title", content.franchiseTitle);
  setText("#franchise-slogan", content.franchiseSlogan);
  setText("#franchise-text", content.franchiseText);
  setText("#vision-title", content.visionTitle);
  setText("#vision-point-1-title", content.visionPoint1Title);
  setText("#vision-point-1-text", content.visionPoint1Text);
  setText("#vision-point-2-title", content.visionPoint2Title);
  setText("#vision-point-2-text", content.visionPoint2Text);
  setText("#vision-point-3-title", content.visionPoint3Title);
  setText("#vision-point-3-text", content.visionPoint3Text);

  const previewGrid = document.querySelector("#popular-products");
  if (previewGrid) {
    const baseProducts = (safeProducts && safeProducts.length) ? safeProducts : (Array.isArray(defaultProducts) ? defaultProducts.slice() : []);
    const activeProducts = baseProducts.filter(function (product) { return product && product.active !== false; });
    const showcaseProducts = (activeProducts.length ? activeProducts : baseProducts).slice(0, 3);
    if (showcaseProducts.length === 0) {
      previewGrid.innerHTML = '<p class="col-span-full py-10 text-center text-sm text-stone-500">Vitrin ürünleri hazırlanıyor.</p>';
    } else {
      previewGrid.innerHTML = showcaseProducts
        .map(
          (product) => `
        <article class="site-card overflow-hidden rounded-[28px] border border-white/60 bg-white">
          <img src="${product.image}" alt="${product.name}" class="h-52 w-full object-cover" onerror="this.style.display='none'" />
          <div class="space-y-4 p-5">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">${categoryLabel(product.category)}</p>
              <h3 class="mt-2 text-xl font-bold text-stone-900">${product.name}</h3>
            </div>
            <p class="text-sm leading-7 text-stone-600">${product.description}</p>
            <div class="flex flex-wrap gap-2">
              ${(product.badges || [])
                .map(
                  (badge) =>
                    `<span class="rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">${badge}</span>`
                )
                .join("")}
            </div>
          </div>
        </article>
      `
        )
        .join("");
    }
  }

  try {
    renderImageGallery(
      "#food-gallery",
      content.foodImages,
      "Yemek galerisi henüz eklenmedi."
    );
  } catch (_) {}

  try { renderHomepageDealers(content); } catch (_) {}
  setText("#headquarters-map-description", `${content.contactAddress} adresindeki genel müdürlüğümüzü harita üzerinden inceleyebilirsiniz.`);
  setMapFrame("#headquarters-map-frame", content.headquartersMapEmbedUrl);
}

function renderProductsPage() {
  const filters = document.querySelector("#product-filters");
  const grid = document.querySelector("#product-grid");
  if (!filters || !grid) return;

  const state = { activeCategory: "all" };

  const draw = () => {
    filters.innerHTML = getCategories()
      .map(
        (category) => `
          <button
            type="button"
            data-category="${category.id}"
            class="rounded-full border px-4 py-2 text-sm font-semibold transition ${
              state.activeCategory === category.id
                ? "border-[#6B1818] bg-[#6B1818] text-white"
                : "border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:text-[#6B1818]"
            }"
          >
            ${category.label}
          </button>
        `
      )
      .join("");

    const filtered =
      state.activeCategory === "all"
        ? getProducts().filter((product) => product.active)
        : getProducts().filter((product) => product.active && product.category === state.activeCategory);

    grid.innerHTML = filtered
      .map(
        (product) => `
          <article class="site-card fade-in overflow-hidden rounded-[28px] border border-white/60 bg-white">
            <img src="${product.image}" alt="${product.name}" class="h-56 w-full object-cover" />
            <div class="space-y-4 p-6">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">${categoryLabel(product.category)}</p>
                <h3 class="mt-2 text-2xl font-bold text-stone-900">${product.name}</h3>
              </div>
              <p class="text-sm leading-7 text-stone-600">${product.description}</p>
              <div class="flex flex-wrap gap-2">
                ${product.badges
                  .map(
                    (badge) =>
                      `<span class="rounded-full bg-[#F7F4EF] px-3 py-2 text-xs font-semibold text-[#6B1818]">${badge}</span>`
                  )
                  .join("")}
              </div>
            </div>
          </article>
        `
      )
      .join("");

    filters.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeCategory = button.dataset.category ?? "all";
        draw();
      });
    });
  };

  draw();
}

function renderAboutPage() {
  const story = document.querySelector("#about-story");
  if (!story) return;

  const content = getSiteContent();
  story.textContent = content.aboutStory;
  document.querySelector("#about-quality").textContent = content.aboutQuality;
  document.querySelector("#about-vision").textContent = content.aboutVision;
}

function renderDealersPage() {
  const dealerList = document.querySelector("#dealer-list");
  if (!dealerList) return;

  const escapeAttr = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const resolveDealerImage = (dealer) => {
    const raw = dealer?.image ?? "";
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) return "";
    return trimmed;
  };

  const dealerImageMarkup = (dealer) => {
    const src = resolveDealerImage(dealer);
    if (src) {
      return `
        <img
          src="${escapeAttr(src)}"
          alt="${escapeAttr(dealer.branchName)} şube görseli"
          class="h-full w-full object-cover"
        />
      `;
    }
    return `
      <div class="flex h-full w-full items-center justify-center bg-[#F7F4EF] px-5 text-center">
        <div class="space-y-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p class="text-xs font-medium text-stone-400">Şube görseli henüz eklenmedi</p>
        </div>
      </div>
    `;
  };

  const draw = () => {
    const dealers = getDealers();

    dealerList.innerHTML = dealers
      .map(
        (dealer) => `
          <article class="site-card overflow-hidden rounded-[28px] border border-stone-200 bg-white">
            <div class="flex h-full flex-col md:flex-row">
              <div class="aspect-[4/3] w-full shrink-0 overflow-hidden border-b border-stone-200 bg-[#F7F4EF] md:aspect-auto md:h-full md:w-[280px] md:border-b-0 md:border-r">
                ${dealerImageMarkup(dealer)}
              </div>
              <div class="flex flex-1 flex-col justify-between p-6">
                <div class="space-y-4">
                  <div>
                    <p class="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">${escapeAttr(dealer.city)} / ${escapeAttr(dealer.district)}</p>
                    <h3 class="mt-2 text-xl font-extrabold text-stone-900">${escapeAttr(dealer.branchName)}</h3>
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Adres</p>
                    <p class="text-sm leading-7 text-stone-600">${escapeAttr(dealer.address)}</p>
                  </div>
                </div>
                <div class="mt-6 space-y-1">
                  <p class="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">İletişim</p>
                  <a href="tel:${escapeAttr(dealer.phone.replace(/\s/g, ''))}" class="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#F7F4EF] px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-[#F0EAE0]">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#6B1818]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    ${escapeAttr(dealer.phone)}
                  </a>
                </div>
              </div>
            </div>
          </article>
        `
      )
      .join("");

    if (!dealers.length) {
      dealerList.innerHTML = `
        <div class="rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 text-sm text-stone-500 lg:col-span-2">
          Henüz bayi kaydı bulunmamaktadır.
        </div>
      `;
    }
  };

  draw();
}

function renderDealersGallery() {
  const container = document.querySelector("#dealers-gallery");
  if (!container) return;

  const images = getStoreGalleryImages();

  if (!images.length) {
    renderDealersGalleryFallback(container);
    return;
  }

  container.innerHTML = images
    .map(
      (image, index) => `
        <article class="site-card overflow-hidden rounded-[28px] border border-stone-200 bg-white">
          <div class="relative">
            <img src="${image.url}" alt="${image.alt}" class="h-64 w-full object-cover" />
            <span class="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold tracking-[0.16em] text-[#6B1818]">
              Şube Görseli ${index + 1}
            </span>
          </div>
          <div class="space-y-2 p-5">
            <p class="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Bayi Galerisi</p>
            <p class="text-sm font-semibold leading-6 text-stone-800">${image.alt}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderFranchiseForm() {
  const form = document.querySelector("#franchise-form");
  if (!form) return;

  const feedback = document.querySelector("#franchise-feedback");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const packageId = formData.get("packageSelect")?.toString().trim() ?? "";
    const packages = getFranchisePackages();
    const selectedPackage = packages.find((pkg) => pkg.id === packageId);

    const payload = {
      fullName: formData.get("fullName")?.toString().trim() ?? "",
      phone: formData.get("phone")?.toString().trim() ?? "",
      email: formData.get("email")?.toString().trim() ?? "",
      cityDistrict: formData.get("cityDistrict")?.toString().trim() ?? "",
      message: formData.get("message")?.toString().trim() ?? "",
      packageId,
      packageTitle: selectedPackage?.title ?? "",
      packagePrice: selectedPackage?.price ?? "",
    };

    if (!payload.fullName || !payload.phone || !payload.email || !payload.cityDistrict || !payload.message) {
      feedback.textContent = "Lütfen tüm alanları eksiksiz doldurunuz.";
      return;
    }

    createApplication(payload);
    form.reset();
    feedback.textContent = "Başvurunuz başarıyla alındı. Ekibimiz en kısa sürede sizinle iletişime geçecektir.";
  });
}

function renderWhyUsSection() {
  const title = document.querySelector("#why-us-title");
  if (!title) return;

  const content = getSiteContent();
  title.textContent = content.whyUsTitle;
  document.querySelector("#why-us-text-1").textContent = content.whyUsText1;
  document.querySelector("#why-us-text-2").textContent = content.whyUsText2;
  document.querySelector("#why-us-text-3").textContent = content.whyUsText3;
}

function renderContactPage() {
  const contactBox = document.querySelector("#contact-box");
  if (!contactBox) return;

  const content = getSiteContent();
  contactBox.innerHTML = `
    <div class="space-y-4 rounded-[32px] bg-white p-6">
      <div>
        <p class="text-sm font-bold uppercase tracking-[0.22em] text-amber-700">${content.headquartersTitle}</p>
        <h2 class="mt-2 text-3xl font-extrabold text-stone-900">${content.brandName} İletişim Bilgileri</h2>
      </div>
      <div class="space-y-3 text-sm leading-7 text-stone-600">
        <p><strong>Telefon:</strong> ${content.contactPhone}</p>
        <p><strong>E-posta:</strong> ${content.contactEmail}</p>
        <p><strong>Çalışma Saatleri:</strong> ${content.contactHours}</p>
        <p><strong>Adres:</strong> ${content.contactAddress}</p>
      </div>
    </div>
    <div class="overflow-hidden rounded-[32px] border border-stone-200 bg-white">
      <iframe
        src="${content.headquartersMapEmbedUrl}"
        title="Genel Müdürlük Haritası"
        class="h-[360px] w-full"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
  `;
}

function renderImageGallery(selector, images, emptyMessage, fallbackImages = []) {
  const container = document.querySelector(selector);
  if (!container) return;

  const galleryImages = normalizeGalleryImages(images, "Galeri görseli");
  const fallbackGalleryImages = normalizeGalleryImages(
    fallbackImages,
    "Varsayılan galeri görseli"
  );
  const displayImages = galleryImages.length ? galleryImages : fallbackGalleryImages;

  if (!displayImages.length) {
    container.innerHTML = `
      <div class="rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 text-sm text-stone-500 sm:col-span-2 xl:col-span-3">
        ${emptyMessage}
      </div>
    `;
    return;
  }

  container.innerHTML = displayImages
    .map(
      (image) => `
        <article class="site-card overflow-hidden rounded-[28px] border border-white/60 bg-white">
          ${renderGalleryMedia(image.url, image.alt)}
          <div class="p-4">
            <p class="text-sm font-semibold text-stone-800">${image.alt}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderGalleryMedia(url, alt) {
  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url) || url.startsWith("data:video");
  if (isVideo) {
    return `
      <video
        src="${escapeAttribute(url)}"
        title="${escapeAttribute(alt)}"
        class="h-64 w-full object-cover"
        controls
        muted
        loop
        playsinline
        preload="metadata"
      ></video>
    `;
  }
  return `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}" class="h-64 w-full object-cover" />`;
}

function getStoreGalleryImages() {
  return normalizeDealerImages(getDealers());
}

function normalizeGalleryImages(images, defaultAltPrefix) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image, index) => {
      const url = resolveGalleryImageUrl(image);
      if (!url) return null;

      const alt = resolveGalleryImageAlt(image, defaultAltPrefix, index);
      const id = resolveGalleryImageId(image, index);

      return {
        id,
        url,
        alt,
      };
    })
    .filter(Boolean);
}

function getStoredSiteContent() {
  const defaultContent = getSiteContent();

  try {
    const rawValue = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!rawValue) return defaultContent;

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return defaultContent;

    return {
      ...defaultContent,
      ...parsed,
    };
  } catch {
    return defaultContent;
  }
}

function resolveGalleryImageUrl(image) {
  if (typeof image === "string") {
    return image.trim();
  }

  return (
    image?.url?.toString().trim() ??
    image?.dataUrl?.toString().trim() ??
    image?.src?.toString().trim() ??
    image?.image?.toString().trim() ??
    image?.imageUrl?.toString().trim() ??
    image?.path?.toString().trim() ??
    image?.value?.toString().trim() ??
    ""
  );
}

function resolveGalleryImageAlt(image, defaultAltPrefix, index) {
  if (typeof image === "string") {
    return `${defaultAltPrefix} ${index + 1}`;
  }

  return (
    image?.alt?.toString().trim() ||
    image?.title?.toString().trim() ||
    image?.name?.toString().trim() ||
    image?.label?.toString().trim() ||
    image?.description?.toString().trim() ||
    `${defaultAltPrefix} ${index + 1}`
  );
}

function resolveGalleryImageId(image, index) {
  if (typeof image === "string") {
    return `gallery-image-${index + 1}`;
  }

  return (
    image?.id?.toString().trim() ||
    image?.key?.toString().trim() ||
    `gallery-image-${index + 1}`
  );
}

function normalizeDealerImages(dealers) {
  if (!Array.isArray(dealers)) return [];

  return dealers
    .flatMap((dealer, dealerIndex) => {
      const directImage = normalizeGalleryImages(
        dealer?.image ? [dealer.image] : [],
        dealer?.branchName?.toString().trim() || "Şube görseli"
      ).map((image) => ({
        ...image,
        alt:
          dealer?.branchName?.toString().trim()
            ? `${dealer.branchName} şube görseli`
            : image.alt,
      }));

      const galleryImages = normalizeGalleryImages(
        Array.isArray(dealer?.images) ? dealer.images : [],
        dealer?.branchName?.toString().trim() || "Şube görseli"
      ).map((image, imageIndex) => ({
        ...image,
        alt:
          dealer?.branchName?.toString().trim()
            ? `${dealer.branchName} - Görsel ${imageIndex + 1}`
            : image.alt,
      }));

      return [...directImage, ...galleryImages].map((image, imageIndex) => ({
        ...image,
        id: image.id || `dealer-image-${dealerIndex + 1}-${imageIndex + 1}`,
      }));
    })
    .filter((image) => image.url);
}

function renderDealersGalleryFallback(container) {
  container.innerHTML = `
    <article class="rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 sm:col-span-2 xl:col-span-3">
      <div class="max-w-3xl space-y-3">
        <p class="text-sm font-bold uppercase tracking-[0.2em] text-amber-700">Bayi Galerisi</p>
        <h3 class="text-2xl font-extrabold text-stone-900">Henüz şube görseli eklenmedi</h3>
        <p class="text-sm leading-7 text-stone-600">
          Yönetim panelinden yüklenecek şube ve mağaza görselleri bu alanda otomatik olarak listelenecektir.
        </p>
      </div>
    </article>
  `;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

function setMapFrame(selector, src) {
  const frame = document.querySelector(selector);
  if (frame) {
    frame.src = resolveMapEmbedSrc(src);
  }
}

function setImage(selector, src, alt) {
  const image = document.querySelector(selector);
  if (image) {
    image.src = src;
    image.alt = alt;
  }
}

function renderHomepageDealers(content) {
  const container = document.querySelector("#homepage-dealers");
  if (!container) return;

  const escapeAttr = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const resolveDealerImage = (dealer) => {
    const raw = dealer?.image ?? "";
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) return "";
    return trimmed;
  };

  const dealerImageMarkup = (dealer) => {
    const src = resolveDealerImage(dealer);
    if (src) {
      return `
        <img
          src="${escapeAttr(src)}"
          alt="${escapeAttr(dealer.branchName)} şube görseli"
          class="h-full w-full object-cover"
        />
      `;
    }
    return `
      <div class="flex h-full w-full items-center justify-center bg-[#F7F4EF] px-5 text-center">
        <div class="space-y-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <p class="text-xs font-medium text-stone-400">Şube görseli henüz eklenmedi</p>
        </div>
      </div>
    `;
  };

  container.innerHTML = getDealers()
    .slice(0, 4)
    .map(
      (dealer) => `
        <article class="site-card overflow-hidden rounded-[28px] border border-stone-200 bg-white">
          <div class="aspect-[16/10] w-full overflow-hidden border-b border-stone-200 bg-[#F7F4EF]">
            ${dealerImageMarkup(dealer)}
          </div>
          <div class="space-y-3 p-5">
            <p class="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">${escapeAttr(dealer.city)} / ${escapeAttr(dealer.district)}</p>
            <h3 class="text-xl font-extrabold text-stone-900">${escapeAttr(dealer.branchName)}</h3>
            <p class="text-sm leading-7 text-stone-600">${escapeAttr(dealer.address)}</p>
            <a href="tel:${escapeAttr(dealer.phone.replace(/\s/g, ''))}" class="inline-flex items-center gap-2 rounded-2xl bg-[#F7F4EF] px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-[#F0EAE0]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#6B1818]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              ${escapeAttr(dealer.phone)}
            </a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderWhatsAppButton() {
  const button = document.querySelector("#whatsapp-floating-button");
  if (!button) return;

  const content = getSiteContent();
  const phone = (content.whatsappPhone ?? "").replace(/\D/g, "");
  const message = encodeURIComponent("Merhaba, bayilik hakkında bilgi almak istiyorum");
  button.href = `https://wa.me/${phone}?text=${message}`;
}

function resolveMapEmbedSrc(value) {
  const trimmed = value?.toString().trim() ?? "";
  if (!trimmed) return "";

  const iframeSrcMatch = trimmed.match(/src=(["'])(.*?)\1/i);
  if (iframeSrcMatch?.[2]) {
    return iframeSrcMatch[2].trim();
  }

  return trimmed;
}

function rerenderAllDynamicSections() {
  renderLayout();
  renderHome();
  renderProductsPage();
  renderAboutPage();
  renderDealersPage();
  renderFranchisePage();
  renderWhyUsSection();
  renderContactPage();
  renderWhatsAppButton();
}

function updateDocumentTitle(brandName, customPageTitle) {
  const defaultTitles = {
    "index.html": "Ana Sayfa",
    "urunlerimiz.html": "Ürünlerimiz",
    "hakkimizda.html": "Hakkımızda",
    "bayilerimiz.html": "Bayilerimiz",
    "bayilik-basvurusu.html": "Bayimiz Olun",
    "iletisim.html": "İletişim",
  };

  const pageTitle = customPageTitle?.trim() || defaultTitles[currentPath || __extractCurrentPath()] || "Kurumsal Site";
  document.title = `${brandName} | ${pageTitle}`;
}

function applyPageHeaderTitles(pageTitleData) {
  const eyebrow = document.querySelector("#page-eyebrow");
  const mainTitle = document.querySelector("#page-main-title");
  const mainSubtitle = document.querySelector("#page-main-subtitle");

  if (eyebrow && pageTitleData?.title?.trim()) {
    eyebrow.textContent = pageTitleData.title;
  }
  if (mainTitle && pageTitleData?.headerTitle?.trim()) {
    mainTitle.textContent = pageTitleData.headerTitle;
  }
  if (mainSubtitle && pageTitleData?.headerSubtitle?.trim()) {
    mainSubtitle.textContent = pageTitleData.headerSubtitle;
  }
}

function renderFranchisePage() {
  const packagesContainer = document.querySelector("#franchise-packages-container");
  const packageSelect = document.querySelector("#packageSelect");

  if (!packagesContainer && !packageSelect) return;

  const packages = getFranchisePackages().filter((pkg) => pkg.active);

  ensureFranchiseModalMounted();

  if (packagesContainer) {
    if (!packages.length) {
      packagesContainer.innerHTML = `
        <div class="lg:col-span-3 rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 text-center text-sm text-stone-500">
          Henüz bayilik paketi eklenmedi.
        </div>
      `;
    } else {
      let cardsHtml = "";
      for (let idx = 0; idx < packages.length; idx++) {
        const pkg = packages[idx];
        const isPremium = idx === packages.length - 1 && packages.length >= 3;
        const gallery = Array.isArray(pkg.gallery) ? pkg.gallery : [];
        let coverUrl = pkg.media || "";
        const mediaType = pkg.mediaType || "image";
        if (!coverUrl && gallery.length) {
          const first = gallery[0] || {};
          coverUrl = first.url || "";
        }
        const coverHtml = renderMediaElement(coverUrl, mediaType, pkg.title, "h-56 w-full object-cover");
        let featuresHtml = "";
        const featuresList = Array.isArray(pkg.features) ? pkg.features : [];
        for (let fi = 0; fi < featuresList.length; fi++) {
          const feature = featuresList[fi];
          featuresHtml = featuresHtml +
            "<li class=\"flex items-start gap-3 text-sm text-stone-700\">" +
              "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"mt-0.5 h-5 w-5 shrink-0 text-emerald-600\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4.5 12.75l6 6 9-13.5\" /></svg>" +
              "<span>" + escapeHtml(feature) + "</span>" +
            "</li>";
        }
        const premiumBadge = isPremium ? "<span class=\"absolute right-4 top-4 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white\">Önerilen</span>" : "";
        const ctaClass = isPremium ? "bg-[#6B1818] text-white" : "border border-[#6B1818] text-[#6B1818]";
        cardsHtml = cardsHtml +
          "<article class=\"site-card relative overflow-hidden rounded-[32px] border border-stone-200 bg-white\" data-paket-id=\"" + escapeAttribute(String(pkg.id || "")) + "\">" +
            premiumBadge +
            coverHtml +
            "<div class=\"space-y-5 p-7\">" +
              "<div>" +
                "<p class=\"text-xs font-bold uppercase tracking-[0.2em] text-amber-700\">Bayilik Paketi " + (idx + 1) + "</p>" +
                "<h3 class=\"mt-2 text-2xl font-extrabold text-stone-900\">" + escapeHtml(pkg.title) + "</h3>" +
              "</div>" +
              "<p class=\"text-sm leading-7 text-stone-600\">" + escapeHtml(pkg.description) + "</p>" +
              "<div class=\"rounded-[24px] bg-stone-50 px-5 py-4\">" +
                "<p class=\"text-xs font-bold uppercase tracking-[0.18em] text-stone-400\">Yatırım Tutarı</p>" +
                "<p class=\"mt-1 text-3xl font-extrabold text-[#6B1818]\">" + escapeHtml(pkg.price) + "</p>" +
              "</div>" +
              "<ul class=\"space-y-3\">" + featuresHtml + "</ul>" +
              "<div class=\"grid gap-3 sm:grid-cols-2\">" +
                "<button type=\"button\" data-paket-incele=\"" + escapeAttribute(String(pkg.id || "")) + "\" class=\"w-full rounded-2xl border border-amber-600 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800 transition hover:bg-amber-100\">" +
                  "<span class=\"inline-flex items-center justify-center gap-2\">" +
                    "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-4 w-4\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>" +
                    "Paketi İncele" +
                  "</span>" +
                "</button>" +
                "<button type=\"button\" data-scroll-to-form=\"" + escapeAttribute(String(pkg.id || "")) + "\" class=\"w-full rounded-2xl " + ctaClass + " px-5 py-4 text-sm font-bold transition hover:brightness-105\">Bu Paket İçin Başvur</button>" +
              "</div>" +
            "</div>" +
          "</article>";
      }
      packagesContainer.innerHTML = cardsHtml;

      packagesContainer.querySelectorAll("[data-paket-incele]").forEach((button) => {
        button.addEventListener("click", function () {
          const pkgId = String(button.getAttribute("data-paket-incele") || "");
          if (!pkgId) return;
          openFranchisePackageModal(pkgId);
        });
      });

      packagesContainer.querySelectorAll("[data-scroll-to-form]").forEach((button) => {
        button.addEventListener("click", () => {
          const form = document.querySelector("#franchise-form");
          const packageId = String(button.getAttribute("data-scroll-to-form") || "");
          const packageTitle = button.closest("article")?.querySelector("h3")?.textContent?.trim() || "";
          if (packageSelect) {
            const targetVal = packageId ? packageId : packageTitle;
            const option = Array.from(packageSelect.options).find((opt) => {
              if (packageId) return String(opt.value || "") === packageId;
              return String(opt.textContent || "").indexOf(packageTitle) >= 0;
            });
            if (option) {
              packageSelect.value = option.value;
            }
          }
          scrollToFranchiseForm();
        });
      });
    }
  }

  if (packageSelect) {
    let optsHtml = `<option value="">Paket seçiniz</option>`;
    for (let pi = 0; pi < packages.length; pi++) {
      const p = packages[pi];
      optsHtml = optsHtml + "<option value=\"" + escapeAttribute(p.id) + "\">" + escapeHtml(p.title) + " - " + escapeHtml(p.price) + "</option>";
    }
    packageSelect.innerHTML = optsHtml;
  }
}

function scrollToFranchiseForm() {
  const form = document.querySelector("#franchise-form");
  if (!form) return;
  const focusTarget = document.querySelector("#fullName") || document.querySelector("#franchise-form input");
  try {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (_) {
    form.scrollIntoView();
  }
  try {
    setTimeout(function () {
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus({ preventScroll: true });
      }
    }, 420);
  } catch (_) { /* ignore */ }
}

function ensureFranchiseModalMounted() {
  const root = document.querySelector("#franchise-modal-root");
  if (!root) return;
  if (root.dataset.mounted === "evet") return;
  root.dataset.mounted = "evet";
  root.innerHTML = "" +
    "<div id=\"franchise-modal\" data-franchise-modal role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"franchise-modal-title\" class=\"fixed inset-0 z-[80] hidden items-center justify-center p-4 sm:p-6\">" +
      "<div data-franchise-modal-overlay class=\"absolute inset-0 bg-stone-950/70 backdrop-blur-sm\"></div>" +
      "<div class=\"relative z-10 w-full max-w-4xl overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-2xl\">" +
        "<div class=\"relative flex items-start justify-between gap-4 border-b border-stone-200 bg-[#FDFBF7] px-6 py-5 sm:px-8\">" +
          "<div>" +
            "<p class=\"text-xs font-bold uppercase tracking-[0.22em] text-amber-700\">Bayilik Paketi Detayı</p>" +
            "<h2 id=\"franchise-modal-title\" class=\"mt-1 text-2xl font-extrabold text-stone-900 sm:text-3xl\"></h2>" +
          "</div>" +
          "<button type=\"button\" data-franchise-modal-kapat aria-label=\"Detayı kapat\" class=\"shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 hover:text-[#6B1818]\">" +
            "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-5 w-5\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/></svg>" +
          "</button>" +
        "</div>" +
        "<div data-franchise-modal-icerik class=\"max-h-[75vh] overflow-y-auto px-6 py-6 sm:px-8 sm:py-7\"></div>" +
        "<div class=\"flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-6 py-5 sm:px-8 sm:flex-row sm:items-center sm:justify-between\">" +
          "<p class=\"text-sm leading-6 text-stone-600\">Bu paketi seçtikten sonra başvuru formunu doldurarak ekibimizle iletişime geçebilirsiniz.</p>" +
          "<button type=\"button\" data-franchise-modal-basvur class=\"shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6B1818] px-6 py-4 text-sm font-bold text-white shadow-md transition hover:bg-[#561212] active:scale-[0.995]\">" +
            "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-4 w-4\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 2 11 13\"/><path d=\"M22 2 15 22l-4-9-9-4 20-7Z\"/></svg>" +
            "Bu Paketi İçin Başvur" +
          "</button>" +
        "</div>" +
      "</div>" +
    "</div>";

  const modal = root.querySelector("[data-franchise-modal]");
  if (modal) {
    modal.querySelector("[data-franchise-modal-overlay]")?.addEventListener("click", function () {
      closeFranchisePackageModal();
    });
    modal.querySelector("[data-franchise-modal-kapat]")?.addEventListener("click", function () {
      closeFranchisePackageModal();
    });
    modal.querySelector("[data-franchise-modal-basvur]")?.addEventListener("click", function () {
      const currentId = String(modal.dataset.currentPkgId || "");
      closeFranchisePackageModal();
      if (currentId) {
        const packageSelect = document.querySelector("#packageSelect");
        if (packageSelect) {
          const opt = Array.from(packageSelect.options || []).find(function (o) { return String(o.value || "") === currentId; });
          if (opt) { packageSelect.value = opt.value; }
        }
      }
      scrollToFranchiseForm();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e && e.key === "Escape") {
      try { closeFranchisePackageModal(); } catch (_) { /* ignore */ }
    }
  });
}

function closeFranchisePackageModal() {
  const modal = document.querySelector("[data-franchise-modal]");
  if (!modal) return;
  try { document.body.style.overflow = ""; } catch (_) { /* ignore */ }
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  modal.setAttribute("aria-hidden", "true");
  const openers = document.querySelectorAll("[data-paket-incele]");
  for (let i = 0; i < openers.length; i++) {
    try { openers[i].setAttribute("tabindex", "0"); } catch (_) { /* ignore */ }
  }
  try {
    modal.querySelector("[data-franchise-modal-icerik]").scrollTop = 0;
  } catch (_) { /* ignore */ }
}

function openFranchisePackageModal(packageId) {
  const root = document.querySelector("#franchise-modal-root");
  const modal = root ? root.querySelector("[data-franchise-modal]") : null;
  if (!modal || !packageId) return;
  const packages = getFranchisePackages() || [];
  const pkg = packages.find(function (p) { return String(p.id || "") === String(packageId || ""); });
  if (!pkg) return;
  const titleEl = modal.querySelector("#franchise-modal-title");
  const content = modal.querySelector("[data-franchise-modal-icerik]");
  if (!titleEl || !content) return;
  modal.dataset.currentPkgId = String(packageId || "");
  titleEl.textContent = String(pkg.title || "Bayilik Paketi");

  const gallery = Array.isArray(pkg.gallery) ? pkg.gallery.slice() : [];
  const coverUrl = pkg.media ? String(pkg.media) : (gallery.length && gallery[0] ? String(gallery[0].url || "") : "");
  const mediaType = pkg.mediaType || "image";
  const hasCover = !!coverUrl;

  const resolvedGallery = [];
  if (hasCover) {
    resolvedGallery.push({ id: "__kapak__", url: coverUrl, alt: String(pkg.title || ""), isCover: true });
  }
  const seen = new Set(hasCover ? [coverUrl] : []);
  for (let gi = 0; gi < gallery.length; gi++) {
    const it = gallery[gi] || {};
    const u = String(it.url || "");
    if (!u || seen.has(u)) continue;
    seen.add(u);
    resolvedGallery.push({ id: String(it.id || ("g_" + gi)), url: u, alt: String(it.alt || pkg.title || ""), isCover: false });
  }

  let coverHtml = hasCover ? renderMediaElement(coverUrl, mediaType, pkg.title, "h-64 w-full rounded-[24px] object-cover shadow-sm sm:h-80") : "";
  let galleryHtml = "";
  if (resolvedGallery.length > 0) {
    galleryHtml = "" +
      "<div class=\"mt-6\">" +
        "<p class=\"mb-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-500\">Paket Galerisi</p>" +
        "<div class=\"grid gap-3 sm:grid-cols-3 md:grid-cols-4\">";
    for (let gi = 0; gi < resolvedGallery.length; gi++) {
      const item = resolvedGallery[gi];
      const url = item.url || "";
      const alt = item.alt || "";
      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(url) || String(url).startsWith("data:video");
      const badgeHtml = item.isCover
        ? "<span class=\"absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow\">Kapak</span>"
        : (isVideo ? "<span class=\"absolute left-2 top-2 rounded-full bg-stone-900/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow\">Video</span>" : "");
      if (isVideo) {
        galleryHtml = galleryHtml +
          "<figure class=\"relative overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100 aspect-video\">" +
            badgeHtml +
            "<video src=\"" + escapeAttribute(url) + "\" title=\"" + escapeAttribute(alt) + "\" class=\"h-full w-full object-cover\" muted loop playsinline preload=\"metadata\"></video>" +
          "</figure>";
      } else {
        galleryHtml = galleryHtml +
          "<figure class=\"relative overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100 aspect-[4/3]\">" +
            badgeHtml +
            "<img src=\"" + escapeAttribute(url) + "\" alt=\"" + escapeAttribute(alt) + "\" class=\"h-full w-full object-cover\" loading=\"lazy\" decoding=\"async\" />" +
          "</figure>";
      }
    }
    galleryHtml = galleryHtml + "</div></div>";
  }

  let featuresHtml = "";
  const featuresList = Array.isArray(pkg.features) ? pkg.features : [];
  if (featuresList.length) {
    featuresHtml = "<div class=\"mt-6\">" +
      "<p class=\"mb-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-500\">Paket İçeriği / Özellikler</p>" +
      "<ul class=\"grid gap-3 sm:grid-cols-2\">";
    for (let fi = 0; fi < featuresList.length; fi++) {
      const feature = featuresList[fi];
      if (!String(feature || "").trim()) continue;
      featuresHtml = featuresHtml +
        "<li class=\"flex items-start gap-3 rounded-[20px] bg-stone-50 px-4 py-3 text-sm text-stone-700\">" +
          "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"mt-0.5 h-5 w-5 shrink-0 text-emerald-600\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"2\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M4.5 12.75l6 6 9-13.5\" /></svg>" +
          "<span class=\"leading-6\">" + escapeHtml(feature) + "</span>" +
        "</li>";
    }
    featuresHtml = featuresHtml + "</ul></div>";
  }

  let contentHtml = "";
  contentHtml = contentHtml +
    "<div class=\"grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)]\">" +
      "<div class=\"space-y-4\">" +
        coverHtml +
        galleryHtml +
      "</div>" +
      "<aside class=\"space-y-5\">" +
        "<div class=\"rounded-[28px] bg-[#FDFBF7] p-5 border border-stone-200\">" +
          "<p class=\"text-xs font-bold uppercase tracking-[0.18em] text-stone-500\">Yatırım Tutarı</p>" +
          "<p class=\"mt-1 text-4xl font-extrabold leading-tight text-[#6B1818]\">" + escapeHtml(String(pkg.price || "")) + "</p>" +
          "<p class=\"mt-2 text-xs leading-6 text-stone-500\">Fiyatlar güncel koşullara göre değişiklik gösterebilir. Kesin bilgi için başvuru sonrası ekibimizle iletişime geçiniz.</p>" +
        "</div>" +
        "<div class=\"rounded-[28px] bg-white border border-stone-200 p-5\">" +
          "<p class=\"text-xs font-bold uppercase tracking-[0.18em] text-stone-500\">Paket Açıklaması</p>" +
          "<p class=\"mt-2 text-sm leading-7 text-stone-700\">" + escapeHtml(String(pkg.description || "")) + "</p>" +
        "</div>" +
        "<div class=\"rounded-[28px] bg-stone-50 border border-stone-200 p-5\">" +
          "<p class=\"text-xs font-bold uppercase tracking-[0.18em] text-stone-500\">Durum</p>" +
          "<p class=\"mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold " + (pkg.active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700") + "\">" +
            "<span class=\"h-2 w-2 rounded-full " + (pkg.active ? "bg-emerald-500" : "bg-amber-500") + "\"></span>" +
            (pkg.active ? "Başvuru için aktif" : "Geçici olarak pasif") +
          "</p>" +
        "</div>" +
      "</aside>" +
    "</div>" +
    featuresHtml;

  content.innerHTML = contentHtml;

  try { document.body.style.overflow = "hidden"; } catch (_) { /* ignore */ }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  modal.setAttribute("aria-hidden", "false");
  try { content.scrollTop = 0; } catch (_) { /* ignore */ }
  const closer = modal.querySelector("[data-franchise-modal-kapat]");
  try { if (closer) closer.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
}

function renderMediaElement(mediaUrl, mediaType, altText, className = "") {
  if (!mediaUrl?.trim()) {
    return `
      <div class="flex h-48 items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    `;
  }

  const type = (mediaType || "image").toLowerCase();
  if (type === "video" || /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl)) {
    return `
      <video
        src="${escapeAttribute(mediaUrl)}"
        title="${escapeAttribute(altText)}"
        class="${className}"
        controls
        muted
        loop
        playsinline
        preload="metadata"
      ></video>
    `;
  }

  return `
    <img
      src="${escapeAttribute(mediaUrl)}"
      alt="${escapeAttribute(altText)}"
      class="${className}"
      loading="lazy"
      decoding="async"
    />
  `;
}

function navLinks(extraClass = "") {
  const links = [
    ["index.html", "Ana Sayfa"],
    ["urunlerimiz.html", "Ürünlerimiz"],
    ["hakkimizda.html", "Hakkımızda"],
    ["bayilerimiz.html", "Bayilerimiz"],
    ["bayilik-basvurusu.html", "Bayimiz Olun"],
    ["iletisim.html", "İletişim"],
  ];

  const inline = extraClass === "";
  const inlineAlignClass = inline
    ? "inline-flex items-center self-center"
    : "";

  return links
    .map(([href, label]) => {
      const __cp = currentPath || __extractCurrentPath();
      const isActive = __cp === href;
      const activeClass = isActive ? "font-bold text-[#6B1818]" : "text-stone-700";
      return `<a href="/${href}" class="${inlineAlignClass} ${extraClass} ${activeClass}">${label}</a>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
