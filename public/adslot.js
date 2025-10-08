/** Генерація випадкового id */
function randId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const a = crypto?.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : null;
  if (a) return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** Стабільний UID: localStorage → cookie → епізодичний */
function getUid() {
  const KEY = "ad_uid";
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = randId();
      localStorage.setItem(KEY, v);
      // продублюємо в cookie на рік (може згодитися за межами SPA)
      try {
        document.cookie = `ad_uid=${encodeURIComponent(v)}; Max-Age=31536000; Path=/; SameSite=Lax`;
      } catch {}
    }
    return v;
  } catch {
    // у sandbox iframe без allow-same-origin буде помилка доступу до storage/cookie
    // повертаємо епізодичний id на сесію
    return randId();
  }
}

/** Дуже легкий санітайзер adm, щоб не ламати CSP і зменшити ризик XSS */
function sanitizeAdm(html) {
  if (!html) return "";
  let s = String(html);
  // вирізаємо <script>…</script>
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  // прибираємо inline on*=
  s = s
    .replace(/\son[a-z]+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, "");
  // блокуємо javascript: у href/src
  s = s.replace(/\b(href|src)\s*=\s*(['"]?)(javascript:)/gi, "$1=$2about:blank");
  return s;
}

/** Дістаємо endpoint: через data-endpoint або за замовчуванням */
function getEndpoint(el) {
  const base = (el.dataset.endpoint || "").replace(/\/+$/, "");
  return (base ? base : "") + "/adserver/bid";
}

/** Опційно додати Tailwind у ShadowRoot (якщо треба стилі картки/плейсхолдера) */
function ensureShadowCss(root) {
  if (root.querySelector("link[data-tw-embed]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/public/assets/tw-embed.css?v=1"; // статик з backend
  link.setAttribute("data-tw-embed", "1");
  root.appendChild(link);
}

/** Рендер одного слоту */
export async function renderAd(el, opts = {}) {
  const size = el.dataset.size || opts.size || "300x250";
  const type = el.dataset.type || opts.type || "banner";
  const geo = el.dataset.geo || opts.geo || "";
  const uid = getUid();

  const [w, h] = /^\s*(\d+)x(\d+)\s*$/i.test(size)
    ? size
        .toLowerCase()
        .split("x")
        .map((n) => parseInt(n, 10))
    : [300, 250];

  // Shadow root
  const root = el.shadowRoot || el.attachShadow({ mode: "open" });
  root.innerHTML = "";
  ensureShadowCss(root);

  // Плейсхолдер, щоб не було “білого простирадла”
  const card = document.createElement("div");
  card.className = "bg-white rounded-2xl shadow-2xl border border-gray-300 overflow-hidden";
  Object.assign(card.style, { width: `${w}px`, height: `${h}px` });
  card.innerHTML =
    '<div class="w-full h-full flex items-center justify-center text-gray-500">Loading ad…</div>';
  root.appendChild(card);

  // Запит на бід: якщо бек очікує кукі/сесію — додай credentials:'include'
  const ep = getEndpoint(el);
  const qs = new URLSearchParams({
    size,
    type,
    uid,
    geo,
    adUnitCode: el.id || "", // якщо хочеш передати код плейсмента
  });

  let data;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${ep}?${qs}`, { credentials: "include", signal: ctrl.signal });
    clearTimeout(t);

    if (res.status === 204) {
      el.textContent = "";
      return;
    }
    data = await res.json(); // { adm, w, h, lineItemId, ... }
  } catch (e) {
    card.innerHTML =
      '<div class="w-full h-full flex items-center justify-center text-red-600">Ad failed to load</div>';
    console.warn("ad load error:", e);
    return;
  }

  const html = sanitizeAdm(data?.adm || "");
  if (!html) {
    card.innerHTML =
      '<div class="w-full h-full flex items-center justify-center text-gray-500">No ad</div>';
    return;
  }

  // Вставляємо креатив
  card.style.width = (data?.w || w) + "px";
  card.style.height = (data?.h || h) + "px";
  card.innerHTML = html;

  // Лог кліку (не блокує навігацію)
  root.addEventListener(
    "click",
    (ev) => {
      const t = ev.target;
      const a = t && typeof t.closest === "function" ? t.closest("a") : null;
      const li = data?.lineItemId || "";
      const url = `/adserver/click?li=${encodeURIComponent(li)}&uid=${encodeURIComponent(uid)}`;
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([], { type: "text/plain" }));
        } else {
          fetch(url, { method: "GET", keepalive: true }).catch(() => {});
        }
      } catch {}
      // бажано ще проставити безпечні атрибути посиланню
      if (a) {
        a.setAttribute("rel", "noopener noreferrer");
        if (!a.getAttribute("target")) a.setAttribute("target", "_blank");
      }
    },
    { capture: true },
  );
}

/** Lazy-render всіх слотів на сторінці */
export function renderAll(selector = ".ad-slot") {
  const els = Array.from(document.querySelectorAll(selector));
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => renderAd(el));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          obs.unobserve(e.target);
          renderAd(e.target);
        }
      });
    },
    { rootMargin: "300px 0px", threshold: 0.01 },
  );
  els.forEach((el) => io.observe(el));
}

// автозапуск
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => renderAll());
} else {
  renderAll();
}
