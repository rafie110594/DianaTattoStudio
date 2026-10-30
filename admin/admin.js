/* Admin UI — Diana Tattoo Studio */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const loginView = $("#loginView");
  const appView = $("#appView");
  const loginForm = $("#loginForm");
  const loginPassword = $("#loginPassword");
  const loginError = $("#loginError");
  const logoutBtn = $("#logoutBtn");
  const statusBox = $("#publishStatus");

  let CSRF = "";
  let SITE = null;
  let isGhPages = location.hostname.endsWith(".github.io");

  /* ---------- helpers ---------- */
  const api = async (path, options = {}) => {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };

  const status = (msg, kind = "") => {
    statusBox.classList.remove("ok", "err");
    if (kind) statusBox.classList.add(kind);
    statusBox.textContent = msg;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function loadSession() {
    try {
      const s = await api("/api/session");
      if (s.ok) {
        CSRF = s.csrf;
        await loadSite();
      } else {
        showLogin();
      }
    } catch {
      isGhPages = true;
      showGhPagesBanner();
      showLogin(true);
    }
  }

  function showGhPagesBanner() {
    status(
      "Admin hanya aktif di versi Vercel (https://diana-tatto-studio.vercel.app).\nHalaman ini (dari GitHub Pages) tidak dapat menyimpan perubahan.",
      "err"
    );
  }

  function showLogin(gh = false) {
    loginView.hidden = false;
    appView.hidden = true;
    if (gh) {
      loginError.textContent = "";
      loginPassword.disabled = true;
    }
  }

  async function loadSite() {
    const res = await fetch("/content/site.json", { cache: "no-store" });
    SITE = await res.json();
    fillForm();
    loginView.hidden = true;
    appView.hidden = false;
  }

  /* ---------- login ---------- */
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword.value })
      });
      CSRF = data.csrf;
      loginPassword.value = "";
      await loadSite();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    location.reload();
  });

  /* ---------- form binding ---------- */
  const field = (id) => {
    const el = document.getElementById(id);
    return {
      get: () => el.value.trim(),
      set: (v) => { el.value = v ?? ""; }
    };
  };

  function fillForm() {
    const loc = SITE.location || {};
    field("locPhotoAlt").set(loc.photo?.alt);
    field("locCaption").set(loc.caption);
    field("locAddress").set(loc.address);
    field("locHours").set(loc.hours);
    field("locCid").set(loc.mapsCid);
    field("locGuide").set((loc.guide || []).join("\n"));
    if (loc.photo?.src) {
      const img = $("#locPhotoPreview");
      img.src = loc.photo.src;
      img.hidden = false;
    }
    field("marqueeText").set((SITE.marquee || []).join("\n"));
    renderStats();
    renderGallery();
    renderStyles();
    renderContact();
  }

  function readForm() {
    const loc = SITE?.location || {};
    const guide = field("locGuide").get().split("\n").map((s) => s.trim()).filter(Boolean);
    const marquee = field("marqueeText").get().split("\n").map((s) => s.trim()).filter(Boolean);
    return {
      meta: SITE.meta,
      marquee: marquee.length ? marquee : SITE.marquee,
      stats: SITE.stats,
      gallery: SITE.gallery,
      styles: SITE.styles,
      contact: SITE.contact,
      location: {
        photo: loc.photo,
        caption: field("locCaption").get() || loc.caption,
        address: field("locAddress").get() || loc.address,
        hours: field("locHours").get() || loc.hours,
        mapsCid: field("locCid").get() || loc.mapsCid,
        guide
      }
    };
  }

  /* ---------- stats editor ---------- */
  function renderStats() {
    const box = $("#statsList");
    box.innerHTML = "";
    SITE.stats.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.cssText = "align-items:end;padding-bottom:.5rem;border-bottom:1px dashed #2c241c;";
      row.innerHTML = `
        <label class="field">Label<br><input type="text" data-k="label" data-i="${i}" value="${esc(s.label)}"></label>
        <label class="field">Angka<br><input type="text" data-k="value" data-i="${i}" value="${esc(s.value)}"></label>
      `;
      box.appendChild(row);
    });
    box.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const el = e.target;
        SITE.stats[+el.dataset.i][el.dataset.k] = el.dataset.k === "value" ? Number(el.value) : el.value;
      });
    });
  }

  /* ---------- gallery ---------- */
  function renderGallery() {
    const list = $("#galleryList");
    list.innerHTML = "";
    SITE.gallery.forEach((g, i) => {
      const li = document.createElement("li");
      li.className = "grid-item";
      li.draggable = true;
      li.dataset.idx = String(i);
      li.innerHTML = `
        <img src="${esc(g.src)}" alt="">
        <div class="meta"><span class="slug">${esc(g.slug)}</span><br><small>${esc(g.src)} · ${g.w}×${g.h}</small></div>
        <button class="del" title="Hapus">×</button>`;
      li.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", String(i)));
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = +e.dataTransfer.getData("text/plain");
        const to = +li.dataset.idx;
        if (from === to) return;
        const arr = SITE.gallery;
        const [m] = arr.splice(from, 1);
        arr.splice(to, 0, m);
        renderGallery();
      });
      $(".del", li).addEventListener("click", () => {
        SITE.gallery.splice(i, 1);
        renderGallery();
      });
      list.appendChild(li);
    });
  }

  /* ---------- styles ---------- */
  function renderStyles() {
    const box = $("#stylesList");
    box.innerHTML = "";
    SITE.styles.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "style-card-ed";
      card.innerHTML = `
        <div class="head">
          <label>Nama <input type="text" data-k="name" data-i="${i}" value="${esc(s.name)}"></label>
          <label>Blurb <input type="text" class="blurb" data-k="blurb" data-i="${i}" value="${esc(s.blurb)}"></label>
        </div>
        <div class="photos"></div>
        <input class="add" type="file" accept="image/jpeg,image/png,image/webp" data-add="${i}">
        <p class="log"></p>`;
      const photos = $(".photos", card);
      s.photos.forEach((p, j) => {
        const th = document.createElement("div");
        th.className = "thumb";
        th.innerHTML = `<img src="${esc(p.src)}" alt=""><button title="Hapus" data-del="${i}:${j}">×</button>`;
        $("button", th).addEventListener("click", () => {
          s.photos.splice(j, 1);
          renderStyles();
        });
        photos.appendChild(th);
      });
      const log = $(".log", card);
      $("input[data-add]", card).addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resizeImage(file).then((img) => {
          s.photos.push(img);
          renderStyles();
          log.textContent = "Foto ditambahkan: " + img.src;
        }).catch((err) => { log.textContent = "Gagal: " + err.message; });
      });
      card.querySelectorAll("input[data-k]").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          SITE.styles[+e.target.dataset.i][e.target.dataset.k] = e.target.value;
        });
      });
      box.appendChild(card);
    });
  }

  /* ---------- contact ---------- */
  function renderContact() {
    const box = $("#contactList");
    box.innerHTML = "";
    SITE.contact.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.cssText = "align-items:end;padding-bottom:.5rem;";
      row.innerHTML = `
        <label class="field">Label<br><input type="text" data-k="label" data-i="${i}" value="${esc(c.label)}"></label>
        <label class="field">URL<br><input type="text" data-k="href" data-i="${i}" value="${esc(c.href)}"></label>`;
      box.appendChild(row);
    });
    box.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        SITE.contact[+e.target.dataset.i][e.target.dataset.k] = e.target.value;
      });
    });
  }

  /* ---------- image processing (browser) ---------- */
  function resizeImage(file, maxDim = 1600) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Gagal memproses gambar"));
            const reader = new FileReader();
            reader.onload = () => resolve({ blob, src: canvas.toDataURL(type, 0.82), w: canvas.width, h: canvas.height });
            reader.onerror = () => reject(new Error("Gagal membaca file"));
            reader.readAsArrayBuffer(blob);
          },
          type,
          type === "image/jpeg" ? 0.82 : undefined
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bukan gambar valid")); };
      img.src = url;
    });
  }

  /* ---------- upload flow ---------- */
  const pendingUploads = new Map();
  const pendingDeletes = new Set();

  function bytesToBase64(bytes) {
    const CHUNK = 0x8000;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  async function uploadImage(blob, folder, slug) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const base64 = bytesToBase64(buf);
    const data = await api("/api/upload", {
      method: "POST",
      headers: { "X-CSRF": CSRF },
      body: JSON.stringify({ base64, folder, slug })
    });
    return data; // { sha, path, type }
  }

  async function processGalleryFile(file) {
    status("");
    try {
      const img = await resizeImage(file);
      const up = await uploadImage(img.blob, "ring", "g");
      pendingUploads.set(up.path, up.sha);
      SITE.gallery.push({ src: up.path, slug: "fineline", w: img.w, h: img.h });
      renderGallery();
      $("#galleryLog").textContent = "Upload OK: " + up.path;
    } catch (err) {
      $("#galleryLog").textContent = "Gagal: " + err.message;
    }
  }

  $("#galleryFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) processGalleryFile(file);
    e.target.value = "";
  });

  $("#locPhotoFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    status("");
    try {
      const img = await resizeImage(file);
      const up = await uploadImage(img.blob, "location", "lokasi");
      const old = SITE.location.photo?.src;
      if (old && old !== up.path) pendingDeletes.add(old);
      pendingUploads.set(up.path, up.sha);
      SITE.location.photo = { src: up.path, w: img.w, h: img.h, alt: SITE.location.photo?.alt || "Tampak depan Diana Tattoo Studio" };
      $("#locPhotoPreview").src = img.src;
      $(".log", $("#locPhotoPreview").parentElement).textContent = "Upload OK: " + up.path;
    } catch (err) {
      $(".log", $("#locPhotoPreview").parentElement).textContent = "Gagal: " + err.message;
    }
  });

  $("#locPhotoPreview").addEventListener("click", async () => {
    const old = SITE.location.photo?.src;
    if (!old) return;
    if (!confirm("Hapus foto lokasi ini saat publish?")) return;
    pendingDeletes.add(old);
    const img = $("#locPhotoPreview");
    img.removeAttribute("src");
    $(".log", img.parentElement).textContent = "Foto lama akan dihapus saat publish: " + old;
  });

  /* ---------- publish ---------- */
  async function collectFiles() {
    const files = [];
    for (const [path, sha] of pendingUploads) {
      files.push({ path, sha });
    }
    return files;
  }

  $("#previewBtn").addEventListener("click", async () => {
    status("");
    try {
      const site = readForm();
      const data = await api("/api/publish", {
        method: "POST",
        headers: { "X-CSRF": CSRF },
        body: JSON.stringify({ site, files: await collectFiles(), deletes: [], preview: true })
      });
      status(`PRATINJAU (belum tersimpan)\nBagian berubah: ${data.summary}\n${(data.diff || []).join("\n")}`.slice(0, 6000), "ok");
    } catch (err) {
      status("Gagal pratinjau: " + err.message, "err");
    }
  });

  $("#publishBtn").addEventListener("click", async () => {
    status("Menyimpan…");
    try {
      const site = readForm();
      const data = await api("/api/publish", {
        method: "POST",
        headers: { "X-CSRF": CSRF },
        body: JSON.stringify({ site, files: await collectFiles(), deletes: Array.from(pendingDeletes) })
      });
      status(`TERBIT ✓ (commit ${data.commit.slice(0, 7)})\n${data.summary}\n\nMenunggu Vercel + GitHub Pages deploy (±1–2 menit).`, "ok");
      pendingUploads.clear();
      pendingDeletes.clear();
      const res = await fetch("/content/site.json", { cache: "no-store" });
      SITE = await res.json();
      fillForm();
      status(`TERBIT ✓ (commit ${data.commit.slice(0, 7)})\n${data.summary}\n\nMenunggu Vercel + GitHub Pages deploy (±1–2 menit).`, "ok");
      try { await fetch(`https://api.github.com/repos/rafie110594/DianaTattoStudio/commits/${data.commit}`, { mode: "no-cors" }); } catch {}
    } catch (err) {
      status("Gagal menerbitkan: " + err.message, "err");
    }
  });

  /* ---------- tabs ---------- */
  $$(".tabs__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tabs__item").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      $$(".tab").forEach((t) => t.classList.remove("is-active"));
      $("#tab-" + btn.dataset.tab).classList.add("is-active");
    });
  });

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  loadSession();
})();