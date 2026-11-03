// ============================================================
// Основа: вспомогательные функции, иконки, состояние, звук.
// ============================================================
const APP_NAME = "Дроп";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const P = (d, extra = "") => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  play: `<svg class="i-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>`,
  pause: `<svg class="i-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.4"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4"/></svg>`,
  moments: P(`<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="1.8"/><path d="M21 15l-5-5L5 21"/>`),
  rooms: P(`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-4 3-5.5 6.5-5.5s5.9 1.5 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.8.6 2.7 2.2 3 5.2"/>`),
  plus: P(`<path d="M12 5v14M5 12h14"/>`),
  camera: P(`<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>`),
  tracks: P(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>`),
  chats: P(`<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>`),
  me: P(`<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>`),
  send: P(`<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>`),
  back: P(`<path d="M15 18l-6-6 6-6"/>`),
  close: P(`<path d="M6 6l12 12M18 6 6 18"/>`),
  note: P(`<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`),
  search: P(`<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>`),
  prev: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5.9v12.2a.8.8 0 0 1-1.25.66L10 13a1 1 0 0 1 0-1.66l8.75-5.76A.8.8 0 0 1 20 5.9z"/></svg>`,
  next: `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 18.1V5.9a.8.8 0 0 1 1.25-.66L14 11a1 1 0 0 1 0 1.66l-8.75 5.76A.8.8 0 0 1 4 18.1z"/></svg>`,
  bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`,
};

const AV_COLORS = ["#7c5cff", "#ff5ca8", "#19d3a2", "#ffb84d", "#2a6bff", "#ff6b4a", "#c6f432"];
function avatar(p, size = 44) {
  if (p && p.avatar_url) return `<img class="avatar" src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover">`;
  const name = (p && (p.display_name || p.username)) || "?";
  let h = 0;
  for (const ch of (p && p.username) || name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${AV_COLORS[h % AV_COLORS.length]};font-size:${Math.round(size * 0.4)}px">${esc(name.trim()[0] || "?").toUpperCase()}</span>`;
}
const cover = (t, cls = "") => `<span class="cover ${cls}" style="background:${coverBg(t)}"><i></i></span>`;

// ---------- Состояние ----------
const S = {
  view: "moments",
  nowId: null,
  playing: false,
  sheet: false,
  mstart: 0,
  auth: { user: null, profile: null, mode: "login", error: "", notice: "", busy: false },
  moments: null, // null = ещё не загружены
  momentsErr: "",
  chat: { peer: null, msgs: [], peers: [], found: [], q: "", err: "", loading: false },
  unread: {},
};
const me = () => (S.auth.user ? S.auth.user.id : null);

// ---------- Звук ----------
const au = new Audio();
au.preload = "metadata";
let until = null; // секунда, на которой остановиться (для «Момента»)
let playKey = null; // что именно сейчас играет: "id" или "id:начало"

function startPlayback(id, from, to, key) {
  const t = track(id);
  if (!t) return;
  until = to == null ? null : to;
  playKey = key;
  const go = () => { if (from != null) au.currentTime = from; au.play().catch(() => {}); };
  if (S.nowId !== id) {
    S.nowId = id;
    S.mstart = t.hot;
    au.src = t.src;
    au.addEventListener("loadedmetadata", go, { once: true });
    au.load();
  } else if (au.readyState > 0) go();
  else au.addEventListener("loadedmetadata", go, { once: true });
  sync(true);
  if (typeof DB !== "undefined") DB.setNow(id, me());
}

function playTrack(id) {
  if (S.nowId === id && playKey === id && !au.paused) return au.pause();
  startPlayback(id, S.nowId === id && playKey === id ? null : 0, null, id);
}
function playMoment(id, start) {
  const key = id + ":" + start;
  if (S.nowId === id && playKey === key && !au.paused) return au.pause();
  startPlayback(id, start, start + MOMENT_LEN, key);
}
function toggleNow() {
  if (!S.nowId) return;
  if (au.paused) au.play().catch(() => {}); else au.pause();
}
function step(dir) {
  const i = TRACKS.findIndex((t) => t.id === S.nowId);
  const n = TRACKS[(i + dir + TRACKS.length) % TRACKS.length];
  playTrack(n.id);
}

au.addEventListener("play", () => { S.playing = true; sync(true); });
au.addEventListener("pause", () => { S.playing = false; sync(true); });
au.addEventListener("ended", () => { if (until == null) step(1); });
au.addEventListener("timeupdate", () => {
  if (until != null && au.currentTime >= until) { until = null; au.pause(); }
  sync(false);
});

// ---------- Подсказка внизу экрана ----------
let toastTimer = null;
function toast(msg) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------- Тема ----------
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("drop-theme", t); } catch (e) {}
  const b = $("#theme");
  if (b) b.innerHTML = t === "dark" ? "☀️ Светлая" : "🌙 Тёмная";
}
