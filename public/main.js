/* AI Batkahi — progressive enhancement. One IIFE of small modules, each guarded
   by the presence of its element: theme, platform kbd, header height, kinetic
   word slot, reveal fallback, category filter, share. ES2017, no dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme toggle ----------
     Light is the default for everyone; the OS preference is never consulted.
     "dark" = html[data-theme="dark"], anything else = light (no attribute). */
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    var colorMeta = document.querySelector('meta[name="theme-color"]');

    var current = function () {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    };

    var render = function () {
      var isDark = current() === "dark";
      // Label names the theme the button will switch to.
      toggle.setAttribute(
        "aria-label",
        toggle.getAttribute(isDark ? "data-light-label" : "data-dark-label")
      );
      if (schemeMeta) schemeMeta.content = isDark ? "dark" : "light";
      if (colorMeta) {
        // Source of truth is the --bg token in styles.css; literals are a fallback only.
        colorMeta.content =
          getComputedStyle(root).getPropertyValue("--bg").trim() ||
          (isDark ? "#15130F" : "#FAF6EF");
      }
    };

    toggle.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      if (next === "dark") root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* storage unavailable */
      }
      render();
    });

    render();
    toggle.disabled = false;
  }

  /* ---------- Platform: show the Command glyph on Apple devices ---------- */
  var kbds = document.querySelectorAll(".kbd");
  if (kbds.length) {
    var platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";
    if (/Mac|iPhone|iPad/.test(platform)) {
      for (var p = 0; p < kbds.length; p++) kbds[p].textContent = "\u2318 K";
    }
  }

  /* ---------- Header height -> --header-h (hero min-height uses it) ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var setHeaderHeight = function () {
      root.style.setProperty("--header-h", header.offsetHeight + "px");
    };
    var hhFrame = null;
    window.addEventListener("resize", function () {
      if (hhFrame) return;
      hhFrame = requestAnimationFrame(function () {
        hhFrame = null;
        setHeaderHeight();
      });
    });
    setHeaderHeight();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setHeaderHeight);
    }
  }

  /* ---------- Kinetic word slot (home hero) ---------- */
  var slot = document.querySelector(".slot");
  if (slot) {
    var items = slot.querySelectorAll(".slot-item");
    var index = 0;
    var timer = null;
    var paused = false;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    var show = function (i) {
      for (var k = 0; k < items.length; k++) {
        if (k === i) items[k].setAttribute("data-on", "");
        else items[k].removeAttribute("data-on");
      }
      index = i;
    };
    var advance = function () {
      show((index + 1) % items.length);
    };
    var start = function () {
      if (timer || items.length < 2) return;
      timer = setInterval(function () {
        if (!paused && !document.hidden) advance();
      }, 3500);
    };
    var stop = function () {
      clearInterval(timer);
      timer = null;
    };

    slot.addEventListener("click", advance);
    slot.addEventListener("mouseenter", function () { paused = true; });
    slot.addEventListener("mouseleave", function () { paused = false; });
    slot.addEventListener("focus", function () { paused = true; });
    slot.addEventListener("blur", function () { paused = false; });

    if (!reduce.matches) start();
    var onReduceChange = function (e) {
      if (e.matches) {
        stop();
        show(0);
      } else {
        start();
      }
    };
    if (reduce.addEventListener) reduce.addEventListener("change", onReduceChange);
    else if (reduce.addListener) reduce.addListener(onReduceChange);

    slot.disabled = false;
  }

  /* ---------- Reveal fallback (no scroll-driven animations) ---------- */
  if (root.classList.contains("no-sda") && "IntersectionObserver" in window) {
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
      var io = new IntersectionObserver(
        function (entries) {
          for (var r = 0; r < entries.length; r++) {
            if (entries[r].isIntersecting) {
              entries[r].target.classList.add("is-in");
              io.unobserve(entries[r].target);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px" }
      );
      for (var q = 0; q < reveals.length; q++) io.observe(reveals[q]);
    }
  }

  /* ---------- Reading progress fallback (post page) ----------
     The CSS drives the bar with a scroll() timeline where supported; here we
     only step in for browsers without scroll-driven animations. */
  var bar = document.querySelector(".progress-bar");
  if (
    bar &&
    !(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"))
  ) {
    var updateProgress = function () {
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      bar.style.transform = "scaleX(" + Math.min(1, window.scrollY / max) + ")";
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  /* ---------- Table of contents (post page) ----------
     <details> is open in the HTML so it works without JS. With JS it starts
     collapsed below 75em (a reader's own toggle is respected) and is forced
     open from 75em, where the CSS hides the summary and shows the sticky rail. */
  var details = document.querySelector(".toc-wrap");
  if (details) {
    var wide = window.matchMedia("(min-width: 75em)");
    var userToggled = false;
    var syncToc = function () {
      if (wide.matches) details.open = true;
      else if (!userToggled) details.open = false;
    };
    var summary = details.querySelector("summary");
    if (summary) {
      summary.addEventListener("click", function () {
        userToggled = true;
      });
    }
    syncToc();
    if (wide.addEventListener) wide.addEventListener("change", syncToc);
    else if (wide.addListener) wide.addListener(syncToc);

    // Active section: the last heading whose top is above 30% of the viewport.
    var tocLinks = details.querySelectorAll('.toc a[href^="#"]');
    var targets = [];
    for (var t = 0; t < tocLinks.length; t++) {
      var heading = document.getElementById(tocLinks[t].getAttribute("href").slice(1));
      if (heading) targets.push({ link: tocLinks[t], heading: heading });
    }
    if (targets.length) {
      var markActive = function () {
        var line = window.innerHeight * 0.3;
        var active = targets[0];
        for (var u = 0; u < targets.length; u++) {
          if (targets[u].heading.getBoundingClientRect().top <= line) active = targets[u];
        }
        for (var v = 0; v < targets.length; v++) {
          if (targets[v] === active) targets[v].link.setAttribute("aria-current", "true");
          else targets[v].link.removeAttribute("aria-current");
        }
      };
      window.addEventListener("scroll", markActive, { passive: true });
      markActive();
    }
  }

  /* ---------- Category filter (posts index) ----------
     Hash first, then the ?category= deep link; clicks rewrite only the hash. */
  var filter = document.querySelector(".filter");
  if (filter) {
    var links = filter.querySelectorAll("a[data-filter]");
    var postItems = document.querySelectorAll(".post-item[data-category]");
    var status = filter.querySelector(".filter-status");

    var apply = function (slug) {
      var visible = 0;
      var known = slug === "all";
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute("data-filter") === slug) known = true;
      }
      if (!known) slug = "all";
      for (var j = 0; j < postItems.length; j++) {
        var showItem = slug === "all" || postItems[j].getAttribute("data-category") === slug;
        postItems[j].hidden = !showItem;
        if (showItem) visible++;
      }
      for (var k = 0; k < links.length; k++) {
        if (links[k].getAttribute("data-filter") === slug) {
          links[k].setAttribute("aria-current", "true");
        } else {
          links[k].removeAttribute("aria-current");
        }
      }
      if (status) status.textContent = visible + " बतकही";
    };

    for (var n = 0; n < links.length; n++) {
      links[n].addEventListener("click", function (ev) {
        var slug = this.getAttribute("data-filter");
        ev.preventDefault();
        apply(slug);
        var hash = slug === "all" ? "" : "#" + slug;
        if (history.replaceState) {
          history.replaceState(null, "", location.pathname + location.search + hash);
        }
      });
    }

    var applyFromHash = function () {
      var slug = location.hash.replace(/^#/, "");
      apply(slug || "all");
    };
    window.addEventListener("hashchange", applyFromHash);

    var initial = location.hash.slice(1);
    if (!initial && window.URLSearchParams) {
      initial = new URLSearchParams(location.search).get("category") || "";
    }
    if (initial) apply(initial); // unknown slugs fall back to "all" inside apply()
  }

  /* ---------- Share controls (post page) ---------- */
  var share = document.querySelector(".share");
  if (share) {
    var copyBtn = share.querySelector(".copy-link");
    var shareBtn = share.querySelector(".web-share");
    var shareStatus = share.querySelector(".share-status");
    var canCopy = !!(navigator.clipboard && navigator.clipboard.writeText);
    var canShare = !!navigator.share;
    var statusTimer = null;

    var say = function (text) {
      if (!shareStatus) return;
      shareStatus.textContent = text;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        shareStatus.textContent = "";
      }, 2000);
    };

    if (canCopy && copyBtn) {
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(location.href).then(
          function () {
            say("लिंक कॉपी हो गइल");
          },
          function () {
            say("कॉपी ना हो पाइल");
          }
        );
      });
    } else if (copyBtn) {
      copyBtn.hidden = true;
    }

    if (canShare && shareBtn) {
      shareBtn.hidden = false;
      shareBtn.addEventListener("click", function () {
        navigator
          .share({ title: document.title, url: location.href })
          .catch(function () {
            /* user cancelled */
          });
      });
    }

    if (canCopy || canShare) share.hidden = false;
  }
})();
