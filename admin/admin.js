/* Admin — Diana Tattoo Studio. CRUD penuh, upload langsung ke Vercel Blob. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const BLOB_PUT = "https://vercel.com/api/blob/";

  const state = {
    site: null,
    original: null,
    csrf: "",
    user: "",
    /* blob URLs uploaded this session — unreferenced ones are cleaned on publish */
    uploaded: new Set()
  };

  const loginView = $("#loginView");
  const appView = $("#appView");
  const loginForm = $("#loginForm");
  const statusBox = $("#publishStatus");

  /* ---------------- helpers ---------------- */
  const esc = (v) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* repo-relative media paths (assets/...) must resolve from the site root,
     because the admin page itself lives under /admin/ */
  const mediaSrc = (src) => {
    const s = String(src ?? "");
    if (!s) return "";
    if (/^(https?:|data:|blob:|\/)/i.test(s)) return s;
    return "/" + s.replace(/^\.\//, "");
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));

  const setStatus = (msg, kind = "") => {
    statusBox.classList.remove("ok", "err");
    if (kind) statusBox.classList.add(kind);
    statusBox.textContent = msg;
  };

  /* Blob errors come back as { error: { code, message } }, our APIs as { error: "..." } */
  const errText = (data, fallback) => {
    const e = data && data.error;
    if (!e) return (data && data.message) || fallback;
    if (typeof e === "string") return e;
    return e.message || e.code || fallback;
  };

  const api = async (path, { method = "GET", body, csrf = false } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (csrf) headers["X-CSRF"] = state.csrf;
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errText(data, `HTTP ${res.status}`));
    return data;
  };

  /* ---------------- dirty tracking ---------------- */
  const snapshot = () => JSON.stringify(state.site);
  const isDirty = () => state.original !== null && snapshot() !== state.original;

  const markDirty = () => {
    $("#dirtyDot").hidden = !isDirty();
  };

  /* ---------------- login ---------------- */
  const showLogin = () => {
    loginView.hidden = false;
    appView.hidden = true;
  };

  const showApp = () => {
    loginView.hidden = true;
    appView.hidden = false;
    $("#whoami").innerHTML = state.user ? `Masuk sebagai <b>${esc(state.user)}</b>` : "";
  };

  $("#togglePw").addEventListener("click", () => {
    const input = $("#loginPassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    $("#togglePw").textContent = show ? "Sembunyikan" : "Lihat";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#loginError");
    err.textContent = "";

    const username = $("#loginUsername").value.trim();
    const password = $("#loginPassword").value;
    if (!username || !password) {
      err.textContent = "Username dan password wajib diisi.";
      return;
    }

    try {
      const data = await api("/api/login", { method: "POST", body: { username, password } });
      state.csrf = data.csrf;
      state.user = data.user || username;
      localStorage.setItem("dts_admin_user", username);
      $("#loginPassword").value = "";
      await loadSite();
      showApp();
    } catch (e2) {
      err.textContent = e2.message;
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    if (isDirty() && !confirm("Ada perubahan belum disimpan. Keluar tetap?")) return;
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    location.reload();
  });

  /* ---------------- boot ---------------- */
  async function boot() {
    $("#loginUsername").value = localStorage.getItem("dts_admin_user") || "";

    try {
      const s = await api("/api/session");
      if (s.ok) {
        state.csrf = s.csrf;
        state.user = s.user || "";
        await loadSite();
        showApp();
        return;
      }
    } catch {
      /* /api is only served by the Vercel deployment */
    }
    showLogin();
  }

  async function loadSite() {
    const res = await fetch(`/content/site.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Gagal memuat content/site.json");
    state.site = await res.json();
    state.original = snapshot();
    renderAll();
    markDirty();
  }

  /* ---------------- image helpers ---------------- */
  /* never hang: a slow/blocked image must not stall the upload flow */
  const dims = (url) =>
    new Promise((resolve) => {
      let done = false;
      const finish = (d) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(d);
      };
      const timer = setTimeout(() => finish({ w: 1200, h: 1600 }), 8000);
      const img = new Image();
      img.onload = () => finish({ w: img.naturalWidth || 1200, h: img.naturalHeight || 1600 });
      img.onerror = () => finish({ w: 1200, h: 1600 });
      img.src = url;
    });

  function extOf(file) {
    const t = (file.type || "").toLowerCase();
    if (t === "image/png") return "png";
    if (t === "image/webp") return "webp";
    if (t === "video/webm") return "webm";
    if (t === "video/mp4") return "mp4";
    return "jpg";
  }

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "media";

  /* client upload straight to Vercel Blob (bypasses the 4.5 MB function body limit) */
  async function uploadToBlob(file, folder, nameHint) {
    const pathname = `media/${folder}/${slugify(nameHint || file.name.replace(/\.[^.]+$/, ""))}.${extOf(file)}`;

    const tokenRes = await fetch("/api/blob-upload", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF": state.csrf },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: { pathname, clientPayload: JSON.stringify({ csrf: state.csrf }), multipart: false }
      })
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.clientToken) {
      throw new Error(errText(tokenJson, "Gagal membuat token upload"));
    }

    const putRes = await fetch(`${BLOB_PUT}?pathname=${encodeURIComponent(pathname)}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${tokenJson.clientToken}`,
        "x-vercel-blob-access": "public",
        "x-content-type": file.type || "application/octet-stream",
        "x-api-version": "13",
        "x-content-length": String(file.size)
      },
      body: file
    });
    const blob = await putRes.json().catch(() => ({}));
    if (!putRes.ok || !blob.url) {
      throw new Error(errText(blob, `Upload gagal (${putRes.status})`));
    }
    state.uploaded.add(blob.url);
    return blob;
  }

  const MAX_IMAGE = 5 * 1024 * 1024;
  const MAX_VIDEO = 50 * 1024 * 1024;

  /* ---------------- generic row editor ---------------- */
  /**
   * fields: [{ key, label, type, placeholder }]
   */
  function renderRows(container, list, fields, { onChange, onAdd, onRemove, itemLabel }) {
    container.innerHTML = "";
    list.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.draggable = true;
      row.dataset.idx = String(i);
      row.innerHTML = `
        <span class="row-item__grip" title="Seret untuk mengurutkan">⋮⋮</span>
        <div class="row-item__fields"></div>
        <div class="row-item__acts">
          <button class="mini" data-act="up" title="Naik">↑</button>
          <button class="mini" data-act="down" title="Turun">↓</button>
          <button class="mini mini--del" data-act="del" title="Hapus">✕</button>
        </div>`;
      const fieldsBox = $(".row-item__fields", row);
      fields.forEach((f) => {
        const label = document.createElement("label");
        label.className = "field";
        label.innerHTML = `<span>${esc(f.label)}</span>`;
        const input = document.createElement("input");
        input.type = "text";
        input.value = item[f.key] ?? "";
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.maxlength) input.maxLength = f.maxlength;
        input.addEventListener("input", () => {
          item[f.key] = input.value;
          markDirty();
          onChange && onChange(item, i);
        });
        label.appendChild(input);
        fieldsBox.appendChild(label);
      });

      row.addEventListener("dragstart", (e) => {
        row.classList.add("is-drag");
        e.dataTransfer.setData("text/plain", String(i));
      });
      row.addEventListener("dragend", () => row.classList.remove("is-drag"));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(from) || from === i) return;
        const [moved] = list.splice(from, 1);
        list.splice(i, 0, moved);
        markDirty();
        renderRows(container, list, fields, { onChange, onAdd, onRemove, itemLabel });
      });

      row.addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        if (act === "up" && i > 0) {
          [list[i - 1], list[i]] = [list[i], list[i - 1]];
        } else if (act === "down" && i < list.length - 1) {
          [list[i + 1], list[i]] = [list[i], list[i + 1]];
        } else if (act === "del") {
          if (!confirm(`Hapus ${itemLabel || "baris"} ini?`)) return;
          list.splice(i, 1);
          onRemove && onRemove(item, i);
        } else {
          return;
        }
        markDirty();
        renderRows(container, list, fields, { onChange, onAdd, onRemove, itemLabel });
      });

      container.appendChild(row);
    });
  }

  /* ---------------- panel: hero ---------------- */
  function renderHero() {
    const v = state.site.hero?.video;
    const el = $("#heroPreview");
    $("#heroSrc").textContent = v?.src || "(tidak ada video)";
    if (v?.src) {
      const url = mediaSrc(v.src);
      if (el.getAttribute("src") !== url) el.src = url;
      el.hidden = false;
    } else {
      el.removeAttribute("src");
      el.hidden = true;
    }
  }

  $("#heroFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const log = $("#heroLog");
    if (file.size > MAX_VIDEO) {
      log.textContent = `Video terlalu besar (${(file.size / 1048576).toFixed(1)} MB). Maks 50 MB.`;
      return;
    }
    log.textContent = "Mengunggah video…";
    try {
      const blob = await uploadToBlob(file, "hero", "cinematic");
      state.site.hero = { video: { src: blob.url, type: blob.contentType || file.type || "video/mp4" } };
      renderHero();
      markDirty();
      log.textContent = "Video siap. Klik Terbitkan untuk menyimpan.";
    } catch (err) {
      log.textContent = "Gagal: " + err.message;
    }
  });

  $("#heroRemove").addEventListener("click", () => {
    if (!state.site.hero?.video) return;
    if (!confirm("Hapus video hero? Beranda akan memakai latar gradien.")) return;
    state.site.hero = { video: { src: "assets/video/cinematic.mp4", type: "video/mp4" } };
    renderHero();
    markDirty();
    $("#heroLog").textContent = "Dikembalikan ke video bawaan.";
  });

  /* ---------------- panel: gallery ---------------- */
  function renderGallery() {
    const list = $("#galleryList");
    $("#galleryCount").textContent = `(${state.site.gallery.length})`;
    list.innerHTML = "";

    state.site.gallery.forEach((g, i) => {
      const li = document.createElement("li");
      li.className = "tile";
      li.draggable = true;
      li.dataset.idx = String(i);
      li.innerHTML = `
        <img src="${esc(mediaSrc(g.src))}" alt="" loading="lazy">
        <div class="tile__body">
          <span class="tile__slug">${esc(g.slug)}</span>
          <span class="tile__meta">${esc(g.src)}</span>
        </div>
        <div class="tile__acts">
          <button class="mini" data-act="edit">Edit</button>
          <button class="mini" data-act="up">↑</button>
          <button class="mini" data-act="down">↓</button>
          <button class="mini mini--del" data-act="del">✕</button>
        </div>`;

      li.addEventListener("dragstart", (e) => {
        li.classList.add("is-drag");
        e.dataTransfer.setData("text/plain", String(i));
      });
      li.addEventListener("dragend", () => li.classList.remove("is-drag"));
      li.addEventListener("dragover", (e) => e.preventDefault());
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(from) || from === i) return;
        const [m] = state.site.gallery.splice(from, 1);
        state.site.gallery.splice(i, 0, m);
        renderGallery();
        markDirty();
      });

      li.addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        const arr = state.site.gallery;
        if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        else if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        else if (act === "del") {
          if (!confirm("Hapus foto ini dari galeri?")) return;
          arr.splice(i, 1);
        } else if (act === "edit") {
          editGalleryItem(i);
          return;
        } else return;
        renderGallery();
        markDirty();
      });

      list.appendChild(li);
    });
  }

  function editGalleryItem(i) {
    const g = state.site.gallery[i];
    const styleNames = state.site.styles.map((s) => `${s.slug} (${s.name})`).join(", ");
    const slug = prompt(`Gaya untuk foto ini:\n${styleNames}`, g.slug);
    if (slug === null) return;
    if (!state.site.styles.some((s) => s.slug === slug.trim())) {
      alert("Slug gaya tidak ada. Pilih salah satu: " + styleNames);
      return;
    }
    g.slug = slug.trim();

    const alt = prompt("Teks alternatif foto (kosongkan bila dekoratif):", g.alt || "");
    if (alt !== null) g.alt = alt;

    const replace = confirm("Ganti file foto ini juga? (OK = pilih file baru, Batal = biarkan)");
    if (replace) pickFile("image/jpeg,image/png,image/webp", async (file) => {
      if (file.size > MAX_IMAGE) {
        alert("Foto maksimal 5 MB.");
        return;
      }
      try {
        const blob = await uploadToBlob(file, "gallery", g.slug);
        const d = await dims(blob.url);
        g.src = blob.url;
        g.w = d.w;
        g.h = d.h;
        renderGallery();
        markDirty();
      } catch (err) {
        alert("Gagal upload: " + err.message);
      }
    });

    renderGallery();
    markDirty();
  }

  function pickFile(accept, cb) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => {
      const f = input.files[0];
      if (f) cb(f);
    });
    input.click();
  }

  $("#galleryFile").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const log = $("#galleryLog");
    let ok = 0;
    const defaultSlug = state.site.styles[0]?.slug || "fineline";

    for (const file of files) {
      if (file.size > MAX_IMAGE) {
        log.textContent = `${file.name}: lebih dari 5 MB, dilewati.`;
        continue;
      }
      log.textContent = `Mengunggah ${file.name}… (${ok + 1}/${files.length})`;
      try {
        const blob = await uploadToBlob(file, "gallery", defaultSlug);
        const d = await dims(blob.url);
        state.site.gallery.push({ src: blob.url, slug: defaultSlug, alt: "", w: d.w, h: d.h });
        ok += 1;
        renderGallery();
        markDirty();
      } catch (err) {
        log.textContent = `${file.name}: gagal — ${err.message}`;
      }
    }
    if (ok) log.textContent = `${ok} foto ditambahkan. Atur gaya tiap foto lewat tombol Edit.`;
  });

  /* ---------------- panel: styles ---------------- */
  function renderStyles() {
    const box = $("#stylesList");
    $("#stylesCount").textContent = `(${state.site.styles.length})`;
    box.innerHTML = "";

    state.site.styles.forEach((s, si) => {
      const card = document.createElement("div");
      card.className = "style-ed";
      card.innerHTML = `
        <div class="style-ed__head">
          <label class="field"><span>Slug</span><input type="text" data-k="slug" value="${esc(s.slug)}" maxlength="32"></label>
          <label class="field"><span>Nama</span><input type="text" data-k="name" value="${esc(s.name)}" maxlength="40"></label>
          <button class="btn btn--danger btn--sm" data-act="delstyle">Hapus gaya</button>
        </div>
        <label class="field field--mt"><span>Deskripsi</span><input type="text" data-k="blurb" value="${esc(s.blurb)}" maxlength="80"></label>
        <div class="style-ed__photos"></div>
        <div class="btnrow">
          <label class="btn btn--ghost btn--sm file-btn">Tambah foto<input type="file" data-add="${si}" accept="image/jpeg,image/png,image/webp" hidden></label>
        </div>
        <p class="log" data-log="${si}"></p>`;

      card.querySelectorAll("input[data-k]").forEach((inp) => {
        inp.addEventListener("input", () => {
          if (inp.dataset.k === "slug") {
            /* keep gallery references pointing at the renamed style */
            const oldSlug = s.slug;
            const newSlug = inp.value.trim();
            if (oldSlug && newSlug && oldSlug !== newSlug) {
              state.site.gallery.forEach((g) => {
                if (g.slug === oldSlug) g.slug = newSlug;
              });
            }
            s.slug = newSlug;
            renderGallery();
          } else {
            s[inp.dataset.k] = inp.value.trim();
          }
          markDirty();
        });
      });

      $("button[data-act='delstyle']", card).addEventListener("click", () => {
        const used = state.site.gallery.filter((g) => g.slug === s.slug).length;
        if (used > 0) {
          alert(`Gaya "${s.name}" masih dipakai ${used} foto galeri.\nPindahkan atau hapus foto tersebut lebih dulu.`);
          return;
        }
        if (!confirm(`Hapus gaya "${s.name}" beserta ${s.photos.length} fotonya?`)) return;
        state.site.styles.splice(si, 1);
        renderStyles();
        markDirty();
      });

      const photos = $(".style-ed__photos", card);
      s.photos.forEach((p, pi) => {
        const ph = document.createElement("div");
        ph.className = "ph";
        ph.draggable = true;
        ph.dataset.idx = String(pi);
        ph.innerHTML = `
          <img src="${esc(mediaSrc(p.src))}" alt="" loading="lazy">
          ${pi === 0 ? '<span class="ph__cover">Sampul</span>' : ""}
          <div class="ph__acts">
            <button data-act="up" title="Naik">↑</button>
            <button data-act="down" title="Turun">↓</button>
          </div>
          <button class="ph__del" data-act="del" title="Hapus">✕</button>`;

        ph.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", `${si}:${pi}`));
        ph.addEventListener("dragover", (e) => e.preventDefault());
        ph.addEventListener("drop", (e) => {
          e.preventDefault();
          const [fs, fp] = e.dataTransfer.getData("text/plain").split(":").map(Number);
          if (fs !== si || Number.isNaN(fp) || fp === pi) return;
          const [m] = s.photos.splice(fp, 1);
          s.photos.splice(pi, 0, m);
          renderStyles();
          markDirty();
        });

        ph.addEventListener("click", (e) => {
          const act = e.target.closest("button")?.dataset.act;
          if (!act) return;
          if (act === "up" && pi > 0) [s.photos[pi - 1], s.photos[pi]] = [s.photos[pi], s.photos[pi - 1]];
          else if (act === "down" && pi < s.photos.length - 1)
            [s.photos[pi + 1], s.photos[pi]] = [s.photos[pi], s.photos[pi + 1]];
          else if (act === "del") {
            if (s.photos.length === 1) {
              alert("Setiap gaya minimal punya 1 foto.");
              return;
            }
            if (!confirm("Hapus foto ini?")) return;
            s.photos.splice(pi, 1);
          } else return;
          renderStyles();
          markDirty();
        });

        photos.appendChild(ph);
      });

      $("input[data-add]", card).addEventListener("change", async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file) return;
        const log = $(`[data-log="${si}"]`);
        if (file.size > MAX_IMAGE) {
          log.textContent = "Foto maksimal 5 MB.";
          return;
        }
        log.textContent = "Mengunggah…";
        try {
          const blob = await uploadToBlob(file, `styles/${s.slug || "style"}`, s.slug || "style");
          const d = await dims(blob.url);
          s.photos.push({ src: blob.url, w: d.w, h: d.h });
          renderStyles();
          markDirty();
        } catch (err) {
          log.textContent = "Gagal: " + err.message;
        }
      });

      box.appendChild(card);
    });
  }

  $("#styleAdd").addEventListener("click", () => {
    const name = prompt("Nama gaya baru (mis. Realism):");
    if (!name) return;
    const slug = slugify(name);
    if (state.site.styles.some((s) => s.slug === slug)) {
      alert("Slug sudah dipakai: " + slug);
      return;
    }
    state.site.styles.push({
      slug,
      name: name.trim(),
      blurb: "",
      photos: []
    });
    renderStyles();
    markDirty();
  });

  /* ---------------- panel: location ---------------- */
  function renderLocation() {
    const loc = state.site.location;
    $("#locPhotoPreview").src = mediaSrc(loc.photo?.src) || "";
    $("#locPhotoAlt").value = loc.photo?.alt || "";
    $("#locCaption").value = loc.caption || "";
    $("#locAddress").value = loc.address || "";
    $("#locHours").value = loc.hours || "";
    $("#locCid").value = loc.mapsCid || "";

    /* oninput (not addEventListener) so re-rendering never stacks handlers */
    const bind = (id, apply) => {
      $(id).oninput = (e) => {
        apply(e.target.value);
        markDirty();
      };
    };

    bind("#locPhotoAlt", (v) => (loc.photo.alt = v));
    bind("#locCaption", (v) => (loc.caption = v));
    bind("#locAddress", (v) => (loc.address = v));
    bind("#locHours", (v) => (loc.hours = v));
    bind("#locCid", (v) => (loc.mapsCid = v.replace(/\D/g, "")));

    /* guide entries are plain strings -> dedicated string row editor */
    remapStringRows($("#guideList"), loc.guide);
  }

  /* row editor for plain string arrays */
  function remapStringRows(container, arr) {
    container.innerHTML = "";
    arr.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.draggable = true;
      row.innerHTML = `
        <span class="row-item__grip">⋮⋮</span>
        <div class="row-item__fields">
          <label class="field"><span>Patokan ${i + 1}</span></label>
        </div>
        <div class="row-item__acts">
          <button class="mini" data-act="up">↑</button>
          <button class="mini" data-act="down">↓</button>
          <button class="mini mini--del" data-act="del">✕</button>
        </div>`;
      const input = document.createElement("textarea");
      input.rows = 2;
      input.value = text;
      input.addEventListener("input", () => {
        arr[i] = input.value;
        markDirty();
      });
      $(".row-item__fields", row).appendChild(input);

      row.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", String(i)));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(from) || from === i) return;
        const [m] = arr.splice(from, 1);
        arr.splice(i, 0, m);
        remapStringRows(container, arr);
        markDirty();
      });
      row.addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        else if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        else if (act === "del") {
          if (arr.length === 1) {
            alert("Minimal 1 patokan jalan.");
            return;
          }
          arr.splice(i, 1);
        } else return;
        remapStringRows(container, arr);
        markDirty();
      });
      container.appendChild(row);
    });
  }

  $("#locPhotoFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const log = $("#locPhotoLog");
    if (file.size > MAX_IMAGE) {
      log.textContent = "Foto maksimal 5 MB.";
      return;
    }
    log.textContent = "Mengunggah…";
    try {
      const blob = await uploadToBlob(file, "location", "lokasi");
      const d = await dims(blob.url);
      const loc = state.site.location;
      loc.photo = { src: blob.url, alt: loc.photo?.alt || "Tampak depan Diana Tattoo Studio", w: d.w, h: d.h };
      renderLocation();
      markDirty();
      log.textContent = "Foto siap. Klik Terbitkan untuk menyimpan.";
    } catch (err) {
      log.textContent = "Gagal: " + err.message;
    }
  });

  $("#locPhotoRemove").addEventListener("click", () => {
    if (!confirm("Hapus foto lokasi? Situs akan memakai foto bawaan.")) return;
    state.site.location.photo = {
      src: "assets/img/location/lokasi.jpg",
      alt: "Tampak depan Diana Tattoo Studio",
      w: 1200,
      h: 1600
    };
    renderLocation();
    markDirty();
    $("#locPhotoLog").textContent = "Dikembalikan ke foto bawaan.";
  });

  $("#guideAdd").addEventListener("click", () => {
    state.site.location.guide.push("");
    renderLocation();
    markDirty();
  });

  /* ---------------- panel: stats / marquee / contact ---------------- */
  function renderStats() {
    renderRows(
      $("#statsList"),
      state.site.stats,
      [
        { key: "label", label: "Label", maxlength: 40 },
        { key: "value", label: "Angka", maxlength: 6 },
        { key: "suffix", label: "Suffix", maxlength: 4, placeholder: "%" }
      ],
      { itemLabel: "statistik" }
    );
  }

  $("#statAdd").addEventListener("click", () => {
    state.site.stats.push({ value: 0, label: "Statistik baru", plain: false, delay: null, suffix: null });
    renderStats();
    markDirty();
  });

  function renderMarquee() {
    const box = $("#marqueeList");
    box.innerHTML = "";
    state.site.marquee.forEach((text, i) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="row-item__grip">⋮⋮</span>
        <div class="row-item__fields">
          <label class="field"><span>Baris ${i + 1}</span><input type="text" maxlength="40" value="${esc(text)}"></label>
        </div>
        <div class="row-item__acts">
          <button class="mini" data-act="up">↑</button>
          <button class="mini" data-act="down">↓</button>
          <button class="mini mini--del" data-act="del">✕</button>
        </div>`;
      $("input", row).addEventListener("input", (e) => {
        state.site.marquee[i] = e.target.value;
        markDirty();
      });
      row.addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        const arr = state.site.marquee;
        if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        else if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        else if (act === "del") {
          if (arr.length === 1) {
            alert("Minimal 1 baris marquee.");
            return;
          }
          arr.splice(i, 1);
        } else return;
        renderMarquee();
        markDirty();
      });
      box.appendChild(row);
    });
  }

  $("#marqueeAdd").addEventListener("click", () => {
    state.site.marquee.push("TEKS BARU");
    renderMarquee();
    markDirty();
  });

  const CONTACT_LABELS = {
    whatsapp: "WhatsApp",
    instagram: "Instagram DM",
    tiktok: "TikTok",
    facebook: "Facebook"
  };

  function renderContact() {
    const box = $("#contactList");
    box.innerHTML = "";
    state.site.contact.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="row-item__grip">⋮⋮</span>
        <div class="row-item__fields">
          <label class="field"><span>Platform</span>
            <select data-k="key">
              ${Object.entries(CONTACT_LABELS)
                .map(([k, l]) => `<option value="${k}"${c.key === k ? " selected" : ""}>${l}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field"><span>Label tombol</span><input type="text" data-k="label" value="${esc(c.label)}" maxlength="30"></label>
          <label class="field"><span>URL</span><input type="text" data-k="href" value="${esc(c.href)}" maxlength="300"></label>
        </div>
        <div class="row-item__acts">
          <button class="mini" data-act="up">↑</button>
          <button class="mini" data-act="down">↓</button>
        </div>`;

      row.querySelectorAll("[data-k]").forEach((el) => {
        el.addEventListener("input", () => {
          c[el.dataset.k] = el.value;
          if (el.dataset.k === "key" && !c.label) c.label = CONTACT_LABELS[c.key] || "";
          markDirty();
        });
      });
      row.addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (!act) return;
        const arr = state.site.contact;
        if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        else if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        else return;
        renderContact();
        markDirty();
      });
      box.appendChild(row);
    });
  }

  /* ---------------- render all ---------------- */
  function renderAll() {
    renderHero();
    renderGallery();
    renderStyles();
    renderLocation();
    renderStats();
    renderMarquee();
    renderContact();
  }

  /* ---------------- nav ---------------- */
  $$(".side__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".side__item").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      $$(".panel").forEach((p) => p.classList.remove("is-active"));
      $("#panel-" + btn.dataset.panel).classList.add("is-active");
      $("#sideNav").classList.remove("is-open");
      $("#menuBtn").setAttribute("aria-expanded", "false");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  $("#menuBtn").addEventListener("click", () => {
    const nav = $("#sideNav");
    const open = nav.classList.toggle("is-open");
    $("#menuBtn").setAttribute("aria-expanded", String(open));
  });

  /* ---------------- preview / reset / publish ---------------- */
  $("#resetBtn").addEventListener("click", async () => {
    if (!isDirty()) return;
    if (!confirm("Batalkan semua perubahan yang belum diterbitkan?")) return;
    await loadSite();
    setStatus("Perubahan dibatalkan.", "ok");
  });

  $("#previewBtn").addEventListener("click", async () => {
    setStatus("Menyiapkan pratinjau…");
    try {
      const data = await api("/api/publish", {
        method: "POST",
        csrf: true,
        body: { site: state.site, files: [], deletes: [], preview: true }
      });
      const lines = [
        "PRATINJAU — belum disimpan",
        `Bagian: ${data.summary}`,
        data.orphans ? `File akan dibersihkan: ${data.orphans.repo} repo, ${data.orphans.blobs} blob` : ""
      ].filter(Boolean);
      setStatus(lines.join("\n"), "ok");
    } catch (e) {
      setStatus("Gagal pratinjau: " + e.message, "err");
    }
  });

  $("#publishBtn").addEventListener("click", async () => {
    const btn = $("#publishBtn");
    btn.disabled = true;
    setStatus("Menerbitkan…");
    try {
      const data = await api("/api/publish", {
        method: "POST",
        csrf: true,
        body: { site: state.site, files: [], deletes: [] }
      });
      const removed = data.removed
        ? `\nDibersihkan: ${data.removed.repo} file repo, ${data.removed.blobs} blob`
        : "";
      setStatus(
        `TERBIT ✓ (commit ${String(data.commit).slice(0, 7)})\n${data.summary}${removed}\n\nVercel + GitHub Pages deploy otomatis dalam ±1–2 menit.`,
        "ok"
      );
      state.original = snapshot();
      markDirty();
    } catch (e) {
      setStatus("Gagal menerbitkan: " + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  boot();
})();
