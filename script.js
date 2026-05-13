/* Animation plays on first scroll-in, replays only after `cooldownMs` away */
function makeCooldownObserver({ onReveal, onPreReveal, threshold = 0.2, cooldownMs = 30000 }) {
  const state = new WeakMap();
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        let s = state.get(el);
        if (!s) { s = { revealedOnce: false, leftAt: 0 }; state.set(el, s); }
        if (entry.isIntersecting) {
          const awayFor = s.leftAt ? (Date.now() - s.leftAt) : Infinity;
          if (s.revealedOnce && awayFor <= cooldownMs) return;
          s.revealedOnce = true;
          s.leftAt = 0;
          if (onPreReveal) onPreReveal(entry);
          onReveal(entry);
        } else {
          if (!s.leftAt) s.leftAt = Date.now();
        }
      });
    },
    { threshold }
  );
}

/* Map */
const regionData = {
  "CZ-PR": { parcels: 2847, area: 496,   investment: 145 },
  "CZ-ST": { parcels: 8932, area: 11015, investment: 312 },
  "CZ-JC": { parcels: 5421, area: 6320,  investment: 189 },
  "CZ-PL": { parcels: 4356, area: 5342,  investment: 160 },
  "CZ-KA": { parcels: 1823, area: 2302,  investment: 67  },
  "CZ-US": { parcels: 3102, area: 3658,  investment: 112 },
  "CZ-LI": { parcels: 1654, area: 1980,  investment: 58  },
  "CZ-KR": { parcels: 2967, area: 3521,  investment: 98  },
  "CZ-PA": { parcels: 2456, area: 2890,  investment: 85  },
  "CZ-VY": { parcels: 3234, area: 3987,  investment: 110 },
  "CZ-JM": { parcels: 4567, area: 4234,  investment: 156 },
  "CZ-OL": { parcels: 3198, area: 3754,  investment: 108 },
  "CZ-ZL": { parcels: 2134, area: 2567,  investment: 74  },
  "CZ-MO": { parcels: 3456, area: 3890,  investment: 120 },
};

const cz = (n) => n.toLocaleString("cs-CZ");

const mapHint     = document.getElementById("mapHint");
const mapPopup    = document.getElementById("mapPopup");
const popupName   = document.getElementById("popupName");
const popupParcels = document.getElementById("popupParcels");
const popupArea    = document.getElementById("popupArea");
const popupInvest  = document.getElementById("popupInvestment");
const mapWrap     = document.querySelector(".map-sec__map-wrap");
const mapCursor   = document.getElementById("mapCursor");

let cursorActive = false;
if (mapCursor && mapWrap) {
  let curMx = 0, curMy = 0;
  let tgtMx = 0, tgtMy = 0;

  mapWrap.addEventListener("mousemove", (e) => {
    const rect = mapWrap.getBoundingClientRect();
    tgtMx = e.clientX - rect.left;
    tgtMy = e.clientY - rect.top;
    if (!cursorActive) {
      curMx = tgtMx; curMy = tgtMy;
    }
  });

  function tickCursor() {
    if (cursorActive) {
      curMx += (tgtMx - curMx) * 0.42;
      curMy += (tgtMy - curMy) * 0.42;
      mapCursor.style.transform = `translate(${curMx}px, ${curMy}px) translate(-50%, -50%)`;
    }
    requestAnimationFrame(tickCursor);
  }
  tickCursor();
}

function positionPopup(e) {
  if (!mapPopup || !mapWrap) return;
  const wrapRect = mapWrap.getBoundingClientRect();
  const popupRect = mapPopup.getBoundingClientRect();
  const x = e.clientX - wrapRect.left;
  const y = e.clientY - wrapRect.top;

  let left = x - popupRect.width / 2;
  let top  = y - popupRect.height - 14;
  let flipBelow = false;

  if (top < 8) {
    top = y + 14;
    flipBelow = true;
  }

  const minLeft = 8;
  const maxLeft = wrapRect.width - popupRect.width - 8;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  const arrowX = Math.max(14, Math.min(popupRect.width - 14, x - left));

  mapPopup.style.left = `${left}px`;
  mapPopup.style.top  = `${top}px`;
  mapPopup.style.setProperty("--arrow-x", `${arrowX}px`);
  mapPopup.classList.toggle("is-below", flipBelow);
}

let popupPinned = false;

const mapMount = document.getElementById("czMapMount");
if (mapMount) {
  const src = mapMount.dataset.src || "assets/cz-regions.svg";
  fetch(src)
    .then((r) => r.text())
    .then((svgText) => {
      mapMount.outerHTML = svgText;
      initMapInteractions();
    })
    .catch((err) => console.error("Failed to load map asset:", err));
}

const popupTweens = new WeakMap();
function tweenPopupNum(el, target, dur = 600) {
  if (!el) return;
  const prev = popupTweens.get(el);
  if (prev) cancelAnimationFrame(prev);
  const t0 = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    const v = Math.round(target * e);
    el.textContent = v.toLocaleString("cs-CZ");
    if (t < 1) popupTweens.set(el, requestAnimationFrame(frame));
    else popupTweens.delete(el);
  }
  popupTweens.set(el, requestAnimationFrame(frame));
}

let currentPopupRegion = null;

function showRegionPopup(path, e) {
  const id = path.id;
  const data = regionData[id];
  if (!data) return;

  document.querySelectorAll(".map-region.is-active").forEach((p) => p.classList.remove("is-active"));
  path.classList.add("is-active");

  if (mapHint)  mapHint.classList.add("is-hidden");

  if (popupName) popupName.textContent = path.dataset.name || "";

  // Only animate on region change — re-trigger on same region (e.g. click after hover) keeps current values
  if (id !== currentPopupRegion) {
    tweenPopupNum(popupParcels, data.parcels, 650);
    tweenPopupNum(popupArea,    data.area,    700);
    currentPopupRegion = id;
  }

  if (mapPopup) {
    mapPopup.classList.add("is-visible");
    mapPopup.setAttribute("aria-hidden", "false");
    positionPopup(e);
  }
}

function hideRegionPopup() {
  document.querySelectorAll(".map-region.is-active, .map-region.is-pinned").forEach((p) => p.classList.remove("is-active", "is-pinned"));
  if (mapHint)  mapHint.classList.remove("is-hidden");
  if (mapPopup) {
    mapPopup.classList.remove("is-visible", "is-pinned");
    mapPopup.setAttribute("aria-hidden", "true");
  }
  popupPinned = false;
  currentPopupRegion = null;
}

let popupHideTimer = null;

function initMapInteractions() {
  document.querySelectorAll(".map-region").forEach((path) => {
  path.addEventListener("mouseenter", (e) => {
    if (popupHideTimer) { clearTimeout(popupHideTimer); popupHideTimer = null; }
    cursorActive = true;
    if (mapCursor) {
      const rect = mapWrap.getBoundingClientRect();
      mapCursor.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`;
      mapCursor.classList.add("is-active", "is-over-region");
    }
    if (popupPinned) return;
    showRegionPopup(path, e);
  });

  path.addEventListener("mouseleave", () => {
    cursorActive = false;
    if (mapCursor) {
      mapCursor.classList.remove("is-active", "is-over-region");
    }
    if (popupPinned) return;
    popupHideTimer = setTimeout(() => {
      document.querySelectorAll(".map-region.is-active").forEach((p) => p.classList.remove("is-active"));
      if (mapPopup) {
        mapPopup.classList.remove("is-visible");
        mapPopup.setAttribute("aria-hidden", "true");
      }
    }, 30);
  });

  path.addEventListener("mousemove", (e) => {
    if (popupPinned) return;
    positionPopup(e);
  });

  path.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".map-region.is-pinned").forEach((p) => p.classList.remove("is-pinned"));
    showRegionPopup(path, e);
    path.classList.add("is-pinned");
    popupPinned = true;
    if (mapPopup) mapPopup.classList.add("is-pinned");
  });
});

const svg = document.getElementById("czMap");
if (svg) {
  svg.addEventListener("mouseleave", () => {
    if (popupPinned) return;
    document.querySelectorAll(".map-region.is-active").forEach((p) => p.classList.remove("is-active"));
    if (mapHint)  mapHint.classList.remove("is-hidden");
    if (mapPopup) {
      mapPopup.classList.remove("is-visible");
      mapPopup.setAttribute("aria-hidden", "true");
    }
  });
}

if (svg) {
  const paths = svg.querySelectorAll(".map-region");
  const lengths = new Map();

  paths.forEach((path) => {
    const len = path.getTotalLength();
    lengths.set(path, len);
  });

  function resetPaths() {
    paths.forEach((path) => {
      const len = lengths.get(path);
      path.style.transition = "none";
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.style.fillOpacity = "0";
    });
  }

  function drawPaths() {
    void svg.getBoundingClientRect(); // force reflow so reset commits before transition
    paths.forEach((path, i) => {
      path.style.transition =
        `stroke-dashoffset 1.3s cubic-bezier(.2,.7,.2,1) ${i * 0.06}s, ` +
        `fill-opacity .6s var(--ease) ${1.0 + i * 0.04}s`;
      path.style.strokeDashoffset = "0";
      path.style.fillOpacity = "1";
    });
  }

  resetPaths();

  const drawObserver = makeCooldownObserver({
    threshold: 0.25,
    onPreReveal: resetPaths,
    onReveal: drawPaths,
  });
  drawObserver.observe(svg);
}

}

/* Finance section */
const finSec = document.querySelector(".fin-sec");
if (finSec) {
  const finSecObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        finSec.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    { threshold: 0.05 }
  );
  finSecObs.observe(finSec);

  const chartWrap = finSec.querySelector(".bento__chart");
  const bento = finSec.querySelector(".bento");
  if (chartWrap) {
    const chartObs = makeCooldownObserver({
      threshold: 0.2,
      onPreReveal: () => {
        if (bento) {
          bento.classList.remove("is-animating");
          void bento.offsetWidth;
        }
        if (typeof window.__resetFinChart === "function") window.__resetFinChart();
      },
      onReveal: () => {
        if (bento) bento.classList.add("is-animating");
        setTimeout(() => {
          if (typeof window.__revealFinChart === "function") window.__revealFinChart();
        }, 200);
      },
    });
    chartObs.observe(chartWrap);
  }
}

/* Bento line chart */
const term = document.getElementById("finChart");
if (term) {
  const finData = {
    capital:   { name: "Vlastní kapitál",   data: [250, 380, 478],          max: 500,  yAxis: [500, 375, 250, 125, 0], delta: "+91 %"  },
    ebitda:    { name: "EBITDA",            data: [83, 145, 152],           max: 175,  yAxis: [175, 131, 87, 43, 0],  delta: "+83 %"  },
    portfolio: { name: "Hodnota portfolia", data: [850, 1050, 1280],        max: 1300, yAxis: [1300, 975, 650, 325, 0], delta: "+51 %" },
    revenue:   { name: "Tržby skupiny",     data: [148.68, 257.22, 326.66], max: 350,  yAxis: [350, 262, 175, 87, 0], delta: "+120 %" },
    profit:    { name: "Čistý zisk",        data: [70, 130, 169.9],         max: 200,  yAxis: [200, 150, 100, 50, 0], delta: "FY24" },
    debt:      { name: "Zadlužení skupiny", data: [85, 92, 87.8],           max: 120,  yAxis: [120, 90, 60, 30, 0],  delta: "stabilní" },
  };
  const years = ["2022", "2023", "2024"];

  const chartTag   = document.getElementById("chartTag");
  const lcY        = document.getElementById("lcY");
  const readoutY   = document.getElementById("readoutY");
  const readoutV   = document.getElementById("readoutV");
  const lcLinePath = document.getElementById("lcLinePath");
  const lcAreaPath = document.getElementById("lcAreaPath");
  const lcPoints   = document.getElementById("lcPoints");
  const lcCross    = document.getElementById("lcCross");
  const lcChV      = document.getElementById("lcChV");
  const lcChH      = document.getElementById("lcChH");
  const tabs       = document.querySelectorAll(".bento__tile[data-metric]");

  const W = 400, H = 220, padTop = 8, padBot = 8;

  function pointsFor(set) {
    return set.data.map((v, i) => ({
      x: (i * W) / (set.data.length - 1),
      y: padTop + (1 - v / set.max) * (H - padTop - padBot),
      v: v,
      year: years[i],
    }));
  }

  function fmt(v) {
    return v.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
  }

  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let path = "M" + pts[0].x.toFixed(2) + "," + pts[0].y.toFixed(2);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1] || curr;
      const prevPrev = pts[i - 2] || prev;

      const cp1x = prev.x + (curr.x - prevPrev.x) / 6;
      const cp1y = prev.y + (curr.y - prevPrev.y) / 6;
      const cp2x = curr.x - (next.x - prev.x) / 6;
      const cp2y = curr.y - (next.y - prev.y) / 6;

      path += " C" + cp1x.toFixed(2) + "," + cp1y.toFixed(2)
            + " " + cp2x.toFixed(2) + "," + cp2y.toFixed(2)
            + " " + curr.x.toFixed(2) + "," + curr.y.toFixed(2);
    }
    return path;
  }

  const lcLineGlow = document.getElementById("lcLineGlow");

  // Dots created once — only cx/cy are tweened, never re-rendered
  const dotCount = 3;
  lcPoints.innerHTML = (() => {
    let html = "";
    for (let i = 0; i < dotCount; i++) {
      const isLast = i === dotCount - 1;
      html += '<circle class="lc__pt' + (isLast ? ' lc__pt--last' : '') + '" data-i="' + i + '" cx="0" cy="' + H + '" r="' + (isLast ? 6 : 5) + '"/>';
    }
    html += '<circle class="lc__pt-ring" id="lcRing1" cx="0" cy="' + H + '" r="9"/>';
    html += '<circle class="lc__pt-ring lc__pt-ring--2" id="lcRing2" cx="0" cy="' + H + '" r="9"/>';
    return html;
  })();
  const dotEls = lcPoints.querySelectorAll(".lc__pt");
  const ringEls = lcPoints.querySelectorAll(".lc__pt-ring");

  // Readout number snaps to the active metric — only y-positions tween
  let displayY = new Array(dotCount).fill(H);
  let activeKey = null;
  let rafId = null;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function paint() {
    const set = finData[activeKey];
    if (!set) return;

    const pts = displayY.map((y, i) => ({
      x: (i * W) / (dotCount - 1),
      y: y,
      v: set.data[i],
      year: years[i],
    }));

    const linePath = smoothPath(pts);
    const areaPath = linePath + " L" + pts[pts.length - 1].x.toFixed(2) + "," + H + " L" + pts[0].x.toFixed(2) + "," + H + " Z";

    lcLinePath.setAttribute("d", linePath);
    lcAreaPath.setAttribute("d", areaPath);
    if (lcLineGlow) lcLineGlow.setAttribute("d", linePath);

    dotEls.forEach((c, i) => {
      c.setAttribute("cx", pts[i].x.toFixed(2));
      c.setAttribute("cy", pts[i].y.toFixed(2));
    });
    const last = pts[pts.length - 1];
    ringEls.forEach((r) => {
      r.setAttribute("cx", last.x.toFixed(2));
      r.setAttribute("cy", last.y.toFixed(2));
    });

    term._pts = pts;
    term._last = last;
  }

  function tweenTo(targetSet, duration) {
    if (rafId) cancelAnimationFrame(rafId);
    const targetPts = pointsFor(targetSet);
    const startY = displayY.slice();
    const targetY = targetPts.map((p) => p.y);
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(t);
      for (let i = 0; i < dotCount; i++) {
        displayY[i] = startY[i] + (targetY[i] - startY[i]) * e;
      }
      paint();
      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null;
        displayY = targetY.slice();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function renderChart(key, duration) {
    const set = finData[key];
    if (!set) return;
    const isFirstRender = activeKey === null;
    activeKey = key;

    if (chartTag) chartTag.textContent = set.name.toUpperCase();
    if (readoutY) readoutY.textContent = years[years.length - 1];
    if (readoutV) readoutV.textContent = fmt(set.data[set.data.length - 1]);
    if (lcY) lcY.innerHTML = set.yAxis.map((v) => "<span>" + v + "</span>").join("");
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.metric === key));

    if (isFirstRender) {
      paint();
      return;
    }

    tweenTo(set, duration || 650);
  }

  window.__resetFinChart = function () {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    for (let i = 0; i < dotCount; i++) {
      displayY[i] = H;
    }
    paint();
  };

  window.__revealFinChart = function () {
    if (!activeKey) return;
    tweenTo(finData[activeKey], 1500);
    runDemoCycle();
  };

  // First-time-only walk through every metric to show the row→chart link
  let demoStarted = false;
  let userClicked = false;
  let demoTimers = [];
  const demoSequence = ["ebitda", "portfolio", "revenue", "capital"];
  const demoStartDelay = 2200;
  const demoStepInterval = 950;
  const demoTweenDuration = 520;

  function runDemoCycle() {
    if (demoStarted || userClicked) return;
    demoStarted = true;
    demoSequence.forEach((key, i) => {
      const at = demoStartDelay + i * demoStepInterval;
      demoTimers.push(setTimeout(() => {
        if (userClicked) return;
        renderChart(key, demoTweenDuration);
      }, at));
    });
  }

  function cancelDemo() {
    userClicked = true;
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      cancelDemo();
      if (!t.dataset.metric) return;
      renderChart(t.dataset.metric);
    });
  });

  const plot = document.getElementById("chartPlot");
  if (plot) {
    plot.addEventListener("mousemove", (e) => {
      const pts = term._pts;
      if (!pts) return;
      const svg = plot.querySelector("svg");
      const rect = svg.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width;
      const x = xRatio * W;

      let nearest = pts[0], best = Infinity;
      pts.forEach((p) => {
        const d = Math.abs(p.x - x);
        if (d < best) { best = d; nearest = p; }
      });

      lcChV.setAttribute("x1", nearest.x);
      lcChV.setAttribute("x2", nearest.x);
      if (lcChH) {
        lcChH.setAttribute("y1", nearest.y);
        lcChH.setAttribute("y2", nearest.y);
      }
      lcCross.classList.add("is-on");

      readoutY.textContent = nearest.year;
      readoutV.textContent = fmt(nearest.v);

      plot.querySelectorAll(".lc__pt").forEach((c, i) => {
        c.classList.toggle("is-active", pts[i] === nearest);
      });
    });

    plot.addEventListener("mouseleave", () => {
      lcCross.classList.remove("is-on");
      plot.querySelectorAll(".lc__pt.is-active").forEach((c) => c.classList.remove("is-active"));
      if (term._last) {
        readoutY.textContent = term._last.year;
        readoutV.textContent = fmt(term._last.v);
      }
    });
  }

  renderChart("capital");
}

const statBars = document.querySelectorAll(".stat-card__bar-fill");
if (statBars.length) {
  const barObserver = makeCooldownObserver({
    threshold: 0.4,
    onReveal: (entry) => {
      entry.target.style.animation = "none";
      void entry.target.offsetWidth;
      entry.target.style.animation = "barFill 1.4s var(--ease-out) .4s forwards";
    },
  });
  statBars.forEach((b) => barObserver.observe(b));
}

document.addEventListener("click", (e) => {
  if (!popupPinned) return;
  if (!e.target.closest(".map-region") && !e.target.closest(".map-popup")) {
    hideRegionPopup();
  }
});


/* Header dropdowns */
let openItem = null;

document.querySelectorAll(".site-nav [data-toggle]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = btn.closest(".nav-item");
    if (openItem && openItem !== item) openItem.classList.remove("open");
    item.classList.toggle("open");
    openItem = item.classList.contains("open") ? item : null;
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".site-nav .nav-item") && openItem) {
    openItem.classList.remove("open");
    openItem = null;
  }
});


/* Lenis smooth scroll */
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  smoothTouch: false,
});

(function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
})(0);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, {
      offset: -90,
      duration: 1.6,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });
  });
});


/* Scramble effect */
const scrambleChars = "0123456789";

function scramble(el, final, dur, delay) {
  const start = performance.now() + delay;
  function tick(now) {
    if (now < start) return requestAnimationFrame(tick);
    const t = Math.min(1, (now - start) / dur);
    let out = "";
    for (let i = 0; i < final.length; i++) {
      if (t * final.length > i || final[i] === ",") {
        out += final[i];
      } else {
        out += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
      }
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = final;
  }
  requestAnimationFrame(tick);
}

document.querySelectorAll("[data-scramble]").forEach((el) => {
  scramble(el, el.dataset.scramble, 1100, 600);
});


/* Counter (data-counter) */
function runCounter(el, dur = 1700, delay = 0) {
  const targetStr = el.dataset.counter.replace(",", ".");
  const target    = parseFloat(targetStr);
  const decimals  = (targetStr.split(".")[1] || "").length;
  const start     = performance.now() + delay;

  function tick(now) {
    if (now < start) return requestAnimationFrame(tick);
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    const v = (target * e).toFixed(decimals).replace(".", ",");
    el.textContent = v;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const counterObserver = makeCooldownObserver({
  threshold: 0.4,
  onPreReveal: (entry) => {
    const el = entry.target;
    const decimals = (el.dataset.counter.replace(",", ".").split(".")[1] || "").length;
    el.textContent = (0).toFixed(decimals).replace(".", ",");
  },
  onReveal: (entry) => runCounter(entry.target, 1500, 0),
});

document.querySelectorAll("[data-counter]").forEach((el) => {
  const decimals = (el.dataset.counter.replace(",", ".").split(".")[1] || "").length;
  el.textContent = (0).toFixed(decimals).replace(".", ",");
  counterObserver.observe(el);
});


/* Magnetic buttons */
document.querySelectorAll("[data-magnetic]").forEach((el) => {
  const strength = 0.2;
  el.addEventListener("mousemove", (e) => {
    const r  = el.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width  / 2;
    const dy = e.clientY - r.top  - r.height / 2;
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "translate(0, 0)";
  });
});


/* Tilt on hover (data-tilt) */
document.querySelectorAll("[data-tilt]").forEach((el) => {
  const max = 6;
  el.style.transformStyle = "preserve-3d";

  el.addEventListener("mousemove", (e) => {
    const r  = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top)  / r.height;
    const rx = (py - 0.5) * -max * 2;
    const ry = (px - 0.5) *  max * 2;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  });

  el.addEventListener("mouseleave", () => {
    el.style.transform = "";
  });
});


/* Tooltip (data-tip) */
const tooltip = document.getElementById("tooltip");

document.querySelectorAll("[data-tip]").forEach((el) => {
  el.addEventListener("mouseenter", () => {
    tooltip.textContent = el.dataset.tip;
    tooltip.classList.add("is-visible");
    positionTip(el);
  });
  el.addEventListener("mousemove", () => positionTip(el));
  el.addEventListener("mouseleave", () => {
    tooltip.classList.remove("is-visible");
  });
});

function positionTip(el) {
  const r  = el.getBoundingClientRect();
  const tr = tooltip.getBoundingClientRect();
  let x = r.left;
  let y = r.bottom + 12;

  const maxX = window.innerWidth - tr.width - 16;
  if (x > maxX) x = maxX;
  if (x < 16)   x = 16;

  if (y + tr.height > window.innerHeight - 16) {
    y = r.top - tr.height - 12;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top  = `${y}px`;
}


/* Parallax (data-parallax) */
const parallaxEls = document.querySelectorAll("[data-parallax]");

lenis.on("scroll", ({ scroll }) => {
  parallaxEls.forEach((el) => {
    const speed = parseFloat(el.dataset.parallax) || 0.3;
    el.style.transform = `translate3d(0, ${scroll * speed}px, 0)`;
  });
});


/* Side anchor CTA */
const sideCta = document.getElementById("sideCta");

if (sideCta) {
  setTimeout(() => sideCta.classList.add("is-visible"), 1800);

  // Hide only once the form itself is in view (avoids hiding mid-scroll)
  const contactForm = document.querySelector(".contact-form-wrap");
  if (contactForm) {
    const contactObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          sideCta.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { threshold: 0.55 }
    );
    contactObs.observe(contactForm);
  }
}


/* ============================================
   Cursor-following glow
   ============================================ */
const cursorGlow = document.querySelector("[data-cursor-glow]");
if (cursorGlow) {
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.setProperty("--mouseX", e.clientX + "px");
    cursorGlow.style.setProperty("--mouseY", e.clientY + "px");
    cursorGlow.style.top  = e.clientY + "px";
    cursorGlow.style.left = e.clientX + "px";
  });
}

/* Calculator — rising particles */
(function initCalcDots() {
  const sec = document.querySelector('.calc-sec');
  if (!sec) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const dots = document.createElement('div');
  dots.className = 'calc-dots';
  dots.setAttribute('aria-hidden', 'true');

  const count = 18;
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    const size = 2 + Math.round(Math.random() * 3);
    span.style.width  = size + 'px';
    span.style.height = size + 'px';
    span.style.left   = (Math.random() * 100).toFixed(2) + '%';
    span.style.animationDuration = (16 + Math.random() * 12).toFixed(1) + 's';
    span.style.animationDelay    = (-Math.random() * 22).toFixed(1) + 's';
    if (Math.random() < 0.18) span.classList.add('is-blue');
    dots.appendChild(span);
  }

  sec.appendChild(dots);
})();

/* Calculator — 7,1 % p.a., 5-year term, monthly payout */
(function () {
  const slider  = document.getElementById('calcSlider');
  const amount  = document.getElementById('calcAmount');
  const monthly = document.getElementById('calcMonthly');
  const yearly  = document.getElementById('calcYearly');
  const total   = document.getElementById('calcTotal');
  const card    = document.querySelector('.calc-card');
  if (!slider) return;

  const RATE = 0.071;
  const YEARS = 5;

  function fmt(n) { return Math.round(Math.max(0, n)).toLocaleString('cs-CZ'); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  const display = new WeakMap();

  function setDisplay(el, v) {
    let s = display.get(el);
    if (!s) { s = { val: 0, raf: null }; display.set(el, s); }
    s.val = v;
    el.textContent = fmt(v);
  }

  function tweenTo(el, target, dur = 280) {
    let s = display.get(el);
    if (!s) { s = { val: 0, raf: null }; display.set(el, s); }
    if (s.raf) cancelAnimationFrame(s.raf);
    const start = s.val;
    const delta = target - start;
    if (Math.abs(delta) < 0.5) { setDisplay(el, target); return; }
    const t0 = performance.now();
    function frame(now) {
      const t = clamp01((now - t0) / dur);
      const e = easeOutCubic(t);
      s.val = start + delta * e;
      el.textContent = fmt(s.val);
      if (t < 1) {
        s.raf = requestAnimationFrame(frame);
      } else {
        s.raf = null;
        s.val = target;
        el.textContent = fmt(target);
      }
    }
    s.raf = requestAnimationFrame(frame);
  }

  let trackRaf = null;
  let trackPct = 0;
  let thumbRaf = null;
  function setTrack(pct) {
    trackPct = pct;
    slider.style.background = `linear-gradient(90deg, var(--gold) ${pct}%, rgba(32, 147, 213, 0.22) ${pct}%)`;
  }
  function tweenTrack(target, dur = 280) {
    if (trackRaf) cancelAnimationFrame(trackRaf);
    const start = trackPct;
    const delta = target - start;
    const t0 = performance.now();
    function frame(now) {
      const t = clamp01((now - t0) / dur);
      const e = easeOutCubic(t);
      setTrack(start + delta * e);
      if (t < 1) trackRaf = requestAnimationFrame(frame);
      else { trackRaf = null; setTrack(target); }
    }
    trackRaf = requestAnimationFrame(frame);
  }

  function tweenThumb(fromV, targetV, dur) {
    if (thumbRaf) cancelAnimationFrame(thumbRaf);
    slider.value = fromV;
    const t0 = performance.now();
    function frame(now) {
      const t = clamp01((now - t0) / dur);
      const e = easeOutCubic(t);
      slider.value = Math.round(fromV + (targetV - fromV) * e);
      if (t < 1) thumbRaf = requestAnimationFrame(frame);
      else { thumbRaf = null; slider.value = targetV; }
    }
    thumbRaf = requestAnimationFrame(frame);
  }

  function compute() {
    const v = parseInt(slider.value, 10);
    const y = v * RATE;
    return { v, y, m: y / 12, t: y * YEARS };
  }

  function pctFromValue(v) {
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
    return ((v - min) / (max - min)) * 100;
  }

  // Slider drag → numbers + track snap instantly to the thumb so dragging never
  // visibly lags. Tweens only happen during the entrance reveal.
  function commitSmooth() {
    // If user grabs the slider mid-reveal, drop the reveal-driven thumb tween
    if (thumbRaf) { cancelAnimationFrame(thumbRaf); thumbRaf = null; }
    const { v, y, m, t } = compute();
    // Cancel any in-flight tweens and write the target value directly
    [amount, monthly, yearly, total].forEach((el) => {
      const s = display.get(el);
      if (s && s.raf) { cancelAnimationFrame(s.raf); s.raf = null; }
    });
    setDisplay(amount,  v);
    setDisplay(monthly, m);
    setDisplay(yearly,  y);
    setDisplay(total,   t);
    if (trackRaf) { cancelAnimationFrame(trackRaf); trackRaf = null; }
    setTrack(pctFromValue(v));
  }

  function commitInstant(vOverride) {
    const v = vOverride != null ? vOverride : parseInt(slider.value, 10);
    const y = v * RATE;
    setDisplay(amount,  v);
    setDisplay(monthly, y / 12);
    setDisplay(yearly,  y);
    setDisplay(total,   y * YEARS);
    setTrack(pctFromValue(v));
  }

  slider.addEventListener('input', commitSmooth);

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    const { v, y, m, t } = compute();
    const minV = parseInt(slider.min, 10);
    commitInstant(0);
    setTrack(0);
    tweenTo(amount,  v, 1100);
    tweenTo(monthly, m, 1200);
    tweenTo(yearly,  y, 1200);
    tweenTo(total,   t, 1300);
    tweenTrack(pctFromValue(v), 1100);
    tweenThumb(minV, v, 1100);
    if (card) card.classList.add('is-revealed');
  }

  commitInstant(0);
  setTrack(0);

  if (card && typeof makeCooldownObserver === 'function') {
    const calcObs = makeCooldownObserver({
      threshold: 0.25,
      onPreReveal: () => {
        revealed = false;
        commitInstant(0);
        setTrack(0);
      },
      onReveal: reveal,
    });
    calcObs.observe(card);
  } else {
    reveal();
  }
})();

/* Contact form — stub: replace placeholder POST with real backend */
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const phone = form.querySelector('input[name="phone"]');
  if (phone) {
    phone.addEventListener('input', () => {
      const cleaned = phone.value.replace(/[^\d\s+()\-]/g, '');
      if (cleaned !== phone.value) phone.value = cleaned;
    });
  }

  const yearField = form.querySelector('input[name="year"]');
  if (yearField) {
    const currentYear = String(new Date().getFullYear());
    function validateYear() {
      yearField.setCustomValidity(
        yearField.value === currentYear ? '' : `Zadejte aktuální rok (${currentYear}).`
      );
    }
    yearField.addEventListener('input', () => {
      const cleaned = yearField.value.replace(/[^\d]/g, '');
      if (cleaned !== yearField.value) yearField.value = cleaned;
      validateYear();
    });
    yearField.addEventListener('blur', validateYear);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submit = form.querySelector('.contact-submit');
    if (submit) {
      submit.disabled = true;
      const txt = submit.querySelector('.contact-submit__txt');
      if (txt) txt.textContent = 'Děkujeme — ozveme se do 24 h';
    }
    // TODO: POST FormData(form) to /api/contact
  });
})();

/* Custom keyboard-accessible dropdowns (Tab / Enter / Arrows / Esc) */
(function () {
  const dropdowns = document.querySelectorAll('[data-dropdown]');
  if (!dropdowns.length) return;

  let activeDropdown = null;

  function closeAll(except) {
    dropdowns.forEach((d) => {
      if (d === except) return;
      d.classList.remove('is-open');
      const btn = d.querySelector('.formdd__btn');
      const menu = d.querySelector('.formdd__menu');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (menu) menu.setAttribute('hidden', '');
    });
  }

  dropdowns.forEach((dd) => {
    const btn   = dd.querySelector('.formdd__btn');
    const value = dd.querySelector('.formdd__value');
    const menu  = dd.querySelector('.formdd__menu');
    const input = dd.querySelector('input[type="hidden"]');
    const options = Array.from(dd.querySelectorAll('.formdd__option'));
    let focusedIndex = -1;

    function open() {
      closeAll(dd);
      dd.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      menu.removeAttribute('hidden');
      activeDropdown = dd;
      focusedIndex = options.findIndex((o) => o.classList.contains('is-selected'));
      if (focusedIndex < 0) focusedIndex = 0;
      updateFocused();
    }

    function close() {
      dd.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      menu.setAttribute('hidden', '');
      if (activeDropdown === dd) activeDropdown = null;
    }

    function select(opt) {
      options.forEach((o) => o.classList.remove('is-selected'));
      opt.classList.add('is-selected');
      value.textContent = opt.textContent.trim();
      value.removeAttribute('data-placeholder');
      if (input) {
        input.value = opt.dataset.value || '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close();
      btn.focus();
    }

    function updateFocused() {
      options.forEach((o, i) => o.classList.toggle('is-focused', i === focusedIndex));
      const opt = options[focusedIndex];
      if (opt) opt.scrollIntoView({ block: 'nearest' });
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      dd.classList.contains('is-open') ? close() : open();
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    options.forEach((opt, i) => {
      opt.addEventListener('mouseenter', () => { focusedIndex = i; updateFocused(); });
      opt.addEventListener('click', () => select(opt));
    });

    menu.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusedIndex = (focusedIndex + 1) % options.length; updateFocused(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusedIndex = (focusedIndex - 1 + options.length) % options.length; updateFocused(); }
      else if (e.key === 'Enter')   { e.preventDefault(); if (options[focusedIndex]) select(options[focusedIndex]); }
      else if (e.key === 'Escape')  { close(); btn.focus(); }
    });

    menu.setAttribute('tabindex', '-1');
  });

  document.addEventListener('click', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeDropdown) {
      const btn = activeDropdown.querySelector('.formdd__btn');
      closeAll();
      if (btn) btn.focus();
    }
  });
})();
