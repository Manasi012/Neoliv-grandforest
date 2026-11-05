/* Scroll reveals that replay: play when an element enters the view, reset once it is well outside it
   (the larger reset margin stops elements flickering at the screen edge). */
/* Animations play on every device, including iPhones with "Reduce Motion" switched on (the client wants
   the motion seen). To respect that setting again, use: window.matchMedia('(prefers-reduced-motion: reduce)').matches */
window.gfReduce = false;

window.gfReplay = function (els, cls, inMargin) {
    els = Array.prototype.slice.call(els);
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || window.gfReduce) {
        els.forEach(function (el) { el.classList.add(cls); });
        return;
    }
    var inObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add(cls); });
    }, { rootMargin: inMargin || '0px 0px -8% 0px' });
    var outObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (!e.isIntersecting) e.target.classList.remove(cls); });
    }, { rootMargin: '20% 0px 20% 0px' });
    els.forEach(function (el) { inObs.observe(el); outObs.observe(el); });
};

(function () {
    'use strict';
    var CFG = window.GF_CONFIG;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var store = {
        get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
    };
    document.body.classList.remove('no-js');
    $('#yr').textContent = new Date().getFullYear();
    var toastT;
    function toast(msg) {
        var t = $('#toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastT);
        toastT = setTimeout(function () { t.classList.remove('show'); }, 3200);
    }
    function track(event, data) {
        window.dataLayer = window.dataLayer || [];
        var o = { event: event };
        for (var k in data) o[k] = data[k];
        window.dataLayer.push(o);
    }

    /* ---------------- Attribution (hidden fields) ---------------- */
    var params = new URLSearchParams(location.search);
    var ATTR_KEY = 'gf-attr';
    var attr = {};
    try { attr = JSON.parse(store.get(ATTR_KEY) || '{}'); } catch (e) { attr = {}; }
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(function (k) {
        if (params.get(k)) attr[k] = params.get(k);
    });
    if (!attr.utm_term && params.get('keyword')) attr.utm_term = params.get('keyword');
    // Partner-tagged links: ?partner=CP123 (also accepts cp= or partner_code=)
    var partner = params.get('partner') || params.get('cp') || params.get('partner_code');
    if (partner) attr.partner_code = partner.replace(/[^\w-]/g, '').slice(0, 32);
    if (!attr.landing_page) attr.landing_page = location.href.split('#')[0];
    if (!attr.referrer) attr.referrer = document.referrer || 'direct';
    var views = parseInt(store.get('gf-views') || '0', 10) + 1;
    store.set('gf-views', String(views));
    store.set(ATTR_KEY, JSON.stringify(attr));
    var device = /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    var sectionsSeen = [];
    var currentSection = 'hero';

    /* ---------------- Header, nav, reveal ---------------- */
    // The header is not sticky: it sits on the hero and scrolls away with the page, so it never switches
    // to the white "scrolled" bar (that CSS stays in case a sticky header is wanted again).
    var burger = $('.burger');
    function setMenu(open) {
        document.documentElement.classList.toggle('menu-open', open);
        burger.setAttribute('aria-expanded', open);
        burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setMenu(!document.documentElement.classList.contains('menu-open')); });
    $$('.mnav a').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var id = a.getAttribute('href'), target = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
            setMenu(false);
            if (!target) return;
            e.preventDefault();
            // wait a frame so the scroll lock is released before scrolling
            requestAnimationFrame(function () {
                var top = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                if (history.replaceState) history.replaceState(null, '', id);
            });
        });
    });

    window.gfReplay($$('.rv'), 'in');

    var navLinks = $$('.nav a');
    var secObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
            if (!e.isIntersecting) return;
            var name = e.target.dataset.section;
            currentSection = name;
            if (sectionsSeen.indexOf(name) < 0) { sectionsSeen.push(name); track('gf_section_view', { section: name }); }
            navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-section]').forEach(function (s) { secObs.observe(s); });

    // Floating desktop button steps aside over the footer and final CTA (which repeat the same actions)
    var frail = $('#frail');
    var asideObs = new IntersectionObserver(function (es) {
        var any = false;
        es.forEach(function (e) { e.target._in = e.isIntersecting; });
        [$('.ftr'), $('.cta-band'), $('#home')].forEach(function (el) { if (el && el._in) any = true; });
        if (frail) frail.classList.toggle('hide', any);
    }, { threshold: .2 });
    [$('.ftr'), $('.cta-band'), $('#home')].forEach(function (el) { if (el) asideObs.observe(el); });

    $$('[data-track]').forEach(function (a) {
        a.addEventListener('click', function () { track('gf_contact_click', { channel: a.dataset.track, section: currentSection }); });
    });

    /* ---------------- Hero film (loads late, never blocks first paint) ---------------- */
    function lateLoad(fn) {
        if (document.readyState === 'complete') setTimeout(fn, 600);
        else window.addEventListener('load', function () { setTimeout(fn, 600); });
    }
    var conn = navigator.connection || {};
    var lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    var vid = $('#heroVideo');
    // The hero film is heavy, so it only loads once the visitor has entered the site (after the welcome
    // screen and loader), on every screen size, but not on Save-Data / slow connections (those keep the poster image).
    function afterEnter(fn) {
        if (window.__gfLoaded) lateLoad(fn); else window.addEventListener('gf:loaded', function () { lateLoad(fn); }, { once: true });
    }
    var slowNet = /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
    afterEnter(function () {
        if (!vid || lowData || slowNet || !vid.dataset.src) return;
        // iOS / Android only autoplay inline when muted is set as a property, not just the attribute
        vid.muted = true;
        vid.defaultMuted = true;
        vid.playsInline = true;
        vid.setAttribute('autoplay', '');
        vid.setAttribute('webkit-playsinline', '');
        var src = document.createElement('source');
        src.src = vid.dataset.src;
        src.type = 'video/mp4';
        src.addEventListener('error', function () { vid.remove(); });
        vid.appendChild(src);
        vid.addEventListener('playing', function () { vid.classList.add('playing'); });
        vid.load();
        var p = vid.play();
        if (p && p.catch) p.catch(function () {
            // autoplay blocked (e.g. iOS Low Power Mode): start on the first touch / click instead
            function retry() { vid.play().catch(function () { }); }
            document.addEventListener('touchstart', retry, { once: true, passive: true });
            document.addEventListener('click', retry, { once: true });
        });
    });

    /* ---------------- Buying purpose ---------------- */
    var PURPOSE_BY_KEY = { build: 'Build own home', weekend: 'Weekend / second home', investment: 'Investment', villa: 'Villa' };
    function setPurpose(key, fromForm) {
        if (!PURPOSE_BY_KEY[key]) return;
        document.body.dataset.purpose = key;
        store.set('gf-purpose', key);
        if (!fromForm) {
            var r = $('#enqForm input[name="purpose"][data-key="' + key + '"]');
            if (r && !$('#enqForm input[name="purpose"]:checked')) r.checked = true;
        }
    }
    var savedPurpose = store.get('gf-purpose');
    if (savedPurpose) document.body.dataset.purpose = savedPurpose;
    $$('[data-purpose-link]').forEach(function (a) { a.addEventListener('click', function () { setPurpose(a.dataset.purposeLink); }); });

    /* ---------------- Amenities: auto slider ----------------
       2½ slides on desktop (1½ on tablet, 1 + a peek on phones). Autoplays from page load, loops back at the end,
       pauses while the pointer is over it or after a swipe/click. Each slide has an expand button (lightbox with prev/next). */
    (function () {
        var root = $('.amx');
        if (!root) return;
        var track = $('.amx__track', root), slides = $$('.amx__slide', root), dots = $$('.amx__dots button', root);
        var count = $('.amx__count b', root), DUR = 4000, cur = 0, timer = null, hold = false, resume = null;
        var reduce = window.gfReduce;
        root.style.setProperty('--amx-dur', DUR + 'ms');
        function maxLeft() { return track.scrollWidth - track.clientWidth; }
        function atEnd() { return track.scrollLeft >= maxLeft() - 4; }
        function mark(i) {
            cur = i;
            dots.forEach(function (d, k) { d.classList.toggle('on', k === i); if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
            if (count) count.textContent = (i < 9 ? '0' : '') + (i + 1);
        }
        function go(i) {
            i = (i + slides.length) % slides.length;
            track.scrollTo({ left: Math.min(slides[i].offsetLeft - slides[0].offsetLeft, maxLeft()), behavior: reduce ? 'auto' : 'smooth' });
            mark(i);
            restartFill();
        }
        function next() { go(atEnd() ? 0 : cur + 1); }   // the last slides are already in view: loop back to the first
        function restartFill() { root.classList.remove('is-auto'); void root.offsetWidth; if (timer) root.classList.add('is-auto'); }
        function stop() { clearInterval(timer); timer = null; root.classList.remove('is-auto'); }
        function start() {
            stop();
            if (reduce || hold || document.hidden) return;
            timer = setInterval(next, DUR);
            restartFill();
        }
        function pauseFor(ms) { hold = true; stop(); clearTimeout(resume); resume = setTimeout(function () { hold = false; start(); }, ms); }
        // a swipe or scroll by the visitor updates the counter
        var st = null;
        track.addEventListener('scroll', function () {
            clearTimeout(st);
            st = setTimeout(function () {
                if (atEnd()) { mark(Math.max(cur, slides.length - 1 - Math.floor(track.clientWidth / slides[0].offsetWidth) + 1)); return; }
                var x = track.scrollLeft, best = 0, bd = Infinity;
                slides.forEach(function (s, k) { var d = Math.abs(s.offsetLeft - slides[0].offsetLeft - x); if (d < bd) { bd = d; best = k; } });
                mark(best);
            }, 90);
        }, { passive: true });
        dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); pauseFor(8000); }); });
        $$('[data-amx]', root).forEach(function (b) { b.addEventListener('click', function () { if (+b.dataset.amx > 0) next(); else go(cur - 1); pauseFor(8000); }); });
        track.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); if (e.key === 'ArrowRight') next(); else go(cur - 1); pauseFor(8000); }
        });
        track.addEventListener('touchstart', function () { pauseFor(7000); }, { passive: true });
        root.addEventListener('mouseenter', function () { hold = true; stop(); });
        root.addEventListener('mouseleave', function () { hold = false; start(); });
        document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
        start();   // autoplay from the start

        // Expand: open the slide full size; arrows (and keys) browse the amenities
        var lb = $('#lightbox'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('p'), lbIdx = 0;
        function show(i) {
            lbIdx = (i + slides.length) % slides.length;
            var s = slides[lbIdx], img = s.querySelector('img');
            lbImg.src = img.getAttribute('src');   // the 1400px image
            lbImg.alt = img.alt;
            lbCap.textContent = s.querySelector('h3').textContent;
        }
        if (!lb.querySelector('.lightbox__nav')) {
            lb.insertAdjacentHTML('beforeend', '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>');
        }
        lb.querySelector('.lightbox__nav--prev').addEventListener('click', function () { show(lbIdx - 1); });
        lb.querySelector('.lightbox__nav--next').addEventListener('click', function () { show(lbIdx + 1); });
        lb.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') show(lbIdx + 1);
            if (e.key === 'ArrowLeft') show(lbIdx - 1);
        });
        lb.addEventListener('close', function () { hold = false; start(); });
        slides.forEach(function (s, k) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'amx__expand';
            btn.setAttribute('aria-label', 'View ' + s.querySelector('h3').textContent + ' full size');
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>';
            btn.addEventListener('click', function () { hold = true; stop(); show(k); if (lb.showModal) lb.showModal(); });
            s.appendChild(btn);
        });
    })();

    /* ---------------- Amenities (v4): category tabs on desktop, accordion + chips on phones, "all 66" sheet ---------------- */
    (function () {
        var box = $('#amTabs');
        if (!box) return;
        var tabs = $$('.amt__tab', box), panels = $$('.amt__p', box), phone = window.matchMedia('(max-width: 720px)');
        // one group open at a time: opening one closes the others
        function setOpen(p, open) {
            panels.forEach(function (o) {
                var on = o === p ? open : (open ? false : o.classList.contains('is-open'));
                o.classList.toggle('is-open', on);
                $('.amt__acc', o).setAttribute('aria-expanded', on ? 'true' : 'false');
            });
        }
        function select(k) {
            tabs.forEach(function (t) { t.setAttribute('aria-selected', t.dataset.k === k ? 'true' : 'false'); });
            panels.forEach(function (p) { p.classList.toggle('is-on', p.dataset.k === k); });
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function () {
                select(t.dataset.k);
                if (!phone.matches) return;
                // phones: the chip opens that group in the accordion and brings it into view
                var p = panels[i];
                setOpen(p, true);
                requestAnimationFrame(function () {
                    window.scrollTo({ top: p.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
                });
            });
            t.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
                n.focus(); n.click();
            });
        });
        panels.forEach(function (p) {
            $('.amt__acc', p).addEventListener('click', function () {
                var open = !p.classList.contains('is-open');
                setOpen(p, open);
                if (!open) return;
                select(p.dataset.k);
                // a long group above may have just closed: keep the opened header on screen
                var top = p.getBoundingClientRect().top;
                if (top < 0) window.scrollTo({ top: top + window.scrollY - 16, behavior: 'smooth' });
            });
        });

        // phones: the photo strip swipes; the dots follow it and jump to a photo
        var strip = $('#ampStrip'), dots = $('#ampDots');
        if (strip && dots) {
            var tiles = $$('.amp__t', strip), pos = [], cur = -1, queued = false;
            // tile positions are measured once (and on resize), not on every scroll event
            function measure() {
                var pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
                pos = tiles.map(function (t) { return t.offsetLeft - strip.offsetLeft - pad; });
            }
            tiles.forEach(function (t, i) {
                var d = document.createElement('button');
                d.type = 'button';
                d.tabIndex = -1;
                d.addEventListener('click', function () { strip.scrollTo({ left: pos[i], behavior: 'smooth' }); });
                dots.appendChild(d);
            });
            var dotEls = $$('button', dots);
            function mark() {
                queued = false;
                var x = strip.scrollLeft, best = 0, bd = Infinity;
                pos.forEach(function (p, i) { var dd = Math.abs(p - x); if (dd < bd) { bd = dd; best = i; } });
                if (x + strip.clientWidth >= strip.scrollWidth - 4) best = tiles.length - 1;
                if (best === cur) return;
                cur = best;
                dotEls.forEach(function (d, i) { d.classList.toggle('on', i === best); });
            }
            strip.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(mark); } }, { passive: true });
            window.addEventListener('resize', function () { measure(); mark(); }, { passive: true });
            measure();
            mark();
        }

        // "View all 66 amenities & services" sheet
        var all = $('#amAll');
        if (!all) return;
        $$('[data-amall]').forEach(function (b) {
            b.addEventListener('click', function () { if (all.showModal) all.showModal(); track('gf_amenities_all'); });
        });
        $('.amall__x', all).addEventListener('click', function () { all.close(); });
        all.addEventListener('click', function (e) { if (e.target === all) all.close(); });
    })();

    /* ---------------- Amenities photos: a small expand button opens each one full size (prev/next browse all) ---------------- */
    (function () {
        var tiles = $$('.amp__t'), lb = $('#lightbox');
        if (!tiles.length || !lb) return;
        var lbImg = lb.querySelector('img'), lbCap = lb.querySelector('p'), idx = 0, mine = false;
        function show(i) {
            idx = (i + tiles.length) % tiles.length;
            var img = tiles[idx].querySelector('img');
            lbImg.src = img.getAttribute('src').replace('-800.webp', '-1400.webp');
            lbImg.alt = img.alt;
            lbCap.textContent = tiles[idx].querySelector('figcaption').textContent;
        }
        if (!lb.querySelector('.lightbox__nav')) {
            lb.insertAdjacentHTML('beforeend', '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>');
        }
        var prev = lb.querySelector('.lightbox__nav--prev'), next = lb.querySelector('.lightbox__nav--next');
        prev.addEventListener('click', function () { if (mine) show(idx - 1); });
        next.addEventListener('click', function () { if (mine) show(idx + 1); });
        lb.addEventListener('keydown', function (e) {
            if (!mine) return;
            if (e.key === 'ArrowRight') show(idx + 1);
            if (e.key === 'ArrowLeft') show(idx - 1);
        });
        lb.addEventListener('close', function () { mine = false; prev.hidden = next.hidden = false; });
        tiles.forEach(function (t, k) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'amp__expand';
            btn.setAttribute('aria-label', 'View ' + t.querySelector('figcaption').textContent + ' full size');
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>';
            btn.addEventListener('click', function () { mine = true; show(k); if (lb.showModal) lb.showModal(); });
            t.appendChild(btn);
        });
    })();

    /* ---------------- Location: Google Maps embed, pinned on the project ----------------
       One embed, three interactive views: the project pin (pulsing halo), a drive route to a destination in the
       list, or Google's own results for a "Nearby" category around the site, each in map or satellite view.
       The halo can't follow the map once it's dragged, so it fades on interaction. */
    // the embed can be swapped in the HTML: fall back to any iframe in the map box, and never let a missing map stop the rest of the page
    var mapBox = $('#locMapBox') || document.createElement('div'), mapFrame = $('#mapFrame') || mapBox.querySelector('iframe') || document.createElement('iframe'), drives = $$('.drive'), chips = $$('.map__chip');
    var SITE = CFG.siteLatLng.join(',');
    var view = { mode: 'site', dest: null, near: null, type: 'm' };
    function mapSrc() {
        var t = '&t=' + view.type + '&output=embed';
        if (view.mode === 'route') return 'https://www.google.com/maps?saddr=' + SITE + '&daddr=' + encodeURIComponent(view.dest.dataset.dest) + t;
        if (view.mode === 'near') return 'https://www.google.com/maps?q=' + encodeURIComponent(view.near.dataset.near + ' near ') + SITE + '&z=13' + t;
        // coordinates only: Google draws a plain marker there, which the NeoLiv infinity pin covers
        return 'https://www.google.com/maps?q=' + SITE + '&z=' + (view.type === 'k' ? 16 : 14) + t;
    }
    var mapReady = false;   // first render keeps the embed from the HTML; later views (route, nearby, satellite) swap it
    function renderMap() {
        mapBox.classList.remove('is-used');
        mapBox.classList.toggle('is-site', view.mode === 'site');
        if (mapReady) { mapBox.classList.add('is-loading'); mapFrame.src = mapSrc(); }
        mapReady = true;
        drives.forEach(function (x) { x.setAttribute('aria-pressed', String(view.mode === 'route' && x === view.dest)); });
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(view.mode === 'near' && x === view.near)); });
        $$('[data-maptype]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.maptype === view.type)); });
        $('#mapReset').hidden = view.mode === 'site';
        var dir = CFG.siteMapsUrl || 'https://www.google.com/maps/dir/?api=1&destination=' + SITE;   // the project's own Google Maps link
        if (view.mode === 'route') {
            dir = 'https://www.google.com/maps/dir/?api=1&origin=' + SITE + '&destination=' + encodeURIComponent(view.dest.dataset.dest);
        }
        $('#mapDir').href = $('#dirLink').href = dir;
    }
    mapFrame.addEventListener('load', function () { mapBox.classList.remove('is-loading'); });
    // the visitor started using the map (the iframe took focus): the halo no longer marks the pin
    window.addEventListener('blur', function () { if (document.activeElement === mapFrame) mapBox.classList.add('is-used'); });
    drives.forEach(function (b) {
        b.addEventListener('click', function () {
            var off = view.mode === 'route' && view.dest === b;
            view.mode = off ? 'site' : 'route'; view.dest = off ? null : b;
            renderMap();
            track('gf_map_route', { dest: b.dataset.dest });
        });
    });
    chips.forEach(function (c) {
        c.addEventListener('click', function () {
            var off = view.mode === 'near' && view.near === c;
            view.mode = off ? 'site' : 'near'; view.near = off ? null : c;
            renderMap();
            track('gf_map_nearby', { category: c.dataset.near });
        });
    });
    $$('[data-maptype]').forEach(function (b) {
        b.addEventListener('click', function () { if (view.type === b.dataset.maptype) return; view.type = b.dataset.maptype; renderMap(); });
    });
    $('#mapReset').addEventListener('click', function () { view.mode = 'site'; view.dest = view.near = null; renderMap(); });
    renderMap();

    /* ---------------- Gallery + lightbox ---------------- */
    $$('.gal-tabs button').forEach(function (b) {
        b.addEventListener('click', function () {
            $$('.gal-tabs button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
            $$('#gal button').forEach(function (g) { g.hidden = b.dataset.gal !== 'all' && g.dataset.kind !== b.dataset.gal; });
            $('#gal').classList.toggle('is-filtered', b.dataset.gal !== 'all');
            $('#gal').classList.toggle('is-render', b.dataset.gal === 'render');
        });
    });
    var lb = $('#lightbox');
    $$('#gal button').forEach(function (g) {
        g.addEventListener('click', function () {
            var img = g.querySelector('img');
            lb.querySelector('img').src = img.currentSrc || img.src;
            lb.querySelector('img').alt = img.alt;
            lb.querySelector('p').textContent = g.querySelector('span').textContent;
            if (lb.showModal) lb.showModal();
        });
    });
    lb.querySelector('.lightbox__close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });

    /* ---------------- Privacy dialog ---------------- */
    var privacy = $('#privacy');
    $$('[data-privacy]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); if (privacy.showModal) privacy.showModal(); });
    });

    /* =====================================================================
       Enquiry sheet: opens from every CTA. The form itself (name, email, phone) is
       submitted by Propstory's form_submit.js (.submit_button), which shows .success_msg.
       ===================================================================== */
    var sheet = $('#sheet'), form = $('#enqForm'), lastFocus = null;
    var MODES = {
        video: { eyebrow: 'Live video walkthrough', title: 'Schedule a Video Call' },
        enquire: { eyebrow: 'NeoLiv Grand Forest', title: 'Enquire Now' },
        price: { eyebrow: 'Plot bands & pricing', title: 'Get Plot Pricing' }
    };
    function openSheet(kind, src, opts) {
        var mode = MODES[kind] ? kind : 'enquire', m = MODES[mode], ctx = [];
        opts = opts || {};
        lastFocus = document.activeElement;
        $('#sheetEyebrow').textContent = m.eyebrow;
        $('#sheetTitle').textContent = m.title;
        if (opts.band && opts.band !== 'all') ctx.push(Number(opts.band).toLocaleString('en-IN') + ' sq. ft. plots');
        $('#sheetCtx').innerHTML = ctx.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        track('gf_form_open', { mode: mode, cta: src || '', section: opts.section || currentSection });
        setTimeout(function () {
            var first = $('.sidenav_form input:not([type=hidden])', sheet);
            if (first && first.offsetParent && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
        }, 350);
    }
    function closeSheet() {
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    $$('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () {
            var sec = b.closest('[data-section]');
            var opts = { section: sec ? sec.dataset.section : currentSection };
            if (b.dataset.priceBand) opts.band = b.dataset.priceBand;
            openSheet(b.dataset.open, b.dataset.cta, opts);
        });
    });
    sheet.querySelector('.sheet__close').addEventListener('click', closeSheet);
    // Back from the Thank You page: the browser restores this page from its cache (no reload), so close the
    // enquiry sheet and put the form back to a clean state instead of showing the old success message.
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        if (sheet.classList.contains('open')) closeSheet();
        var form = sheet.querySelector('.enq_form');
        if (form && form.reset) form.reset();
        $$('.success_msg, .error_msg, .form_error', sheet).forEach(function (el) { el.style.display = 'none'; });
        $$('.sidenav_form', sheet).forEach(function (el) { el.style.display = ''; });
    });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
        if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) setMenu(false);
    });
    // Keep keyboard focus inside the open sheet
    sheet.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = $$('button:not([hidden]):not([disabled]), input:not([type=hidden]):not([disabled]), select', sheet).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    // Enter in a field moves to the next one, then submits (the button is type="button", so no native submit)
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !e.target.matches('.inp')) return;
        e.preventDefault();
        var inputs = $$('.sidenav_form .inp', form).filter(function (x) { return x.offsetParent !== null; }), i = inputs.indexOf(e.target);
        if (i > -1 && i < inputs.length - 1) inputs[i + 1].focus(); else $('.submit_button', form).click();
    });
})();

/* Amenities carousel: arrow buttons scroll one card; buttons disable at either end */
(function () {
    var car = document.getElementById('amCar');
    if (!car) return;
    var prev = document.querySelector('[data-car="-1"]'), next = document.querySelector('[data-car="1"]');
    function step() { var c = car.querySelector('.acard'); return c ? c.getBoundingClientRect().width + 16 : 300; }
    function update() {
        prev.disabled = car.scrollLeft <= 4;
        next.disabled = car.scrollLeft + car.clientWidth >= car.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) {
        b.addEventListener('click', function () { car.scrollBy({ left: step() * +b.dataset.car, behavior: 'smooth' }); });
    });
    car.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
})();

/* FAQs: opening one question closes the others */
(function () {
    var items = document.querySelectorAll('#faqList details');
    items.forEach(function (d) {
        d.addEventListener('toggle', function () {
            if (!d.open) return;
            items.forEach(function (o) { if (o !== d) o.open = false; });
        });
    });
})();

/* Stat counters (Why section): count up from 0 once the row is on screen, staggered */
(function () {
    var counters = document.querySelectorAll('.kstats [data-count]');
    if (!counters.length || window.gfReduce || !('IntersectionObserver' in window)) return;
    function count(el, delay) {
        var end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = null;
        function step(t) {
            if (!t0) t0 = t;
            var k = Math.min((t - t0) / 2200, 1);
            var v = Math.round(end * (1 - Math.pow(1 - k, 4)));
            el.textContent = (el.dataset.sep ? v.toLocaleString('en-IN') : v) + suf;
            if (k < 1) requestAnimationFrame(step);
        }
        setTimeout(function () { requestAnimationFrame(step); }, delay);
    }
    // The real figures stay in the HTML (for Google, link previews and if the animation never runs);
    // they drop to 0 only as the row reaches the screen, then count up.
    var row = document.querySelector('.kstats');
    var pre = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        pre.disconnect();
        counters.forEach(function (el) { el.textContent = '0' + (el.dataset.suffix || ''); });
    }, { threshold: 0 });
    pre.observe(row);
    var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        counters.forEach(function (el, i) { count(el, 500 + i * 150); });
        io.disconnect();
    }, { threshold: .6 });
    io.observe(row);
})();

/* Why Khopoli corridor: the line draws across and the stops pop in, once */
(function () {
    var corr = document.querySelector('.corr');
    if (!corr) return;
    if (!('IntersectionObserver' in window) || window.gfReduce) { corr.classList.add('in'); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { corr.classList.add('in'); io.disconnect(); } }, { threshold: .4 });
    io.observe(corr);
})();

/* Why Khopoli figures: each row counts up once it is on screen (decimals and units kept; the year counts from data-from) */
(function () {
    if (window.gfReduce || !('IntersectionObserver' in window)) return;
    function fmt(el, v) { return v.toFixed((el.dataset.count.split('.')[1] || '').length) + (el.dataset.suffix || ''); }
    ['.kh2__stats'].forEach(function (sel) {
        var row = document.querySelector(sel);
        var els = row ? row.querySelectorAll('[data-count]') : [];
        if (!els.length) return;
        // real figures stay in the HTML until the row reaches the screen (see the Why stats above)
        var pre = new IntersectionObserver(function (es) {
            if (!es[0].isIntersecting) return;
            pre.disconnect();
            Array.prototype.forEach.call(els, function (el) { el.textContent = fmt(el, +(el.dataset.from || 0)); });
        }, { threshold: 0 });
        pre.observe(row);
        var io = new IntersectionObserver(function (es) {
            if (!es[0].isIntersecting) return;
            io.disconnect();
            Array.prototype.forEach.call(els, function (el, i) {
                var from = +(el.dataset.from || 0), to = +el.dataset.count, t0 = null;
                setTimeout(function () {
                    requestAnimationFrame(function step(t) {
                        if (!t0) t0 = t;
                        var k = Math.min((t - t0) / 1800, 1), e = 1 - Math.pow(1 - k, 4);
                        el.textContent = fmt(el, k < 1 ? from + (to - from) * e : to);
                        if (k < 1) requestAnimationFrame(step);
                    });
                }, 300 + i * 150);
            });
        }, { threshold: .3 });
        io.observe(row);
    });
})();

/* Site progress: the timeline lights up marker by marker, the line drawing down between them,
   while the meter fills and counts up over the same time */
(function () {
    var sec = document.getElementById('progress');
    if (!sec) return;
    var STEP = 600; // ms from one marker lighting to the next
    var still = window.gfReduce;
    var tl = sec.querySelector('.ptl');
    // only completed + in-progress milestones light up; upcoming ones stay faded
    var items = Array.prototype.filter.call(tl.querySelectorAll('li'), function (li) { return li.matches('.is-done, .is-now'); });
    if (!still) tl.classList.add('ptl--anim');
    var meter = sec.querySelector('[data-progress]');
    function run() {
        items.forEach(function (li, i) {
            setTimeout(function () {
                li.classList.add('is-lit');
                requestAnimationFrame(function () { li.classList.add('is-run'); });
            }, still ? 0 : i * STEP);
        });
        if (!meter) return;
        var target = Number(meter.dataset.progress) || 0;
        var total = still ? 0 : Math.max(1, items.length) * STEP;
        var bar = meter.querySelector('.meter__bar i'), num = meter.querySelector('[data-progress-n]');
        bar.style.transitionDuration = total + 'ms';
        bar.style.setProperty('--p', target + '%');
        if (still) { num.textContent = target; return; }
        var t0 = performance.now();
        (function tick(t) {
            var k = Math.min(1, (t - t0) / total);
            num.textContent = Math.round(target * k);
            if (k < 1) requestAnimationFrame(tick);
        })(t0);
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { run(); io.disconnect(); }
    }, { threshold: .3 });
    io.observe(tl);
})();

/* Motion: staggered reveals for grids and section intros, gentle hero parallax */
(function () {
    var reduce = window.gfReduce;
    var groups = ['.head', '.why-cards', '#gal', '.vgrid', '.faqs', '.ftr__top', '.plan__steps'];
    var fresh = [];
    groups.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (g) {
            Array.prototype.forEach.call(g.children, function (c, i) {
                c.style.setProperty('--si', Math.min(i, 8));
                if (!c.classList.contains('rv')) { c.classList.add('rv'); fresh.push(c); }
            });
        });
    });
    window.gfReplay(fresh, 'in', '0px 0px -6% 0px');
    if (reduce) return;
    var media = document.querySelector('.hero__media'), hero = document.getElementById('home'), ticking = false;
    // parallax on desktop only: on phones a per-frame transform during touch scroll causes jank
    if (!media || !hero || !window.matchMedia('(min-width: 901px) and (hover: hover)').matches) return;
    var heroH = hero.offsetHeight, lastY = -1;
    window.addEventListener('resize', function () { heroH = hero.offsetHeight; }, { passive: true });
    function para() {
        ticking = false;
        var y = Math.min(window.scrollY, heroH);
        if (y === lastY) return;   // past the hero: stop writing styles
        lastY = y;
        media.style.transform = 'translate3d(0,' + (y * .28).toFixed(1) + 'px,0)';
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(para); } }, { passive: true });
})();

/* Pause looping animations (map pin halo, progress pulse, live dot) while their section is off screen */
(function () {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.target.classList.toggle('is-off', !e.isIntersecting); });
    }, { rootMargin: '100px 0px' });
    document.querySelectorAll('.sec').forEach(function (s) { io.observe(s); });
})();

/* Image reveal (curtain wipe), applied to the page's feature images */
(function () {
    var sel = ['.why-card', '#gal button'];
    var els = [];
    sel.forEach(function (q) { document.querySelectorAll(q).forEach(function (el) { el.classList.add('ir'); els.push(el); }); });
    window.gfReplay(els, 'ir-in', '0px 0px -10% 0px');
})();

/* Shared links to a section (…/#pricing): the loader locks scrolling, so the browser's jump to the section can
   be lost. Once the loader lifts, go to the section and show everything on screen straight away instead of
   waiting for a scroll to trigger the reveals. */
(function () {
    function showOnScreen() {
        var h = window.innerHeight;
        document.querySelectorAll('.rv, .ir').forEach(function (el) {
            var r = el.getBoundingClientRect();
            if (r.bottom > 0 && r.top < h) el.classList.add(el.classList.contains('ir') ? 'ir-in' : 'in');
        });
    }
    function goToHash() {
        var id = location.hash.slice(1), target = id ? document.getElementById(id) : null;
        if (!target) return;
        window.scrollTo(0, Math.max(0, target.getBoundingClientRect().top + window.scrollY));
        requestAnimationFrame(showOnScreen);
        setTimeout(showOnScreen, 150);
    }
    if (window.__gfLoaded) goToHash(); else window.addEventListener('gf:loaded', goToHash, { once: true });
    window.addEventListener('hashchange', function () { requestAnimationFrame(showOnScreen); });
})();
