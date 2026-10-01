// Client behaviour for every page. Runs on each Astro page load (including after
// view-transition navigations) and cleans up before the next swap.
import { animate } from 'motion/mini';
import { inView, stagger } from 'motion';

type Cleanup = () => void;
let cleanups: Cleanup[] = [];
const onCleanup = (fn: Cleanup) => cleanups.push(fn);

const EASE: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

// Above-the-fold behaviour runs immediately; the rest waits for an idle moment so it
// never competes with first render.
const whenIdle = (fn: () => void) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 1);

document.addEventListener('astro:page-load', () => {
  initTheme();
  initHeader();
  initHero();
  initReel();
  initFacade();
  whenIdle(() => {
    initReveals();
    initTimeline();
    initPreviews();
    initDiagrams();
    initGallery();
    initCopy();
  });
});

document.addEventListener('astro:before-swap', () => {
  cleanups.forEach((fn) => fn());
  cleanups = [];
});

/* Theme ------------------------------------------------------------------- */
function initTheme() {
  const btn = $<HTMLButtonElement>('[data-theme-toggle]');
  if (!btn) return;
  const root = document.documentElement;
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const sync = () => {
    btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    if (root.dataset.theme) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      $$<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = bg));
    }
  };
  sync();
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* storage unavailable: theme lasts this visit */ }
    sync();
  });
}

/* Header border once the page scrolls ------------------------------------ */
function initHeader() {
  const header = $<HTMLElement>('[data-header]');
  if (!header) return;
  let ticking = false;
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  // Read scroll position on the next frame, not synchronously after the DOM swap.
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  onCleanup(() => window.removeEventListener('scroll', onScroll));
}

/* Hero intro: name letters rise, then the statement, underline and actions */
function initHero() {
  const hero = $<HTMLElement>('.hero');
  if (!hero || hero.classList.contains('is-in')) return;
  if (reducedMotion()) { hero.classList.add('is-in'); return; }
  const chars = $$<HTMLElement>('.ch', hero);
  const parts = $$<HTMLElement>('[data-hero-part]', hero);
  const rule = $<HTMLElement>('.rule', hero);
  const runs = [
    animate(chars, { opacity: [0, 1], transform: ['translateY(0.35em)', 'translateY(0)'] }, { duration: 0.6, delay: stagger(0.028), ease: EASE }),
    animate(parts, { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0)'] }, { duration: 0.7, delay: stagger(0.08, { startDelay: 0.25 }), ease: EASE }),
  ];
  if (rule) runs.push(animate(rule, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 0.8, delay: 0.8, ease: EASE }));
  Promise.all(runs).then(() => hero.classList.add('is-in'));
}

/* Hero reel: a deck of the real projects. On desktop the front card plays its preview
   loop and the deck advances as each one ends. On touch screens and Save-Data connections
   it shuffles the posters on a timer instead, so phones never stream videos they didn't ask for. */
function initReel() {
  const reel = $<HTMLElement>('[data-reel]');
  if (!reel) return;
  const slides = $$<HTMLAnchorElement>('[data-slide]', reel);
  const segs = $$<HTMLButtonElement>('[data-seg]', reel);
  const data: { slug: string; title: string; tagline: string }[] = JSON.parse($('[data-reel-data]', reel)!.textContent!);
  const title = $<HTMLElement>('[data-reel-title]', reel)!;
  const tag = $<HTMLElement>('[data-reel-tag]', reel)!;
  const link = $<HTMLAnchorElement>('[data-reel-link]', reel)!;
  const toggle = $<HTMLButtonElement>('[data-reel-toggle]', reel)!;
  const live = $<HTMLElement>('[data-reel-live]', reel)!;
  const reduce = reducedMotion();
  const withVideo = canHover() && !saveData();
  const STILL_MS = 5200;
  const n = slides.length;
  const videoOf = (i: number) => $<HTMLVideoElement>('video', slides[i])!;

  let active = 0;
  let paused = reduce;
  let visible = false;
  let started = false;
  let raf = 0;
  let stillStart = 0;
  let stillElapsed = 0;
  const timers: number[] = [];

  const setDepths = (skip?: HTMLElement) => {
    slides.forEach((slide, i) => {
      const depth = (i - active + n) % n;
      if (slide !== skip) slide.dataset.depth = String(Math.min(depth, 3));
      if (depth === 0) { slide.removeAttribute('aria-hidden'); slide.removeAttribute('tabindex'); }
      else { slide.setAttribute('aria-hidden', 'true'); slide.tabIndex = -1; }
    });
  };

  const progress = () => {
    cancelAnimationFrame(raf);
    const v = videoOf(active);
    const seg = segs[active];
    const frame = (now: number) => {
      let p: number;
      if (withVideo) p = v.duration ? v.currentTime / v.duration : 0;
      else {
        p = Math.min((now - stillStart) / STILL_MS, 1);
        if (p >= 1) { go((active + 1) % n); return; }
      }
      seg.style.setProperty('--p', String(p));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const playFront = () => {
    if (paused || !visible || !started || document.hidden) return;
    if (withVideo) {
      const v = videoOf(active);
      if (!v.src) v.src = v.dataset.src!;
      v.play().catch(() => {});
    } else {
      stillStart = performance.now() - stillElapsed;
    }
    progress();
  };

  const pauseFront = () => {
    if (withVideo) videoOf(active).pause();
    else if (stillStart) stillElapsed = performance.now() - stillStart;
    cancelAnimationFrame(raf);
  };

  const go = (next: number, userInitiated = false) => {
    if (next === active) return;
    // Announce only changes the visitor asked for, not every automatic advance.
    live.setAttribute('aria-live', userInitiated ? 'polite' : 'off');
    const leaving = slides[active];
    const lv = videoOf(active);
    lv.pause();
    lv.classList.remove('is-playing');
    if (lv.src) lv.currentTime = 0;
    segs[active].removeAttribute('aria-current');
    segs[active].style.setProperty('--p', '0');
    active = next;
    stillElapsed = 0;
    if (reduce) setDepths();
    else {
      leaving.dataset.depth = 'out';
      setDepths(leaving);
      timers.push(window.setTimeout(() => setDepths(), 380));
    }
    segs[active].setAttribute('aria-current', 'true');
    title.textContent = data[active].title;
    tag.textContent = data[active].tagline;
    link.href = `/projects/${data[active].slug}/`;
    playFront();
  };

  slides.forEach((_, i) => {
    const v = videoOf(i);
    v.addEventListener('playing', () => {
      v.classList.add('is-playing');
      // Once this clip is actually playing, quietly fetch the next one for a seamless hand-off.
      timers.push(window.setTimeout(() => {
        const next = videoOf((i + 1) % n);
        if (!next.src) { next.preload = 'auto'; next.src = next.dataset.src!; }
      }, 2000));
    });
    v.addEventListener('ended', () => { if (i === active) go((active + 1) % n); });
  });
  segs.forEach((seg, i) => seg.addEventListener('click', () => go(i, true)));
  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play previews' : 'Pause previews');
    if (paused) pauseFront(); else playFront();
  });
  const onVisibility = () => (document.hidden ? pauseFront() : playFront());
  document.addEventListener('visibilitychange', onVisibility);

  const stopView = inView(reel, () => {
    visible = true;
    playFront();
    return () => { visible = false; pauseFront(); };
  }, { amount: 0.35 });

  // Fan the deck out and start only once the page is loaded and idle,
  // so the reel never competes with first paint or early input.
  const start = () => {
    reel.classList.add('is-ready');
    timers.push(window.setTimeout(() => { started = true; playFront(); }, reduce ? 0 : 900));
  };
  const afterLoad = () => whenIdle(() => timers.push(window.setTimeout(start, 300)));
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });

  onCleanup(() => {
    stopView();
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    document.removeEventListener('visibilitychange', onVisibility);
    slides.forEach((_, i) => videoOf(i).pause());
  });
}

/* Scroll reveals: fade and rise once, staggered per batch ----------------- */
function initReveals() {
  const els = $$<HTMLElement>('[data-reveal]:not(.is-revealed)');
  if (!els.length) return;
  if (reducedMotion()) { els.forEach((el) => el.classList.add('is-revealed')); return; }
  let batch: HTMLElement[] = [];
  let scheduled = 0;
  const flush = () => {
    const items = batch;
    batch = [];
    scheduled = 0;
    animate(items, { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0)'] }, { duration: 0.7, delay: stagger(0.07), ease: EASE })
      .then(() => items.forEach((el) => el.classList.add('is-revealed')));
  };
  const stop = inView(els, (el) => {
    batch.push(el as HTMLElement);
    if (!scheduled) scheduled = requestAnimationFrame(flush);
  }, { amount: 0.15 });
  onCleanup(() => { stop(); cancelAnimationFrame(scheduled); });
}

/* Experience timeline: the rail draws, then each stop pops in ------------- */
function initTimeline() {
  const tl = $<HTMLElement>('[data-timeline]');
  if (!tl) return;
  if (reducedMotion()) { tl.classList.add('is-drawn'); return; }
  const stop = inView(tl, () => {
    const vertical = matchMedia('(max-width: 760px)').matches;
    const axis = vertical ? 'scaleY' : 'scaleX';
    const fill = $<HTMLElement>('.rail-fill', tl)!;
    const stops = $$<HTMLElement>('.stop', tl);
    const nodes = $$<HTMLElement>('.node', tl);
    Promise.all([
      animate(fill, { transform: [`${axis}(0)`, `${axis}(1)`] }, { duration: 1.2, ease: EASE }),
      animate(nodes, { transform: ['scale(0)', 'scale(1)'] }, { duration: 0.5, delay: stagger(0.32, { startDelay: 0.1 }), ease: [0.3, 1.5, 0.5, 1] }),
      animate(stops, { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0)'] }, { duration: 0.6, delay: stagger(0.32, { startDelay: 0.15 }), ease: EASE }),
    ]).then(() => tl.classList.add('is-drawn'));
  }, { amount: 0.35 });
  onCleanup(stop);
}

/* Card previews: hover (desktop) or in view (touch), muted and looped ----- */
function initPreviews() {
  if (reducedMotion() || saveData()) return;
  const hover = canHover();
  $$<HTMLVideoElement>('[data-preview]').forEach((video) => {
    const card = video.closest('a')!;
    const play = () => {
      if (!video.src) video.src = video.dataset.src!;
      video.play().catch(() => {});
    };
    const stop = () => { video.pause(); video.classList.remove('is-playing'); };
    video.addEventListener('playing', () => video.classList.add('is-playing'));
    if (hover) {
      card.addEventListener('pointerenter', play);
      card.addEventListener('pointerleave', stop);
      card.addEventListener('focus', play);
      card.addEventListener('blur', stop);
    } else {
      onCleanup(inView(card, () => { play(); return stop; }, { amount: 0.6 }));
    }
    onCleanup(() => video.pause());
  });
}

/* Architecture diagrams: nodes fade in, edges draw, then a pulse travels --- */
function initDiagrams() {
  $$<HTMLElement>('[data-diagram]').forEach((fig) => {
    if (reducedMotion()) { fig.classList.add('is-drawn'); return; }
    const stop = inView(fig, () => { drawDiagram(fig); }, { amount: 0.3 });
    onCleanup(stop);
  });
}

function drawDiagram(fig: HTMLElement) {
  const svg = $$<SVGSVGElement>('svg.view', fig).find((s) => s.getBoundingClientRect().width > 0);
  if (!svg) { fig.classList.add('is-drawn'); return; }
  const nodes = $$<SVGGElement>('.node-inner', svg);
  const lines = $$<SVGPathElement>('.edge .line', svg);
  const arrows = $$<SVGPathElement>('.edge .arrow', svg);
  const edgeStart = nodes.length * 0.05 + 0.15;
  Promise.all([
    animate(nodes, { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] }, { duration: 0.45, delay: stagger(0.05), ease: EASE }),
    animate(lines, { strokeDashoffset: [1, 0] }, { duration: 0.6, delay: stagger(0.07, { startDelay: edgeStart }), ease: [0.45, 0, 0.25, 1] }),
    animate(arrows, { opacity: [0, 1] }, { duration: 0.25, delay: stagger(0.07, { startDelay: edgeStart + 0.5 }) }),
  ]).then(() => {
    fig.classList.add('is-drawn');
    startPulse(fig, svg);
  });
}

function startPulse(fig: HTMLElement, svg: SVGSVGElement) {
  const pulse = $<SVGGElement>('.pulse', svg);
  const pairs = (fig.dataset.main ?? '').split(',').filter(Boolean);
  const paths = pairs.map((p) => $<SVGPathElement>(`[data-edge="${p}"] .line`, svg)).filter(Boolean) as SVGPathElement[];
  if (!pulse || !paths.length) return;
  const frames: Keyframe[] = [];
  let total = 0;
  const lengths = paths.map((p) => p.getTotalLength());
  const sum = lengths.reduce((a, b) => a + b, 0);
  paths.forEach((path, idx) => {
    const len = lengths[idx];
    const steps = Math.max(2, Math.round(len / 12));
    for (let s = 0; s <= steps; s++) {
      const pt = path.getPointAtLength((len * s) / steps);
      frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)`, offset: (total + (len * s) / steps) / sum });
    }
    total += len;
  });
  // De-duplicate offsets at segment joins, which WAAPI rejects if they go backwards.
  for (let i = 1; i < frames.length; i++) {
    if ((frames[i].offset as number) < (frames[i - 1].offset as number)) frames[i].offset = frames[i - 1].offset;
  }
  const duration = Math.max(2400, sum * 3.2);
  const move = pulse.animate(frames, { duration, iterations: Infinity, easing: 'linear' });
  const fade = pulse.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
    { duration, iterations: Infinity },
  );
  const stop = inView(fig, () => {
    move.play(); fade.play();
    return () => { move.pause(); fade.pause(); };
  });
  onCleanup(() => { stop(); move.cancel(); fade.cancel(); });
}

/* Screenshot lightbox ------------------------------------------------------ */
function initGallery() {
  $$<HTMLElement>('[data-gallery]').forEach((gallery) => {
    const dialog = $<HTMLDialogElement>('[data-lightbox]', gallery)!;
    const shots: { src: string; alt: string }[] = JSON.parse($('[data-lb-data]', gallery)!.textContent!);
    const img = $<HTMLImageElement>('[data-lb-img]', dialog)!;
    const cap = $<HTMLElement>('[data-lb-cap]', dialog)!;
    const count = $<HTMLElement>('[data-lb-count]', dialog)!;
    let index = 0;
    // The open screenshot is reflected in the URL (#screenshot-N) so it can be linked.
    const show = (i: number) => {
      index = (i + shots.length) % shots.length;
      img.src = shots[index].src;
      img.alt = shots[index].alt;
      cap.textContent = shots[index].alt;
      count.textContent = `${index + 1} / ${shots.length}`;
      history.replaceState(history.state, '', `#screenshot-${index + 1}`);
    };
    const open = (i: number) => { show(i); if (!dialog.open) dialog.showModal(); };
    $$<HTMLButtonElement>('[data-shot]', gallery).forEach((btn) =>
      btn.addEventListener('click', () => open(Number(btn.dataset.shot))),
    );
    dialog.addEventListener('close', () => {
      history.replaceState(history.state, '', location.pathname + location.search);
    });
    const linked = /^#screenshot-(\d+)$/.exec(location.hash);
    if (linked && Number(linked[1]) >= 1 && Number(linked[1]) <= shots.length) open(Number(linked[1]) - 1);
    $('[data-lb-prev]', dialog)!.addEventListener('click', () => show(index - 1));
    $('[data-lb-next]', dialog)!.addEventListener('click', () => show(index + 1));
    $('[data-lb-close]', dialog)!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    onCleanup(() => { if (dialog.open) dialog.close(); });
  });
}

/* YouTube facade: the privacy-enhanced iframe loads only on click --------- */
function initFacade() {
  $$<HTMLElement>('[data-yt]').forEach((box) => {
    const btn = $<HTMLButtonElement>('[data-yt-play]', box);
    // Warm up the connection once the visitor shows intent, before the click.
    const warm = () => {
      for (const href of ['https://www.youtube-nocookie.com', 'https://i.ytimg.com']) {
        if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = href;
        link.crossOrigin = '';
        document.head.append(link);
      }
    };
    btn?.addEventListener('pointerenter', warm, { once: true });
    btn?.addEventListener('focus', warm, { once: true });
    btn?.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0`;
      iframe.title = box.dataset.ytTitle ?? 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      box.append(iframe);
      btn.remove();
      iframe.focus();
    }, { once: true });
  });
}

/* Copy email ---------------------------------------------------------------- */
function initCopy() {
  $$<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    const label = $<HTMLElement>('.copy-label', btn)!;
    let timer = 0;
    btn.addEventListener('click', async () => {
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(btn.dataset.copy!);
        btn.classList.add('is-copied');
        label.textContent = 'Copied';
      } catch {
        label.textContent = 'Copy failed. Select the address instead.';
      }
      timer = window.setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = ''; }, 2000);
    });
    onCleanup(() => clearTimeout(timer));
  });
}
