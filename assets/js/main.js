/* Diana Tattoo Studio â€” interaksi minimal, tanpa dependency */

document.addEventListener("DOMContentLoaded", () => {
  const head = document.querySelector(".site-head");

  /* ---------- menu mobile (hamburger) ---------- */
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");

  if (navToggle && navMenu) {
    const setNav = (open) => {
      navMenu.dataset.open = String(open);
      navMenu.setAttribute("aria-hidden", String(!open));
      navMenu.toggleAttribute("inert", !open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    };

    setNav(false);

    navToggle.addEventListener("click", () => {
      setNav(navMenu.dataset.open !== "true");
    });

    navMenu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setNav(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navMenu.dataset.open === "true") setNav(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1024 && navMenu.dataset.open === "true") setNav(false);
    }, { passive: true });
  }

  /* ---------- header state ---------- */
  const onScroll = () => {
    head?.classList.toggle("is-stuck", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- reveal saat scroll: foto & teks masuk dari bawah ---------- */
  const revealTargets = () => document.querySelectorAll("[data-reveal]");

  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal-ready");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );

    const observeAll = () => revealTargets().forEach((el) => {
      if (!el.classList.contains("is-in")) io.observe(el);
    });

    observeAll();
    /* kartu Styles dibuat oleh JS, jadi amati ulang setelah render */
    requestAnimationFrame(observeAll);
    window.addEventListener("load", observeAll, { once: true });
  }

  /* ---------- scroll progress bar ---------- */
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);

  let progressTick = false;
  const updateProgress = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    progress.style.transform = `scaleX(${p})`;
    progressTick = false;
  };
  const queueProgress = () => {
    if (progressTick) return;
    progressTick = true;
    requestAnimationFrame(updateProgress);
  };
  updateProgress();
  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress, { passive: true });

  /* ---------- count-up angka statistik ---------- */
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const reduceMotionQuery =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  const runCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (Number.isNaN(target)) return;
    const suffix = el.dataset.suffix || "";

    /* tahun (data-plain) ditampilkan apa adanya, tanpa animasi angka */
    if (el.dataset.plain === "true") {
      el.textContent = String(target);
      return;
    }
    if (reduceMotionQuery && reduceMotionQuery.matches) {
      el.textContent = target + suffix;
      return;
    }

    const duration = 1100;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const co = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCount(entry.target);
          co.unobserve(entry.target);
        });
      }, { threshold: 0.4 });
      counters.forEach((el) => co.observe(el));
    } else {
      counters.forEach(runCount);
    }
  }

  /* ---------- parallax ringan pada judul section ---------- */
  const parallaxEls = Array.from(document.querySelectorAll("[data-parallax]"));
  if (parallaxEls.length && !(reduceMotionQuery && reduceMotionQuery.matches)) {
    let pTick = false;
    const applyParallax = () => {
      const vh = window.innerHeight;
      parallaxEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        /* -1 (di bawah layar) .. 1 (di atas layar) */
        const rel = (r.top + r.height / 2 - vh / 2) / vh;
        const shift = Math.max(-1, Math.min(1, rel)) * -22;
        el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
      });
      pTick = false;
    };
    const queueParallax = () => {
      if (pTick) return;
      pTick = true;
      requestAnimationFrame(applyParallax);
    };
    applyParallax();
    window.addEventListener("scroll", queueParallax, { passive: true });
    window.addEventListener("resize", queueParallax, { passive: true });
  }

  /* ---------- slideshow foto di halaman About Us ---------- */
  const slideshow = document.querySelector("[data-slideshow]");
  if (slideshow) {
    const PHOTOS = [
      ["g01-balinase", "Balinese"],
      ["g02-fineline", "Fine Line"], ["g03-fineline", "Fine Line"],
      ["g04-fineline", "Fine Line"], ["g05-fineline", "Fine Line"],
      ["g06-fineline", "Fine Line"], ["g07-fineline", "Fine Line"],
      ["g08-fineline", "Fine Line"], ["g09-fineline", "Fine Line"],
      ["g10-fineline", "Fine Line"], ["g11-fineline", "Fine Line"],
      ["g12-japanese", "Japanese"], ["g13-japanese", "Japanese"],
      ["g14-japanese", "Japanese"], ["g15-japanese", "Japanese"],
      ["g16-japanese", "Japanese"],
      ["g17-maoriental", "Maoriental"],
      ["g18-medusa", "Medusa"],
      ["g19-shicano", "Shicano"]
    ].map(([file, name]) => ({ src: `assets/img/ring/${file}.jpg`, name }));

    const imgs = Array.from(slideshow.querySelectorAll(".about-figure__img"));
    const caption = slideshow.parentElement.querySelector(".about-figure__cap");

    /* preload semua foto supaya pergantian mulus tanpa kedip */
    PHOTOS.forEach((photo) => { new Image().src = photo.src; });

    let current = 0;
    let front = 0;
    let timer = null;

    const show = (index) => {
      const next = (front + 1) % imgs.length;
      const img = imgs[next];
      img.src = PHOTOS[index].src;
      img.alt = `Karya tato gaya ${PHOTOS[index].name} di Diana Tattoo Studio`;
      img.classList.add("is-active");
      imgs[front].classList.remove("is-active");
      front = next;
      if (caption) caption.textContent = PHOTOS[index].name;
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        current = (current + 1) % PHOTOS.length;
        show(current);
      }, 1000);
    };

    const stop = () => {
      clearInterval(timer);
      timer = null;
    };

    if (!(reduceMotionQuery && reduceMotionQuery.matches)) {
      start();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else start();
      });
    }
  }

  /* ---------- video: hemat daya saat tab tidak aktif ---------- */
  const video = document.querySelector(".hero__video");
  if (video) {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    });
  }

  /* ---------- cursor glow: lingkaran penerang mengikuti mouse ---------- */
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let rx = -9999, ry = -9999, tx = -9999, ty = -9999;
  window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  window.addEventListener("mouseenter", () => document.body.classList.add("has-glow"));
  window.addEventListener("mouseleave", () => document.body.classList.remove("has-glow"));

  if (reduceMotion) {
    glow.style.transform = "translate(-9999px, -9999px)";
  } else {
    const glide = () => {
      rx += (tx - rx) * 0.2;
      ry += (ty - ry) * 0.2;
      glow.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(glide);
    };
    glide();
  }

  /* ---------- Tattoo Styles ---------- */
  const STYLES = [
    { slug: "balinese",   name: "Balinese",   count: 1,  blurb: "Ornamen sakral, garis tegas" },
    { slug: "fineline",   name: "Fine Line",  count: 10, blurb: "Halus, detail, presisi" },
    { slug: "japanese",   name: "Japanese",   count: 5,  blurb: "Irezumi, motif klasik" },
    { slug: "maoriental", name: "Maoriental", count: 1,  blurb: "Maori & oriental" },
    { slug: "medusa",     name: "Medusa",     count: 1,  blurb: "Mitologi, dramatis" },
    { slug: "shicano",    name: "Shicano",    count: 1,  blurb: "Chicano, hitam pekat" }
  ];

  const pad = (n) => String(n).padStart(2, "0");
  const imgPath = (slug, i) => `assets/img/styles/${slug}/${slug}-${pad(i)}.jpg`;

  /* panel galeri dipakai bersama oleh grid Styles & foto berjalan */
  let openStylePanel = null;

  const grid = document.getElementById("stylesGrid");

  if (grid) {
    grid.innerHTML = STYLES.map((s, i) => `
      <button class="style-card" type="button" data-slug="${s.slug}" aria-label="Lihat ${s.name}" data-reveal style="--d:${(i * 0.09).toFixed(2)}s">
        <span class="style-card__view">View</span>
        <span class="style-card__media">
          <img src="${imgPath(s.slug, 1)}" alt="${s.name} tattoo" loading="lazy" width="1200" height="1600">
          <span class="style-card__meta">
            <span class="style-card__name">${s.name}</span>
            <span class="style-card__count">${s.count} ${s.count === 1 ? "piece" : "pieces"} &middot; ${s.blurb}</span>
          </span>
        </span>
      </button>
    `).join("");
  }

  /* panel galeri â€” dibuat sekali, bisa dipicu dari grid maupun foto berjalan */
  {
    const panel = document.createElement("div");
    panel.className = "style-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="style-panel__inner" role="dialog" aria-modal="true" aria-labelledby="spTitle">
        <div class="style-panel__top">
          <div>
            <h3 class="style-panel__title" id="spTitle"></h3>
            <p class="style-panel__count"></p>
          </div>
          <button class="style-panel__close" type="button" aria-label="Tutup">&times;</button>
        </div>
        <div class="style-panel__grid"></div>
      </div>`;
    document.body.appendChild(panel);

    const spTitle = panel.querySelector(".style-panel__title");
    const spCount = panel.querySelector(".style-panel__count");
    const spGrid = panel.querySelector(".style-panel__grid");
    const spClose = panel.querySelector(".style-panel__close");

    openStylePanel = (style) => {
      spTitle.textContent = style.name;
      spCount.textContent = `${style.count} ${style.count === 1 ? "piece" : "pieces"} Â· ${style.blurb}`;
      spGrid.innerHTML = Array.from({ length: style.count }, (_, i) => `
        <img src="${imgPath(style.slug, i + 1)}" alt="${style.name} ${i + 1}" loading="lazy">
      `).join("");
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      document.body.classList.add("panel-open");
      spClose.focus();
    };

    const closePanel = () => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("panel-open");
    };

    if (grid) {
      grid.addEventListener("click", (e) => {
        const btn = e.target.closest(".style-card");
        if (!btn) return;
        const style = STYLES.find((s) => s.slug === btn.dataset.slug);
        if (style && openStylePanel) openStylePanel(style);
      });
    }

    spClose.addEventListener("click", closePanel);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) closePanel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) closePanel();
    });
  }

  /* ---------- modal booking: pilih kanal kontak ---------- */
  {
    const CHANNELS = [
      {
        key: "whatsapp",
        label: "WhatsApp",
        href: "https://wa.me/6287755036876",
        path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      },
      {
        key: "instagram",
        label: "Instagram DM",
        href: "https://www.instagram.com/diana_inkk",
        path: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      },
      {
        key: "tiktok",
        label: "TikTok",
        href: "https://www.tiktok.com/@guswidy_08",
        path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
      },
      {
        key: "facebook",
        label: "Facebook",
        href: "https://www.facebook.com/share/1CuRrf39HU/?mibextid=wwXIfr",
        path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      }
    ];

    const modal = document.createElement("div");
    modal.className = "book-modal";
    modal.id = "bookModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="book-modal__inner" role="dialog" aria-modal="true" aria-labelledby="bmTitle">
        <button class="book-modal__close" type="button" aria-label="Tutup">&times;</button>
        <div class="book-modal__brand">
          <div>
            <img class="book-modal__logo" src="assets/img/logo.png" alt="" width="200" height="200">
            <p class="book-modal__brand-name">Diana<span>Tattoo Studio</span></p>
          </div>
          <p class="book-modal__brand-note">Custom only &middot; Bali<br>Since 2024</p>
        </div>
        <div class="book-modal__body">
          <p class="book-modal__eyebrow">Book a Session</p>
          <h2 class="book-modal__title" id="bmTitle">Mari mulai percakapan</h2>
          <p class="book-modal__sub">Pilih kanal yang paling nyaman. Ceritakan ide, referensi, dan penempatan tato Anda &mdash; konsultasi gratis, tanpa komitmen.</p>
          <div class="book-modal__channels">
            ${CHANNELS.map((c) => `
              <a class="book-modal__channel book-modal__channel--${c.key}" href="${c.href}" target="_blank" rel="noopener">
                <span class="book-modal__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${c.path}"/></svg></span>
                <span class="book-modal__channel-label">${c.label}</span>
              </a>`).join("")}
          </div>
          <p class="book-modal__foot">Balasan biasanya dalam beberapa jam pada jam operasional, Senin&ndash;Sabtu 10.00&ndash;20.00 WITA.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const inner = modal.querySelector(".book-modal__inner");
    const closeBtn = modal.querySelector(".book-modal__close");
    let lastTrigger = null;

    const focusables = () => Array.from(
      inner.querySelectorAll('a[href], button:not([disabled])')
    );

    /* elemen baru bisa difokus setelah transisi visibility membuka panel,
       jadi coba ulang per-frame sampai fokus benar-benar masuk ke modal */
    const focusFirstChannel = (attempt = 0) => {
      if (!modal.classList.contains("is-open")) return;
      const first = modal.querySelector(".book-modal__channel");
      if (!first) return;
      first.focus({ preventScroll: true });
      if (modal.contains(document.activeElement)) return;
      if (attempt < 120) requestAnimationFrame(() => focusFirstChannel(attempt + 1));
    };

    const openModal = (trigger) => {
      lastTrigger = trigger || null;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      modal.toggleAttribute("inert", false);
      document.body.classList.add("modal-open");
      focusFirstChannel();
    };

    const closeModal = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modal.toggleAttribute("inert", true);
      document.body.classList.remove("modal-open");
      if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
    };

    document.querySelectorAll('a[href*="#book"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const menu = document.getElementById("navMenu");
        if (menu && menu.dataset.open === "true") {
          document.getElementById("navToggle")?.click();
        }
        openModal(link);
      });
    });

    closeBtn.addEventListener("click", closeModal);

    /* buka otomatis bila halaman dimuat langsung dengan #book */
    if (window.location.hash === "#book") openModal(null);

    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#book" && !modal.classList.contains("is-open")) {
        openModal(null);
      }
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape") {
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ---------- galeri berjalan: foto mengalir ke kiri ---------- */
  const stage = document.getElementById("arc");
  if (!stage) return;

  const track = stage.querySelector(".arc-strip");
  if (!track) return;

  /* duplikat kartu sekali agar pergeseran -50% membungkus mulus */
  Array.from(track.children).forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    const img = clone.querySelector("img");
    if (img) img.setAttribute("loading", "lazy");
    track.appendChild(clone);
  });

  const VISIBLE = 6; // jumlah foto yang tampil sekaligus (tetap 6 kartu)

  const measure = () => {
    const w = stage.clientWidth;
    /* 6 kartu di satu layar, tanpa jarak antar kartu (gap nol) */
    const gap = 0;
    const cw = Math.floor(w / VISIBLE);

    stage.style.setProperty("--cw", `${cw}px`);
    stage.style.setProperty("--gap", `${gap}px`);

    /* kecepatan konstan: geser seluruh siklus dalam waktu tetap per pixel */
    const total = track.children.length * (cw + gap);
    stage.style.setProperty("--dur", `${Math.round(total / 48)}s`);
  };
  measure();
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("load", measure, { once: true });

  /* ---------- cekungan ke dalam ----------
     Lebih besar di sisi kiri & kanan, mengecil ke arah tengah layar,
     lalu membesar lagi â€” seperti strip yang tenggelam ke belakang layar.
     Skala tiap kartu dihitung dari posisi layarnya tiap frame (rAF). */
  const cards = Array.from(track.children);

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const apply = () => {
    const w = stage.clientWidth;
    const cw = parseFloat(stage.style.getPropertyValue("--cw")) || 120;
    const gap = parseFloat(stage.style.getPropertyValue("--gap")) || 8;
    const step = cw + gap;

    /* posisi track dibaca sekali (track hanya digeser, tidak dimiringkan,
       jadi rect-nya tidak terpengaruh rotateY kartu) */
    const trackLeft = track.getBoundingClientRect().left;

    cards.forEach((card, i) => {
      const cx = trackLeft + i * step + cw / 2; // pusat kartu di layar
      const edge = cx / w;                        // 0 = tepi kiri, 1 = tepi kanan
      const t = edge < 0 ? 1 : edge > 1 ? 0 : edge;

      /* cekungan: 0 di tepi, 1 di tengah layar */
      const depth = Math.sin(t * Math.PI);
      const scale = 1 - depth * 0.46;             // tengah â‰ˆ 54% ukuran tepi
      const op = 1 - depth * 0.55;

      /* orientasi: tengah 0Â° tegap; kanan negatif (hadap kiri);
         kiri positif (hadap kanan) -> mengarah ke cekungan.
         (0.5 - t) maksimum 0.5 di tepi, jadi dikali 28 -> Â±14Â° */
      const tilt = (0.5 - t) * 28;

      card.style.setProperty("--curve", `${scale}`);
      card.style.setProperty("--curve-op", `${op}`);
      card.style.setProperty("--tilt", `${tilt.toFixed(2)}deg`);
    });
  };

  const loop = () => { apply(); requestAnimationFrame(loop); };
  if (!reduce) {
    requestAnimationFrame(loop);
  } else {
    apply();
  }

  /* ---------- klik/tap pada foto berjalan -> buka gaya terkait ----------
     Menekan kartu menghentikan aliran, lalu membuka panel galeri gaya
     yang sesuai dengan foto tersebut. */
  const openFromCard = (card) => {
    const slug = card.dataset.slug;
    if (!slug || !openStylePanel) return;
    const style = STYLES.find((s) => s.slug === slug);
    if (style) openStylePanel(style);
  };

  stage.addEventListener("click", (e) => {
    const card = e.target.closest(".arc-card");
    if (!card) return;
    openFromCard(card);
  });

  stage.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".arc-card");
    if (!card) return;
    e.preventDefault();
    openFromCard(card);
  });
});