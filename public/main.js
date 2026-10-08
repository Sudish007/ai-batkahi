/* AI Batkahi — progressive enhancement: theme toggle, category filter, share. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Theme toggle ---------- */
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    var darkLabel = toggle.getAttribute("data-dark-label");
    var lightLabel = toggle.getAttribute("data-light-label");

    var currentTheme = function () {
      var t = root.getAttribute("data-theme");
      if (t === "dark" || t === "light") return t;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };

    var themeMetas = document.querySelectorAll('meta[name="theme-color"]');

    var render = function () {
      var isDark = currentTheme() === "dark";
      // Label names the theme the button will switch to.
      toggle.textContent = isDark ? lightLabel : darkLabel;
      // Keep browser UI colour in step with an explicit choice (both media-gated
      // metas get the same value so whichever one matches is correct).
      if (root.hasAttribute("data-theme")) {
        // Source of truth is the --bg token in styles.css; literals are a fallback only.
        var bg = getComputedStyle(root).getPropertyValue("--bg").trim() ||
          (isDark ? "#15130F" : "#FAF6EF");
        for (var m = 0; m < themeMetas.length; m++) {
          themeMetas[m].setAttribute("content", bg);
        }
      }
    };

    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* storage unavailable */
      }
      render();
    });

    render();
    toggle.hidden = false;
  }

  /* ---------- Category filter (posts index) ---------- */
  var filter = document.querySelector(".filter");
  if (filter) {
    var links = filter.querySelectorAll("a[data-filter]");
    var items = document.querySelectorAll(".post-item[data-category]");
    var status = filter.querySelector(".filter-status");

    var apply = function (slug) {
      var visible = 0;
      var known = slug === "all";
      for (var i = 0; i < links.length; i++) {
        if (links[i].getAttribute("data-filter") === slug) known = true;
      }
      if (!known) slug = "all";
      for (var j = 0; j < items.length; j++) {
        var show = slug === "all" || items[j].getAttribute("data-category") === slug;
        items[j].hidden = !show;
        if (show) visible++;
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
    if (location.hash) applyFromHash();
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
