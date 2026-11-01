# MCS — Alur Kerja & Admin Diana Tattoo Studio

Dokumen ini menjelaskan **alur situs**, **cara kerja halaman admin**, dan **cara mengubah konten**
(foto, lokasi, statistik, kontak) tanpa menyentuh kode.

---

## 1. Ringkasan

| Item | Nilai |
| --- | --- |
| Jenis situs | Statis (HTML + CSS + JS), tanpa framework |
| Produksi | https://diana-tatto-studio.vercel.app |
| Cermin | https://rafie110594.github.io/DianaTattoStudio/ (GitHub Pages) |
| Admin | https://diana-tatto-studio.vercel.app/admin |
| Repo | `rafie110594/DianaTattoStudio` (branch `main`) |
| Sumber konten | `content/site.json` |

Situs di-deploy **otomatis** setiap ada commit ke `main` (Vercel + GitHub Pages).
Admin membuat commit lewat GitHub API, jadi tidak perlu build manual.

---

## 2. Halaman & alur pengunjung

```
index.html (beranda satu halaman)
├── Header + menu (desktop & mobile)
├── Hero            video latar + logo + H1 + arc galeri (#arc) + CTA Book
├── Marquee         CUSTOM ONLY · 2022 · BALI
├── Stats           2022 / 6 gaya / 100% custom
├── Tattoo Styles   (#tattoo-styles) grid 6 kartu → panel galeri per gaya
├── About Us        (#about) slideshow foto + 3 nilai → about.html
└── Location        (#location) foto depan + patokan jalan + jam + peta → location.html

about.html      → nilai studio, alur kerja 01–04, CTA book
aftercare.html  → panduan perawatan 01–06
hygiene.html    → standar higiene 01–07
location.html   → foto depan, patokan jalan, alamat, jam, peta Google
```

**Jalur konversi:** semua CTA `Book a session` → `index.html#book` → modal kanal kontak
(WhatsApp, Instagram, TikTok, Facebook).

---

## 3. Arsitektur data

Satu sumber kebenaran: **`content/site.json`**.

```
content/site.json
        │
        ├── npm run render ──► index.html, location.html, assets/js/site-data.js
        │                      (build lokal / Vercel build)
        │
        └── POST /api/publish ─► commit atomik ke GitHub
                                  = site.json + foto baru + HTML + site-data.js
                                  → Vercel & GH Pages deploy otomatis
```

`api/_lib/render.mjs` menulis ulang **hanya blok konten** di HTML (marquee, stats, arc, lokasi).
Blok dikenali dari tag pembukanya, bukan dari nomor baris, sehingga tetap aman meski
indentasi atau line-ending berubah. Hasil render untuk data saat ini **byte-identik**
dengan HTML yang ada (dijaga oleh `npm run verify`).

### Struktur `site.json`

```jsonc
{
  "meta": { "since": 2022 },
  "marquee": ["CUSTOM ONLY", "2022", "BALI"],
  "stats": [
    { "value": 2022, "label": "Berdiri sejak", "plain": true,  "delay": null, "suffix": null },
    { "value": 6,    "label": "Gaya tato",     "plain": false, "delay": ".1s", "suffix": null },
    { "value": 100,  "label": "Custom only",   "plain": false, "delay": ".2s", "suffix": "%" }
  ],
  "gallery": [                                     // strip hero + slideshow About
    { "src": "assets/img/ring/g01-balinase.jpg", "slug": "balinese", "w": 1200, "h": 1599 }
  ],
  "styles": [
    {
      "slug": "balinese", "name": "Balinese", "blurb": "Ornamen sakral, garis tegas",
      "photos": [{ "src": "assets/img/styles/balinese/balinese-01.jpg", "w": 1200, "h": 1599 }]
    }
  ],
  "location": {
    "photo": { "src": "assets/img/location/lokasi.jpg", "w": 1200, "h": 1600, "alt": "…" },
    "caption": "Tampak depan studio &mdash; papan nama hitam dengan logo emas",
    "guide": ["…", "…"],                            // patokan jalan (boleh <strong>)
    "address": "Jl. Padang Luwih No. 2, Dalung",
    "hours": "Senin&ndash;Sabtu 10.00&ndash;20.00 &middot; Minggu by appointment",
    "mapsCid": "5724227728851520814"
  },
  "contact": [
    { "key": "whatsapp", "label": "WhatsApp", "href": "https://wa.me/6287755036876" }
  ]
}
```

`key` kontak yang didukung: `whatsapp`, `instagram`, `tiktok`, `facebook`
(ikon SVG ada di `assets/js/main.js`).

---

## 4. Halaman Admin

**URL:** `/admin` (hanya aktif di Vercel; di GitHub Pages `/api` tidak ada — admin menampilkan peringatan).

### Login
- **Username + password**, disimpan sebagai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` di
  environment Vercel. Kesalahan username/password memunculkan pesan seragam
  `"Username atau password salah"` (tidak membocorkan mana yang salah).
- Sesi = cookie `dts_admin` (HMAC-SHA256, `HttpOnly`, `Secure`, `SameSite=Strict`, 12 jam);
  payload menyimpan username.
- Percobaan login dibatasi 5×/menit per IP.
- Input password **tidak pernah di-disable** — kegagalan `/api/session` (mis. dibuka dari
  GitHub Pages) hanya menampilkan banner "bukan versi Vercel".

### Panel yang tersedia

| Panel | Yang bisa diubah |
| --- | --- |
| **Video Hero** | Ganti video latar (MP4/WebM, maks 50 MB) langsung ke Blob, atau kembalikan ke video bawaan |
| **Galeri** | Tambah foto (multi, maks 5 MB), edit gaya tiap foto, hapus, urutkan (drag) |
| **Gaya Tato** | Tambah/hapus gaya, ubah slug/nama/deskripsi, tambah/hapus/urutkan foto tiap gaya (foto pertama = sampul) |
| **Lokasi** | Foto tampak depan (ganti/hapus), alt, caption, alamat, jam buka, CID Google Maps, patokan jalan |
| **Statistik** | Label, angka, suffix tiap baris; tambah/hapus/urutkan |
| **Marquee** | Baris teks berjalan; tambah/hapus/urutkan |
| **Kontak** | Platform, label tombol, URL tiap kanal di modal Book |

### Aturan & alur simpan
- Gaya yang masih dipakai foto galeri **tidak bisa dihapus** (diblokir + pesan).
  Mengganti `slug` gaya otomatis memperbarui referensi foto galeri.
- Foto/video diunggah langsung dari browser ke **Vercel Blob**
  (`/api/blob-upload`, token `vercel_blob_client_*`) — melewati limit body 4.5 MB
  function di Vercel, kualitas tetap asli.
- Blob yang sudah diunggah tapi tidak jadi dipakai (dikembalikan/diganti) akan
  **dibersihkan otomatis saat Terbitkan**.
- Klik **Pratinjau** untuk ringkasan (tidak menyimpan). Klik **Terbitkan** →
  satu commit berisi `site.json` + HTML hasil render; Vercel & GitHub Pages
  deploy otomatis dalam ±1–2 menit.

### Batasan upload
- Foto: **JPEG, PNG, WebP**, maks **5 MB** (divalidasi magic bytes via content-type token).
- Video: **MP4, WebM**, maks **50 MB**.
- Path blob hanya di dalam `media/...` (mengandung slug, random-suffix,
  cache-control 30 hari). Upload & publish butuh header `X-CSRF` dari sesi aktif.

---

## 5. API

| Endpoint | Method | Fungsi |
| --- | --- | --- |
| `/api/session` | GET | Cek sesi; balikan `{ ok, csrf, exp, user }` |
| `/api/login` | POST | `{ username, password }` → set cookie sesi |
| `/api/logout` | POST | Hapus cookie sesi |
| `/api/blob-upload` | POST | Token `vercel_blob_client_*` untuk upload langsung ke Blob |
| `/api/publish` | POST | `{ site, files[], deletes[], preview? }` → commit atau pratinjau |

Semua endpoint `no-store`. `blob-upload`/`publish` wajib sesi + CSRF.

---

## 6. Environment variables (Vercel, Production)

| Nama | Keterangan |
| --- | --- |
| `ADMIN_USERNAME` | Username login admin (hanya di dashboard Vercel — jangan ditulis di repo) |
| `ADMIN_PASSWORD` | Password login admin |
| `ADMIN_SESSION_SECRET` | Kunci HMAC sesi (≥ 32 karakter) |
| `GITHUB_TOKEN` | Token dengan akses `contents: write` ke repo ini |
| `GITHUB_REPO` | `rafie110594/DianaTattoStudio` |
| `GITHUB_BRANCH` | `main` |
| `BLOB_READ_WRITE_TOKEN` | Token Blob store `diana-media` (ID store di dashboard Vercel) |

Store Blob diakses publik; foto/video live disajikan dari
`https://<store>.public.blob.vercel-storage.com`. File media repo tetap utuh
(`assets/img/*`, `assets/video/cinematic.mp4`) dan dipilotkan lewat `site.json`.

Mengubah env var **tidak** langsung berlaku — perlu deploy ulang
(`git commit` kosong / `vercel --prod`) agar function memuat nilai baru.

Untuk pengembangan lokal buat `.env.local` (sudah di-.gitignore) dengan isi yang sama.

### Scope per environment

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `ADMIN_USERNAME` | ya | ya | — |
| `ADMIN_PASSWORD` | ya | ya | — |
| `ADMIN_SESSION_SECRET` | ya | ya | — |
| `GITHUB_TOKEN` / `GITHUB_REPO` / `GITHUB_BRANCH` | ya | — | — |
| `BLOB_READ_WRITE_TOKEN` / `BLOB_STORE_ID` | ya | ya | ya |

Tanpa `ADMIN_SESSION_SECRET` di suatu environment, `secret()` melempar error dan
login di environment itu selalu gagal (500 "Server belum dikonfigurasi").

### Prosedur rotasi kredensial admin

Jalankan dari root repo (CLI sudah login sebagai pemilik project):

```powershell
$u = "username-baru"
$p = "password-baru"

vercel env add ADMIN_USERNAME production --sensitive --force --value $u
vercel env add ADMIN_USERNAME preview    --sensitive --force --value $u
vercel env add ADMIN_PASSWORD production --sensitive --force --value $p
vercel env add ADMIN_PASSWORD preview    --sensitive --force --value $p

# rotasi secret sesi (≥ 32 karakter) -> semua sesi aktif langsung logout
$s = -join ((1..64) | ForEach-Object { "0123456789abcdef"[(Get-Random -Maximum 16)] })
vercel env add ADMIN_SESSION_SECRET production --sensitive --force --value $s
vercel env add ADMIN_SESSION_SECRET preview    --sensitive --force --value $s

# env var di-bake saat build: wajib redeploy
vercel redeploy <deployment-produksi-terakhir> --environment production
```

Verifikasi setelah redeploy:

```powershell
# kredensial baru -> 200 + Set-Cookie dts_admin
# kredensial lama -> 401
# POST /api/publish { preview: true } pakai sesi baru -> 200 (uji GITHUB_REPO/GITHUB_BRANCH tanpa commit)
# GET /admin/ -> cek header CSP, X-Frame-Options: DENY, X-Robots-Tag
```

Catatan keamanan:

- `GITHUB_REPO` / `GITHUB_BRANCH` bertipe **Config**, sehingga `vercel env ls`
  bisa menampilkan prefix yang menyesatkan (kolom value kadang meminjam nilai
  var lain). Cek nilai sebenarnya dengan `vercel env pull`.
- Username admin lama pernah tertulis di `mcs.md` pada commit `1f9b9a2` dan
  `0d86788` (repo publik). Menghapus file di HEAD tidak menghapus riwayat —
  itulah alasan username dirotasi. Jangan pernah menulis username/password ke
  file yang di-commit.
- File runbook ini berada di `_docs/` yang dikecualikan `.vercelignore` dan
  diabaikan Jekyll GitHub Pages (folder berawalan `_`).

---

## 7. Perintah pengembangan

```powershell
npm run render    # render HTML + site-data.js dari content/site.json
npm run verify    # pastikan render byte-identik dengan HTML saat ini
node scripts/test-render-mutations.mjs   # uji bahwa render benar-benar menerapkan data
```

Alur manual (tanpa admin):

```powershell
# 1. edit content/site.json
npm run render
npm run verify
git add -A; git commit -m "Update konten"; git push origin main
```

---

## 8. Rollback

Setiap terbitan admin = satu commit `Admin: update …`.

- Kembalikan satu perubahan: `git revert <sha>` lalu `git push`.
- Atau buka tab yang salah di admin, perbaiki, dan terbitkan lagi.

Daftar commit cepat:
```powershell
git log --oneline -10
```

---

## 9. Checklist rilis

- [ ] `npm run verify` → `OK` untuk `index.html` dan `location.html`
- [ ] `node scripts/test-render-mutations.mjs` → semua `PASS`
- [ ] Buka `/admin` → login → tab tampil tanpa error
- [ ] Upload 1 foto uji → Terbitkan → cek commit muncul
- [ ] Cek produksi: gambar 200, teks tahun benar, tidak ada overflow di 390 px
- [ ] Cek `/admin` mengembalikan header `X-Robots-Tag: noindex`

---

## 10. Catatan teknis

- `assets/js/main.js` membaca `window.__SITE__` dari `assets/js/site-data.js`
  (bukan `fetch`) agar tetap bekerja di `file://`, GitHub Pages, dan Vercel.
- `main.js` punya fallback ke nilai bawaan bila `__SITE__` tidak ada.
- Kartu gaya sengaja selalu `opacity: 1` (animasi masuk tetap ada) agar foto
  tidak pernah tampak kosong.
- Hero memakai video tanpa `poster` dengan `preload="auto"`.
- `.gitignore`/`.vercelignore` memakai pola root ber-anchor (`/Japanese/` dst.)
  agar tidak ikut menghapus `assets/img/styles/*` yang case-insensitive.
