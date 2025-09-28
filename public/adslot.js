function getUid() {
  try {
    const k = "ad_uid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export async function renderAd(el, opts = {}) {
  const size = el.dataset.size || opts.size || "300x250";
  const type = el.dataset.type || opts.type || "banner";
  const geo = el.dataset.geo || opts.geo || "";
  const uid = getUid();

  const res = await fetch(
    `/adserver/bid?size=${encodeURIComponent(size)}&type=${encodeURIComponent(type)}&uid=${encodeURIComponent(uid)}&geo=${encodeURIComponent(geo)}`,
  );
  if (res.status === 204) {
    el.textContent = "";
    return;
  }
  const data = await res.json(); // { lineItemId, adm, w, h, ... }

  // shadow
  const root = el.shadowRoot || el.attachShadow({ mode: "open" });
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.width = (data.w || 0) + "px";
  wrap.style.height = (data.h || 0) + "px";
  wrap.innerHTML = data.adm || "";
  root.appendChild(wrap);

  // лог кліку (не заважає навігації)
  root.addEventListener(
    "click",
    (ev) => {
      const a =
        ev.target && /** @type {HTMLElement} */ (ev.target).closest
          ? /** @type {HTMLElement} */ (ev.target).closest("a")
          : null;
      // фіксуємо клік навіть якщо посилання немає (markdown може бути без <a>)
      const url = `/adserver/click?li=${encodeURIComponent(data.lineItemId || "")}&uid=${encodeURIComponent(uid)}`;
      if (navigator.sendBeacon) {
        const blob = new Blob([], { type: "text/plain" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, { method: "GET", keepalive: true }).catch(() => {});
      }
    },
    { capture: true },
  );
}

export function renderAll(selector = ".ad-slot") {
  document.querySelectorAll(selector).forEach((el) => renderAd(el));
}

// автозапуск, якщо підключили як <script type="module" src="/adslot.js">
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => renderAll());
} else {
  renderAll();
}
