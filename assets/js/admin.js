import {
  applicationStatuses,
  categoryLabel,
  createFranchisePackage,
  createImageId,
  deleteApplication as persistDeleteApplication,
  deleteDealer as persistDeleteDealer,
  deleteFranchisePackage,
  deleteProduct as persistDeleteProduct,
  formatDate,
  getAdminAuth,
  getApplications,
  getDealers,
  getFranchisePackages,
  getPageTitles,
  getProducts,
  getSiteContent,
  getSiteLogo,
  initializeData,
  initializeDataServerFirstIfPossible,
  saveApplications,
  saveDealers,
  saveFranchisePackages,
  savePageTitles,
  saveProducts,
  saveSiteContent,
  saveSiteLogo,
  slugify,
  statusClassName,
  updateAdminPassword,
  updateFranchisePackage,
} from "./shared/data.js?v=20260821-v12";
import { CURRENT_DATA_VERSION } from "./shared/data.js?v=20260821-v12";
const EXPECTED_BUILD_ADMIN = "20260821-v6";
if (typeof CURRENT_DATA_VERSION === "string" && CURRENT_DATA_VERSION !== EXPECTED_BUILD_ADMIN) {
  try { window.location.reload(true); } catch (_) { location.href = location.href; }
}

"use strict";

/* ============================================================================
 *  Admin Sunucu-Önce (Server-First) Başlatma:
 *  1. /api/db/sync ilk → storage'ı sunucu verisiyle OVERWRITE (TEK KAYNAK)
 *  2. Storage build pin assertion (fail → reload)
 *  3. Auth check + DB_API_SECRET setup prompt (isteğe bağlı, yoksa storage-only çalışır)
 *  4. renderDashboard() çağrılır
 * ========================================================================== */
(function bootstrapAdminAsync() {
  const initPromise = (typeof initializeDataServerFirstIfPossible === "function")
    ? initializeDataServerFirstIfPossible()
    : Promise.resolve({ serverFirstApplied: false, fallback: true, reason: "Yöntem yok" });

  initPromise
    .then(function (initResult) {
      try {
        if (window && window.console && typeof window.console.info === "function") {
          window.console.info("[admin] Server-first init:", initResult && (initResult.serverFirstApplied ? ("Sunucu " + (initResult.keysWritten || 0) + " anahtar ile eşitlendi.") : (initResult.reason || "LocalStorage kullanılıyor")));
          window.__CKFT_ADMIN_INIT_RESULT__ = initResult;
        }
      } catch (_l) { /* ignore */ }
      try { initializeData(); } catch (_initErr) { /* her durumda veri katmanını tohumlama garantisi */ }
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        try {
          const storageBuild = localStorage.getItem("ckft_corporate_build_version");
          if (storageBuild !== EXPECTED_BUILD_ADMIN) {
            try { initializeData(); } catch (_) {}
            try {
              const retryBuild = localStorage.getItem("ckft_corporate_build_version");
              if (retryBuild !== EXPECTED_BUILD_ADMIN) {
                try { window.location.reload(true); } catch (_reloadErr) {
                  try { location.href = location.href; } catch (__) {}
                }
                return;
              }
            } catch (_retryErr) {}
          }
        } catch (_chk) { /* ignore */ }
      }
      try {
        if (window.PySyncClient && typeof window.PySyncClient.getStoredSecret === "function" && !window.PySyncClient.getStoredSecret()) {
          const fromEnv = (window.DB_API_SECRET || window.__CKFT_DB_SECRET__ || "");
          if (fromEnv && typeof fromEnv === "string" && fromEnv.length > 6) {
            window.PySyncClient.onAdminAuthenticated(String(fromEnv));
          }
        }
      } catch (_secretSetup) { /* ignore */ }
      mainAdminInit();
    })
    .catch(function (fatal) {
      try { console.error("[admin] Init başarısız, localStorage fallback:", fatal); } catch (_) {}
      try { initializeData(); } catch (_) {}
      mainAdminInit();
    });
})();

function mainAdminInit() {

const AUTH_FLAG_KEY = "isAdminLoggedIn";
const ADMIN_TAB_KEY = "ckft_admin_active_tab";

if (localStorage.getItem(AUTH_FLAG_KEY) !== "true") {
  window.location.replace("admin-login.html");
  throw new Error("Yönetici oturumu doğrulanamadı. Giriş sayfasına yönlendiriliyorsunuz.");
}

let state = {};
let elements = {};

let __adminTabDelegationAttached = false;
function attachAdminTabDelegation() {
  if (__adminTabDelegationAttached) return;
  __adminTabDelegationAttached = true;
  document.addEventListener("click", function (e) {
    try {
      const btn = e.target && e.target.closest ? e.target.closest("[data-admin-tab]") : null;
      if (!btn || !(btn instanceof Element)) return;
      const nextTab = btn.dataset.adminTab || "genel-bakis";
      if (state) {
        state.activeTab = nextTab;
      } else {
        state = { activeTab: nextTab };
      }
      try { sessionStorage.setItem(ADMIN_TAB_KEY, nextTab); } catch (_) {}
      try { applyActiveTab(); } catch (err) { console.error("[admin] delegation applyActiveTab hatası:", err); }
    } catch (outer) {
      console.error("[admin] sekme delegasyon hatası:", outer);
    }
  });
}
attachAdminTabDelegation();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAdminDashboard, { once: true });
} else {
  // Sunucu-önce eşitleme DOMContentLoaded sonrasında tamamlanabilir. Bu durumda
  // olayı tekrar beklemek paneli boş bırakır; paneli hemen başlat.
  queueMicrotask(initializeAdminDashboard);
}
window.addEventListener("load", function () {
  if (!state || !elements || !elements.dashboardView) {
    setTimeout(initializeAdminDashboard, 0);
    setTimeout(initializeAdminDashboard, 120);
  }
});

function initializeAdminDashboard() {
  if (state && elements && elements.adminTabButtons && elements.adminTabButtons.length) {
    try { syncStateValues(); } catch (_resync) {}
    try { renderDashboard(); } catch (_rerender) {}
    return;
  }

  try { initializeData(); } catch (_initErr) { /* dashboard girişinden hemen önce veri katmanını tohumla */ }
  try {
    const freshProducts = Array.isArray(getProducts()) ? getProducts() : [];
    const freshDealers = Array.isArray(getDealers()) ? getDealers() : [];
    const freshApplications = Array.isArray(getApplications()) ? getApplications() : [];
    const freshSiteContent = getSiteContent();
    const freshPackages = Array.isArray(getFranchisePackages()) ? getFranchisePackages() : [];
    const freshPageTitles = getPageTitles();

    state = {
      products: freshProducts,
      dealers: freshDealers,
      applications: freshApplications,
      siteContent: freshSiteContent,
      franchisePackages: freshPackages,
      pageTitles: freshPageTitles,
      editingDealerId: null,
      editingPackageId: null,
      activeTab: sessionStorage.getItem(ADMIN_TAB_KEY) ?? "genel-bakis",
    };

    elements = {
      loginView: document.querySelector("#login-view"),
      dashboardView: document.querySelector("#dashboard-view"),
      loginFeedback: document.querySelector("#login-feedback"),
      logoutButton: document.querySelector("#logout-button"),
      adminBrandName: document.querySelector("#admin-brand-name"),
      totalProducts: document.querySelector("#total-products"),
      totalDealers: document.querySelector("#total-dealers"),
      totalApplications: document.querySelector("#total-applications"),
      pendingApplications: document.querySelector("#pending-applications"),
      productForm: document.querySelector("#product-form"),
      productFormTitle: document.querySelector("#product-form-title"),
      productList: document.querySelector("#product-list"),
      productFormFeedback: document.querySelector("#product-form-feedback"),
      packageForm: document.querySelector("#package-form"),
      packageFormTitle: document.querySelector("#package-form-title"),
      packageFormSubmitButton: document.querySelector("#package-form-submit"),
      packageFormResetButton: document.querySelector("#package-form-reset"),
      packageFormFeedback: document.querySelector("#package-form-feedback"),
      packageList: document.querySelector("#package-list"),
      dealerForm: document.querySelector("#dealer-form"),
      dealerFormTitle: document.querySelector("#dealer-form-title"),
      dealerFormSubmitButton: document.querySelector("#dealer-form-submit"),
      dealerFormResetButton: document.querySelector("#dealer-form-reset"),
      dealerFormFeedback: document.querySelector("#dealer-form-feedback"),
      dealerList: document.querySelector("#dealer-list"),
      applicationTable: document.querySelector("#application-table"),
      settingsForm: document.querySelector("#settings-form"),
      settingsFeedback: document.querySelector("#settings-feedback"),
      pageTitlesForm: document.querySelector("#page-titles-form"),
      pageTitlesFeedback: document.querySelector("#page-titles-feedback"),
      heroCardForm: document.querySelector("#hero-card-form"),
      heroCardFeedback: document.querySelector("#hero-card-feedback"),
      logoFeedback: document.querySelector("#logo-feedback"),
      foodImagesForm: document.querySelector("#food-images-form"),
      foodImagesFeedback: document.querySelector("#food-images-feedback"),
      foodImagesList: document.querySelector("#food-images-list"),
      passwordForm: document.querySelector("#password-form"),
      passwordFeedback: document.querySelector("#password-feedback"),
      adminTabButtons: Array.from(document.querySelectorAll("[data-admin-tab]") ?? []),
      adminPanels: Array.from(document.querySelectorAll("[data-admin-panel]") ?? []),
    };

    try { elements.logoutButton?.addEventListener("click", handleLogout); } catch (e) { console.warn("[admin] logout listener bağlanamadı:", e); }
    try { elements.productForm?.addEventListener("submit", handleProductSave); } catch (e) { console.warn("[admin] productForm listener bağlanamadı:", e); }
    try { elements.packageForm?.addEventListener("submit", handlePackageSave); } catch (e) { console.warn("[admin] packageForm listener bağlanamadı:", e); }
    try { elements.packageFormResetButton?.addEventListener("click", resetPackageForm); } catch (e) { console.warn("[admin] packageFormReset listener bağlanamadı:", e); }
    try { elements.dealerForm?.addEventListener("submit", handleDealerSave); } catch (e) { console.warn("[admin] dealerForm listener bağlanamadı:", e); }
    try { elements.dealerFormResetButton?.addEventListener("click", resetDealerForm); } catch (e) { console.warn("[admin] dealerFormReset listener bağlanamadı:", e); }
    try { elements.settingsForm?.addEventListener("submit", handleSettingsSave); } catch (e) { console.warn("[admin] settingsForm listener bağlanamadı:", e); }
    try { elements.pageTitlesForm?.addEventListener("submit", handlePageTitlesSave); } catch (e) { console.warn("[admin] pageTitlesForm listener bağlanamadı:", e); }
    try { elements.heroCardForm?.addEventListener("submit", handleHeroCardSave); } catch (e) { console.warn("[admin] heroCardForm listener bağlanamadı:", e); }
    try { elements.foodImagesForm?.addEventListener("submit", handleFoodImagesSave); } catch (e) { console.warn("[admin] foodImagesForm listener bağlanamadı:", e); }
    try { elements.passwordForm?.addEventListener("submit", handlePasswordChange); } catch (e) { console.warn("[admin] passwordForm listener bağlanamadı:", e); }
    try { window.addEventListener("storage", syncState); } catch (e) { console.warn("[admin] storage listener bağlanamadı:", e); }

    try { initializeAdminTabs(); } catch (e) { console.error("[admin] sekmeler başlatılamadı:", e); }
    try { renderDashboard(); } catch (e) { console.error("[admin] gösterge paneli işlenirken hata:", e); }

    try { bindMediaGroups(elements.productForm); } catch (e) { console.warn("[admin] productForm medya grubu bağlanamadı:", e); }
    try { bindMediaGroups(elements.packageForm); } catch (e) { console.warn("[admin] packageForm medya grubu bağlanamadı:", e); }
    try { bindGalleryScope(elements.packageForm, []); } catch (e) { console.warn("[admin] packageForm galeri bağlanamadı:", e); }
    try { bindMediaGroups(elements.dealerForm); } catch (e) { console.warn("[admin] dealerForm medya grubu bağlanamadı:", e); }
    try { bindMediaGroups(elements.settingsForm); } catch (e) { console.warn("[admin] settingsForm medya grubu bağlanamadı:", e); }

    if (elements.dashboardView) {
      try { elements.dashboardView.classList.remove("hidden"); } catch (e) { console.warn("[admin] dashboard görünür yapılamadı:", e); }
    }
  } catch (err) {
    console.error("[admin] Yönetici paneli başlatılırken KRİTİK hata:", err);
  }
}


function handleLogout() {
  localStorage.removeItem(AUTH_FLAG_KEY);
  sessionStorage.removeItem(ADMIN_TAB_KEY);
  try { localStorage.removeItem("ckft_admin_login_time"); } catch (_) {}
  try { localStorage.removeItem("ckft_py_db_api_secret_cache_v1"); } catch (_) {}

  try {
    window.location.replace("/admin-login.html?logout=1");
  } catch (e) {
    try {
      window.location.href = "./admin-login.html";
    } catch (e2) {
      showView(false);
    }
  }
}

function showView(isLoggedIn) {
  try { elements?.loginView?.classList.toggle("hidden", isLoggedIn); } catch (e) {}
  try { elements?.dashboardView?.classList.toggle("hidden", !isLoggedIn); } catch (e) {}
}

function syncState() {
  try { syncStateValues(); } catch (e) { console.warn("[admin] syncStateValues hatası:", e); }
  if (localStorage.getItem(AUTH_FLAG_KEY) === "true") {
    try { renderDashboard(); } catch (e) { console.warn("[admin] renderDashboard (syncState) hatası:", e); }
  }
}

function syncStateValues() {
  if (!state) {
    state = {};
  }
  try { initializeData(); } catch (_) {}
  state.products = Array.isArray(getProducts()) ? getProducts() : state.products;
  state.dealers = Array.isArray(getDealers()) ? getDealers() : state.dealers;
  state.applications = Array.isArray(getApplications()) ? getApplications() : state.applications;
  state.siteContent = getSiteContent();
  state.franchisePackages = Array.isArray(getFranchisePackages()) ? getFranchisePackages() : state.franchisePackages;
  state.pageTitles = getPageTitles();
  if (!Array.isArray(state.products)) state.products = [];
  if (!Array.isArray(state.dealers)) state.dealers = [];
  if (!Array.isArray(state.applications)) state.applications = [];
  if (!Array.isArray(state.franchisePackages)) state.franchisePackages = [];
}

function renderDashboard() {
  try { syncStateValues(); } catch (e) { console.error("[admin] syncStateValues hatası:", e); }
  try { renderOverview(); } catch (e) { console.error("[admin] renderOverview hatası:", e); }
  try { renderProducts(); } catch (e) { console.error("[admin] renderProducts hatası:", e); }
  try { renderFranchisePackages(); } catch (e) { console.error("[admin] renderFranchisePackages hatası:", e); }
  try { renderDealers(); } catch (e) { console.error("[admin] renderDealers hatası:", e); }
  try { renderApplications(); } catch (e) { console.error("[admin] renderApplications hatası:", e); }
  try { renderSettingsForm(); } catch (e) { console.error("[admin] renderSettingsForm hatası:", e); }
  try { renderPageTitlesForm(); } catch (e) { console.error("[admin] renderPageTitlesForm hatası:", e); }
  try { renderHeroCardForm(); } catch (e) { console.error("[admin] renderHeroCardForm hatası:", e); }
  try { renderImageManagers(); } catch (e) { console.error("[admin] renderImageManagers hatası:", e); }
  try { bindMediaGroups(elements.productForm); } catch (e) { console.warn("[admin] productForm medya bağlama hatası:", e); }
  try { bindMediaGroups(elements.packageForm); } catch (e) { console.warn("[admin] packageForm medya bağlama hatası:", e); }
  try { bindGalleryScope(elements.packageForm, getFormGalleryState(elements.packageForm)); } catch (e) { console.warn("[admin] packageForm galeri bağlama hatası:", e); }
  try { bindMediaGroups(elements.dealerForm); } catch (e) { console.warn("[admin] dealerForm medya bağlama hatası:", e); }
  try { bindMediaGroups(elements.settingsForm); } catch (e) { console.warn("[admin] settingsForm medya bağlama hatası:", e); }
  try { applyActiveTab(); } catch (e) { console.error("[admin] applyActiveTab hatası:", e); }
}

function renderOverview() {
  if (!elements.totalProducts) return;

  elements.totalProducts.textContent = String(
    state.products.filter((item) => item.active).length
  );
  if (elements.totalDealers) {
    elements.totalDealers.textContent = String(state.dealers.length);
  }
  if (elements.totalApplications) {
    elements.totalApplications.textContent = String(state.applications.length);
  }
  if (elements.pendingApplications) {
    elements.pendingApplications.textContent = String(
      state.applications.filter((item) => item.status === "Yeni").length
    );
  }
}

function renderProducts() {
  if (!elements.productList) return;

  if (!Array.isArray(state.products)) {
    try { state.products = Array.isArray(getProducts()) ? getProducts() : []; } catch (_) { state.products = []; }
  }
  if (!state.products.length) {
    try {
      const retry = Array.isArray(getProducts()) ? getProducts() : [];
      if (retry.length) state.products = retry.slice();
    } catch (_) {}
  }

  const isVideoUrl = function (url) {
    return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.indexOf("data:video") === 0;
  };

  if (!state.products.length) {
    elements.productList.innerHTML =
      "<div class=\"rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8\">" +
        "<div class=\"grid gap-4 sm:grid-cols-[auto_1fr] items-start\">" +
          "<span class=\"inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700\">" +
            "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-6 w-6\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 7 4 7\"/><path d=\"M20 12 4 12\"/><path d=\"M20 17 4 17\"/></svg>" +
          "</span>" +
          "<div>" +
            "<h3 class=\"text-base font-bold text-stone-900\">Henüz ürün kaydı bulunmuyor</h3>" +
            "<p class=\"mt-2 text-sm leading-7 text-stone-600\">" +
              "Soldaki \"Yeni Ürün Ekle\" formunu kullanarak ilk vitrin ürünü ekleyebilirsiniz. Eklediğiniz ürünler ana sayfada ve Ürünlerimiz sayfasında görünecektir." +
            "</p>" +
            "<p class=\"mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700\">" +
              "Örnek: Acılı Çiğköfte, Nohutlu Çiğköfte, Patatesli Çiğköfte, Vegan Çiğköfte" +
            "</p>" +
          "</div>" +
        "</div>" +
      "</div>";
    return;
  }

  elements.productList.innerHTML = state.products
    .map(function (product) {
      const prodIsVideo = isVideoUrl(product.image);
      const mediaHtml = prodIsVideo
        ? "<video src=\"" + escapeAttribute(product.image) + "\" title=\"" + escapeAttribute(product.name) + "\" class=\"h-full w-full object-cover\" controls muted loop playsinline preload=\"metadata\"></video>"
        : "<img src=\"" + escapeAttribute(product.image) + "\" alt=\"" + escapeAttribute(product.name) + "\" class=\"h-full w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
      const checkedAttr = product.active ? "checked" : "";
      const badgesStr = Array.isArray(product.badges) ? product.badges.join(", ") : (String(product.badges ?? ""));
      return "" +
        "<article class=\"rounded-[28px] border border-stone-200 bg-[#FDFBF7] p-5\">" +
          "<form data-inline-product-form=\"" + escapeAttribute(product.id) + "\" class=\"space-y-4\">" +
            "<div class=\"grid gap-5 lg:grid-cols-[220px_1fr]\">" +
              "<div class=\"space-y-3\">" +
                "<div class=\"overflow-hidden rounded-[24px] border border-stone-200 bg-white h-52\">" +
                  mediaHtml +
                "</div>" +
                "<p class=\"rounded-2xl bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700\">" +
                  escapeHtml(categoryLabel(product.category)) +
                "</p>" +
              "</div>" +
              "<div class=\"grid gap-4 md:grid-cols-2\">" +
                "<div>" +
                  "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Ürün Adı</label>" +
                  "<input name=\"name\" value=\"" + escapeAttribute(product.name) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\" />" +
                "</div>" +
                "<div>" +
                  "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Kategori</label>" +
                  "<select name=\"category\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\">" +
                    kategoriSecenekleri(product.category) +
                  "</select>" +
                "</div>" +
                "<div class=\"md:col-span-2\" data-medya-grubu data-medya-alani=\"image\" data-medya-baslangic=\"" + escapeAttribute(product.image) + "\">" +
                  "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Ürün Görseli / Videosu Yükle</label>" +
                  "<div class=\"mt-3\">" +
                    "<input type=\"file\" accept=\"image/*,video/*\" data-medya-dosya class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\" />" +
                  "</div>" +
                  "<p class=\"mt-2 text-xs leading-6 text-stone-500\">Yeni görsel veya video seçilmezse mevcut medya korunur.</p>" +
                  "<div data-medya-onizleme data-product-upload-preview class=\"mt-3 hidden h-48 w-full overflow-hidden rounded-[24px] border border-stone-200 bg-white\"></div>" +
                "</div>" +
                "<div class=\"md:col-span-2\">" +
                  "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Açıklama</label>" +
                  "<textarea name=\"description\" rows=\"4\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\">" + escapeHtml(product.description ?? "") + "</textarea>" +
                "</div>" +
                "<div>" +
                  "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Rozetler</label>" +
                  "<input name=\"badges\" value=\"" + escapeAttribute(badgesStr) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\" />" +
                "</div>" +
                "<label class=\"flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700\">" +
                  "<input type=\"checkbox\" name=\"active\" class=\"h-4 w-4\" " + checkedAttr + " />" +
                  "Ürün aktif olsun" +
                "</label>" +
              "</div>" +
            "</div>" +
            "<div class=\"flex flex-wrap gap-3\">" +
              "<button type=\"submit\" class=\"rounded-2xl bg-[#6B1818] px-5 py-3 text-sm font-bold text-white\">Ürünü Güncelle</button>" +
              "<button type=\"button\" data-delete-product=\"" + escapeAttribute(product.id) + "\" class=\"rounded-2xl bg-red-50 px-5 py-3 text-sm font-bold text-red-700\">Ürünü Sil</button>" +
            "</div>" +
          "</form>" +
        "</article>";
    })
    .join("");

  elements.productList
    .querySelectorAll("[data-inline-product-form]")
    .forEach(function (form) {
      form.addEventListener("submit", handleInlineProductSave);
      bindMediaGroups(form);
    });

  elements.productList
    .querySelectorAll("[data-delete-product]")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        deleteProduct(button.dataset.deleteProduct ?? "");
      });
    });
}

function handleProductSave(event) {
  event.preventDefault();
  if (!elements.productForm) return;

  const formData = new FormData(elements.productForm);
  const payload = buildProductPayload(formData);

  if (!isValidProduct(payload)) {
    setTextContent(
      elements.productFormFeedback,
      "Lütfen ürün adı, kategori, açıklama ve görsel alanlarını doldurunuz."
    );
    return;
  }

  try {
    const latest = Array.isArray(getProducts()) ? getProducts() : [];
    state.products = Array.isArray(latest) && latest.length ? latest : (Array.isArray(state.products) ? state.products : []);
  } catch (_rehydrate) {}

  state.products = [{ ...payload }, ...(Array.isArray(state.products) ? state.products : [])];
  saveProducts(state.products);
  elements.productForm.reset();
  resetMediaGroups(elements.productForm);
  setTextContent(elements.productFormFeedback, "Yeni ürün başarıyla kaydedildi.");
  renderDashboard();
}

function handleInlineProductSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const productId = form.dataset.inlineProductForm ?? "";
  const formData = new FormData(form);

  try {
    const latest = Array.isArray(getProducts()) ? getProducts() : [];
    if (Array.isArray(latest) && latest.length) {
      state.products = latest.slice();
    }
  } catch (_rehydrate) {}

  const payload = buildProductPayload(formData, productId);

  if (!isValidProduct(payload)) {
    return;
  }

  state.products = (Array.isArray(state.products) ? state.products : []).map((product) =>
    product && product.id === productId ? payload : product
  );
  saveProducts(state.products);
  renderDashboard();
}

function deleteProduct(productId) {
  if (!productId) return;
  try {
    const latest = Array.isArray(getProducts()) ? getProducts() : [];
    if (Array.isArray(latest) && latest.length) {
      state.products = latest.slice();
    }
  } catch (_rehydrate) {}
  const product = (Array.isArray(state.products) ? state.products : []).find(function (p) { return p && p.id === productId; });
  const label = product && product.name ? product.name : "seçili ürün";
  const confirmed = window.confirm("⚠️ " + label + " kalıcı olarak silinsin mi?\nBu işlem GERİ ALINAMAZ. Silinen ürün sayfa yenilemelerinde geri gelmeyecektir.");
  if (!confirmed) return;

  state.products = (Array.isArray(state.products) ? state.products : []).filter((product) => product && product.id !== productId);
  saveProducts(state.products);
  try { persistDeleteProduct(productId); } catch (_) {}
  renderDashboard();
}

function buildProductPayload(formData, productId = null) {
  const badges = (formData.get("badges")?.toString() ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const rawName = formData.get("name")?.toString().trim() ?? "";
  const nextId = productId || slugify(rawName);

  const currentProduct = productId
    ? state.products.find((product) => product.id === productId)
    : null;

  return {
    id: nextId,
    name: rawName,
    category: formData.get("category")?.toString().trim() ?? "",
    description: formData.get("description")?.toString().trim() ?? "",
    image: normalizeImagePath(
      formData.get("image")?.toString().trim() ?? currentProduct?.image ?? ""
    ),
    badges,
    active: formData.get("active") === "on",
  };
}

function isValidProduct(product) {
  return Boolean(
    product.id &&
      product.name &&
      product.category &&
      product.description &&
      product.image
  );
}

function renderFranchisePackages() {
  if (!elements.packageList) return;

  const packages = Array.isArray(state.franchisePackages) ? state.franchisePackages.slice() : [];
  packages.sort(function (a, b) { return (a.order ?? 0) - (b.order ?? 0); });

  let resultHtml = "";
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const mediaHtml = renderAdminMediaPreview(pkg.media, pkg.mediaType, pkg.title, "h-52 w-full object-cover");
    const statusClass = pkg.active ? "text-emerald-700" : "text-stone-400";
    const statusText = pkg.active ? "Sitede Aktif" : "Pasif";
    const mediaTypeImgSel = pkg.mediaType === "image" ? "selected" : "";
    const mediaTypeVidSel = pkg.mediaType === "video" ? "selected" : "";
    const checkedAttr = pkg.active ? "checked" : "";
    const featuresVal = escapeHtml(Array.isArray(pkg.features) ? pkg.features.join("\n") : "");
    const galleryHtml = buildGallerySectionHtml(pkg);

    resultHtml = resultHtml +
      "<article class=\"rounded-[28px] border border-stone-200 bg-[#FDFBF7] p-5\">" +
        "<form data-inline-package-form=\"" + escapeAttribute(pkg.id) + "\" class=\"space-y-5\">" +
          "<div class=\"grid gap-5 lg:grid-cols-[220px_1fr]\">" +
            "<div class=\"space-y-3\">" +
              "<div data-package-media-preview class=\"overflow-hidden rounded-[24px] border border-stone-200 bg-white\">" + mediaHtml + "</div>" +
              "<p class=\"rounded-2xl bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] " + statusClass + "\">" + statusText + "</p>" +
            "</div>" +
            "<div class=\"grid gap-4 sm:grid-cols-2\">" +
              "<div class=\"sm:col-span-2\">" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Paket Adı</label>" +
                "<input name=\"title\" value=\"" + escapeAttribute(pkg.title) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3\" />" +
              "</div>" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Yatırım Tutarı / Fiyat</label>" +
                "<input name=\"price\" value=\"" + escapeAttribute(pkg.price) + "\" placeholder=\"₺450.000\" class=\"w-full rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3\" />" +
              "</div>" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Görüntüleme Sırası</label>" +
                "<input name=\"order\" type=\"number\" min=\"1\" value=\"" + escapeAttribute(pkg.order ?? 1) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3\" />" +
              "</div>" +
              "<div class=\"sm:col-span-2\">" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Açıklama</label>" +
                "<textarea name=\"description\" rows=\"4\" class=\"w-full rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3\">" + escapeHtml(pkg.description) + "</textarea>" +
              "</div>" +
              "<div class=\"sm:col-span-2\" data-medya-grubu data-medya-alani=\"media\" data-medya-baslangic=\"" + escapeAttribute(pkg.media ?? "") + "\">" +
                "<div class=\"rounded-[28px] border border-stone-200 bg-[#FDFBF7] p-4\">" +
                  "<div class=\"mb-3 grid gap-4 sm:grid-cols-2\">" +
                    "<div>" +
                      "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Kapak Medyası Türü</label>" +
                      "<select name=\"mediaType\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\">" +
                        "<option value=\"image\" " + mediaTypeImgSel + ">Görsel</option>" +
                        "<option value=\"video\" " + mediaTypeVidSel + ">Video (MP4, WebM)</option>" +
                      "</select>" +
                    "</div>" +
                    "<div>" +
                      "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Kapak Görseli / Video Yükle</label>" +
                      "<input type=\"file\" accept=\"image/*,video/*\" data-medya-dosya class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3\" />" +
                    "</div>" +
                  "</div>" +
                  "<p class=\"text-xs leading-6 text-stone-500\">Paket kartında kapak olarak gösterilecek tek medya dosyasını buradan yükleyin. Yeni medya seçilmezse mevcut kapak medyası korunur.</p>" +
                  "<div data-medya-onizleme data-package-preview-container class=\"mt-4 hidden overflow-hidden rounded-[24px] border border-stone-200 bg-white h-48\"></div>" +
                "</div>" +
              "</div>" +
              "<div class=\"sm:col-span-2\">" +
                galleryHtml +
              "</div>" +
              "<div class=\"sm:col-span-2\">" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Paket Özellikleri (her satıra bir özellik)</label>" +
                "<textarea name=\"features\" rows=\"6\" placeholder=\"Standart ekipman seti&#10;3 gün eğitim desteği&#10;İlk ay stok desteği\" class=\"w-full rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3\">" + featuresVal + "</textarea>" +
              "</div>" +
              "<label class=\"flex items-center gap-3 rounded-2xl border border-stone-200 bg-[#FDFBF7] px-4 py-3 text-sm font-medium text-stone-700 sm:col-span-2\">" +
                "<input type=\"checkbox\" name=\"active\" class=\"h-4 w-4\" " + checkedAttr + " />" +
                "Paket sitede gösterilsin" +
              "</label>" +
            "</div>" +
          "</div>" +
          "<div class=\"flex flex-wrap gap-3\">" +
            "<button type=\"submit\" class=\"rounded-2xl bg-[#6B1818] px-5 py-3 text-sm font-bold text-white\">Paketi Güncelle</button>" +
            "<button type=\"button\" data-edit-package=\"" + escapeAttribute(pkg.id) + "\" class=\"rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700\">Düzenle</button>" +
            "<button type=\"button\" data-delete-package=\"" + escapeAttribute(pkg.id) + "\" class=\"rounded-2xl bg-red-50 px-5 py-3 text-sm font-bold text-red-700\">Paketi Sil</button>" +
          "</div>" +
        "</form>" +
      "</article>";
  }

  if (!packages.length) {
    resultHtml = "<div class=\"rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 text-sm text-stone-500\">Henüz bayilik paketi eklenmedi.</div>";
  }

  elements.packageList.innerHTML = resultHtml;

  try {
    elements.packageList.querySelectorAll("[data-inline-package-form]").forEach(function (form) {
      try { form.addEventListener("submit", handleInlinePackageSave); } catch (_) {}
      try { bindMediaGroups(form); } catch (_) {}
      try {
        const currentPkgId = form.dataset.inlinePackageForm;
        const currentPkg = packages.find(function (p) { return p.id === currentPkgId; });
        const initialG = Array.isArray(currentPkg && currentPkg.gallery) && currentPkg.gallery.length
          ? currentPkg.gallery.slice()
          : (currentPkg && currentPkg.media ? [{ id: createImageId("pkg"), url: currentPkg.media, alt: String(currentPkg.title || "") }] : []);
        bindGalleryScope(form, initialG);
      } catch (_) {}
    });
    elements.packageList.querySelectorAll("[data-edit-package]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          populatePackageForm(button.dataset.editPackage ? button.dataset.editPackage : "");
        });
      } catch (_) {}
    });
    elements.packageList.querySelectorAll("[data-delete-package]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          deletePackage(button.dataset.deletePackage ? button.dataset.deletePackage : "");
        });
      } catch (_) {}
    });
  } catch (_) {}
}

function renderAdminMediaPreview(mediaUrl, mediaType, altText, className) {
  const cls = className ? className : "";
  if (!mediaUrl || !String(mediaUrl).trim()) {
    return "" +
      "<div class=\"flex h-52 items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200\">" +
        "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-16 w-16 text-stone-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
          "<path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z\" />" +
        "</svg>" +
      "</div>";
  }
  const type = String(mediaType || "image").toLowerCase();
  if (type === "video" || /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl)) {
    return "<video src=\"" + escapeAttribute(mediaUrl) + "\" title=\"" + escapeAttribute(altText) + "\" class=\"" + escapeAttribute(cls) + "\" controls muted loop playsinline preload=\"metadata\"></video>";
  }
  return "<img src=\"" + escapeAttribute(mediaUrl) + "\" alt=\"" + escapeAttribute(altText) + "\" class=\"" + escapeAttribute(cls) + "\" loading=\"lazy\" decoding=\"async\" />";
}

function handlePackageSave(event) {
  event.preventDefault();
  if (!elements.packageForm) return;

  const formData = new FormData(elements.packageForm);
  const payload = buildPackagePayload(formData, state.editingPackageId || null, elements.packageForm);

  if (!isValidPackage(payload)) {
    setTextContent(
      elements.packageFormFeedback,
      "Lütfen paket adı, fiyat ve açıklama alanlarını doldurunuz."
    );
    return;
  }

  if (state.editingPackageId) {
    updateFranchisePackage(state.editingPackageId, payload);
  } else {
    createFranchisePackage(payload);
  }

  state.franchisePackages = getFranchisePackages();
  resetPackageForm();
  setTextContent(elements.packageFormFeedback, "Bayilik paketi başarıyla kaydedildi.");
  renderDashboard();
}

function handleInlinePackageSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const packageId = form.dataset.inlinePackageForm ?? "";
  const formData = new FormData(form);
  const payload = buildPackagePayload(formData, packageId, form);

  if (!isValidPackage(payload)) {
    return;
  }

  updateFranchisePackage(packageId, payload);
  state.franchisePackages = getFranchisePackages();
  renderDashboard();
}

function buildPackagePayload(formData, packageId = null, sourceForm = null) {
  const featuresRaw = formData.get("features")?.toString() ?? "";
  const features = featuresRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rawTitle = formData.get("title")?.toString().trim() ?? "";
  const nextId = packageId || slugify(rawTitle);

  const currentPackage = packageId
    ? state.franchisePackages.find((pkg) => pkg.id === packageId)
    : null;

  const selectedMediaType = formData.get("mediaType")?.toString().trim() || "image";
  const rawMedia = formData.get("media")?.toString().trim() ?? "";
  const galleryStateKnown = sourceForm instanceof HTMLFormElement && __PKG_GALLERY_WEAK.has(sourceForm);
  // Formun galeri durumu biliniyorsa media alanı gerçeğin kaynağıdır: silme
  // işleminde boş, yeni kapak yüklemesinde yeni dosya değeridir. Eski pakete
  // fallback yapmak silinen kapağı geri getirir.
  const resolvedMedia = galleryStateKnown ? rawMedia : (rawMedia || currentPackage?.media || "");

  const detectedMediaType = /\.(mp4|webm|ogg|mov)$/i.test(resolvedMedia) || resolvedMedia.startsWith("data:video")
    ? "video"
    : selectedMediaType;

  let gallery = sourceForm instanceof HTMLFormElement
    ? getFormGalleryState(sourceForm)
    : Array.isArray(currentPackage && currentPackage.gallery) ? normalizeGallery(currentPackage.gallery) : [];

  if (!galleryStateKnown && !gallery.length && currentPackage && currentPackage.media) {
    gallery = normalizeGallery([{
      id: createImageId("pkg"),
      url: currentPackage.media,
      alt: String(currentPackage.title || ""),
    }]);
  }
  if (!galleryStateKnown && !gallery.length && resolvedMedia) {
    gallery = normalizeGallery([{
      id: createImageId("pkg"),
      url: resolvedMedia,
      alt: rawTitle,
    }]);
  }

  let finalMedia = normalizeImagePath(resolvedMedia);
  if (!finalMedia && gallery.length) {
    finalMedia = String(gallery[0].url || "");
  }
  let finalMediaType = detectedMediaType;
  if (!resolvedMedia && gallery.length) {
    const firstUrl = gallery[0].url || "";
    if (/\.(mp4|webm|ogg|mov)$/i.test(firstUrl) || String(firstUrl).startsWith("data:video")) {
      finalMediaType = "video";
    } else {
      finalMediaType = "image";
    }
  }

  return {
    id: nextId,
    title: rawTitle,
    description: formData.get("description")?.toString().trim() ?? "",
    price: formData.get("price")?.toString().trim() ?? "",
    features,
    media: finalMedia,
    mediaType: finalMediaType,
    gallery: gallery,
    order: parseInt(formData.get("order")?.toString() ?? "1", 10) || 1,
    active: formData.get("active") === "on",
  };
}

function isValidPackage(pkg) {
  return Boolean(pkg.id && pkg.title && pkg.price && pkg.description);
}

const __PKG_GALLERY_WEAK = new WeakMap();

function normalizeGallery(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it) continue;
    const url = String(it.url || "").trim();
    if (!url) continue;
    out.push({
      id: String(it.id || createImageId("pkg")),
      url: url,
      alt: String(it.alt || ""),
    });
  }
  return out;
}

function getGalleryScope(container) {
  if (!container) return null;
  if (container instanceof Element && container.hasAttribute("data-paket-galeri")) return container;
  if (container instanceof Element) {
    const found = container.querySelector("[data-paket-galeri]");
    if (found) return found;
  }
  return null;
}

function getFormGalleryState(formEl) {
  if (!formEl) return [];
  if (__PKG_GALLERY_WEAK.has(formEl)) {
    return normalizeGallery(__PKG_GALLERY_WEAK.get(formEl));
  }
  return [];
}

function setFormGalleryState(formEl, items) {
  if (!formEl) return;
  const clean = normalizeGallery(items);
  __PKG_GALLERY_WEAK.set(formEl, clean);
  renderGalleryThumbnails(formEl);
}

function syncFormGalleryToStateAndSave(formEl) {
  if (!(formEl instanceof HTMLFormElement)) return false;
  const editingInline = formEl.dataset?.inlinePackageForm ? String(formEl.dataset.inlinePackageForm) : "";
  const editingMain = state.editingPackageId ? String(state.editingPackageId) : "";
  const targetPackageId = editingInline || editingMain;
  if (!targetPackageId) return false;
  const galleryNew = normalizeGallery(getFormGalleryState(formEl));
  const pkgIndex = state.franchisePackages.findIndex(function (p) { return p && String(p.id) === String(targetPackageId); });
  if (pkgIndex < 0) return false;
  const currentPkg = state.franchisePackages[pkgIndex];
  // Galerinin ilk öğesi kapaktır. Son öğe de silindiyse eski kapak değerini
  // korumak görseli yeniden diriltir; bu yüzden media alanını da boşalt.
  const nextMedia = galleryNew.length ? String(galleryNew[0]?.url || "") : "";
  const mediaField = formEl.elements ? formEl.elements.namedItem("media") : null;
  if (mediaField && "value" in mediaField) {
    try { mediaField.value = nextMedia; } catch (_) {}
  }
  let nextMediaType = currentPkg?.mediaType || "image";
  if (nextMedia) {
    nextMediaType = /\.(mp4|webm|ogg|mov)$/i.test(nextMedia) || String(nextMedia).startsWith("data:video") ? "video" : nextMediaType;
  }
  state.franchisePackages[pkgIndex] = {
    ...(currentPkg || {}),
    gallery: galleryNew,
    media: nextMedia,
    mediaType: nextMediaType,
  };
  const writeOk = saveFranchisePackages(state.franchisePackages);
  state.franchisePackages = getFranchisePackages();
  return Boolean(writeOk);
}

function renderGalleryThumbnails(scope) {
  const formEl = scope instanceof HTMLFormElement ? scope : scope?.closest?.("form");
  const galeriKapsam = formEl ? formEl.querySelector("[data-paket-galeri-liste]") : scope?.querySelector?.("[data-paket-galeri-liste]");
  const kapakUyari = formEl ? formEl.querySelector("[data-paket-galeri-kapak]") : scope?.querySelector?.("[data-paket-galeri-kapak]");
  if (!galeriKapsam) return;
  const items = formEl ? getFormGalleryState(formEl) : [];
  if (kapakUyari) {
    if (items.length > 0) kapakUyari.classList.remove("hidden");
    else kapakUyari.classList.add("hidden");
  }
  if (!items.length) {
    galeriKapsam.innerHTML = "<p class=\"col-span-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-xs leading-6 text-stone-500\">Henüz galeriye görsel veya video eklenmedi. Yukarıdaki dosya seçici ile birden fazla dosya ekleyebilirsiniz.</p>";
    return;
  }
  let html = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(item.url) || String(item.url).startsWith("data:video");
    const badge = isVideo ? "<span class=\"absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase text-white\">Video</span>" : (i === 0 ? "<span class=\"absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase text-white\">Kapak</span>" : "");
    let mediaHtml = "";
    if (isVideo) {
      mediaHtml = "<video src=\"" + escapeAttribute(item.url) + "\" title=\"" + escapeAttribute(item.alt) + "\" class=\"h-32 w-full object-cover\" muted loop playsinline preload=\"metadata\"></video>";
    } else {
      mediaHtml = "<img src=\"" + escapeAttribute(item.url) + "\" alt=\"" + escapeAttribute(item.alt) + "\" class=\"h-32 w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
    }
    const solaDevreDisi = i === 0 ? " opacity-30 cursor-not-allowed\" disabled=\"disabled\"" : "\"";
    const sagaDevreDisi = i === items.length - 1 ? " opacity-30 cursor-not-allowed\" disabled=\"disabled\"" : "\"";
    html = html +
      "<figure class=\"overflow-hidden rounded-[20px] border border-stone-200 bg-white\">" +
        "<div class=\"relative\">" + mediaHtml + badge + "</div>" +
        "<div class=\"flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-[#FDFBF7] p-2\">" +
          "<div class=\"flex gap-1\">" +
            "<button type=\"button\" data-galeri-tasi=\"sol\" data-galeri-id=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-white px-2 py-1 text-sm font-bold border border-stone-200 text-stone-700" + solaDevreDisi + ">←</button>" +
            "<button type=\"button\" data-galeri-tasi=\"sag\" data-galeri-id=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-white px-2 py-1 text-sm font-bold border border-stone-200 text-stone-700" + sagaDevreDisi + ">→</button>" +
          "</div>" +
          "<button type=\"button\" data-galeri-sil=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-100\">Sil</button>" +
        "</div>" +
      "</figure>";
  }
  galeriKapsam.innerHTML = html;
}

function bindGalleryScope(scopeEl, initialItems) {
  if (!scopeEl) return;
  const formEl = scopeEl instanceof HTMLFormElement ? scopeEl : scopeEl.closest("form");
  const galleryContainer = getGalleryScope(scopeEl);
  if (!galleryContainer) return;

  if (Array.isArray(initialItems) && formEl) {
    __PKG_GALLERY_WEAK.set(formEl, normalizeGallery(initialItems));
  }
  if (formEl) renderGalleryThumbnails(formEl);

  const fileInput = galleryContainer.querySelector("[data-paket-galeri-dosya]");
  if (fileInput && !fileInput.dataset.galeriHazir) {
    fileInput.dataset.galeriHazir = "evet";
    fileInput.addEventListener("change", async function () {
      const files = fileInput.files ? Array.from(fileInput.files) : [];
      if (!files.length || !formEl) return;
      const mevcut = getFormGalleryState(formEl);
      const next = mevcut.slice();
      let warning = "";
      let skippedVideo = 0;
      for (let f = 0; f < files.length; f++) {
        const file = files[f];
        try {
          const smart = await readMediaFileSmart(file);
          if (smart.kind === "video" && !/^\.\/|^http(s)?:/i.test(file.name || "")) {
            skippedVideo = skippedVideo + 1;
            continue;
          }
          if (smart && smart.dataUrl) {
            next.push({
              id: createImageId("pkg"),
              url: smart.dataUrl,
              alt: String(file.name || ""),
            });
            if (smart && smart.warning) warning = smart.warning;
          }
        } catch (_) { /* ignore */ }
      }
      setFormGalleryState(formEl, next);
      try { syncFormGalleryToStateAndSave(formEl); } catch (_) { /* ignore */ }
      fileInput.value = "";
      if (skippedVideo > 0) {
        alert("Uyarı: " + skippedVideo + " video dosyası eklenemedi. Videoları sunucuya yükleyip dosya yolunu (./images/...) veya http URL'ini kullanın.");
      } else if (warning) {
        console.warn("[gallery] " + warning);
      }
    });
  }

  const targetForDelegation = formEl ? formEl : galleryContainer;
  if (!targetForDelegation.dataset.galeriDelegasyon) {
    targetForDelegation.dataset.galeriDelegasyon = "evet";
    targetForDelegation.addEventListener("click", function (e) {
      try {
        const formCtx = targetForDelegation instanceof HTMLFormElement ? targetForDelegation : targetForDelegation.closest("form");
        if (!formCtx) return;
        const moveBtn = e.target && e.target.closest ? e.target.closest("[data-galeri-tasi]") : null;
        const delBtn = e.target && e.target.closest ? e.target.closest("[data-galeri-sil]") : null;
        if (moveBtn) {
          const direction = moveBtn.getAttribute("data-galeri-tasi");
          const id = moveBtn.getAttribute("data-galeri-id");
          if (moveBtn.disabled || !direction || !id) return;
          const arr = getFormGalleryState(formCtx);
          const idx = arr.findIndex(function (x) { return x.id === id; });
          if (idx < 0) return;
          let changed = false;
          if (direction === "sol" && idx > 0) {
            const tmp = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = tmp;
            changed = true;
          } else if (direction === "sag" && idx < arr.length - 1) {
            const tmp = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = tmp;
            changed = true;
          }
          if (changed) {
            setFormGalleryState(formCtx, arr);
            try { syncFormGalleryToStateAndSave(formCtx); } catch (_) { /* ignore */ }
          }
        } else if (delBtn) {
          const id = delBtn.getAttribute("data-galeri-sil");
          if (!id) return;
          const label = "Seçili görsel / video";
          const onay = window.confirm("⚠️ " + label + " galeriden KALICI olarak silinsin mi?\nBu işlem GERİ ALINAMAZ. Silinen görsel sayfa yenilemede geri gelmeyecektir.");
          if (!onay) return;
          const arr = getFormGalleryState(formCtx).filter(function (x) { return x.id !== id; });
          setFormGalleryState(formCtx, arr);
          try { syncFormGalleryToStateAndSave(formCtx); } catch (_) { /* ignore */ }
        }
      } catch (_) { /* ignore */ }
    });
  }
}

function buildGallerySectionHtml(pkg) {
  const gallery = normalizeGallery(pkg && pkg.gallery ? pkg.gallery : []);
  let thumbHtml = "";
  if (!gallery.length) {
    thumbHtml = "<p class=\"col-span-full rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-xs leading-6 text-stone-500\">Henüz galeriye görsel veya video eklenmedi. Yukarıdaki dosya seçici ile birden fazla dosya ekleyebilirsiniz.</p>";
  } else {
    for (let i = 0; i < gallery.length; i++) {
      const item = gallery[i];
      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(item.url) || String(item.url).startsWith("data:video");
      const badge = isVideo ? "<span class=\"absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase text-white\">Video</span>" : (i === 0 ? "<span class=\"absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase text-white\">Kapak</span>" : "");
      let mediaHtml = "";
      if (isVideo) {
        mediaHtml = "<video src=\"" + escapeAttribute(item.url) + "\" title=\"" + escapeAttribute(item.alt) + "\" class=\"h-32 w-full object-cover\" muted loop playsinline preload=\"metadata\"></video>";
      } else {
        mediaHtml = "<img src=\"" + escapeAttribute(item.url) + "\" alt=\"" + escapeAttribute(item.alt) + "\" class=\"h-32 w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
      }
      const solDisabled = i === 0 ? " opacity-30 cursor-not-allowed\" disabled=\"disabled\"" : "\"";
      const sagDisabled = i === gallery.length - 1 ? " opacity-30 cursor-not-allowed\" disabled=\"disabled\"" : "\"";
      thumbHtml = thumbHtml +
        "<figure class=\"overflow-hidden rounded-[20px] border border-stone-200 bg-white\">" +
          "<div class=\"relative\">" + mediaHtml + badge + "</div>" +
          "<div class=\"flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-[#FDFBF7] p-2\">" +
            "<div class=\"flex gap-1\">" +
              "<button type=\"button\" data-galeri-tasi=\"sol\" data-galeri-id=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-white px-2 py-1 text-sm font-bold border border-stone-200 text-stone-700" + solDisabled + ">←</button>" +
              "<button type=\"button\" data-galeri-tasi=\"sag\" data-galeri-id=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-white px-2 py-1 text-sm font-bold border border-stone-200 text-stone-700" + sagDisabled + ">→</button>" +
            "</div>" +
            "<button type=\"button\" data-galeri-sil=\"" + escapeAttribute(item.id) + "\" class=\"rounded-xl bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-100\">Sil</button>" +
          "</div>" +
        "</figure>";
    }
  }
  const kapakHidden = gallery.length ? "" : " hidden";
  return "" +
    "<div data-paket-galeri class=\"rounded-[28px] border border-stone-200 bg-[#FDFBF7] p-4\">" +
      "<div class=\"mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between\">" +
        "<div>" +
          "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Paket Galerisi (Çoklu Görsel / Video)</label>" +
          "<p class=\"text-xs leading-6 text-stone-500\">Aynı anda birden fazla dosya seçebilir; yüklendikten sonra sıralarını ← → oklarıyla değiştirebilirsiniz.</p>" +
        "</div>" +
        "<div>" +
          "<input type=\"file\" accept=\"image/*,video/*\" multiple data-paket-galeri-dosya class=\"w-full sm:w-auto rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" />" +
        "</div>" +
      "</div>" +
      "<div data-paket-galeri-kapak class=\"mt-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-500" + kapakHidden + "\">Galerideki ilk görsel, sitedeki kartın büyük kapağı olarak da kullanılır.</div>" +
      "<div data-paket-galeri-liste class=\"mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4\">" + thumbHtml + "</div>" +
    "</div>";
}

function deletePackage(packageId) {
  if (!packageId) return;
  const pkg = state.franchisePackages.find(function (p) { return p && p.id === packageId; });
  const label = pkg && pkg.title ? pkg.title : "seçili bayilik paketi";
  const confirmed = window.confirm("⚠️ " + label + " kalıcı olarak silinsin mi?\nBu işlem GERİ ALINAMAZ. Silinen paket sayfa yenilemelerinde geri gelmeyecektir.");
  if (!confirmed) return;

  if (state.editingPackageId === packageId) {
    resetPackageForm();
  }

  deleteFranchisePackage(packageId);
  state.franchisePackages = getFranchisePackages();
  renderDashboard();
}

function populatePackageForm(packageId) {
  if (!elements.packageForm) return;

  const pkg = state.franchisePackages.find((item) => item.id === packageId);
  if (!pkg) return;

  state.editingPackageId = pkg.id;
  if (elements.packageFormTitle) {
    elements.packageFormTitle.textContent = "Paket Düzenle";
  }
  if (elements.packageFormSubmitButton) {
    elements.packageFormSubmitButton.textContent = "Paketi Güncelle";
  }

  elements.packageForm.elements.title.value = pkg.title;
  elements.packageForm.elements.price.value = pkg.price;
  elements.packageForm.elements.order.value = pkg.order ?? 1;
  elements.packageForm.elements.description.value = pkg.description;
  elements.packageForm.elements.features.value = (pkg.features || []).join("\n");

  const mediaTypeSelect = elements.packageForm.elements.mediaType;
  if (mediaTypeSelect) {
    mediaTypeSelect.value = pkg.mediaType ?? "image";
  }

  const activeCheckbox = elements.packageForm.elements.active;
  if (activeCheckbox) {
    activeCheckbox.checked = pkg.active;
  }

  syncMediaGroupValues(elements.packageForm, {
    media: pkg.media ?? "",
  });

  const gallerySeed = Array.isArray(pkg.gallery) && pkg.gallery.length
    ? pkg.gallery.slice()
    : (pkg.media ? [{ id: createImageId("pkg"), url: pkg.media, alt: pkg.title || "" }] : []);
  setFormGalleryState(elements.packageForm, gallerySeed);

  setTextContent(elements.packageFormFeedback, "");
}

function resetPackageForm() {
  if (!elements.packageForm) return;

  state.editingPackageId = null;
  if (elements.packageFormTitle) {
    elements.packageFormTitle.textContent = "Yeni Paket Ekle";
  }
  if (elements.packageFormSubmitButton) {
    elements.packageFormSubmitButton.textContent = "Paketi Kaydet";
  }
  elements.packageForm.reset();
  if (elements.packageForm.elements.order) {
    elements.packageForm.elements.order.value = 1;
  }
  if (elements.packageForm.elements.mediaType) {
    elements.packageForm.elements.mediaType.value = "image";
  }
  if (elements.packageForm.elements.active) {
    elements.packageForm.elements.active.checked = true;
  }
  resetMediaGroups(elements.packageForm);
  setFormGalleryState(elements.packageForm, []);
  setTextContent(elements.packageFormFeedback, "");
}

function renderPageTitlesForm() {
  if (!elements.pageTitlesForm) return;

  const titles = state.pageTitles;
  const pageKeys = [
    { file: "index", label: "index" },
    { file: "urunlerimiz", label: "urunlerimiz" },
    { file: "hakkimizda", label: "hakkimizda" },
    { file: "bayilerimiz", label: "bayilerimiz" },
    { file: "bayilik-basvurusu", label: "bayilik-basvurusu" },
    { file: "iletisim", label: "iletisim" },
  ];

  pageKeys.forEach(({ file, label }) => {
    const fileKey = `${label}.html`;
    const data = titles[fileKey] ?? {};
    const fields = [
      { field: "title", id: `pt-${file}-title` },
      { field: "headerTitle", id: `pt-${file}-headerTitle` },
      { field: "headerSubtitle", id: `pt-${file}-headerSubtitle` },
    ];
    fields.forEach(({ field, id }) => {
      const input = document.querySelector(`#${id}`);
      if (input) {
        input.value = data[field] ?? "";
      }
    });
  });

  setTextContent(elements.pageTitlesFeedback, "");
}

function handlePageTitlesSave(event) {
  event.preventDefault();
  if (!elements.pageTitlesForm) return;

  const formData = new FormData(elements.pageTitlesForm);
  const fileMappings = [
    "index",
    "urunlerimiz",
    "hakkimizda",
    "bayilerimiz",
    "bayilik-basvurusu",
    "iletisim",
  ];

  const nextTitles = {};
  fileMappings.forEach((file) => {
    const fileKey = `${file}.html`;
    nextTitles[fileKey] = {
      title: formData.get(`${file}.title`)?.toString().trim() ?? "",
      headerTitle: formData.get(`${file}.headerTitle`)?.toString().trim() ?? "",
      headerSubtitle: formData.get(`${file}.headerSubtitle`)?.toString().trim() ?? "",
    };
  });

  savePageTitles(nextTitles);
  state.pageTitles = getPageTitles();
  setTextContent(
    elements.pageTitlesFeedback,
    "Sayfa başlıkları başarıyla kaydedildi. İlgili sayfalarda otomatik olarak güncellenecektir."
  );
  renderDashboard();
}

function renderDealers() {
  if (!elements.dealerList) return;
  if (!state.hasOwnProperty("editingInlineDealerId")) state.editingInlineDealerId = null;

  function isVideoUrl(url) {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)$/i.test(url) || String(url).startsWith("data:video");
  }

  const dealers = Array.isArray(state.dealers) ? state.dealers : [];
  let resultHtml = "";

  resultHtml +=
    "<div class=\"mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[24px] border border-amber-200/70 bg-[#FFF9F0] px-5 py-4\">" +
      "<div class=\"flex items-start gap-3\">" +
        "<span class=\"mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700\">" +
          "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-4 w-4\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z\"/><path d=\"m9 12 2 2 4-4\"/></svg>" +
        "</span>" +
        "<div>" +
          "<p class=\"text-sm font-bold text-stone-900\">Bayi kayıtları otomatik kalıcıdır</p>" +
          "<p class=\"text-xs leading-6 text-stone-500\">Düzenle, Sil veya Yeni Bayi Ekle yaptığınız anda değişiklikler tarayıcınızda localStorage üzerine yazılır ve sayfa yenilemelerinde korunur.</p>" +
        "</div>" +
      "</div>" +
      "<button type=\"button\" data-bayi-liste-kayit-kontrol class=\"rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white\">Kayıtlı Bayileri Doğrula</button>" +
    "</div>";

  for (let i = 0; i < dealers.length; i++) {
    const dealer = dealers[i];
    const isEditing = state.editingInlineDealerId === dealer.id;
    if (!isEditing) {
      let mediaCol = "";
      if (!dealer.image) {
        mediaCol = "<div class=\"flex h-[150px] items-center justify-center bg-[#F7F4EF] px-4 text-center text-sm font-medium text-stone-500\">Şube görseli / videosu eklenmedi</div>";
      } else if (isVideoUrl(dealer.image)) {
        mediaCol = "<video src=\"" + escapeAttribute(dealer.image) + "\" title=\"" + escapeAttribute(dealer.branchName) + " videosu\" class=\"h-[150px] w-full object-cover\" controls muted loop playsinline preload=\"metadata\"></video>";
      } else {
        mediaCol = "<img src=\"" + escapeAttribute(dealer.image) + "\" alt=\"" + escapeAttribute(dealer.branchName) + " görseli\" class=\"h-[150px] w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
      }
      resultHtml +=
        "<article class=\"rounded-[28px] border border-stone-200 bg-[#FDFBF7] p-5 mb-4\" data-bayi-kart-id=\"" + escapeAttribute(dealer.id) + "\">" +
          "<div class=\"grid gap-4 lg:grid-cols-[240px_1fr_220px]\">" +
            "<div class=\"overflow-hidden rounded-[20px] border border-stone-200 bg-white\">" + mediaCol + "</div>" +
            "<div class=\"space-y-2\">" +
              "<p class=\"text-xs font-bold uppercase tracking-[0.2em] text-amber-700\">" + escapeHtml(dealer.city) + " / " + escapeHtml(dealer.district) + "</p>" +
              "<h3 class=\"text-lg font-bold text-stone-900\">" + escapeHtml(dealer.branchName) + "</h3>" +
              "<p class=\"text-sm leading-7 text-stone-600\">" + escapeHtml(dealer.address) + "</p>" +
              "<p class=\"text-sm font-semibold text-stone-700\">" + escapeHtml(dealer.phone) + "</p>" +
              (typeof dealer.workingHours === "string" && dealer.workingHours.trim()
                ? "<p class=\"text-xs leading-6 text-stone-500\">Çalışma Saatleri: " + escapeHtml(dealer.workingHours) + "</p>"
                : "") +
              (typeof dealer.active === "boolean"
                ? ("<p class=\"mt-1 inline-flex items-center gap-2 rounded-full " + (dealer.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500") + " px-3 py-1 text-xs font-bold tracking-[0.18em] uppercase\">" + (dealer.active ? "Aktif Şube" : "Pasif Şube") + "</p>")
                : "") +
            "</div>" +
            "<div class=\"overflow-hidden rounded-[20px] border border-stone-200 bg-white\">" +
              "<iframe src=\"" + escapeAttribute(dealer.mapEmbedUrl) + "\" title=\"" + escapeAttribute(dealer.branchName) + " haritası\" class=\"h-[150px] w-full\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>" +
            "</div>" +
          "</div>" +
          "<div class=\"mt-4 flex flex-wrap gap-2\">" +
            "<button type=\"button\" data-edit-dealer=\"" + escapeAttribute(dealer.id) + "\" class=\"rounded-2xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700\">Düzenle (Soldaki Form)</button>" +
            "<button type=\"button\" data-inline-edit-dealer=\"" + escapeAttribute(dealer.id) + "\" class=\"rounded-2xl bg-stone-900 px-4 py-2 text-sm font-bold text-white\">Kart Üzerinden Düzenle</button>" +
            "<button type=\"button\" data-delete-dealer=\"" + escapeAttribute(dealer.id) + "\" class=\"rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700\">Sil</button>" +
          "</div>" +
        "</article>";
    } else {
      const defImage = dealer.image || "";
      const defMap = dealer.mapEmbedUrl || "";
      resultHtml +=
        "<article class=\"rounded-[28px] border-2 border-amber-400 bg-amber-50/40 p-5 mb-4\" data-bayi-kart-id=\"" + escapeAttribute(dealer.id) + "\">" +
          "<div class=\"mb-4 flex items-center gap-3 rounded-[20px] bg-white px-4 py-3\">" +
            "<span class=\"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white\">" +
              "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"h-4 w-4\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z\"/></svg>" +
            "</span>" +
            "<div>" +
              "<p class=\"text-xs font-bold uppercase tracking-[0.2em] text-amber-700\">Düzenleme Modu</p>" +
              "<h3 class=\"text-lg font-bold text-stone-900\">" + escapeHtml(dealer.branchName) + " — Değişiklikleri doğrudan kart üzerinden kaydedin</h3>" +
            "</div>" +
          "</div>" +
          "<form data-inline-dealer-form=\"" + escapeAttribute(dealer.id) + "\" class=\"space-y-4\">" +
            "<div class=\"grid gap-4 sm:grid-cols-2 lg:grid-cols-4\">" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Şehir</label>" +
                "<input name=\"city\" type=\"text\" value=\"" + escapeAttribute(dealer.city || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" required />" +
              "</div>" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">İlçe</label>" +
                "<input name=\"district\" type=\"text\" value=\"" + escapeAttribute(dealer.district || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" required />" +
              "</div>" +
              "<div class=\"sm:col-span-2\">" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Şube Adı</label>" +
                "<input name=\"branchName\" type=\"text\" value=\"" + escapeAttribute(dealer.branchName || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" required />" +
              "</div>" +
            "</div>" +
            "<div>" +
              "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Şube Adresi</label>" +
              "<input name=\"address\" type=\"text\" value=\"" + escapeAttribute(dealer.address || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" required />" +
            "</div>" +
            "<div class=\"grid gap-4 sm:grid-cols-2\">" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">İletişim Telefonu</label>" +
                "<input name=\"phone\" type=\"text\" value=\"" + escapeAttribute(dealer.phone || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" required />" +
              "</div>" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Çalışma Saatleri</label>" +
                "<input name=\"workingHours\" type=\"text\" value=\"" + escapeAttribute(dealer.workingHours || "") + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" placeholder=\"Hafta içi 09:00 - 23:00 | Hafta sonu 10:00 - 23:00\" />" +
              "</div>" +
            "</div>" +
            "<div class=\"grid gap-4 sm:grid-cols-[1fr_100px]\">" +
              "<div>" +
                "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Şube Görseli URL / Yol</label>" +
                "<input name=\"image\" type=\"text\" value=\"" + escapeAttribute(defImage) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" placeholder=\"./images/Usta Durumu.jpg\" />" +
              "</div>" +
              "<div class=\"flex items-end\">" +
                "<label class=\"inline-flex w-full items-center justify-center rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm font-bold text-stone-700\">" +
                  "<input name=\"active\" type=\"checkbox\" class=\"h-4 w-4 mr-2\" " + (dealer.active !== false ? "checked" : "") + " />" +
                  "Aktif" +
                "</label>" +
              "</div>" +
            "</div>" +
            "<div>" +
              "<label class=\"mb-2 block text-sm font-semibold text-stone-700\">Google Maps Gömme URL</label>" +
              "<input name=\"mapEmbedUrl\" type=\"text\" value=\"" + escapeAttribute(defMap) + "\" class=\"w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm\" placeholder=\"https://www.google.com/maps?q=...&output=embed\" required />" +
            "</div>" +
            "<div class=\"grid gap-4 lg:grid-cols-2\">" +
              "<div class=\"rounded-[24px] border border-stone-200 bg-white p-4\">" +
                "<p class=\"mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700\">Şube Görseli Önizleme</p>" +
                (defImage
                  ? (isVideoUrl(defImage)
                    ? "<video src=\"" + escapeAttribute(defImage) + "\" class=\"h-44 w-full object-cover rounded-[20px]\" muted loop playsinline preload=\"metadata\" controls></video>"
                    : "<img src=\"" + escapeAttribute(defImage) + "\" alt=\"" + escapeAttribute(dealer.branchName) + " önizleme\" class=\"h-44 w-full object-cover rounded-[20px]\" />")
                  : "<div class=\"flex h-44 items-center justify-center rounded-[20px] bg-[#F7F4EF] text-sm text-stone-500\">Henüz görsel ayarlanmadı</div>") +
              "</div>" +
              "<div class=\"rounded-[24px] border border-stone-200 bg-white p-4\">" +
                "<p class=\"mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700\">Harita Önizleme</p>" +
                (defMap
                  ? "<iframe src=\"" + escapeAttribute(defMap) + "\" class=\"h-44 w-full rounded-[20px]\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\" title=\"Harita\"></iframe>"
                  : "<div class=\"flex h-44 items-center justify-center rounded-[20px] bg-[#F7F4EF] text-sm text-stone-500\">Henüz harita URL girilmedi</div>") +
              "</div>" +
            "</div>" +
            "<div class=\"flex flex-col gap-3 sm:flex-row sm:justify-end\">" +
              "<button type=\"button\" data-inline-cancel-dealer=\"" + escapeAttribute(dealer.id) + "\" class=\"rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700\">Değişiklikleri İptal Et</button>" +
              "<button type=\"button\" data-delete-dealer=\"" + escapeAttribute(dealer.id) + "\" class=\"rounded-2xl bg-red-50 px-5 py-3 text-sm font-bold text-red-700\">Bu Şubeyi Sil</button>" +
              "<button type=\"submit\" class=\"rounded-2xl bg-[#6B1818] px-5 py-3 text-sm font-bold text-white\">Değişiklikleri Kaydet</button>" +
            "</div>" +
            "<p data-inline-dealer-feedback=\"" + escapeAttribute(dealer.id) + "\" class=\"text-sm font-medium text-green-700\"></p>" +
          "</form>" +
        "</article>";
    }
  }

  if (!dealers.length) {
    resultHtml += "<div class=\"rounded-[28px] border border-dashed border-stone-300 bg-[#F7F4EF] p-8 text-sm text-stone-500\">Henüz bayi eklenmedi. Soldaki formu kullanarak ilk bayiyi ekleyebilirsiniz.</div>";
  }

  elements.dealerList.innerHTML = resultHtml;

  try {
    const verifyBtn = elements.dealerList.querySelector("[data-bayi-liste-kayit-kontrol]");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", function () {
        try {
          const raw = localStorage.getItem("ckft_corporate_dealers");
          const parsed = raw ? JSON.parse(raw) : null;
          const count = Array.isArray(parsed) ? parsed.length : 0;
          alert("✅ localStorage üzerinde kayıtlı bayi sayısı: " + count + " adet.\nSayfa yenilense veya Vercel'e yeniden deploy edilse bile tarayıcınızda bu kayıtlar korunur.");
        } catch (err) {
          alert("❌ Depolama doğrulanamadı: " + String(err && err.message ? err.message : err));
        }
      });
    }

    elements.dealerList.querySelectorAll("[data-edit-dealer]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          populateDealerForm(button.dataset.editDealer ? button.dataset.editDealer : "");
          if (elements.dealerForm && typeof elements.dealerForm.scrollIntoView === "function") {
            elements.dealerForm.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } catch (_) {}
    });

    elements.dealerList.querySelectorAll("[data-inline-edit-dealer]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          const id = button.dataset.inlineEditDealer || "";
          state.editingInlineDealerId = id;
          renderDealers();
          setTimeout(function () {
            const card = elements.dealerList.querySelector("[data-bayi-kart-id=\"" + id + "\"]");
            if (card && typeof card.scrollIntoView === "function") {
              card.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 60);
        });
      } catch (_) {}
    });

    elements.dealerList.querySelectorAll("[data-inline-cancel-dealer]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          state.editingInlineDealerId = null;
          renderDealers();
        });
      } catch (_) {}
    });

    elements.dealerList.querySelectorAll("[data-delete-dealer]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          deleteDealer(button.dataset.deleteDealer ? button.dataset.deleteDealer : "");
        });
      } catch (_) {}
    });

    elements.dealerList.querySelectorAll("form[data-inline-dealer-form]").forEach(function (form) {
      try {
        form.addEventListener("submit", handleInlineDealerSave);
      } catch (_) {}
    });
  } catch (_) {}
}

function handleInlineDealerSave(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!formEl) return;
  const dealerId = formEl.getAttribute("data-inline-dealer-form") || "";
  if (!dealerId) return;
  const dealerIndex = state.dealers.findIndex(function (d) { return d && d.id === dealerId; });
  if (dealerIndex < 0) return;
  const formData = new FormData(formEl);
  const city = (formData.get("city")?.toString() || "").trim();
  const district = (formData.get("district")?.toString() || "").trim();
  const branchName = (formData.get("branchName")?.toString() || "").trim();
  const address = (formData.get("address")?.toString() || "").trim();
  const phone = (formData.get("phone")?.toString() || "").trim();
  const workingHours = (formData.get("workingHours")?.toString() || "").trim();
  const image = normalizeImagePath((formData.get("image")?.toString() || "").trim());
  const mapEmbedUrl = normalizeMapEmbedInput((formData.get("mapEmbedUrl")?.toString() || "").trim());
  const activeChk = formEl.querySelector("input[name=\"active\"]");
  const active = activeChk ? activeChk.checked : true;
  const feedbackEl = formEl.querySelector("[data-inline-dealer-feedback=\"" + dealerId + "\"]");
  if (!city || !district || !branchName || !address || !phone || !mapEmbedUrl) {
    if (feedbackEl) {
      feedbackEl.classList.remove("text-green-700");
      feedbackEl.classList.add("text-red-700");
      feedbackEl.textContent = "Lütfen şehir, ilçe, şube adı, adres, telefon ve Google Maps URL alanlarını boş bırakmayınız.";
    } else {
      alert("Lütfen zorunlu alanları doldurunuz: şehir, ilçe, şube adı, adres, telefon, harita URL.");
    }
    return;
  }
  const existing = state.dealers[dealerIndex];
  const next = {
    id: dealerId,
    city: city,
    district: district,
    branchName: branchName,
    address: address,
    phone: phone,
    workingHours: workingHours || existing.workingHours || "",
    image: image || existing.image || "",
    mapEmbedUrl: mapEmbedUrl || existing.mapEmbedUrl || "",
    active: active,
  };
  state.dealers[dealerIndex] = next;
  const writeOk = saveDealers(state.dealers);
  state.editingInlineDealerId = null;
  if (feedbackEl) {
    feedbackEl.classList.remove("text-red-700");
    feedbackEl.classList.add("text-green-700");
    feedbackEl.textContent = writeOk ? "✅ Bayi kaydı başarıyla güncellendi ve kalıcı olarak kaydedildi." : "⚠️ Bayi güncellendi ancak depolama alanı dolu olduğu için kalıcı yazılamayabilir.";
  }
  renderDashboard();
}

function handleDealerSave(event) {
  event.preventDefault();
  if (!elements.dealerForm) return;

  const formData = new FormData(elements.dealerForm);
  const currentDealer = state.editingDealerId
    ? state.dealers.find((dealer) => dealer.id === state.editingDealerId)
    : null;

  const rawImageFromForm = formData.get("image")?.toString().trim() ?? "";
  const resolvedImage = rawImageFromForm
    ? normalizeImagePath(rawImageFromForm)
    : currentDealer?.image
      ? normalizeImagePath(currentDealer.image)
      : "";
  const rawWh = formData.get("workingHours")?.toString()?.trim() ?? "";
  const workingHours = rawWh || (currentDealer && typeof currentDealer.workingHours === "string" ? currentDealer.workingHours : "");
  let activeFinal = true;
  try {
    const activeRaw = elements.dealerForm.querySelector('input[name="active"]');
    activeFinal = activeRaw ? activeRaw.checked : (currentDealer ? Boolean(currentDealer.active) : true);
  } catch (_) { activeFinal = true; }

  const normalizedMapEmbedUrl = normalizeMapEmbedInput(
    formData.get("mapEmbedUrl")?.toString().trim() ?? ""
  );
  const payload = {
    id:
      state.editingDealerId ||
      slugify(
        `${formData.get("city")?.toString() ?? ""} ${
          formData.get("district")?.toString() ?? ""
        } ${formData.get("branchName")?.toString() ?? ""}`
      ),
    city: formData.get("city")?.toString().trim() ?? "",
    district: formData.get("district")?.toString().trim() ?? "",
    branchName: formData.get("branchName")?.toString().trim() ?? "",
    address: formData.get("address")?.toString().trim() ?? "",
    phone: formData.get("phone")?.toString().trim() ?? "",
    workingHours: workingHours,
    mapEmbedUrl: normalizedMapEmbedUrl,
    image: resolvedImage,
    active: activeFinal,
  };

  if (
    !payload.city ||
    !payload.district ||
    !payload.branchName ||
    !payload.address ||
    !payload.phone ||
    !payload.mapEmbedUrl
  ) {
    setTextContent(
      elements.dealerFormFeedback,
      "Lütfen şehir, ilçe, şube adı, adres, iletişim ve Google Maps gömme alanlarını doldurunuz. Şube görseli isteğe bağlıdır."
    );
    return;
  }

  if (state.editingDealerId) {
    state.dealers = state.dealers.map((dealer) =>
      dealer.id === state.editingDealerId ? { ...dealer, ...payload } : dealer
    );
  } else {
    state.dealers = [{ ...payload }, ...state.dealers];
  }

  const ok = saveDealers(state.dealers);
  resetDealerForm();
  renderDashboard();
  setTextContent(
    elements.dealerFormFeedback,
    ok
      ? "Bayi kaydı başarıyla kaydedildi ve kalıcı hale getirildi."
      : "Bayi kaydı hazırlandı ancak depolama kotası nedeniyle kalıcı yazılamayabilir."
  );
}

function deleteDealer(dealerId) {
  if (!dealerId) return;
  const dealer = state.dealers.find(function (d) { return d && d.id === dealerId; });
  const label = dealer && dealer.branchName ? dealer.branchName : "seçili şube";
  const confirmed = window.confirm("⚠️ " + label + " kalıcı olarak silinsin mi?\nBu işlem geri alınamaz. Silinen şube sayfa yenilemelerinde geri gelmeyecektir.");
  if (!confirmed) return;

  if (state.editingDealerId === dealerId) {
    resetDealerForm();
  }
  if (state.editingInlineDealerId === dealerId) {
    state.editingInlineDealerId = null;
  }
  state.dealers = state.dealers.filter((d) => d.id !== dealerId);
  saveDealers(state.dealers);
  persistDeleteDealer(dealerId);
  renderDashboard();
}
function populateDealerForm(dealerId) {
  if (!elements.dealerForm) return;

  const dealer = state.dealers.find((item) => item.id === dealerId);
  if (!dealer) return;

  state.editingDealerId = dealer.id;
  if (elements.dealerFormTitle) {
    elements.dealerFormTitle.textContent = "Bayi Düzenle";
  }
  if (elements.dealerFormSubmitButton) {
    elements.dealerFormSubmitButton.textContent = "Bayi Kaydını Güncelle";
  }
  elements.dealerForm.elements.city.value = dealer.city;
  elements.dealerForm.elements.district.value = dealer.district;
  elements.dealerForm.elements.branchName.value = dealer.branchName;
  elements.dealerForm.elements.address.value = dealer.address;
  elements.dealerForm.elements.phone.value = dealer.phone;
  elements.dealerForm.elements.mapEmbedUrl.value = dealer.mapEmbedUrl;
  syncMediaGroupValues(elements.dealerForm, {
    image: dealer.image ?? "",
  });
  setTextContent(elements.dealerFormFeedback, "");
}

function resetDealerForm() {
  if (!elements.dealerForm) return;

  state.editingDealerId = null;
  if (elements.dealerFormTitle) {
    elements.dealerFormTitle.textContent = "Yeni Bayi Ekle";
  }
  if (elements.dealerFormSubmitButton) {
    elements.dealerFormSubmitButton.textContent = "Bayi Kaydını Kaydet";
  }
  elements.dealerForm.reset();
  resetMediaGroups(elements.dealerForm);
  setTextContent(elements.dealerFormFeedback, "");
}

function renderApplications() {
  if (!elements.applicationTable) return;

  const apps = Array.isArray(state.applications) ? state.applications : [];
  const statusList = Array.isArray(applicationStatuses) ? applicationStatuses : [];
  let rowsHtml = "";
  for (let i = 0; i < apps.length; i++) {
    const application = apps[i];
    let statusOptionsHtml = "";
    for (let j = 0; j < statusList.length; j++) {
      const status = statusList[j];
      statusOptionsHtml += "<option value=\"" + escapeAttribute(status) + "\" " + (application.status === status ? "selected" : "") + ">" + escapeHtml(status) + "</option>";
    }
    rowsHtml = rowsHtml +
      "<tr class=\"border-b border-stone-100 align-top\">" +
        "<td class=\"px-4 py-4\">" +
          "<div class=\"font-semibold text-stone-900\">" + escapeHtml(application.fullName) + "</div>" +
          "<div class=\"text-sm text-stone-500\">" + escapeHtml(application.email) + "</div>" +
        "</td>" +
        "<td class=\"px-4 py-4 text-sm text-stone-600\">" + escapeHtml(application.phone) + "</td>" +
        "<td class=\"px-4 py-4 text-sm text-stone-600\">" + escapeHtml(application.cityDistrict) + "</td>" +
        "<td class=\"px-4 py-4 text-sm text-stone-600\">" + formatDate(application.submittedAt) + "</td>" +
        "<td class=\"px-4 py-4\">" +
          "<span class=\"status-pill " + statusClassName(application.status) + "\">" + escapeHtml(application.status) + "</span>" +
        "</td>" +
        "<td class=\"px-4 py-4\">" +
          "<details class=\"min-w-[320px] rounded-2xl border border-stone-200 bg-white p-3\">" +
            "<summary class=\"cursor-pointer text-sm font-bold text-[#6B1818]\">Tam Yetkiyle Düzenle</summary>" +
            "<form data-application-edit=\"" + escapeAttribute(application.id) + "\" class=\"mt-4 grid gap-3\">" +
              "<input name=\"fullName\" value=\"" + escapeAttribute(application.fullName || "") + "\" placeholder=\"Ad Soyad\" class=\"rounded-xl border border-stone-200 px-3 py-2\" required />" +
              "<input name=\"phone\" value=\"" + escapeAttribute(application.phone || "") + "\" placeholder=\"Telefon\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<input name=\"email\" type=\"email\" value=\"" + escapeAttribute(application.email || "") + "\" placeholder=\"E-posta\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<input name=\"cityDistrict\" value=\"" + escapeAttribute(application.cityDistrict || "") + "\" placeholder=\"Şehir / İlçe\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<input name=\"packageName\" value=\"" + escapeAttribute(application.packageName || "") + "\" placeholder=\"Paket adı\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<input name=\"packageId\" value=\"" + escapeAttribute(application.packageId || "") + "\" placeholder=\"Paket kimliği\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<textarea name=\"message\" rows=\"4\" placeholder=\"Başvuru mesajı / yönetici notu\" class=\"rounded-xl border border-stone-200 px-3 py-2\">" + escapeHtml(application.message || "") + "</textarea>" +
              "<input name=\"submittedAt\" type=\"datetime-local\" value=\"" + escapeAttribute(toDateTimeLocalValue(application.submittedAt)) + "\" class=\"rounded-xl border border-stone-200 px-3 py-2\" />" +
              "<select name=\"status\" class=\"rounded-xl border border-stone-200 px-3 py-2\">" + statusOptionsHtml + "</select>" +
              "<div class=\"flex gap-2\">" +
                "<button type=\"submit\" class=\"flex-1 rounded-xl bg-[#6B1818] px-4 py-2 text-sm font-bold text-white\">Değişiklikleri Kaydet</button>" +
                "<button type=\"button\" data-delete-application=\"" + escapeAttribute(application.id) + "\" class=\"rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700\">Sil</button>" +
              "</div>" +
            "</form>" +
          "</details>" +
        "</td>" +
      "</tr>";
  }
  if (!apps.length) {
    rowsHtml = "<tr><td colspan=\"6\" class=\"px-4 py-8 text-center text-sm text-stone-500\">Henüz başvuru bulunmuyor.</td></tr>";
  }

  elements.applicationTable.innerHTML = rowsHtml;

  try {
    elements.applicationTable.querySelectorAll("[data-application-edit]").forEach(function (form) {
      try {
        form.addEventListener("submit", handleApplicationEdit);
      } catch (_) {}
    });
    elements.applicationTable.querySelectorAll("[data-delete-application]").forEach(function (button) {
      try { button.addEventListener("click", function () { deleteApplicationFull(button.dataset.deleteApplication || ""); }); } catch (_) {}
    });
  } catch (_) {}
}
function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function handleApplicationEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const applicationId = form.dataset.applicationEdit || "";
  const data = new FormData(form);
  state.applications = state.applications.map((application) => application.id === applicationId ? {
    ...application,
    fullName: String(data.get("fullName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    cityDistrict: String(data.get("cityDistrict") || "").trim(),
    packageName: String(data.get("packageName") || "").trim(),
    packageId: String(data.get("packageId") || "").trim(),
    message: String(data.get("message") || "").trim(),
    submittedAt: String(data.get("submittedAt") || "").trim() || application.submittedAt,
    status: String(data.get("status") || "Yeni").trim(),
  } : application);
  saveApplications(state.applications);
  renderDashboard();
}

function deleteApplicationFull(applicationId) {
  if (!applicationId) return;
  const application = state.applications.find((item) => item.id === applicationId);
  const label = application?.fullName || "Seçili başvuru";
  if (!window.confirm(`⚠️ ${label} başvurusu kalıcı olarak silinsin mi?\nBu işlem geri alınamaz.`)) return;
  state.applications = state.applications.filter((item) => item.id !== applicationId);
  saveApplications(state.applications);
  renderDashboard();
}

function renderSettingsForm() {
  if (!elements.settingsForm) return;

  const content = state.siteContent;
  setTextContent(elements.adminBrandName, content.brandName || "Osmanlı Adıyaman Çiğköfte");
  const names = [
    "brandName",
    "slogan",
    "heroDescription",
    "journeyTitle",
    "journeyText",
    "qualityTitle",
    "qualityText",
    "franchiseTitle",
    "franchiseSlogan",
    "franchiseText",
    "visionTitle",
    "visionPoint1Title",
    "visionPoint1Text",
    "visionPoint2Title",
    "visionPoint2Text",
    "visionPoint3Title",
    "visionPoint3Text",
    "whyUsTitle",
    "whyUsText1",
    "whyUsText2",
    "whyUsText3",
    "aboutStory",
    "aboutQuality",
    "aboutVision",
    "contactPhone",
    "whatsappPhone",
    "contactEmail",
    "contactHours",
    "contactAddress",
    "headquartersTitle",
    "mapPlaceholder",
    "headquartersMapEmbedUrl",
  ];

  names.forEach((name) => {
    if (elements.settingsForm?.elements[name]) {
      elements.settingsForm.elements[name].value = content[name] ?? "";
    }
  });

  bindMediaGroups(elements.settingsForm);
  syncMediaGroupValues(elements.settingsForm, {
    logoUrl: getSiteLogo() || content.logoUrl,
    journeyImageUrl: content.journeyImageUrl,
    franchiseImageUrl: content.franchiseImageUrl,
    visionImageUrl: content.visionImageUrl,
  });
  setTextContent(elements.logoFeedback, "");
}

function renderImageManagers() {
  renderImageList(elements.foodImagesList, state.siteContent.foodImages ?? [], "food");
}

function renderHeroCardForm() {
  if (!elements.heroCardForm) return;

  const content = state.siteContent;
  const names = [
    "heroCardProductLabel",
    "heroCardProductValue",
    "heroCardDealerLabel",
    "heroCardDealerValue",
    "heroCardApplicationLabel",
    "heroCardApplicationValue",
    "heroCardSummaryLabel",
    "heroCardSummaryText",
  ];

  names.forEach((name) => {
    if (elements.heroCardForm?.elements[name]) {
      elements.heroCardForm.elements[name].value = content[name] ?? "";
    }
  });
}

function initializeAdminTabs() {
  if (!elements) return;
  if (!elements.adminTabButtons || !Array.isArray(elements.adminTabButtons) || !elements.adminTabButtons.length) {
    return;
  }
  elements.adminTabButtons.forEach((button) => {
    if (!button || !(button instanceof Element)) return;
    try {
      button.addEventListener("click", () => {
        try {
          const nextTab = button.dataset.adminTab ?? "genel-bakis";
          state.activeTab = nextTab;
          try { sessionStorage.setItem(ADMIN_TAB_KEY, nextTab); } catch (e) {}
          applyActiveTab();
        } catch (inner) {
          console.error("[admin] sekme tıklama hatası:", inner);
        }
      });
    } catch (e) {
      console.warn("[admin] sekme butonu dinleyici bağlanamadı:", e);
    }
  });

  try { applyActiveTab(); } catch (e) { console.error("[admin] applyActiveTab ilk çağrı hatası:", e); }
}

function applyActiveTab() {
  if (!state) {
    state = {};
  }

  if (!state.activeTab) {
    try {
      state.activeTab = sessionStorage.getItem(ADMIN_TAB_KEY) || "genel-bakis";
    } catch (_) {
      state.activeTab = "genel-bakis";
    }
  }

  let panels = [];
  let buttons = [];

  if (elements && Array.isArray(elements.adminPanels) && elements.adminPanels.length) {
    panels = elements.adminPanels;
  } else {
    try {
      panels = Array.from(document.querySelectorAll("[data-admin-panel]") || []);
    } catch (_) { panels = []; }
  }

  if (elements && Array.isArray(elements.adminTabButtons) && elements.adminTabButtons.length) {
    buttons = elements.adminTabButtons;
  } else {
    try {
      buttons = Array.from(document.querySelectorAll("[data-admin-tab]") || []);
    } catch (_) { buttons = []; }
  }

  try {
    let hasActivePanel = false;
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      if (panel && panel instanceof Element && panel.dataset.adminPanel === state.activeTab) {
        hasActivePanel = true;
        break;
      }
    }
    if (!hasActivePanel) {
      state.activeTab = "genel-bakis";
      try { sessionStorage.setItem(ADMIN_TAB_KEY, state.activeTab); } catch (_) {}
    }
  } catch (panelErr) {
    console.warn("[admin] aktif panel kontrol hatası:", panelErr);
    state.activeTab = "genel-bakis";
  }

  try {
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      if (!panel || !(panel instanceof Element)) continue;
      try {
        panel.classList.add("hidden");
      } catch (_) {}
    }
  } catch (_) {}

  try {
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (!button || !(button instanceof Element)) continue;
      try {
        button.classList.remove("admin-nav-link-active");
        button.classList.remove("bg-white/10");
        button.classList.add("text-red-100/80");
      } catch (_) {}
    }
  } catch (_) {}

  try {
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (!button || !(button instanceof Element)) continue;
      if (button.dataset.adminTab === state.activeTab) {
        try {
          button.classList.add("admin-nav-link-active");
          button.classList.add("bg-white/10");
          button.classList.remove("text-red-100/80");
        } catch (_) {}
      }
    }
  } catch (_) {}

  try {
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      if (!panel || !(panel instanceof Element)) continue;
      if (panel.dataset.adminPanel === state.activeTab) {
        try {
          panel.classList.remove("hidden");
        } catch (_) {}
      }
    }
  } catch (_) {}
}

function handleSettingsSave(event) {
  event.preventDefault();
  if (!elements.settingsForm) return;

  const formData = new FormData(elements.settingsForm);
  const nextLogoUrl =
    normalizeImagePath(formData.get("logoUrl")?.toString().trim() ?? "") ||
    state.siteContent.logoUrl;
  if (nextLogoUrl) {
    saveSiteLogo(nextLogoUrl);
  }
  const payload = {
    brandName: formData.get("brandName")?.toString().trim() ?? "",
    logoUrl: nextLogoUrl,
    slogan: formData.get("slogan")?.toString().trim() ?? "",
    heroDescription: formData.get("heroDescription")?.toString().trim() ?? "",
    journeyTitle: formData.get("journeyTitle")?.toString().trim() ?? "",
    journeyText: formData.get("journeyText")?.toString().trim() ?? "",
    journeyImageUrl:
      normalizeImagePath(formData.get("journeyImageUrl")?.toString().trim() ?? "") ||
      state.siteContent.journeyImageUrl,
    qualityTitle: formData.get("qualityTitle")?.toString().trim() ?? "",
    qualityText: formData.get("qualityText")?.toString().trim() ?? "",
    franchiseTitle: formData.get("franchiseTitle")?.toString().trim() ?? "",
    franchiseSlogan: formData.get("franchiseSlogan")?.toString().trim() ?? "",
    franchiseText: formData.get("franchiseText")?.toString().trim() ?? "",
    franchiseImageUrl:
      normalizeImagePath(formData.get("franchiseImageUrl")?.toString().trim() ?? "") ||
      state.siteContent.franchiseImageUrl,
    visionTitle: formData.get("visionTitle")?.toString().trim() ?? "",
    visionImageUrl:
      normalizeImagePath(formData.get("visionImageUrl")?.toString().trim() ?? "") ||
      state.siteContent.visionImageUrl,
    visionPoint1Title: formData.get("visionPoint1Title")?.toString().trim() ?? "",
    visionPoint1Text: formData.get("visionPoint1Text")?.toString().trim() ?? "",
    visionPoint2Title: formData.get("visionPoint2Title")?.toString().trim() ?? "",
    visionPoint2Text: formData.get("visionPoint2Text")?.toString().trim() ?? "",
    visionPoint3Title: formData.get("visionPoint3Title")?.toString().trim() ?? "",
    visionPoint3Text: formData.get("visionPoint3Text")?.toString().trim() ?? "",
    whyUsTitle: formData.get("whyUsTitle")?.toString().trim() ?? "",
    whyUsText1: formData.get("whyUsText1")?.toString().trim() ?? "",
    whyUsText2: formData.get("whyUsText2")?.toString().trim() ?? "",
    whyUsText3: formData.get("whyUsText3")?.toString().trim() ?? "",
    aboutStory: formData.get("aboutStory")?.toString().trim() ?? "",
    aboutQuality: formData.get("aboutQuality")?.toString().trim() ?? "",
    aboutVision: formData.get("aboutVision")?.toString().trim() ?? "",
    contactPhone: formData.get("contactPhone")?.toString().trim() ?? "",
    whatsappPhone: formData.get("whatsappPhone")?.toString().trim() ?? "",
    contactEmail: formData.get("contactEmail")?.toString().trim() ?? "",
    contactHours: formData.get("contactHours")?.toString().trim() ?? "",
    contactAddress: formData.get("contactAddress")?.toString().trim() ?? "",
    headquartersTitle: formData.get("headquartersTitle")?.toString().trim() ?? "",
    mapPlaceholder: formData.get("mapPlaceholder")?.toString().trim() ?? "",
    headquartersMapEmbedUrl:
      formData.get("headquartersMapEmbedUrl")?.toString().trim() ?? "",
  };

  saveSiteContent(payload);
  state.siteContent = getSiteContent();
  setTextContent(
    elements.settingsFeedback,
    "Genel ayarlar ve bölüm içerikleri başarıyla kaydedildi."
  );
  renderDashboard();
}

function handleHeroCardSave(event) {
  event.preventDefault();
  if (!elements.heroCardForm) return;

  const formData = new FormData(elements.heroCardForm);
  const payload = {
    heroCardProductLabel:
      formData.get("heroCardProductLabel")?.toString().trim() ?? "",
    heroCardProductValue:
      formData.get("heroCardProductValue")?.toString().trim() ?? "",
    heroCardDealerLabel:
      formData.get("heroCardDealerLabel")?.toString().trim() ?? "",
    heroCardDealerValue:
      formData.get("heroCardDealerValue")?.toString().trim() ?? "",
    heroCardApplicationLabel:
      formData.get("heroCardApplicationLabel")?.toString().trim() ?? "",
    heroCardApplicationValue:
      formData.get("heroCardApplicationValue")?.toString().trim() ?? "",
    heroCardSummaryLabel:
      formData.get("heroCardSummaryLabel")?.toString().trim() ?? "",
    heroCardSummaryText:
      formData.get("heroCardSummaryText")?.toString().trim() ?? "",
  };

  saveSiteContent(payload);
  state.siteContent = getSiteContent();
  setTextContent(
    elements.heroCardFeedback,
    "Ana sayfa sağ kart içeriği başarıyla kaydedildi."
  );
  renderDashboard();
}

function handlePasswordChange(event) {
  event.preventDefault();
  if (!elements.passwordForm) return;

  const formData = new FormData(elements.passwordForm);
  const oldPassword = formData.get("oldPassword")?.toString().trim() ?? "";
  const newPassword = formData.get("newPassword")?.toString().trim() ?? "";
  const newPasswordRepeat =
    formData.get("newPasswordRepeat")?.toString().trim() ?? "";

  if (!oldPassword || !newPassword || !newPasswordRepeat) {
    setTextContent(
      elements.passwordFeedback,
      "Lütfen tüm şifre alanlarını doldurunuz."
    );
    return;
  }

  if (newPassword.length < 8) {
    setTextContent(
      elements.passwordFeedback,
      "Yeni şifre en az 8 karakter olmalıdır."
    );
    return;
  }

  if (newPassword !== newPasswordRepeat) {
    setTextContent(
      elements.passwordFeedback,
      "Yeni şifre alanları birbiriyle eşleşmiyor."
    );
    return;
  }

  const result = updateAdminPassword(oldPassword, newPassword);
  setTextContent(elements.passwordFeedback, result.message);

  if (result.success) {
    elements.passwordForm.reset();
  }
}

async function handleStoreImagesSave(event) {
  event.preventDefault();
  if (!elements.storeImagesForm) return;

  const input = elements.storeImagesForm.elements.storeImagesInput;
  const files = Array.from(input.files ?? []);

  if (!files.length) {
    setTextContent(
      elements.storeImagesFeedback,
      "Lütfen en az bir şube görseli seçiniz."
    );
    return;
  }

  const uploadedImages = await Promise.all(
    files.map((file, index) =>
      fileToImageItem(file, "store", `Şube Görseli ${index + 1}`)
    )
  );

  saveSiteContent({
    storeImages: [...(state.siteContent.storeImages ?? []), ...uploadedImages],
  });
  state.siteContent = getSiteContent();
  setTextContent(elements.storeImagesFeedback, "Şube görselleri kaydedildi.");
  elements.storeImagesForm.reset();
  renderDashboard();
}

async function handleFoodImagesSave(event) {
  event.preventDefault();
  if (!elements.foodImagesForm) return;

  const input = elements.foodImagesForm.elements.foodImagesInput;
  const files = Array.from(input.files ?? []);

  if (!files.length) {
    setTextContent(
      elements.foodImagesFeedback,
      "Lütfen en az bir ürün görseli seçiniz."
    );
    return;
  }

  const uploadedImages = await Promise.all(
    files.map((file, index) =>
      fileToImageItem(file, "food", `Ürün Görseli ${index + 1}`)
    )
  );

  saveSiteContent({
    foodImages: [...(state.siteContent.foodImages ?? []), ...uploadedImages],
  });
  state.siteContent = getSiteContent();
  setTextContent(elements.foodImagesFeedback, "Ürün görselleri kaydedildi.");
  elements.foodImagesForm.reset();
  renderDashboard();
}

function renderImageList(container, images, type) {
  if (!container) return;

  function isVideoUrl(url) {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)$/i.test(url) || String(url).startsWith("data:video");
  }

  if (!images || !images.length) {
    container.innerHTML = "<div class=\"rounded-[28px] border border-dashed border-stone-300 bg-[#FDFBF7] p-6 text-sm text-stone-500 sm:col-span-2\">Henüz görsel veya video eklenmedi.</div>";
    return;
  }

  let resultHtml = "";
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const itemIsVideo = isVideoUrl(item.url);
    let mediaTag = "";
    if (itemIsVideo) {
      mediaTag = "<video src=\"" + escapeAttribute(item.url) + "\" title=\"" + escapeAttribute(item.alt) + "\" class=\"h-40 w-full object-cover\" controls muted loop playsinline preload=\"metadata\"></video>";
    } else {
      mediaTag = "<img src=\"" + escapeAttribute(item.url) + "\" alt=\"" + escapeAttribute(item.alt) + "\" class=\"h-40 w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
    }
    const badge = itemIsVideo ? " <span class=\"rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-500\">Video</span>" : "";
    const label = itemIsVideo ? "Videoyu Sil" : "Görseli Sil";
    resultHtml = resultHtml +
      "<article class=\"overflow-hidden rounded-[24px] border border-stone-200 bg-[#FDFBF7]\">" +
        mediaTag +
        "<div class=\"space-y-3 p-4\">" +
          "<p class=\"text-sm font-semibold text-stone-800\">" + escapeHtml(item.alt) + badge + "</p>" +
          "<button type=\"button\" data-image-type=\"" + escapeAttribute(type) + "\" data-image-id=\"" + escapeAttribute(item.id) + "\" class=\"w-full rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700\">" + label + "</button>" +
        "</div>" +
      "</article>";
  }
  container.innerHTML = resultHtml;

  try {
    container.querySelectorAll("[data-image-id]").forEach(function (button) {
      try {
        button.addEventListener("click", function () {
          deleteImage(
            button.dataset.imageType ? button.dataset.imageType : "",
            button.dataset.imageId ? button.dataset.imageId : ""
          );
        });
      } catch (_) {}
    });
  } catch (_) {}
}
function deleteImage(type, imageId) {
  if (!type || !imageId) return;

  const key = type === "store" ? "storeImages" : "foodImages";
  const nextImages = (state.siteContent[key] ?? []).filter(
    (image) => image.id !== imageId
  );

  saveSiteContent({
    [key]: nextImages,
  });

  state.siteContent = getSiteContent();
  renderDashboard();
}

function fileToImageItem(file, prefix, altText) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: createImageId(prefix),
        url: reader.result,
        alt: altText,
      });
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

function bindMediaGroups(scope) {
  if (!(scope instanceof Element)) return;

  scope.querySelectorAll("[data-medya-grubu]").forEach((group) => {
    if (group.dataset.medyaHazir === "evet") {
      updateMediaPreview(group);
      return;
    }

    const fileInput = group.querySelector("[data-medya-dosya]");

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      let value = "";
      let videoBlocked = false;
      try {
        const smart = await readMediaFileSmart(file);
        if (smart && smart.kind === "video") {
          videoBlocked = true;
          value = smart.dataUrl || "";
        } else {
          value = smart && smart.dataUrl ? smart.dataUrl : (await readFileAsDataUrl(file));
        }
      } catch (_) {
        value = "";
      }
      if (!value) return;
      applyMediaValue(group, value);
      updateMediaPreview(group);
      try { await handleAutoSaveMediaGroup(group, value); } catch (_) { /* ignore */ }
      if (videoBlocked) {
        alert("Uyarı: Video dosyaları localStorage kotasını çok hızlı doldurur. Videoları sunucuya yükleyip dosya yolunu (./images/...) veya doğrudan http URL'ini kullanın.");
      }
    });

    group.dataset.medyaHazir = "evet";
    applyMediaValue(group, getMediaValue(group));
    updateMediaPreview(group);
  });
}

async function handleAutoSaveMediaGroup(group, value) {
  const autoSaveType = group.dataset.otomatikKaydet ?? "";
  if (autoSaveType !== "logo") {
    return;
  }

  saveSiteContent({
    logoUrl: value,
  });
  saveSiteLogo(value);
  state.siteContent = getSiteContent();
  setTextContent(elements.logoFeedback, "Logo başarıyla yüklendi.");
}

function updateMediaPreview(group) {
  const preview = group.querySelector("[data-medya-onizleme]");
  if (!preview) {
    return;
  }

  function isVideoUrl(url) {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)$/i.test(url) || String(url).startsWith("data:video");
  }

  const src = getMediaValue(group);

  if (!src) {
    if (preview instanceof HTMLImageElement) {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
    } else if (preview instanceof HTMLVideoElement) {
      preview.removeAttribute("src");
      preview.classList.add("hidden");
    } else {
      preview.innerHTML = "";
      preview.classList.add("hidden");
    }
    return;
  }

  const isVideo = isVideoUrl(src);

  if (preview instanceof HTMLImageElement) {
    if (isVideo) {
      preview.classList.add("hidden");
      return;
    }
    preview.src = src;
    preview.classList.remove("hidden");
  } else if (preview instanceof HTMLVideoElement) {
    if (!isVideo) {
      preview.classList.add("hidden");
      return;
    }
    preview.src = src;
    preview.controls = true;
    preview.muted = true;
    preview.loop = true;
    preview.playsInline = true;
    preview.classList.remove("hidden");
  } else {
    preview.classList.remove("hidden");
    if (isVideo) {
      preview.innerHTML = "<video src=\"" + escapeAttribute(src) + "\" class=\"h-full w-full object-cover\" controls muted loop playsinline preload=\"metadata\"></video>";
    } else {
      preview.innerHTML = "<img src=\"" + escapeAttribute(src) + "\" alt=\"Önizleme\" class=\"h-full w-full object-cover\" loading=\"lazy\" decoding=\"async\" />";
    }
  }
}
function resetMediaGroups(scope) {
  if (!(scope instanceof Element)) return;
  scope.querySelectorAll("[data-medya-grubu]").forEach((group) => {
    applyMediaValue(group, "");
    updateMediaPreview(group);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() ?? "");
    reader.onerror = () => reject(new Error("Görsel yüklenemedi."));
    reader.readAsDataURL(file);
  });
}

const COMPRESSED_IMAGE_MAX_SIDE = 1280;
const COMPRESSED_IMAGE_QUALITY = 0.82;
const COMPRESSED_IMAGE_MAX_BYTES = 520 * 1024;
const LARGE_MEDIA_WARN_BYTES = 900 * 1024;

function computeApproxDataUrlBytes(str) {
  if (typeof str !== "string" || !str) return 0;
  return Math.round((str.length * 3) / 4);
}

async function compressImageDataUrl(dataUrl, opts) {
  const options = opts || {};
  const maxSide = Number(options.maxSide || COMPRESSED_IMAGE_MAX_SIDE) || 1280;
  const quality = Number(options.quality || COMPRESSED_IMAGE_QUALITY) || 0.82;
  const maxBytes = Number(options.maxBytes || COMPRESSED_IMAGE_MAX_BYTES) || (520 * 1024);
  try {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    if (!/^data:image\/(png|jpe?g|webp|gif|bmp);/i.test(dataUrl)) return dataUrl;
    const img = await (new Promise(function (res, rej) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error("Resim açılamadı.")); };
      im.src = dataUrl;
    }));
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    if (!origW || !origH) return dataUrl;
    let scale = Math.min(1, maxSide / Math.max(origW, origH));
    if (scale <= 0) scale = 1;
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));
    const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!canvas) return dataUrl;
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    let finalUrl = "";
    let curQuality = quality;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = canvas.toDataURL("image/jpeg", Math.max(0.35, curQuality));
      finalUrl = candidate;
      if (computeApproxDataUrlBytes(candidate) <= maxBytes) break;
      curQuality = curQuality - 0.16;
    }
    if (!finalUrl) finalUrl = dataUrl;
    return finalUrl;
  } catch (_) {
    return dataUrl;
  }
}

async function readMediaFileSmart(file, opts) {
  const options = opts || {};
  const name = String(file && file.name || "").toLowerCase();
  const isVideo = file && file.type && String(file.type).startsWith("video/");
  const isImage = file && file.type && String(file.type).startsWith("image/");
  if (!isImage && !isVideo && /\.(mp4|webm|ogg|mov)$/i.test(name)) {
    const raw = await readFileAsDataUrl(file);
    return { kind: "video", dataUrl: raw, size: file && file.size || 0, warning: "" };
  }
  if (isImage || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) {
    const raw = await readFileAsDataUrl(file);
    const compressed = options.compress === false ? raw : await compressImageDataUrl(raw, {
      maxSide: options.maxSide || COMPRESSED_IMAGE_MAX_SIDE,
      quality: options.quality || COMPRESSED_IMAGE_QUALITY,
      maxBytes: options.maxBytes || COMPRESSED_IMAGE_MAX_BYTES,
    });
    const rawSz = computeApproxDataUrlBytes(raw || "");
    const finalSz = computeApproxDataUrlBytes(compressed || "");
    const warningMsg = finalSz >= LARGE_MEDIA_WARN_BYTES ? "Depolama kotası nedeniyle büyük medya sıkıştırıldı. Kaynak dosyayı harici URL olarak kullanmak daha güvenlidir." : "";
    return { kind: "image", dataUrl: compressed || raw, size: finalSz || rawSz, warning: warningMsg };
  }
  const raw = await readFileAsDataUrl(file);
  const sz = computeApproxDataUrlBytes(raw || "");
  const warningMsg = sz >= LARGE_MEDIA_WARN_BYTES ? "Bu medya dosyası çok büyük. Sıkıştırılmış bir görsel kullanmanız önerilir." : "";
  return { kind: "other", dataUrl: raw, size: sz, warning: warningMsg };
}

function kategoriSecenekleri(selectedCategory) {
  const options = [
    ["durumler", "Dürümler"],
    ["porsiyonlar", "Porsiyonlar"],
    ["etsiz-cigkofte", "Etsiz Çiğköfte Çeşitleri"],
    ["ikramliklar", "Özel İkramlıklar"],
  ];
  let html = "";
  for (let i = 0; i < options.length; i++) {
    const pair = options[i];
    const value = pair[0];
    const label = pair[1];
    const sel = selectedCategory === value ? "selected" : "";
    html = html + "<option value=\"" + escapeAttribute(value) + "\" " + sel + ">" + escapeHtml(label) + "</option>";
  }
  return html;
}
function normalizeImagePath(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("./images/") ||
    trimmed.startsWith("../images/")
  ) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("images/")) {
    return `./${normalized}`;
  }

  if (/^[^/]+\.(png|jpe?g|webp|gif|svg|mp4|webm|ogg|mov)$/i.test(normalized)) {
    return `./images/${normalized}`;
  }

  return normalized;
}

function normalizeMapEmbedInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const iframeSrcMatch = trimmed.match(/src=(["'])(.*?)\1/i);
  if (iframeSrcMatch?.[2]) {
    return iframeSrcMatch[2].trim();
  }

  return trimmed;
}

function getMediaValue(group) {
  if (!(group instanceof Element)) return "";

  const form = group.closest("form");
  const fieldName = group.dataset.medyaAlani ?? "";
  if (!form || !(form instanceof HTMLFormElement) || !fieldName) {
    return "";
  }

  const field = form.elements.namedItem(fieldName);
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    return normalizeImagePath(field.value.trim());
  }

  return normalizeImagePath(group.dataset.medyaBaslangic ?? "");
}

function applyMediaValue(group, value) {
  if (!(group instanceof Element)) return;

  const form = group.closest("form");
  const fieldName = group.dataset.medyaAlani ?? "";
  if (!form || !(form instanceof HTMLFormElement) || !fieldName) {
    return;
  }

  let hidden = group.querySelector(`input[type="hidden"][data-medya-gizli="${fieldName}"]`);
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = fieldName;
    hidden.dataset.medyaGizli = fieldName;
    group.append(hidden);
  }

  const normalizedValue = normalizeImagePath(value);
  hidden.value = normalizedValue;
  group.dataset.medyaBaslangic = normalizedValue;
}

function syncMediaGroupValues(scope, values) {
  if (!(scope instanceof Element)) return;

  scope.querySelectorAll("[data-medya-grubu]").forEach((group) => {
    const fieldName = group.dataset.medyaAlani ?? "";
    if (!fieldName || !(fieldName in values)) {
      return;
    }

    applyMediaValue(group, values[fieldName] ?? "");
    updateMediaPreview(group);
  });
}

function setTextContent(element, value) {
  if (element) {
    element.textContent = value;
  }
}

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

