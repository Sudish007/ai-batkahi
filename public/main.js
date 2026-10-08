/* AI Batkahi — progressive enhancement. One IIFE of small modules, each guarded
   by the presence of its element: theme, platform kbd, header height, kinetic
   word slot, reveal fallback, category filter, share. ES2017, no dependencies. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme toggle ----------
     Light is the default for everyone; the OS preference is never consulted.
     "dark" = html[data-theme="dark"], anything else = light (no attribute). */
  // theme.toggle() is shared with the palette's "थीम बदलीं" action so the
  // attribute, storage, aria-label and meta updates live in one code path.
  var theme = { toggle: null };
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    var colorMeta = document.querySelector('meta[name="theme-color"]');

    var current = function () {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    };

    // withMetas: the inline pre-paint script already set both metas on load, so
    // the start-up call only fixes the label (reading --bg would force a style pass).
    var render = function (withMetas) {
      var isDark = current() === "dark";
      // Label names the theme the button will switch to.
      toggle.setAttribute(
        "aria-label",
        toggle.getAttribute(isDark ? "data-light-label" : "data-dark-label")
      );
      if (!withMetas) return;
      if (schemeMeta) schemeMeta.content = isDark ? "dark" : "light";
      if (colorMeta) {
        // Source of truth is the --bg token in styles.css; literals are a fallback only.
        colorMeta.content =
          getComputedStyle(root).getPropertyValue("--bg").trim() ||
          (isDark ? "#15130F" : "#FAF6EF");
      }
    };

    theme.toggle = function () {
      var next = current() === "dark" ? "light" : "dark";
      if (next === "dark") root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* storage unavailable */
      }
      render(true);
    };
    toggle.addEventListener("click", theme.toggle);

    render(false);
    toggle.disabled = false;
  }

  /* ---------- Platform: show the Command glyph on Apple devices ---------- */
  var kbds = document.querySelectorAll(".kbd");
  if (kbds.length) {
    var platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";
    // userAgentData reports "macOS", navigator.platform "MacIntel": match both.
    if (/mac|iphone|ipad/i.test(platform)) {
      for (var p = 0; p < kbds.length; p++) kbds[p].textContent = "\u2318 K";
    }
  }

  /* ---------- Header height -> --header-h (hero min-height uses it) ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var setHeaderHeight = function () {
      var measured = header.offsetHeight;
      // The stylesheet already states the normal height (registered <length>, so
      // it computes to px). Writing a :root custom property restyles the whole
      // tree and moves the hero, so only write when the CSS value is off.
      var declared = parseFloat(getComputedStyle(root).getPropertyValue("--header-h"));
      if (Math.abs(declared - measured) < 0.5) return;
      root.style.setProperty("--header-h", measured + "px");
    };
    var hhFrame = null;
    window.addEventListener("resize", function () {
      if (hhFrame) return;
      hhFrame = requestAnimationFrame(function () {
        hhFrame = null;
        setHeaderHeight();
      });
    });
    // Measure after the next frame has painted so this script never forces the
    // document's first layout (the CSS value is right for the normal cases).
    var measureAfterPaint = function () {
      requestAnimationFrame(function () {
        setTimeout(setHeaderHeight, 0);
      });
    };
    measureAfterPaint();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureAfterPaint);
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

  /* ---------- Command palette (every page) ----------
     The <dialog> is inert without JS and the search link stays a plain link.
     Options are the <a>/<button> elements themselves (li is presentational), so
     aria-activedescendant names the thing Enter activates. */
  var dialog = document.querySelector(".palette");
  var searchBtn = document.querySelector(".search-btn");
  var openPalette = null;
  if (dialog && typeof dialog.showModal === "function") {
    var input = dialog.querySelector(".palette-input");
    var list = dialog.querySelector(".palette-results");
    var palStatus = dialog.querySelector(".palette-status");
    var themeBtn = dialog.querySelector(".palette-theme");
    var statics = [];
    var staticRows = list.querySelectorAll("li");
    for (var s = 0; s < staticRows.length; s++) {
      if (staticRows[s].querySelector("[data-static]")) statics.push(staticRows[s]);
    }
    var searchIndex = null; // null = not fetched yet; [] = fetched (or failed)
    var indexFailed = false;
    var indexPromise = null;
    var invoker = null;
    var renderFrame = null;

    var norm = function (str) {
      return String(str || "").normalize("NFC").toLowerCase();
    };

    var loadIndex = function () {
      if (indexPromise) return indexPromise;
      indexPromise = fetch(dialog.getAttribute("data-index"), { credentials: "same-origin" })
        .then(function (res) {
          return res.ok ? res.json() : Promise.reject(new Error(String(res.status)));
        })
        .then(function (data) {
          searchIndex = (data && data.posts) || [];
        })
        .catch(function (err) {
          searchIndex = [];
          indexFailed = true;
          console.warn("search.json unavailable", err);
        });
      return indexPromise;
    };

    var score = function (post, q) {
      var title = norm(post.title);
      var points = 0;
      if (title.indexOf(q) === 0) points += 10;
      else if (title.indexOf(q) !== -1) points += 6;
      if (norm(post.title_en).indexOf(q) !== -1) points += 4;
      var tagHit = norm(post.categoryName).indexOf(q) !== -1 || norm(post.category).indexOf(q) !== -1;
      var tags = post.tags || [];
      for (var i = 0; i < tags.length && !tagHit; i++) {
        if (norm(tags[i]).indexOf(q) !== -1) tagHit = true;
      }
      if (tagHit) points += 3;
      if (norm(post.summary).indexOf(q) !== -1) points += 1;
      return points;
    };

    var options = function () {
      var all = list.querySelectorAll('[role="option"]');
      var visible = [];
      for (var i = 0; i < all.length; i++) {
        if (!all[i].parentNode.hidden) visible.push(all[i]);
      }
      return visible;
    };

    var setActive = function (el) {
      var all = list.querySelectorAll('[role="option"]');
      for (var i = 0; i < all.length; i++) all[i].removeAttribute("aria-selected");
      if (el) {
        el.setAttribute("aria-selected", "true");
        input.setAttribute("aria-activedescendant", el.id);
        if (el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
      } else {
        input.setAttribute("aria-activedescendant", "");
      }
    };

    var activeOption = function () {
      var id = input.getAttribute("aria-activedescendant");
      return id ? document.getElementById(id) : null;
    };

    var renderPalette = function (query) {
      var q = norm(query).trim();
      var posts = searchIndex || [];
      var results = [];
      if (q) {
        for (var i = 0; i < posts.length; i++) {
          var pts = score(posts[i], q);
          if (pts > 0) results.push({ post: posts[i], score: pts });
        }
        results.sort(function (a, b) {
          return b.score - a.score || (a.post.date < b.post.date ? 1 : a.post.date > b.post.date ? -1 : 0);
        });
        results = results.slice(0, 8);
      } else {
        for (var j = 0; j < posts.length && j < 5; j++) results.push({ post: posts[j] });
      }

      // Rebuild the post rows (textContent only), inserted before the static rows.
      var old = list.querySelectorAll("li[data-post]");
      for (var k = 0; k < old.length; k++) list.removeChild(old[k]);
      var first = list.firstChild;
      for (var n = 0; n < results.length; n++) {
        var post = results[n].post;
        var li = document.createElement("li");
        li.setAttribute("role", "presentation");
        li.setAttribute("data-post", "");
        var a = document.createElement("a");
        a.setAttribute("role", "option");
        a.id = "pal-" + (n + 1);
        a.tabIndex = -1;
        a.href = post.url;
        var t = document.createElement("span");
        t.className = "pal-title";
        t.textContent = post.title;
        var meta = document.createElement("span");
        meta.className = "pal-meta";
        meta.lang = "en";
        meta.textContent = post.title_en + " \u00b7 " + post.categoryName;
        a.appendChild(t);
        a.appendChild(meta);
        li.appendChild(a);
        list.insertBefore(li, first);
      }

      // Static rows stay; with a query they are hidden unless their text matches.
      var staticVisible = 0;
      for (var m = 0; m < statics.length; m++) {
        var hide = !!q && norm(statics[m].textContent).indexOf(q) === -1;
        statics[m].hidden = hide;
        if (!hide) staticVisible++;
      }

      var visible = options();
      setActive(visible.length ? visible[0] : null);

      if (indexFailed) {
        palStatus.textContent = "खोज अभी उपलब्ध नइखे";
      } else if (searchIndex === null) {
        palStatus.textContent = "";
      } else {
        var count = q ? results.length + staticVisible : results.length;
        palStatus.textContent = count ? count + " नतीजा" : "कुछ ना मिलल।";
      }
    };

    var scheduleRender = function () {
      if (renderFrame) return;
      renderFrame = requestAnimationFrame(function () {
        renderFrame = null;
        renderPalette(input.value);
      });
    };

    openPalette = function (from) {
      if (dialog.open) {
        input.focus();
        return;
      }
      invoker = from || null;
      dialog.showModal();
      input.value = "";
      renderPalette("");
      input.focus();
      if (searchIndex === null) {
        loadIndex().then(function () {
          if (dialog.open) renderPalette(input.value);
        });
      }
    };

    // Focus goes back to the invoker synchronously: the dialog's "close" event
    // is dispatched in a later task, so waiting for it alone leaves the input
    // focused for a tick (the close listener below still covers native cancel).
    var closePalette = function () {
      if (!dialog.open) return;
      dialog.close();
      if (invoker && invoker.focus) invoker.focus();
    };

    var move = function (delta, absolute) {
      var visible = options();
      if (!visible.length) return;
      var current = activeOption();
      var at = -1;
      for (var i = 0; i < visible.length; i++) {
        if (visible[i] === current) at = i;
      }
      var next;
      if (absolute === "first") next = 0;
      else if (absolute === "last") next = visible.length - 1;
      else next = (at + delta + visible.length) % visible.length;
      setActive(visible[next]);
    };

    input.addEventListener("input", scheduleRender);

    input.addEventListener("keydown", function (ev) {
      switch (ev.key) {
        case "ArrowDown":
          ev.preventDefault();
          move(1);
          break;
        case "ArrowUp":
          ev.preventDefault();
          move(-1);
          break;
        case "Home":
          ev.preventDefault();
          move(0, "first");
          break;
        case "End":
          ev.preventDefault();
          move(0, "last");
          break;
        case "Enter":
          ev.preventDefault(); // never submit the method="dialog" form
          var active = activeOption();
          if (!active) return;
          if (active.tagName === "BUTTON") active.click();
          else location.assign(active.href);
          break;
        case "Escape":
          ev.preventDefault();
          closePalette();
          break;
      }
    });

    // Clicks on <a role=option> navigate natively (middle-click works).
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        if (theme.toggle) theme.toggle();
        closePalette();
      });
    }

    dialog.addEventListener("click", function (ev) {
      if (ev.target === dialog) closePalette(); // backdrop
    });

    dialog.addEventListener("close", function () {
      if (invoker && invoker.focus) invoker.focus();
    });

    // The form never submits: Enter is handled above, but keep it inert anyway.
    dialog.querySelector(".palette-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
    });

    if (searchBtn) {
      searchBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        openPalette(searchBtn);
      });
    }

    // Ctrl/⌘+K is always on (it is a modifier shortcut, WCAG 2.1.4 does not apply).
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "k" && (ev.ctrlKey || ev.metaKey) && !ev.altKey) {
        ev.preventDefault();
        openPalette(searchBtn || document.activeElement);
      }
    });
  }

  /* ---------- Single-key shortcuts ('/' and g-chords) with an off switch ----------
     WCAG 2.1.4: page-wide single-character shortcuts must be turn-off-able.
     localStorage.shortcuts === "off" disables them; the toggle lives in the
     palette footer. Never fires inside editable fields or while the palette is open. */
  if (dialog && openPalette) {
    var shortcutsOn = function () {
      try {
        return localStorage.getItem("shortcuts") !== "off";
      } catch (e) {
        return true;
      }
    };
    var isEditable = function (t) {
      return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
    };
    var chordTimer = null;
    var chordOpen = false;
    var cancelChord = function () {
      clearTimeout(chordTimer);
      chordTimer = null;
      chordOpen = false;
    };

    document.addEventListener("keydown", function (ev) {
      if (dialog.open || isEditable(ev.target)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var key = ev.key;
      if (chordOpen) {
        var target = /^[hpa]$/.test(key) ? dialog.querySelector('[data-chord="' + key + '"]') : null;
        cancelChord();
        if (target) {
          ev.preventDefault();
          location.assign(target.href);
        }
        return;
      }
      if (!shortcutsOn()) return;
      if (key === "/") {
        ev.preventDefault();
        openPalette(searchBtn || document.activeElement);
      } else if (key === "g") {
        chordOpen = true;
        chordTimer = setTimeout(cancelChord, 800);
      }
    });

    var shortcutsBtn = dialog.querySelector(".shortcuts-toggle");
    var hints = dialog.querySelector(".palette-hints");
    if (shortcutsBtn) {
      var stateEl = shortcutsBtn.querySelector(".shortcuts-state");
      var renderShortcuts = function () {
        var on = shortcutsOn();
        shortcutsBtn.setAttribute("aria-pressed", on ? "true" : "false");
        if (stateEl) stateEl.textContent = on ? "चालू" : "बंद";
        if (hints) hints.classList.toggle("shortcuts-off", !on);
      };
      shortcutsBtn.addEventListener("click", function () {
        try {
          if (shortcutsOn()) localStorage.setItem("shortcuts", "off");
          else localStorage.removeItem("shortcuts");
        } catch (e) {
          /* storage unavailable */
        }
        renderShortcuts();
      });
      renderShortcuts();
    }
  }

  /* ---------- Cross-document view transitions: title handoff ----------
     CSS names the post <h1> "post-title" statically; on list pages the clicked
     card title gets the same name only for the moment of navigation (and back),
     so the title morphs into the heading. Chromium only; others crossfade root. */
  if ("onpageswap" in window && "navigation" in window) {
    var postPath = /\/posts\/([a-z0-9-]+)\/$/;
    window.addEventListener("pageswap", function (e) {
      if (!e.viewTransition || !e.activation || !e.activation.entry) return;
      var to = new URL(e.activation.entry.url).pathname;
      var m = to.match(postPath);
      if (!m) return;
      var link = document.querySelector(
        '.post-item-title a[href$="/posts/' + m[1] + '/"], .related a[href$="/posts/' + m[1] + '/"]'
      );
      if (link) link.style.viewTransitionName = "post-title";
    });
    window.addEventListener("pagereveal", function (e) {
      if (!e.viewTransition || !navigation.activation || !navigation.activation.from) return;
      var from = new URL(navigation.activation.from.url).pathname;
      var m = from.match(postPath);
      if (!m || document.querySelector(".post-header h1")) return;
      var link = document.querySelector('.post-item-title a[href$="/posts/' + m[1] + '/"]');
      if (!link) return;
      link.style.viewTransitionName = "post-title";
      // finished rejects when the browser skips the transition; clear either way.
      var clearName = function () {
        link.style.viewTransitionName = "";
      };
      e.viewTransition.finished.then(clearName, clearName);
    });
  }
})();
