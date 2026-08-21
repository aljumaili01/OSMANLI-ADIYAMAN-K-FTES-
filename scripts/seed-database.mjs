import {
  CURRENT_DATA_VERSION,
  defaultAdminAuth,
  defaultApplications,
  defaultDealers,
  defaultFranchisePackages,
  defaultPageTitles,
  defaultProducts,
  defaultSiteContent,
} from "../assets/js/shared/data.js";

const apiBase = String(process.env.CKFT_API_BASE || "").replace(/\/$/, "");
const apiSecret = String(process.env.CKFT_API_SECRET || "");

if (!apiBase || !apiSecret) {
  throw new Error("CKFT_API_BASE ve CKFT_API_SECRET ortam değişkenleri zorunludur.");
}

const tables = {
  products: defaultProducts,
  dealers: defaultDealers,
  applications: defaultApplications,
  site_content: defaultSiteContent,
  admin_auth: defaultAdminAuth,
  site_logo: defaultSiteContent.logoUrl,
  franchise_packages: defaultFranchisePackages,
  page_titles: defaultPageTitles,
  build_version: CURRENT_DATA_VERSION,
};

for (const [table, payload] of Object.entries(tables)) {
  const response = await fetch(`${apiBase}/${table}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "X-DB-API-Key": apiSecret,
    },
    body: JSON.stringify({ payload }),
  });
  if (!response.ok) {
    throw new Error(`${table} aktarımı başarısız (HTTP ${response.status}).`);
  }
  console.log(`${table}: tamam`);
}

console.log(`${Object.keys(tables).length} veri grubu Supabase'e aktarıldı.`);
