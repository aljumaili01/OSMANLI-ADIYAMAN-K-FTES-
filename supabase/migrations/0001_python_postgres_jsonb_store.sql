# Python FastAPI PostgreSQL Yedek Depolama (JSONB anahtar/değer, localStorage ile 1:1 uyumlu)
# Vercel Postgres / Neon / Supabase Postgres üzerinde çalıştırılabilir.
# Tek tablo = ckft_store: 8 storage key + 1 build_version satırı, payload JSONB.

-- Drop if exists (güvenli migration: idempotent)
DROP TABLE IF EXISTS ckft_store CASCADE;

CREATE TABLE IF NOT EXISTS ckft_store (
  store_key   TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ckft_store_updated ON ckft_store(updated_at DESC);

-- Trigger: updated_at otomatik yenileme (her yazmada)
CREATE OR REPLACE FUNCTION ckft_touch_updated() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS ckft_store_touch ON ckft_store;
CREATE TRIGGER ckft_store_touch
BEFORE UPDATE ON ckft_store
FOR EACH ROW EXECUTE FUNCTION ckft_touch_updated();

-- Seed: Production Defaults (Türkçe, Express Paket, 4 bayi, 8 ürün)
-- Not: Aşağıdaki veriler data.js'deki default diziler ile birebir aynıdır.
INSERT INTO ckft_store (store_key, payload) VALUES
(
  'ckft_corporate_franchise_packages',
  '[
    {"id":"express-paketi","title":"Express Paket","description":"Yeni girişimciler için tasarlanmış, düşük yatırımlı hızlı başlangıç modeli. Standart ekipman ve temel operasyon desteği içerir.","price":"₺250.000","features":["Standart tezgah ve ekipman seti","Temel operasyon eğitimi (3 gün)","Marka kimliği materyalleri","İlk ay stok desteği","Telefonla teknik destek","Standart ambalaj ve servis ekipmanı"],"media":"./images/Usta Durumu.jpg","mediaType":"image","gallery":[{"id":"pkg-express-1","url":"./images/Usta Durumu.jpg","alt":"Express Paket - Usta Dürümü sunumu"},{"id":"pkg-express-2","url":"./images/Klasik Porsiyon çiğ köfte.png","alt":"Express Paket - Klasik Porsiyon"},{"id":"pkg-express-3","url":"./images/Mega Durum.jpg","alt":"Express Paket - Mega Dürüm"},{"id":"pkg-express-4","url":"./images/Aile Ikram Paketi.jpg","alt":"Express Paket - Aile İkramı"}],"active":true,"order":1},
    {"id":"standart-paket","title":"Standart Paket","description":"Orta ölçekli yatırımcılar için tasarlanmış, tam operasyonel desteğe sahip standart bayilik modeli.","price":"₺450.000","features":["Genişletilmiş tezgah + soğutucu seti","Detaylı operasyon eğitimi (7 gün)","Tam marka kimliği + iç dizayn","İlk 3 ay stok desteği","7/24 sahada teknik destek","Reklam ve tanıtım kampanyası desteği","Online sipariş paneli entegrasyonu","Periyodik denetim ve kalite kontrol"],"media":"./images/Mega Durum.jpg","mediaType":"image","gallery":[{"id":"pkg-standart-1","url":"./images/Mega Durum.jpg","alt":"Standart Paket - Mega Dürüm kapak"},{"id":"pkg-standart-2","url":"./images/Usta Durumu.jpg","alt":"Standart Paket - Usta Dürümü"},{"id":"pkg-standart-3","url":"./images/Yoresel Ozel Seri.webp","alt":"Standart Paket - Yöresel Özel Seri"},{"id":"pkg-standart-4","url":"./images/Klasik Porsiyon çiğ köfte.png","alt":"Standart Paket - Klasik Porsiyon"},{"id":"pkg-standart-5","url":"./images/Geleneksel Etsiz Çiğköfte.jpg","alt":"Standart Paket - Etsiz Çiğköfte"},{"id":"pkg-standart-6","url":"./images/Aile Ikram Paketi.jpg","alt":"Standart Paket - Aile İkramı"}],"active":true,"order":2},
    {"id":"premium-paket","title":"Premium Paket","description":"Büyük metrekareli lokasyonlar ve şehir bayilikleri için tasarlanmış, A sınıfı tam destekli premium bayilik.","price":"₺750.000","features":["Premium özel tasarım ve dekorasyon","Mega stand + tam soğutma ekipmanları","Uzman eğitici ekip ile 15 gün sahada eğitim","İlk 6 ay tam stok desteği","Özel bölge koruması (rakipsiz bölge)","Kişiye özel hesap yöneticisi","TV/dijital reklam kampanyası bütçesi","Tüm yeniliklere öncelikli erişim","Genel merkeze periyodik davet"],"media":"./images/Yoresel Ozel Seri.webp","mediaType":"image","gallery":[{"id":"pkg-premium-1","url":"./images/Yoresel Ozel Seri.webp","alt":"Premium Paket - Yöresel Özel Seri Kapak"},{"id":"pkg-premium-2","url":"./images/Usta Durumu.jpg","alt":"Premium Paket - Usta Dürümü"},{"id":"pkg-premium-3","url":"./images/Mega Durum.jpg","alt":"Premium Paket - Mega Dürüm"},{"id":"pkg-premium-4","url":"./images/Klasik Porsiyon çiğ köfte.png","alt":"Premium Paket - Klasik Porsiyon"},{"id":"pkg-premium-5","url":"./images/Geleneksel Etsiz Çiğköfte.jpg","alt":"Premium Paket - Etsiz Çiğköfte"},{"id":"pkg-premium-6","url":"./images/Aile Ikram Paketi.jpg","alt":"Premium Paket - Aile İkramı"},{"id":"pkg-premium-7","url":"./images/Klasik Porsiyon çiğ köfte - Copy.png","alt":"Premium Paket - Klasik Yan Ürünler"}],"active":true,"order":3}
  ]'
),
(
  'ckft_corporate_dealers',
  '[
    {"id":"bayi-istanbul-bagcilar","city":"İstanbul","district":"Bağcılar","branchName":"Acılı Çiğköfte Bağcılar Merkez","address":"Bağcılar Merkez Mahallesi, İstanbul Caddesi No:124","phone":"0212 444 10 10","workingHours":"09:00 - 23:00","image":"./images/Usta Durumu.jpg","active":true,"mapEmbedUrl":"https://www.google.com/maps?q=Bagcilar+Istanbul"},
    {"id":"bayi-ankara-kecioren","city":"Ankara","district":"Keçiören","branchName":"Acılı Çiğköfte Keçiören","address":"Yunus Emre Mahallesi, Ankara Sokak No:56","phone":"0312 444 20 20","workingHours":"09:00 - 22:00","image":"./images/Mega Durum.jpg","active":true,"mapEmbedUrl":"https://www.google.com/maps?q=Kecioren+Ankara"},
    {"id":"bayi-izmir-bornova","city":"İzmir","district":"Bornova","branchName":"Acılı Çiğköfte Bornova Forum","address":"Forum Bornova AVM Kat:1 No:112","phone":"0232 444 30 30","workingHours":"10:00 - 22:00","image":"./images/Klasik Porsiyon çiğ köfte.png","active":true,"mapEmbedUrl":"https://www.google.com/maps?q=Bornova+Izmir"},
    {"id":"bayi-gaziantep-sehitkamil","city":"Gaziantep","district":"Şehitkamil","branchName":"Acılı Çiğköfte Şehitkamil","address":"Şehitkamil Merkez, Atatürk Bulvarı No:88","phone":"0342 444 40 40","workingHours":"08:00 - 23:30","image":"./images/Geleneksel Etsiz Çiğköfte.jpg","active":true,"mapEmbedUrl":"https://www.google.com/maps?q=Sehitkamil+Gaziantep"}
  ]'
),
(
  'ckft_corporate_products',
  '[
    {"id":"p-usta-durumu","name":"Usta Dürümü","category":"Dürüm","price":"₺145","image":"./images/Usta Durumu.jpg","description":"Özel usta tarifiyla hazırlanmış, 200g çiğ köfte + 6 çeşit sebze + soslu.","active":true,"order":1},
    {"id":"p-mega-durum","name":"Mega Dürüm","category":"Dürüm","price":"₺220","image":"./images/Mega Durum.jpg","description":"Boy XL, 350g çiğ köfte, extra lor, 8 çeşit sebze, çifte lavaş.","active":true,"order":2},
    {"id":"p-klasik-porsiyon","name":"Klasik Porsiyon Çiğ Köfte","category":"Porsiyon","price":"₺180","image":"./images/Klasik Porsiyon çiğ köfte.png","description":"250g klasik tarif, yanında yeşillik + turşu + lavaş.","active":true,"order":3},
    {"id":"p-klasik-porsiyon-cift","name":"Çift Klasik Porsiyon","category":"Porsiyon","price":"₺340","image":"./images/Klasik Porsiyon çiğ köfte - Copy.png","description":"500g çift porsiyon, aile boyu, özel sunum.","active":true,"order":4},
    {"id":"p-etsiz-geleneksel","name":"Geleneksel Etsiz Çiğköfte","category":"Vegan","price":"₺165","image":"./images/Geleneksel Etsiz Çiğköfte.jpg","description":"Bulgur ve domates salçasıyla hazırlanmış vegan tarifi, etsiz sevenler için.","active":true,"order":5},
    {"id":"p-yoresel-ozel-seri","name":"Yöresel Özel Seri","category":"Özel","price":"₺290","image":"./images/Yoresel Ozel Seri.webp","description":"Antep/Antakya yöresine özel baharatlı, nar ekşili, özel cevizli tarif.","active":true,"order":6},
    {"id":"p-aile-ikram","name":"Aile İkram Paketi","category":"Paket","price":"₺890","image":"./images/Aile Ikram Paketi.jpg","description":"4 kişilik: 1 klasik porsiyon + 1 mega dürüm + 2 usta dürümü + patates kızartması + içecek.","active":true,"order":7},
    {"id":"p-yan-urun","name":"Yan Ürün Şeridi","category":"Yan","price":"₺95","image":"./images/Aile Ikram Paketi.jpg","description":"Cips, kola, ayran, çay seçenekleri.","active":true,"order":8}
  ]'
),
(
  'ckft_corporate_applications',
  '[
    {"id":"APP-1001","fullName":"Ahmet Yılmaz","phone":"0555 111 22 33","email":"ahmet@ornek.com","city":"İstanbul","packageId":"standart-paket","packageName":"Standart Paket","notes":"İlk girişimim, finansal desteğim var.","status":"pending","createdAt":"2026-08-19T10:00:00Z"},
    {"id":"APP-1002","fullName":"Zeynep Kaya","phone":"0555 333 44 55","email":"zeynep@ornek.com","city":"Ankara","packageId":"express-paketi","packageName":"Express Paket","notes":"Mobil küçük lokasyon hedefliyorum.","status":"reviewed","createdAt":"2026-08-19T14:30:00Z"}
  ]'
),
(
  'ckft_corporate_site_content',
  ('{'+
    '"brandName":"Osmanlı Adıyaman Çiğköfte",'+
    '"heroTitle":"Lezzetin Usta Adresi — Acılı Çiğköfte",'+
    '"heroSubtitle":"1998\'den bu yana aynı geleneksel tarifle üretiyoruz. 8 vitrin ürünümüz, 4 aktif bayimizle hizmetinizdeyiz.",'+
    '"logoUrl":"./images/logo.svg",'+
    '"addressHeadquarters":"Bağcılar Merkez Mah. İstanbul Cd. No:124 / İstanbul",'+
    '"phoneHeadquarters":"0212 444 10 10",'+
    '"emailInfo":"info@acilicigkofte.com.tr",'+
    '"workingHours":"Pazartesi-Pazar: 09:00 - 23:00",'+
    '"counters": {"products": 8, "dealers": 4, "applications": 2},'+
    '"aboutStory":"Ailemiz 1998 yılında, Antep usulü tarifleriyle küçük bir lokantada hizmet vermeye başladı. 25 yılı aşkın sürede kalite ve hijyen ilkelerinden ödün vermeden büyüdük, şimdi tüm Türkiye\'ye bayilik ağıyla ulaşıyoruz.",'+
    '"aboutQuality":"Her gün sabahın erken saatlerinde taze malzemelerle üretim yapılır. ISO 22000 kalite belgemiz mevcuttur.",'+
    '"aboutFranchise":"Sıfırdan A-Z destek. Uzman ekibimiz sizin için: site seçimi, dekorasyon, personel eğitimi, pazarlama ve stok yönetimi.",'+
    '"aboutVision":"2030 yılına kadar 250+ bayi ile Avrupa pazarında faaliyet göstermek.",'+
    '"pageTitles": {"home":"Anasayfa | Acılı Çiğköfte","products":"Ürünlerimiz | Acılı Çiğköfte","dealers":"Bayilerimiz | Acılı Çiğköfte","franchise":"Bayilik Başvurusu | Acılı Çiğköfte","about":"Hakkımızda | Acılı Çiğköfte","contact":"İletişim | Acılı Çiğköfte","admin":"Yönetim Paneli | Acılı Çiğköfte"},'+
    '"foodImages": [{"url":"./images/Usta Durumu.jpg","alt":"Usta Dürümü"},{"url":"./images/Mega Durum.jpg","alt":"Mega Dürüm"},{"url":"./images/Klasik Porsiyon çiğ köfte.png","alt":"Klasik Porsiyon"},{"url":"./images/Geleneksel Etsiz Çiğköfte.jpg","alt":"Geleneksel Etsiz"},{"url":"./images/Yoresel Ozel Seri.webp","alt":"Yöresel Özel"},{"url":"./images/Aile Ikram Paketi.jpg","alt":"Aile İkramı"}],'+
    '"storeImages": [{"url":"./images/Usta Durumu.jpg","alt":"Bağcılar Mağaza"},{"url":"./images/Mega Durum.jpg","alt":"Keçiören Mağaza"},{"url":"./images/Klasik Porsiyon çiğ köfte.png","alt":"Bornova Mağaza"},{"url":"./images/Geleneksel Etsiz Çiğköfte.jpg","alt":"Şehitkamil Mağaza"}]'+
  '}')::JSONB
),
(
  'ckft_corporate_page_titles',
  ('{'+
    '"home":"Anasayfa | Acılı Çiğköfte",'+
    '"products":"Ürünlerimiz | Acılı Çiğköfte",'+
    '"dealers":"Bayilerimiz | Acılı Çiğköfte",'+
    '"franchise":"Bayilik Başvurusu | Acılı Çiğköfte",'+
    '"about":"Hakkımızda | Acılı Çiğköfte",'+
    '"contact":"İletişim | Acılı Çiğköfte",'+
    '"admin":"Yönetim Paneli | Acılı Çiğköfte"'+
  '}')::JSONB
),
('siteLogo', '"./images/logo.svg"'),
(
  'ckft_corporate_admin_auth',
  '{"username":"admin","password":"Cigkofte123!"}'
),
(
  'ckft_corporate_build_version',
  ('"20260821-v6"')::JSONB
)
ON CONFLICT (store_key) DO NOTHING;
