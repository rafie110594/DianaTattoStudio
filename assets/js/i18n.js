/* ==========================================================================
   Runtime bahasa Diana Tattoo Studio
   - Tanpa fetch / tanpa dependency -> tetap berjalan di file://
   - Prioritas: ?lang= > localStorage > "id"
   - Blok yang ditulis ulang oleh render.mjs tidak diberi data-i18n;
     teksnya ditambal lewat selector (patchDynamic) dan hanya saat lang != id,
     sehingga suntingan dari panel admin tidak tertimpa.
   ========================================================================== */
(function () {
  "use strict";

  var DATA = window.__I18N__ || {};
  var LANGS = ["id", "en", "ja"];
  var DEFAULT_LANG = "id";
  var STORAGE_KEY = "dts-lang";

  var page = document.documentElement.dataset.page || "home";
  var current = DEFAULT_LANG;

  /* ---------- util ---------- */

  function normalize(code) {
    if (!code) return "";
    var c = String(code).toLowerCase().slice(0, 2);
    return LANGS.indexOf(c) !== -1 ? c : "";
  }

  function plainText(html) {
    var probe = document.createElement("div");
    probe.innerHTML = html;
    return String(probe.textContent || "")
      .toLowerCase()
      .replace(/[:\uFF1A]/g, ".")
      .replace(/[\u2013\u2014\u2212]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lookup(dict, key) {
    if (!dict || !key) return undefined;
    /* kunci di kamus sebagian datar ("nav.styles") dan sebagian bertingkat
       ("dyn.styles" -> "balinese" -> "name"). Coba kunci langsung, lalu
       telusuri bertingkat dari prefix terpanjang yang ada. */
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];

    var parts = String(key).split(".");
    for (var cut = parts.length - 1; cut > 0; cut--) {
      var prefix = parts.slice(0, cut).join(".");
      if (!Object.prototype.hasOwnProperty.call(dict, prefix)) continue;
      var node = dict[prefix];
      for (var i = cut; i < parts.length; i++) {
        if (node == null) return undefined;
        node = node[parts[i]];
      }
      return node;
    }
    return undefined;
  }

  function detect() {
    var fromQuery = "";
    try {
      fromQuery = normalize(new URLSearchParams(window.location.search).get("lang"));
    } catch (err) { fromQuery = ""; }
    if (fromQuery) return fromQuery;

    var saved = "";
    try { saved = normalize(window.localStorage.getItem(STORAGE_KEY)); } catch (err) { saved = ""; }
    if (saved) return saved;

    return DEFAULT_LANG;
  }

  /* ---------- API ---------- */

  function t(key, fallback) {
    var value = lookup(DATA[current], key);
    if (value == null) value = lookup(DATA[DEFAULT_LANG], key);
    if (value == null) return fallback == null ? "" : fallback;
    return value;
  }

  function tf(key, vars) {
    var str = t(key);
    if (typeof str !== "string") return str;
    return str.replace(/\{(\w+)\}/g, function (match, name) {
      return vars && vars[name] != null ? vars[name] : match;
    });
  }

  /* ---------- teks statis di markup ---------- */

  function apply() {
    document.documentElement.lang = current;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var value = t(el.dataset.i18n, el.textContent);
      if (typeof value === "string") el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var value = t(el.dataset.i18nHtml, el.innerHTML);
      if (typeof value === "string") el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var value = t(el.dataset.i18nAria, el.getAttribute("aria-label") || "");
      if (typeof value === "string") el.setAttribute("aria-label", value);
    });

    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var value = t(el.dataset.i18nAlt, el.getAttribute("alt") || "");
      if (typeof value === "string") el.setAttribute("alt", value);
    });

    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var value = t(el.dataset.i18nTitle, el.getAttribute("title") || "");
      if (typeof value === "string") el.setAttribute("title", value);
    });

    applyMeta();
    applySwitch();
  }

  function applyMeta() {
    var title = t("meta." + page + ".title");
    if (title) document.title = title;

    var desc = t("meta." + page + ".description");
    var metaDesc = document.querySelector('meta[name="description"]');
    if (desc && metaDesc) metaDesc.setAttribute("content", desc);

    var ogTitle = t("meta." + page + ".ogTitle");
    var ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitleEl) ogTitleEl.setAttribute("content", ogTitle);

    var ogDesc = t("meta." + page + ".ogDescription");
    var ogDescEl = document.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDescEl) ogDescEl.setAttribute("content", ogDesc);

    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute("content", current);
  }

  function applySwitch() {
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      var isActive = btn.dataset.langBtn === current;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.classList.toggle("is-active", isActive);
    });

    document.querySelectorAll("[data-lang-code]").forEach(function (el) {
      el.textContent = current.toUpperCase();
    });

    var group = document.querySelector(".lang-menu__panel");
    if (group) {
      var label = t("ui.lang.group");
      if (label) group.setAttribute("aria-label", label);
    }
  }

  /* ---------- blok dinamis hasil render ---------- */

  var dynCache = null;

  function captureDynamic() {
    if (dynCache) return;
    dynCache = {
      marquee: [],
      stats: [],
      arc: [],
      caption: [],
      guide: [],
      metaLabel: [],
      metaValue: []
    };

    document.querySelectorAll(".marquee__track span").forEach(function (el) {
      dynCache.marquee.push(el.textContent);
    });
    document.querySelectorAll(".stats__list .stats__label").forEach(function (el) {
      dynCache.stats.push(el.textContent);
    });
    document.querySelectorAll(".arc-card").forEach(function (el) {
      dynCache.arc.push(el.getAttribute("aria-label") || "");
    });
    document.querySelectorAll(".location-figure__cap").forEach(function (el) {
      dynCache.caption.push(el.innerHTML);
    });
    document.querySelectorAll(".location-guide__list p").forEach(function (el) {
      dynCache.guide.push(el.innerHTML);
    });
    document.querySelectorAll(".location-meta__label").forEach(function (el) {
      dynCache.metaLabel.push(el.textContent);
    });
    document.querySelectorAll(".location-meta__value").forEach(function (el) {
      dynCache.metaValue.push(el.innerHTML);
    });
  }

  function patchDynamic() {
    captureDynamic();
    var isDefault = current === DEFAULT_LANG;

    /* marquee */
    var marquee = t("dyn.marquee");
    if (Array.isArray(marquee) && marquee.length) {
      document.querySelectorAll(".marquee__track span").forEach(function (el, i) {
        el.textContent = isDefault
          ? (dynCache.marquee[i] != null ? dynCache.marquee[i] : el.textContent)
          : marquee[i % marquee.length];
      });
    }

    /* label statistik */
    var stats = t("dyn.stats");
    if (Array.isArray(stats)) {
      document.querySelectorAll(".stats__list .stats__label").forEach(function (el, i) {
        if (isDefault) {
          if (dynCache.stats[i] != null) el.textContent = dynCache.stats[i];
        } else if (stats[i] && stats[i].label) {
          el.textContent = stats[i].label;
        }
      });
    }

    /* kartu galeri melengkung */
    document.querySelectorAll(".arc-card").forEach(function (el, i) {
      if (isDefault) {
        if (dynCache.arc[i] != null) el.setAttribute("aria-label", dynCache.arc[i]);
        return;
      }
      var name = t("dyn.styles." + el.dataset.slug + ".name");
      if (name) el.setAttribute("aria-label", tf("ui.arcAria", { name: name }));
    });

    /* keterangan foto lokasi */
    var caption = t("dyn.location.caption");
    document.querySelectorAll(".location-figure__cap").forEach(function (el, i) {
      if (isDefault) {
        if (dynCache.caption[i] != null) el.innerHTML = dynCache.caption[i];
      } else if (caption) {
        el.innerHTML = caption;
      }
    });

    /* patokan jalan */
    var guide = t("dyn.location.guide");
    if (Array.isArray(guide)) {
      document.querySelectorAll(".location-guide__list p").forEach(function (el, i) {
        if (isDefault) {
          if (dynCache.guide[i] != null) el.innerHTML = dynCache.guide[i];
        } else if (guide[i]) {
          el.innerHTML = guide[i];
        }
      });
    }

    /* label alamat & jam buka */
    var labels = [t("dyn.location.addrLabel"), t("dyn.location.hoursLabel")];
    document.querySelectorAll(".location-meta__label").forEach(function (el, i) {
      if (isDefault) {
        if (dynCache.metaLabel[i] != null) el.textContent = dynCache.metaLabel[i];
      } else if (labels[i]) {
        el.textContent = labels[i];
      }
    });

    var values = [t("dyn.location.address"), t("dyn.location.hours")];
    /* jam buka sering diubah lewat panel admin. Bila nilai di halaman sudah
       berbeda dari kamus ID, tampilkan apa adanya (jangan pakai terjemahan
       lama yang bisa menyesatkan). */
    var hoursBase = lookup(DATA[DEFAULT_LANG], "dyn.location.hours");
    var hoursChanged = hoursBase != null &&
      plainText(dynCache.metaValue[1] || "") !== plainText(hoursBase);
    document.querySelectorAll(".location-meta__value").forEach(function (el, i) {
      if (isDefault) {
        if (dynCache.metaValue[i] != null) el.innerHTML = dynCache.metaValue[i];
      } else if (values[i] && !(i === 1 && hoursChanged)) {
        el.innerHTML = values[i];
      } else if (dynCache.metaValue[i] != null) {
        el.innerHTML = dynCache.metaValue[i];
      }
    });
  }

  /* ---------- ganti bahasa ---------- */

  function syncUrl(code) {
    try {
      var url = new URL(window.location.href);
      if (code === DEFAULT_LANG) url.searchParams.delete("lang");
      else url.searchParams.set("lang", code);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (err) { /* riwayat tidak tersedia: abaikan */ }
  }

  function setLang(code, opts) {
    var next = normalize(code) || DEFAULT_LANG;
    var changed = next !== current;
    current = next;

    try { window.localStorage.setItem(STORAGE_KEY, current); } catch (err) { /* private mode */ }

    if (!opts || opts.updateUrl !== false) syncUrl(current);

    apply();
    patchDynamic();

    if (changed || (opts && opts.force)) {
      document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: current } }));
    }
  }

  /* ---------- menu bahasa (dropdown) ---------- */

  var closeLangMenu = null;

  function initLangMenu() {
    var menu = document.querySelector("[data-lang-menu]");
    if (!menu) return;

    var toggle = menu.querySelector(".lang-menu__toggle");
    var panel = menu.querySelector(".lang-menu__panel");
    if (!toggle || !panel) return;

    function isOpen() { return !panel.hidden; }

    function open() {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      var active = panel.querySelector("[data-lang-btn].is-active");
      if (active) active.focus();
    }

    function close(returnFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      if (returnFocus) toggle.focus();
    }

    closeLangMenu = close;

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close(true);
      else open();
    });

    panel.addEventListener("click", function (e) {
      if (!e.target.closest("[data-lang-close]")) return;
      e.preventDefault();
      close(true);
    });

    document.addEventListener("click", function (e) {
      if (isOpen() && !menu.contains(e.target)) close(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) close(true);
    });
  }

  function init() {
    /* simpan teks asli SEBELUM bahasa pertama diterapkan,
       supaya kembali ke ID memulihkan teks asli (termasuk hasil render) */
    captureDynamic();

    current = detect();
    setLang(current, { updateUrl: false });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-lang-btn]");
      if (!btn) return;
      e.preventDefault();
      setLang(btn.dataset.langBtn);
      if (closeLangMenu) closeLangMenu(true);
    });

    initLangMenu();
  }

  window.I18N = {
    t: t,
    tf: tf,
    apply: apply,
    patchDynamic: patchDynamic,
    setLang: setLang,
    get lang() { return current; },
    languages: LANGS.slice()
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
