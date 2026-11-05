/* Page entry: the loader (the NeoLiv infinity mark draws itself with progress) runs straight away and lifts
   away to the page. The "Enter" welcome screen is removed from index.html; if it is put back, it shows first. */
(function () {
    'use strict';
    var root = document.documentElement, body = document.body;
    var intro = document.querySelector('[data-hg-intro]');
    var el = document.getElementById('loader');

    /* ---------------- Loader ---------------- */
    var MIN = 1800, MAX = 5000;   // the loader always shows for MIN ms, and never holds anyone past MAX
    var loaded = document.readyState === 'complete', started = false, finished = false;
    window.addEventListener('load', function () { loaded = true; });

    function finish() {
        if (finished) return;
        finished = true;
        if (el) el.classList.add('done');
        body.classList.remove('loading');
        window.__gfLoaded = true;
        window.dispatchEvent(new Event('gf:loaded'));
        if (el) setTimeout(function () { el.remove(); }, 1200);
    }
    function startLoader() {
        if (started) return;
        started = true;
        if (!el) { finish(); return; }
        var bar = el.querySelector('.loader__line span');
        var pct = el.querySelector('.loader__pct');
        var stage = el.querySelector('.loader__stage');
        var infDraw = el.querySelector('.inf-draw');
        var start = performance.now(), shown = 0;
        function pad(n) { return ('00' + n).slice(-3); }
        function tick(t) {
            var elapsed = t - start;
            var target = loaded && elapsed >= MIN ? 100 : Math.min(90, (elapsed / MIN) * 90);
            shown += (target - shown) * (target === 100 ? .18 : .08);
            if (target === 100 && shown > 99.5) shown = 100;
            if (bar) bar.style.transform = 'scaleX(' + (shown / 100) + ')';
            if (pct) pct.textContent = pad(Math.round(shown));
            if (infDraw) infDraw.style.strokeDashoffset = (1 - shown / 100).toFixed(4);
            if (stage) stage.textContent = shown < 30 ? 'Surveying the land' : shown < 90 ? 'Marking the plots' : 'Unveiling Grand Forest';
            if (shown === 100) return setTimeout(finish, 350);
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        setTimeout(function () { loaded = true; }, MAX);
        setTimeout(finish, MAX + 1500);   // hard stop even if animation frames are paused (background tab, low-power mode)
    }

    /* ---------------- Welcome screen ----------------
       Shows once per browser tab: a refresh skips it (and keeps the sound choice), a new tab shows it again.
       sessionStorage lives exactly as long as the tab. The <head> script hides it before first paint. */
    function remember(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
    function recall(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function enter(withSound) {
        remember('gf-intro-seen', '1');
        remember('gf-sound', withSound ? 'on' : 'off');
        root.classList.remove('hg-intro-open');
        if (intro) {
            intro.classList.add('is-leaving');
            setTimeout(function () { intro.hidden = true; }, 700);
        }
        startLoader();
    }
    if (!intro || recall('gf-intro-seen') === '1') {
        if (intro) intro.hidden = true;
        root.classList.remove('hg-intro-open');
        startLoader();
        return;
    }
    intro.querySelector('[data-hg-intro-enter]').addEventListener('click', function () { enter(true); });
    var muteBtn = intro.querySelector('[data-hg-intro-mute]');   // commented out while the sound is off
    if (muteBtn) muteBtn.addEventListener('click', function () { enter(false); });
    intro.querySelector('[data-hg-intro-enter]').focus({ preventScroll: true });
})();
