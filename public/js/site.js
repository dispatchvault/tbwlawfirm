/**
 * site.js — replaces the Webflow interaction runtime (IX2 + w-dropdown +
 * w-lightbox) with small vanilla equivalents. The site's own custom jQuery
 * code from the original build (menu/accordion .open class toggles, swiper
 * inits, counter-up, top-bar scroll) is kept verbatim in each page's markup;
 * this file provides the pieces Webflow's runtime used to supply:
 *
 *   1. desktop nav dropdown open/close (hover, 250ms close delay)
 *   2. mobile hamburger menu open/close
 *   3. accordion height animation driven by the existing .open class toggles
 *   4. scroll-into-view fade animations (.fade-in-up / .fade-up)
 *   5. video lightbox for .w-lightbox links (reads the .w-json payload)
 *
 * All content is fully visible without JavaScript: collapse/hide styles are
 * gated behind the html.js class (set inline in the layout <head>).
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* 1. Webflow-style dropdowns (data-hover + data-delay)              */
  /* ---------------------------------------------------------------- */
  document.querySelectorAll('.w-dropdown').forEach(function (dd) {
    var toggle = dd.querySelector('.w-dropdown-toggle');
    var list = dd.querySelector('.w-dropdown-list');
    if (!toggle || !list) return;
    var delay = parseInt(dd.getAttribute('data-delay') || '0', 10) || 0;
    var timer = null;
    var open = function () {
      clearTimeout(timer);
      toggle.classList.add('w--open');
      list.classList.add('w--open');
      toggle.setAttribute('aria-expanded', 'true');
      var shadow = document.querySelector('.dropdown-shadow');
      if (shadow) shadow.classList.add('is-visible');
    };
    var close = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        toggle.classList.remove('w--open');
        list.classList.remove('w--open');
        toggle.setAttribute('aria-expanded', 'false');
        if (!document.querySelector('.w-dropdown-list.w--open')) {
          var shadow = document.querySelector('.dropdown-shadow');
          if (shadow) shadow.classList.remove('is-visible');
        }
      }, delay);
    };
    if (dd.getAttribute('data-hover') === 'true') {
      dd.addEventListener('mouseenter', open);
      dd.addEventListener('mouseleave', close);
    }
    toggle.addEventListener('click', function () {
      if (toggle.classList.contains('w--open')) {
        toggle.classList.remove('w--open');
        list.classList.remove('w--open');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        open();
      }
    });
  });

  /* ---------------------------------------------------------------- */
  /* 2. Mobile hamburger menu                                          */
  /* ---------------------------------------------------------------- */
  var hamburger = document.querySelector('.mb-menu-hamburger');
  var mbMenu = document.querySelector('.mb-menu-dropdown');
  function sizeMenu() {
    if (!mbMenu || !mbMenu.classList.contains('visible')) return;
    var top = mbMenu.getBoundingClientRect().top;
    mbMenu.style.height = Math.max(0, window.innerHeight - top) + 'px';
  }
  if (hamburger && mbMenu) {
    hamburger.addEventListener('click', function () {
      var opening = !mbMenu.classList.contains('visible');
      mbMenu.classList.toggle('visible', opening);
      hamburger.classList.toggle('menu-open', opening);
      document.body.classList.toggle('mb-menu-open', opening);
      if (opening) sizeMenu();
      else mbMenu.style.height = '';
    });
    window.addEventListener('resize', sizeMenu);
  }

  /* ---------------------------------------------------------------- */
  /* 3. Accordions — animate the panel below any .open-toggled trigger */
  /* ---------------------------------------------------------------- */
  // pairs: [trigger selector, panel = next sibling selector]
  var ACCORDION_PANELS = ['.acordium-bottom', '.mobile-acordium__bottom'];

  function panelFor(trigger) {
    // FAQ/practice accordions: trigger is .acordium (panel inside it);
    // mobile menu/footer: trigger is .mobile-acordium-trigger (panel is next sibling)
    var inner = trigger.querySelector('.acordium-bottom');
    if (inner) return inner;
    var next = trigger.nextElementSibling;
    if (next && ACCORDION_PANELS.some(function (s) { return next.matches(s); })) return next;
    return null;
  }

  function setPanel(panel, expand, animate) {
    if (!panel) return;
    var current = panel.style.height;
    if (expand && current === 'auto') return;
    if (!expand && current === '0px') return;
    if (!animate) {
      panel.style.height = expand ? 'auto' : '0px';
      return;
    }
    if (expand) {
      panel.style.height = panel.scrollHeight + 'px';
      var done = function () {
        panel.style.height = 'auto';
        panel.removeEventListener('transitionend', done);
      };
      panel.addEventListener('transitionend', done);
    } else {
      panel.style.height = panel.scrollHeight + 'px';
      // force reflow so the transition to 0 runs
      void panel.offsetHeight;
      panel.style.height = '0px';
    }
  }

  function accordionTriggers() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-click]'));
  }

  // Two flavours exist:
  //  - content accordions (.acordium, data-click="faq*"): the page's own jQuery
  //    toggles .open reliably (bound once) — heights follow the class.
  //  - mobile menu/footer accordions (panel is the trigger's next sibling): the
  //    live site bound the "menu" toggle twice so the .open toggles cancel; the
  //    Webflow runtime drove those. site.js owns their state via .panel-open.
  function isClassDriven(t) {
    return !!t.querySelector('.acordium-bottom');
  }

  function syncClassDriven(animate) {
    accordionTriggers().forEach(function (t) {
      if (!isClassDriven(t)) return;
      setPanel(panelFor(t), t.classList.contains('open'), animate);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-click]');
    if (!t) return;
    if (isClassDriven(t)) {
      // let the jQuery handlers finish toggling .open first
      setTimeout(function () {
        syncClassDriven(true);
      }, 0);
      return;
    }
    var panel = panelFor(t);
    if (!panel) return;
    var expanding = !t.classList.contains('panel-open');
    if (expanding) {
      // exclusivity within the same accordion group, as on the live site
      accordionTriggers().forEach(function (other) {
        if (other !== t && other.getAttribute('data-click') === t.getAttribute('data-click')) {
          other.classList.remove('panel-open');
          if (!isClassDriven(other)) setPanel(panelFor(other), false, true);
        }
      });
    }
    t.classList.toggle('panel-open', expanding);
    setPanel(panel, expanding, true);
  });

  // initial state: everything closed; the pages' own scripts then open the
  // first content accordion where the live site did ($('#first').click())
  accordionTriggers().forEach(function (t) {
    setPanel(panelFor(t), false, false);
  });

  /* ---------------------------------------------------------------- */
  /* 4. Scroll fade-ins                                                */
  /* ---------------------------------------------------------------- */
  var fades = document.querySelectorAll('.fade-in-up, .fade-up');
  if ('IntersectionObserver' in window && fades.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('anim-in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );
    fades.forEach(function (el) {
      io.observe(el);
    });
  } else {
    fades.forEach(function (el) {
      el.classList.add('anim-in');
    });
  }

  /* ---------------------------------------------------------------- */
  /* 5. Blog category filter (replaces Finsweet CMS Filter)            */
  /*    - toggles is-active / w--redirected-checked on the checkboxes  */
  /*    - syncs the ?category= query param (live site behaviour)       */
  /*    - actual show/hide runs in the site's own jQuery code, which   */
  /*      listens for `input` events on .checkbox-field/.search-field  */
  /* ---------------------------------------------------------------- */
  var filterList = document.querySelector('.collection-list-2');
  if (filterList) {
    var labels = Array.prototype.slice.call(filterList.querySelectorAll('.checkbox-field'));
    var searchField = document.querySelector('.search-field');
    var items = function () {
      return Array.prototype.slice.call(document.querySelectorAll('.blog-collection-list .blog-item'));
    };
    var setChecked = function (label, on) {
      label.classList.toggle('is-active', on);
      var box = label.querySelector('.w-checkbox-input');
      if (box) box.classList.toggle('w--redirected-checked', on);
      var input = label.querySelector('input[type="checkbox"]');
      if (input) input.checked = on;
    };
    var activeNames = function () {
      return labels
        .filter(function (l) { return l.classList.contains('is-active'); })
        .map(function (l) { return l.textContent.trim(); });
    };
    var applyFilter = function () {
      var active = activeNames();
      var term = searchField ? searchField.value.trim().toLowerCase() : '';
      items().forEach(function (item) {
        var titleEl = item.querySelector('.cms-title');
        var title = titleEl ? titleEl.textContent : '';
        var cats = Array.prototype.slice
          .call(item.querySelectorAll('.blog-category'))
          .map(function (c) { return c.textContent.trim(); });
        var catOk =
          !active.length ||
          cats.some(function (c) { return active.indexOf(c) !== -1; });
        var termOk =
          !term ||
          title.toLowerCase().indexOf(term) !== -1 ||
          cats.join(' ').toLowerCase().indexOf(term) !== -1;
        item.style.display = catOk && termOk ? '' : 'none';
        // search-term highlight, as the live site's CMS filter rendered it
        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.unmark && titleEl) {
          var $t = window.jQuery(titleEl);
          $t.unmark({
            done: function () {
              if (term) $t.mark(term, { element: 'span', className: 'fs-cmsfilter_highlight' });
            }
          });
        }
      });
    };
    var syncUrl = function () {
      var params = new URLSearchParams(window.location.search);
      params.delete('category');
      activeNames().forEach(function (name) { params.append('category', name); });
      var qs = params.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
    };
    labels.forEach(function (label) {
      label.addEventListener('click', function (e) {
        // the label's default toggles the hidden input; normalise state ourselves
        e.preventDefault();
        setChecked(label, !label.classList.contains('is-active'));
        syncUrl();
        applyFilter();
      });
    });
    if (searchField) searchField.addEventListener('input', applyFilter);
    // deep links: /blog?category=Case+News (also the /category/* redirects)
    var wanted = new URLSearchParams(window.location.search).getAll('category');
    if (wanted.length) {
      labels.forEach(function (label) {
        if (wanted.indexOf(label.textContent.trim()) !== -1) setChecked(label, true);
      });
      applyFilter();
    }
  }

  /* ---------------------------------------------------------------- */
  /* 6. Lightbox (Webflow w-lightbox links with .w-json payloads)      */
  /* ---------------------------------------------------------------- */
  function embedUrlFor(item) {
    var url = item && (item.originalUrl || item.url);
    if (!url) return null;
    var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (yt) return 'https://www.youtube.com/embed/' + yt[1] + '?autoplay=1&rel=0';
    return url;
  }

  document.querySelectorAll('a.w-lightbox').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var script = link.querySelector('script.w-json');
      if (!script) return;
      var data;
      try {
        data = JSON.parse(script.textContent);
      } catch (_err) {
        return;
      }
      var src = embedUrlFor(data.items && data.items[0]);
      if (!src) return;
      e.preventDefault();
      var backdrop = document.createElement('div');
      backdrop.className = 'site-lightbox-backdrop';
      backdrop.innerHTML =
        '<div class="site-lightbox-frame">' +
        '<button type="button" class="site-lightbox-close" aria-label="Close">&times;</button>' +
        '<iframe src="' +
        src +
        '" frameborder="0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>' +
        '</div>';
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      var closeLb = function () {
        backdrop.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
      };
      var onKey = function (ev) {
        if (ev.key === 'Escape') closeLb();
      };
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop || ev.target.classList.contains('site-lightbox-close')) closeLb();
      });
      document.addEventListener('keydown', onKey);
    });
  });
})();
