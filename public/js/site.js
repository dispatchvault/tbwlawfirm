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
    return document.querySelectorAll('[data-click]');
  }

  // initial sync (the site's own scripts may have pre-opened items, e.g. $('#first').click())
  function syncAccordions(animate) {
    accordionTriggers().forEach(function (t) {
      var panel = panelFor(t);
      if (panel) setPanel(panel, t.classList.contains('open'), animate);
    });
  }

  // the original jQuery code toggles .open on click (with exclusivity by
  // simulating clicks); re-sync heights after those handlers run
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-click]');
    if (!t) return;
    setTimeout(function () {
      syncAccordions(true);
    }, 0);
  });
  syncAccordions(false);

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
  /* 5. Lightbox (Webflow w-lightbox links with .w-json payloads)      */
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
