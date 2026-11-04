// Дроп: весь код сайта в одном файле (собрано из auth, data, db, core, icons, views, media, post, tracks, rooms, together, fx, voice, social, app)
/* ===== auth.js ===== */
// ============================================================
// Вход, регистрация и профиль. Здесь вся связь с Supabase.
// ============================================================
const Auth = (() => {
  const cfg = window.DROP_CONFIG || {};
  const client =
    window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  // Переводим технические ошибки в понятные фразы
  function friendly(err) {
    const m = (err && err.message) || "";
    if (/already registered/i.test(m)) return "Этот email уже зарегистрирован. Попробуйте войти.";
    if (/invalid login/i.test(m)) return "Неверная почта или пароль.";
    if (/at least 6/i.test(m)) return "Пароль должен быть не короче 6 символов.";
    if (/valid email|invalid format|email address/i.test(m)) return "Проверьте адрес почты.";
    if (/rate limit/i.test(m)) return "Слишком много попыток. Подождите минуту.";
    if (err && err.code === "23505") return "Этот ник уже занят.";
    return "Не получилось. Попробуйте ещё раз.";
  }

  // Достаём профиль; если его нет (редкий случай) — создаём простой
  async function loadProfile(user) {
    const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) return data;
    const username = "user_" + user.id.slice(0, 6);
    const { data: created } = await client
      .from("profiles")
      .insert({ id: user.id, username, display_name: username })
      .select()
      .maybeSingle();
    return created || null;
  }

  // Запускается при открытии сайта: смотрит, вошёл ли человек раньше
  async function init(onChange) {
    if (!client) return;
    const { data } = await client.auth.getSession();
    const user = data && data.session ? data.session.user : null;
    onChange({ user, profile: user ? await loadProfile(user) : null });
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") onChange({ user: null, profile: null });
    });
  }

  async function signUp({ email, password, username, name }) {
    if (!client) return { error: "Нет связи с сервером. Обновите страницу." };
    username = (username || "").toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: "Ник: 3–20 символов, только латинские буквы, цифры и _" };
    const { data: taken } = await client.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) return { error: "Этот ник уже занят." };
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) { console.error(error); return { error: friendly(error) }; }
    if (!data.session) return { notice: "Мы отправили письмо. Подтвердите адрес, потом войдите." };
    const { data: profile, error: e2 } = await client
      .from("profiles")
      .insert({ id: data.user.id, username, display_name: name || username })
      .select()
      .maybeSingle();
    if (e2) { console.error(e2); return { error: friendly(e2) }; }
    return { user: data.user, profile };
  }

  async function signIn({ email, password }) {
    if (!client) return { error: "Нет связи с сервером. Обновите страницу." };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { console.error(error); return { error: friendly(error) }; }
    return { user: data.user, profile: await loadProfile(data.user) };
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  async function saveProfile(id, fields) {
    const { data, error } = await client.from("profiles").update(fields).eq("id", id).select().maybeSingle();
    if (error) { console.error(error); return { error: friendly(error) }; }
    return { profile: data };
  }

  return { init, signUp, signIn, signOut, saveProfile, client };
})();

/* ===== data.js ===== */
// ============================================================
// Треки. Чтобы добавить свой: положите mp3 рядом с index.html
// и добавьте сюда ещё один блок. hot = «лучший момент» (секунда).
// ============================================================
const MOMENT_LEN = 15; // длина «Момента» в секундах

const TRACKS = [
  { id: "night-bus", title: "Ночной автобус", artist: "Студия Дроп", genre: "синти-поп", src: "night-bus.mp3", dur: 65, hot: 28, c1: "#7c5cff", c2: "#ff5ca8" },
  { id: "kitchen-morning", title: "Кухонное утро", artist: "Студия Дроп", genre: "лоу-фай", src: "kitchen-morning.mp3", dur: 64, hot: 36, c1: "#ffb84d", c2: "#ff6b4a" },
  { id: "basement-808", title: "Подвал 808", artist: "Студия Дроп", genre: "хип-хоп", src: "basement-808.mp3", dur: 57, hot: 24, c1: "#19d3a2", c2: "#2a6bff" },
  { id: "head-noise", title: "Шум в голове", artist: "Студия Дроп", genre: "электроника", src: "head-noise.mp3", dur: 66, hot: 30, c1: "#c6f432", c2: "#12b886" },
];

const track = (id) => TRACKS.find((t) => t.id === id);
const coverBg = (t) => (t.cover_url ? `url('${t.cover_url}') center / cover no-repeat` : `linear-gradient(135deg, ${t.c1}, ${t.c2})`);

// Песни пользователей добавляются к общему списку
function setUserTracks(rows) {
  for (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].user_id) TRACKS.splice(i, 1);
  for (const r of rows) {
    const b = BANNERS[r.color] || BANNERS[0], who = r.profiles || {};
    TRACKS.push({
      id: "u" + r.id, user_id: r.user_id, dbid: r.id, title: r.title, genre: r.genre || "своё",
      artist: r.artist || who.display_name || who.username || "Автор", src: r.src, dur: r.dur,
      hot: Math.max(0, Math.min(Math.floor(r.dur * 0.4), r.dur - MOMENT_LEN)), c1: b[0], c2: b[1], cover_url: r.cover_url || null,
    });
  }
}

// Одинаковые «волны» для одного и того же трека
function waveHeights(id, n) {
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return Array.from({ length: n }, (_, i) => {
    const v = Math.abs(Math.sin(i * 0.7 + seed) * Math.cos(i * 0.31 + seed * 2));
    return Math.round(22 + 78 * v);
  });
}

// ---------- Оформление профиля ----------
const BANNERS = [
  ["#7c5cff", "#ff5ca8"], ["#ffb84d", "#ff6b4a"], ["#19d3a2", "#2a6bff"], ["#c6f432", "#12b886"],
  ["#ff5ca8", "#ffb84d"], ["#2a6bff", "#7c5cff"], ["#232046", "#7c5cff"], ["#ff6b4a", "#ff2d6f"],
];
const ACCENTS = ["#8b6cff", "#ff5ca8", "#19d3a2", "#ffb84d", "#2a6bff", "#ff6b4a", "#c6f432", "#ffffff"];
const bannerBg = (i) => { const b = BANNERS[i] || BANNERS[0]; return `linear-gradient(135deg, ${b[0]}, ${b[1]})`; };
const accentOf = (i) => ACCENTS[i] || ACCENTS[0];

const nowHtml = (p) => (nowText(p) ? `${ico("headphones", 14)} ${esc(nowText(p))}` : "");
// Кто сейчас слушает (последние 10 минут)
function nowText(p) {
  if (!p || p.show_now === false || !p.now_track || !p.now_at) return "";
  const t = track(p.now_track);
  return t && Date.now() - new Date(p.now_at).getTime() < 600000 ? `слушает «${t.title}»` : "";
}

/* ===== db.js ===== */
// ============================================================
// Моменты, реакции и сообщения. Всё общение с базой здесь.
// ============================================================
const DB = (() => {
  const c = Auth.client;

  // Если таблиц ещё нет (не выполнен SQL) — говорим об этом по-человечески
  let lastErr = "";
  function say(error) {
    if (!error) return "";
    console.error(error);
    lastErr = (error.code || "") + " " + String(error.message || "").slice(0, 160);
    if (error.code === "42501") return "denied";
    if (["42P01", "42703", "PGRST205", "PGRST204", "PGRST200", "PGRST100"].includes(error.code) || /does not exist|schema cache|relationship|column/i.test(error.message || ""))
      return "setup";
    return "Не получилось (" + (error.code || "") + " " + String(error.message || "").slice(0, 90) + ")";
  }

  async function moments() {
    if (!c) return { data: [], error: "Нет связи с сервером." };
    const { data, error } = await c
      .from("moments")
      .select("id,user_id,track_id,start_sec,caption,photo_url,created_at,profiles!moments_user_id_fkey(username,display_name,avatar_url,accent),reactions(emoji,user_id),comments(count)")
      .order("created_at", { ascending: false })
      .limit(40);
    return { data: data || [], error: say(error) };
  }

  async function postMoment(track_id, start_sec, caption, photo_url) {
    const { error } = await c.from("moments").insert({ track_id: track_id || null, start_sec: track_id ? start_sec : null, caption: (caption || "").slice(0, 300), photo_url: photo_url || null });
    return say(error);
  }

  async function deleteMoment(id) {
    const { error } = await c.from("moments").delete().eq("id", id);
    return say(error);
  }

  async function setReaction(moment_id, user_id, emoji) {
    if (!emoji) {
      const { error } = await c.from("reactions").delete().eq("moment_id", moment_id).eq("user_id", user_id);
      return say(error);
    }
    const { error } = await c.from("reactions").upsert({ moment_id, user_id, emoji }, { onConflict: "moment_id,user_id" });
    return say(error);
  }

  async function search(q, meId) {
    const clean = (q || "").replace(/[^\p{L}\p{N}_ ]/gu, "").trim();
    if (!clean) return [];
    const { data } = await c
      .from("profiles")
      .select("id,username,display_name,avatar_url,now_track,now_at")
      .neq("searchable", false)
      .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
      .neq("id", meId)
      .limit(8);
    return data || [];
  }

  // Список собеседников: берём последние сообщения и группируем
  async function peers(meId) {
    const { data, error } = await c
      .from("messages")
      .select("id,sender,receiver,body,track_id,voice_url,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { list: [], error: say(error) };
    const last = new Map();
    for (const m of data) {
      const other = m.sender === meId ? m.receiver : m.sender;
      if (!last.has(other)) last.set(other, m);
    }
    const ids = [...last.keys()];
    let profs = [];
    if (ids.length) profs = (await c.from("profiles").select("id,username,display_name,avatar_url,now_track,now_at").in("id", ids)).data || [];
    const list = profs.map((p) => ({ ...p, last: last.get(p.id) }));
    list.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
    return { list, error: "" };
  }

  async function thread(meId, peerId) {
    const { data, error } = await c
      .from("messages")
      .select("id,sender,receiver,body,track_id,start_sec,voice_url,voice_dur,created_at")
      .or(`and(sender.eq.${meId},receiver.eq.${peerId}),and(sender.eq.${peerId},receiver.eq.${meId})`)
      .order("created_at", { ascending: true })
      .limit(200);
    return { data: data || [], error: say(error) };
  }

  async function send(receiver, body, track_id, start_sec, voice) {
    const row = { receiver, body: (body || "").slice(0, 2000) };
    if (track_id) { row.track_id = track_id; row.start_sec = start_sec; }
    if (voice) { row.voice_url = voice.url; row.voice_dur = voice.dur; }
    const { data, error } = await c.from("messages").insert(row).select().maybeSingle();
    return { msg: data, error: say(error) };
  }

  let channel = null;
  function subscribe(meId, onMessage) {
    unsubscribe();
    if (!c) return;
    channel = c
      .channel("msgs-" + meId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "receiver=eq." + meId }, (p) => onMessage(p.new))
      .subscribe();
  }
  function unsubscribe() {
    if (channel && c) c.removeChannel(channel);
    channel = null;
  }

  async function profile(id) {
    const { data } = await c.from("profiles").select("*").eq("id", id).maybeSingle();
    return data;
  }

  async function userPosts(uid) {
    const { data, error } = await c
      .from("moments")
      .select("id,user_id,track_id,start_sec,caption,photo_url,created_at,profiles!moments_user_id_fkey(username,display_name,avatar_url,accent),reactions(emoji,user_id),comments(count)")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(30);
    return { data: data || [], error: say(error) };
  }

  let lastNow = 0;
  function setNow(trackId, uid) {
    if (!c || !uid || Date.now() - lastNow < 20000) return;
    if (S.auth.profile && S.auth.profile.show_now === false) return;
    lastNow = Date.now();
    c.from("profiles").update({ now_track: trackId, now_at: new Date().toISOString() }).eq("id", uid).then(() => {});
  }

  return { moments, postMoment, deleteMoment, setReaction, search, peers, thread, send, subscribe, unsubscribe, profile, userPosts, setNow, say, client: c, detail: () => lastErr };
})();

/* ===== core.js ===== */
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
const cover = (t, cls = "") => `<span class="cover ${cls} ${t.cover_url ? "img" : ""}" style="background:${coverBg(t)}"><i></i></span>`;

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
au.crossOrigin = "anonymous";
au.preload = "metadata";
let until = null; // секунда, на которой остановиться (для «Момента»)
let playKey = null; // что именно сейчас играет: "id" или "id:начало"

function startPlayback(id, from, to, key) {
  const t = track(id);
  if (!t) return;
  if (typeof FX !== "undefined") { FX.init(); FX.resume(); }
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
  if (typeof FX !== "undefined") { FX.init(); FX.resume(); }
  if (au.paused) au.play().catch(() => {}); else au.pause();
}
const trackList = () => (S.queue && S.queue.includes(S.nowId) ? S.queue.map(track).filter(Boolean) : TRACKS);
function step(dir) {
  const L = trackList();
  const i = L.findIndex((t) => t.id === S.nowId);
  const n = L[(i + dir + L.length) % L.length];
  playTrack(n.id);
}

au.addEventListener("play", () => { S.playing = true; sync(true); });
au.addEventListener("pause", () => { S.playing = false; sync(true); });
au.addEventListener("ended", () => { if (until == null) { if (typeof FX !== "undefined") FX.next(); else step(1); } });
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
  if (b) b.innerHTML = t === "dark" ? ico("sun", 18) + " Светлая" : ico("moon", 18) + " Тёмная";
}

/* ===== icons.js ===== */
// ============================================================
// Значки, нарисованные для Дропа (вместо смайликов).
// ico("fire", 20) возвращает готовую картинку нужного размера.
// ============================================================
const ICO = {
  headphones: `<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.6" height="7" rx="2.2"/><rect x="16.4" y="14" width="4.6" height="7" rx="2.2"/>`,
  fire: `<path d="M12 2.8c.9 3.2 5.2 5.2 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2.2 1-3.4 2.2-4.6.2 1.6.9 2.2 1.9 2.4-1-3 0-5.6 1.1-8z"/>`,
  heart: `<path d="M12 20.2s-7.2-4.4-7.2-10.2a4.2 4.2 0 0 1 7.2-2.9 4.2 4.2 0 0 1 7.2 2.9c0 5.8-7.2 10.2-7.2 10.2z"/>`,
  wow: `<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"/><ellipse cx="12" cy="15.6" rx="2" ry="2.6"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="7.7" r="0.7" fill="currentColor"/>`,
  settings: `<path d="M3.5 7h9M17 7h3.5M3.5 17H7M11.5 17h9"/><circle cx="14.8" cy="7" r="2.3"/><circle cx="9.2" cy="17" r="2.3"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/>`,
  moon: `<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
  star: `<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`,
  vinyl: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>`,
  rocket: `<path d="M12 2.8c3 2 4.8 5 4.8 8.7l-2 3.2H9.2l-2-3.2c0-3.7 1.8-6.7 4.8-8.7z"/><circle cx="12" cy="9.6" r="1.6"/><path d="M9.2 14.7 7 19l3.2-1M14.8 14.7 17 19l-3.2-1"/>`,
  crown: `<path d="m3 8.5 4.2 3.6L12 5l4.8 7.1L21 8.5 19 19H5z"/>`,
  drop: `<path d="M12 3s6.2 6.6 6.2 11a6.2 6.2 0 0 1-12.4 0C5.8 9.6 12 3 12 3z"/>`,
  volume: `<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.3 9a4.2 4.2 0 0 1 0 6M18.8 6.5a7.6 7.6 0 0 1 0 11"/>`,
  mute: `<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="m17 9.5 4 5M21 9.5l-4 5"/>`,
  eq: `<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14.5" r="2.2"/><circle cx="12" cy="8.5" r="2.2"/><circle cx="18" cy="12.5" r="2.2"/>`,
  repeat: `<path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11V9.5A4 4 0 0 1 8 5.5h12"/><path d="m7 21.5-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/>`,
  repeat1: `<path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11V9.5A4 4 0 0 1 8 5.5h12"/><path d="m7 21.5-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/><path d="M11 10.5l1.6-1v6"/>`,
  shuffle: `<path d="M16 3.5h4.5V8"/><path d="M3.5 20.5 20.5 3.5"/><path d="M20.5 16v4.5H16"/><path d="m14.5 14.5 6 6"/><path d="m3.5 3.5 5 5"/>`,
  megaphone: `<path d="M3.5 10v4l10.5 4.2V5.8z"/><path d="M14 8.2c3 0 5 1.5 5 3.8s-2 3.8-5 3.8"/><path d="m6.5 14.4 1 5.1h3l-1-4"/>`,
  chat: `<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>`,
  lock: `<rect x="5" y="11" width="14" height="9.5" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  block: `<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>`,
  trash: `<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>`,
  stop: `<rect x="6" y="6" width="12" height="12" rx="2.5"/>`,
  people: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-4 3-5.5 6.5-5.5s5.9 1.5 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.8.6 2.7 2.2 3 5.2"/>`,
};

const ico = (name, size = 20) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[name] || ""}</svg>`;

// Значки, которые можно выбрать для сообщества
const ROOM_ICONS = ["headphones", "fire", "star", "heart", "vinyl", "mic", "rocket", "crown", "drop", "moon", "sun", "eq"];

// Реакции на посты. Старые смайлики из базы превращаем в новые значки
const REACT_KEYS = ["fire", "heart", "wow"];
const REACT_LEGACY = { "🔥": "fire", "💜": "heart", "😮": "wow" };
const rk = (e) => REACT_LEGACY[e] || e;

// Иконки с размером по умолчанию для общего набора
Object.assign(ICON, {
  headphones: ico("headphones", 22), settings: ico("settings", 22), info: ico("info", 22),
  mic: ico("mic", 22), megaphone: ico("megaphone", 22), people: ico("people", 22),
  volume: ico("volume", 20), mute: ico("mute", 20), eq: ico("eq", 20), stop: ico("stop", 20),
  repeat: ico("repeat", 22), repeat1: ico("repeat1", 22), shuffle: ico("shuffle", 22), trash: ico("trash", 20),
});

/* ===== views.js ===== */
// ============================================================
// Экраны: Моменты, Треки, Чаты, Я, плеер.
// ============================================================
const TABS = [
  ["moments", "Лента"],
  ["tracks", "Треки"],
  ["chats", "Чаты"],
  ["rooms", "Сообщества"],
  ["me", "Я"],
];


function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "только что";
  if (s < 3600) return Math.floor(s / 60) + " мин назад";
  if (s < 86400) return Math.floor(s / 3600) + " ч назад";
  return Math.floor(s / 86400) + " дн назад";
}
const range = (t, start) => `${fmt(start)}–${fmt(Math.min(start + MOMENT_LEN, t.dur))}`;

function setupNotice() {
  return `<div class="notice">Этот раздел ещё не подключён к базе. Нужно один раз выполнить SQL из инструкции в чате, потом обновить страницу.<br><small class="muted">Причина: ${esc(DB.detail())}</small></div>`;
}

// ---------- Карточка «Момента» ----------
function momentBtn(t, start, label) {
  return `<button class="mbtn" data-moment="${t.id}:${start}" aria-label="Играть момент">
    <span class="mplay">${ICON.play}${ICON.pause}</span>
    <span class="mtxt"><b>${esc(label || "Момент")}</b><small>${esc(t.title)} · ${range(t, start)}</small></span>
    <span class="mprog"><span></span></span>
  </button>`;
}

function viewMoments() {
  let list = "";
  if (S.moments === null) list = `<div class="empty">Загружаем…</div>`;
  else if (S.momentsErr === "setup") list = setupNotice();
  else if (S.momentsErr) list = `<div class="alert">${esc(S.momentsErr)}</div>`;
  else if (!S.moments.length)
    list = `<div class="empty"><b>Здесь пока тихо.</b><br>Опубликуй первое фото и подпиши его музыкой.</div>`;
  else list = S.moments.map(postCard).join("");
  return `<header class="top"><h1 class="h1">Лента</h1><p class="muted">Фото, у которых есть саундтрек.</p></header>
  <section class="hero">
    <div><h2>Каждому кадру<br>свой саундтрек</h2><p>Выложи фото и подпиши его музыкой: друзья увидят кадр и услышат, как он звучит.</p></div>
    <button class="btn-dark" data-newpost="1">${ICON.camera} Новый пост</button>
  </section>
  <h3 class="sec">Свежее</h3>${list}`;
}

function viewTracks() {
  return `<header class="top row"><div class="grow"><h1 class="h1">Треки</h1><p class="muted">Демо-треки и песни пользователей.</p></div><button class="btn-a sm" data-newtrack="1">${ICON.plus} Своя песня</button></header>` +
    TRACKS.map((t) => `<article class="card track" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="row">
        <button class="cover-btn" data-open="${t.id}" aria-label="Открыть плеер">${cover(t, "big")}</button>
        <div class="grow"><div class="title">${esc(t.title)}</div><div class="muted">${artistLink(t)}</div><span class="sticker">${esc(t.genre)} · ${fmt(t.dur)}</span></div>
        ${t.user_id && t.user_id === me() ? `<button class="x" data-deltrack="${t.id}" aria-label="Удалить">${ICON.close}</button>` : ""}
        <button class="playbtn" data-play="${t.id}" aria-label="Играть">${ICON.play}${ICON.pause}</button>
      </div>
      ${t.dur > MOMENT_LEN ? momentBtn(t, t.hot, "Лучший момент") : ""}
    </article>`).join("");
}

// ---------- Вход / регистрация ----------
const field = (name, label, type = "text", ph = "", val = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" placeholder="${esc(ph)}" value="${esc(val)}" autocomplete="${type === "password" ? "current-password" : name === "email" ? "email" : "off"}" required></label>`;

function authCard() {
  const a = S.auth, reg = a.mode === "register";
  return `<header class="top"><h1 class="h1">${reg ? "Создать аккаунт" : "Войти"}</h1><p class="muted">Нужен, чтобы публиковать моменты и писать другим.</p></header>
  <form class="card form" id="authForm">
    ${a.error ? `<div class="alert">${esc(a.error)}</div>` : ""}${a.notice ? `<div class="notice">${esc(a.notice)}</div>` : ""}
    ${field("email", "Почта", "email", "you@mail.com")}
    ${field("password", "Пароль (от 6 символов)", "password")}
    ${reg ? field("username", "Ник (латиницей)", "text", "shayn_77") + field("name", "Имя", "text", "Как вас зовут") : ""}
    <button class="btn-a" ${a.busy ? "disabled" : ""}>${a.busy ? "Секунду…" : reg ? "Зарегистрироваться" : "Войти"}</button>
    <button type="button" class="link" data-authmode="${reg ? "login" : "register"}">${reg ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать"}</button>
  </form>`;
}

function viewMe() {
  if (!S.auth.user) return authCard();
  const p = S.auth.profile || {};
  return `<header class="top"><h1 class="h1">Я</h1></header>
  <section class="card"><div class="row">${avatar(p, 64)}<div class="grow"><div class="title">${esc(p.display_name || p.username)}</div><div class="muted">@${esc(p.username)}</div></div></div></section>
  <section class="card form">
    <b>Оформление</b>
    <label class="btn-s" style="align-self:flex-start">${ICON.camera} Сменить аватар<input type="file" id="avatarIn" accept="image/*" hidden></label>
    <div class="field">Баннер<div class="swatches">${BANNERS.map((_, i) => `<button type="button" data-banner="${i}" class="${(p.banner || 0) === i ? "on" : ""}"><i style="background:${bannerBg(i)}"></i></button>`).join("")}</div></div>
    <div class="field">Цвет рамки аватара<div class="swatches">${ACCENTS.map((c, i) => `<button type="button" data-accent="${i}" class="${(p.accent || 0) === i ? "on" : ""}"><i style="background:${c}"></i></button>`).join("")}</div></div>
    <button class="btn-s" data-profile="${p.id}" type="button">Посмотреть мой профиль</button>
  </section>
  <form class="card form" id="profileForm">
    ${S.auth.error ? `<div class="alert">${esc(S.auth.error)}</div>` : ""}${S.auth.notice ? `<div class="notice">${esc(S.auth.notice)}</div>` : ""}
    <label class="field">Имя<input name="display_name" value="${esc(p.display_name || "")}" maxlength="40"></label>
    <label class="field">О себе<textarea name="bio" maxlength="160">${esc(p.bio || "")}</textarea></label>
    <label class="field">Песня профиля<select name="profile_track" class="cap-in"><option value="">Без песни</option>${TRACKS.map((t) => `<option value="${t.id}" ${t.id === p.profile_track ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select></label>
    <button class="btn-a" ${S.auth.busy ? "disabled" : ""}>Сохранить</button>
    <button type="button" class="btn-s" data-logout="1">Выйти</button>
  </form>
  ${privacyCard(p)}
  <div class="card"><b>Пригласи друзей</b><p class="muted">Отправь ссылку на сайт. Пусть зарегистрируются, найдут тебя по нику <b>@${esc(p.username)}</b> и напишут.</p>
    <button class="btn-s" data-copy="1">Скопировать ссылку</button></div>`;
}

// ---------- Чаты ----------
function msgBubble(m) {
  const mineMsg = m.sender === me();
  let inner = m.body ? `<div>${esc(m.body)}</div>` : "";
  const t = m.track_id ? track(m.track_id) : null;
  if (m.voice_url) inner += voiceBtn(m);
  if (t) inner += momentBtn(t, m.start_sec || 0, "Момент");
  return `<div class="bubble ${mineMsg ? "me" : ""}">${inner}</div>`;
}

function viewChats() {
  const c = S.chat;
  if (!S.auth.user) return `<header class="top"><h1 class="h1">Чаты</h1></header><div class="empty"><b>Чтобы переписываться, войдите.</b></div>` + authCard().replace(/<header[\s\S]*?<\/header>/, "");
  if (c.peer) {
    const p = c.peer;
    return `<div class="card chat">
      <div class="chat-head"><button class="x" data-chatback="1" aria-label="Назад">${ICON.back}</button><button data-profile="${p.id}">${avatar(p, 38)}</button><div class="grow"><b>${esc(p.display_name || p.username)}</b><div class="muted small">${nowHtml(p) || "@" + esc(p.username)}</div></div></div>
      <div class="msgs" id="msgs">${c.err === "setup" ? setupNotice() : c.msgs.length ? c.msgs.map(msgBubble).join("") : `<div class="empty">Напиши первым<br><span class="small">Кнопка с нотой отправит момент из плеера, а микрофон запишет голосовое.</span></div>`}</div>
      <form class="compose empty" id="compose">
        <button type="button" class="send ghost" data-sendmoment="1" aria-label="Отправить момент">${ICON.note}</button>
        <input name="text" placeholder="Сообщение…" autocomplete="off" maxlength="2000">
        <button class="send sendb" aria-label="Отправить">${ICON.send}</button>
        <button type="button" class="send micb" aria-label="Голосовое: удерживайте">${ICON.mic}</button>
      </form></div>`;
  }
  const people = c.q.trim() ? c.found : c.peers;
  let body = "";
  if (c.err === "setup") body = setupNotice();
  else if (!people.length) body = `<div class="empty">${c.q.trim() ? "Никого не нашли." : "Диалогов пока нет. Найди человека по нику и напиши."}</div>`;
  else body = people.map((p) => `<button class="card person" data-peer="${p.id}">${avatar(p, 46)}<div class="grow"><b>${esc(p.display_name || p.username)}</b><div class="muted small">${nowHtml(p) || "@" + esc(p.username)}${p.last ? " · " + (p.last.voice_url ? "голосовое" : p.last.track_id ? "момент" : esc((p.last.body || "").slice(0, 40))) : ""}</div></div>${S.unread[p.id] ? `<span class="badge">${S.unread[p.id]}</span>` : ""}</button>`).join("");
  return `<header class="top"><h1 class="h1">Чаты</h1></header>
  <label class="search">${ICON.search}<input id="q" placeholder="Найти по нику или имени" value="${esc(c.q)}" autocomplete="off"></label>${body}`;
}

// ---------- Мини-плеер и большой плеер ----------
function renderPlayer() {
  const el = $("#player");
  const t = track(S.nowId);
  if (!t) { el.innerHTML = ""; el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<button class="pinfo" data-sheet="1">${cover(t)}<span class="grow"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span></button>
    <button class="playbtn sm" data-toggle="1" aria-label="Пауза/играть">${ICON.play}${ICON.pause}</button><span class="pbar"><span id="pBar"></span></span>`;
}

const WAVE_N = 64;
function renderSheet() {
  const el = $("#sheet");
  const t = track(S.nowId);
  if (!S.sheet || !t) { el.hidden = true; el.innerHTML = ""; document.body.classList.remove("noscroll"); return; }
  document.body.classList.add("noscroll");
  el.hidden = false;
  const hs = waveHeights(t.id, WAVE_N);
  const max = Math.max(1, t.dur - MOMENT_LEN);
  el.innerHTML = `<div class="sheet-in" style="--c1:${t.c1};--c2:${t.c2}">
    <button class="x close" data-sheetclose="1" aria-label="Закрыть">${ICON.close}</button>
    <div class="art ${t.cover_url ? "img" : ""}" style="background:${coverBg(t)}"><i></i></div>
    <div class="center"><div class="title">${esc(t.title)}</div><div class="muted">${artistLink(t)} · ${esc(t.genre)}</div></div>
    <div class="wave" id="wave">${hs.map((h, i) => `<b data-i="${i}" style="height:${h}%"></b>`).join("")}</div>
    <div class="times"><span id="sCur">0:00</span><span>${fmt(t.dur)}</span></div>
    <div class="ctrl"><button data-shuffle="1" class="${S.shuffle ? "on" : ""}" aria-label="Вперемешку">${ICON.shuffle}</button><button data-step="-1" aria-label="Назад">${ICON.prev}</button><button class="playbtn big" data-toggle="1" aria-label="Играть">${ICON.play}${ICON.pause}</button><button data-step="1" aria-label="Дальше">${ICON.next}</button><button data-repeat="1" class="${S.repeat ? "on" : ""}" aria-label="Повтор">${S.repeat === 2 ? ICON.repeat1 : ICON.repeat}</button></div>
    ${soundPanel()}
    <div class="card mpanel">
      <div class="row"><b>${ICON.bolt} Твой момент</b><span class="sticker lime grow-r" id="mLabel"></span></div>
      <input type="range" id="mrange" min="0" max="${max}" value="${clamp(S.mstart, 0, max)}" aria-label="Начало момента">
      <div class="muted small">Двигай ползунок: подсвечены 15 секунд, которые получат друзья.</div>
      <button class="btn-s" data-previewmoment="1">${ICON.play.replace(/width="22" height="22"/, 'width="16" height="16"')} Прослушать момент</button>
      <input class="cap-in" id="mcap" maxlength="140" placeholder="Подпись: почему этот момент? (необязательно)">
      <button class="btn-a" data-postmoment="1">Опубликовать в ленту</button>
    </div></div>`;
  paintSheet();
  if (typeof voiceSync === "function") voiceSync();
}

function paintSheet() {
  const t = track(S.nowId);
  if (!S.sheet || !t) return;
  const cur = au.currentTime || 0, bars = $$("#wave b");
  bars.forEach((b, i) => {
    const sec = (i / WAVE_N) * t.dur;
    b.classList.toggle("done", sec <= cur);
    b.classList.toggle("win", sec >= S.mstart - 0.01 && sec < S.mstart + MOMENT_LEN);
  });
  const l = $("#sCur"); if (l) l.textContent = fmt(cur);
  const m = $("#mLabel"); if (m) m.textContent = range(t, S.mstart);
}

// ---------- Синхронизация плеера с кнопками ----------
function sync(full) {
  if (full) renderPlayer();
  const t = track(S.nowId);
  const dur = (t && t.dur) || 1, cur = au.currentTime || 0;
  const bar = $("#pBar"); if (bar) bar.style.width = clamp((cur / dur) * 100, 0, 100) + "%";
  $$("[data-play]").forEach((b) => b.classList.toggle("playing", S.playing && playKey === b.dataset.play));
  $$("[data-toggle]").forEach((b) => b.classList.toggle("playing", S.playing));
  $$("[data-moment]").forEach((b) => {
    const [id, st] = b.dataset.moment.split(":");
    const on = playKey === b.dataset.moment && S.nowId === id;
    b.classList.toggle("playing", on && S.playing);
    const pr = $(".mprog span", b);
    if (pr) pr.style.width = on ? clamp(((cur - +st) / MOMENT_LEN) * 100, 0, 100) + "%" : "0%";
  });
  paintSheet();
  if (typeof voiceSync === "function") voiceSync();
}

/* ===== media.js ===== */
// ============================================================
// Фото: уменьшаем перед загрузкой (чтобы было быстро) и храним в Supabase.
// ============================================================
const Media = (() => {
  // Уменьшает фото до max пикселей. square = обрезать в квадрат (для аватара)
  async function shrink(file, max, square) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await createImageBitmap(file); }
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const cv = document.createElement("canvas");
    cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
    cv.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return new Promise((res) => cv.toBlob(res, "image/jpeg", 0.85));
  }

  // Загружает и возвращает ссылку на фото
  async function upload(blob, uid) {
    const c = Auth.client;
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error } = await c.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) { console.error(error); return { error: "Фото не загрузилось: " + String(error.message || error).slice(0, 120) }; }
    return { url: c.storage.from("photos").getPublicUrl(path).data.publicUrl };
  }

  return { shrink, upload };
})();

/* ===== post.js ===== */
// ============================================================
// Посты (фото + музыка) и публичный профиль.
// ============================================================

// ---------- Карточка поста ----------
function postCard(m) {
  const t = m.track_id ? track(m.track_id) : null;
  const who = m.profiles || { username: "user", display_name: "user" };
  const rs = m.reactions || [];
  const mine = rs.find((r) => r.user_id === me());
  const btns = REACT_KEYS.map((e) => {
    const n = rs.filter((r) => rk(r.emoji) === e).length;
    return `<button class="react ${mine && rk(mine.emoji) === e ? "on" : ""}" data-react="${m.id}:${e}">${ico(e, 20)}<span>${n || ""}</span></button>`;
  }).join("");
  return `<article class="card post" ${t ? `style="--c1:${t.c1};--c2:${t.c2}"` : ""}>
    <div class="row"><button class="who" data-profile="${m.user_id}">${avatar(who, 40)}<span class="grow"><b>${esc(who.display_name || who.username)}</b><span class="muted small">@${esc(who.username)} · ${ago(m.created_at)}</span></span></button>
    ${m.user_id === me() ? `<button class="x" data-delmoment="${m.id}" aria-label="Удалить">${ICON.close}</button>` : ""}</div>
    ${m.photo_url ? `<img class="photo" src="${esc(m.photo_url)}" alt="Фото" loading="lazy">` : ""}
    ${m.caption ? `<p class="cap">${esc(m.caption)}</p>` : ""}
    ${t ? momentBtn(t, m.start_sec || 0, m.photo_url ? "Саундтрек" : "Момент") : ""}
    <div class="reacts">${btns}</div>
    ${commentsBox(m)}</article>`;
}

// ---------- Окно «Новый пост» ----------
function openComposer(preTrack, preStart) {
  if (!S.auth.user) { toast("Сначала войдите"); return go("me"); }
  S.sheet = false; renderSheet();
  const m = $("#modal");
  m.hidden = false; document.body.classList.add("noscroll");
  const tr = preTrack || "";
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Новый пост</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="postForm" class="form">
      <label class="pick" id="pickPhoto"><input type="file" id="photoIn" accept="image/*" hidden><span id="pickTxt">${ICON.camera}<b>Добавить фото</b><small>необязательно</small></span><img id="photoPrev" alt="" hidden></label>
      <textarea name="caption" class="cap-in tall" maxlength="300" placeholder="Подпись…"></textarea>
      <label class="field">Музыка к посту
        <select name="track" id="trackSel" class="cap-in"><option value="">Без музыки</option>${TRACKS.map((t) => `<option value="${t.id}" ${t.id === tr ? "selected" : ""}>${esc(t.title)}</option>`).join("")}</select></label>
      <div id="startWrap" ${tr ? "" : "hidden"}><div class="row"><span class="muted small grow">С какой секунды играть 15 секунд</span><span class="sticker lime" id="startLbl"></span></div>
        <input type="range" id="startRange" min="0" value="${preStart || 0}"></div>
      <div class="alert" id="postErr" hidden></div><button class="btn-a" id="postGo">Опубликовать</button></form></div>`;
  syncComposer(preStart);
}

function syncComposer(preStart) {
  const sel = $("#trackSel"), t = track(sel.value), wrap = $("#startWrap"), r = $("#startRange");
  wrap.hidden = !t;
  if (!t) return;
  r.max = Math.max(1, t.dur - MOMENT_LEN);
  r.value = preStart != null ? clamp(preStart, 0, r.max) : Math.min(+r.value, r.max) || t.hot;
  $("#startLbl").textContent = range(t, +r.value);
}

function closeModal() {
  const m = $("#modal");
  m.hidden = true; m.innerHTML = "";
  if (!S.sheet) document.body.classList.remove("noscroll");
}

async function publishPost(form) {
  const btn = $("#postGo"), er = $("#postErr"), file = $("#photoIn").files[0];
  const fail = (msg) => { btn.disabled = false; btn.textContent = "Опубликовать"; er.hidden = false; er.textContent = msg; };
  er.hidden = true;
  const caption = form.caption.value.trim(), tid = form.track.value;
  if (!file && !caption && !tid) return fail("Добавьте фото, текст или музыку.");
  btn.disabled = true; btn.textContent = "Публикуем…";
  try {
    let url = null;
    if (file) {
      const up = await Media.upload(await Media.shrink(file, 1280, false), me());
      if (up.error) return fail(up.error);
      url = up.url;
    }
    const err = await DB.postMoment(tid, +$("#startRange").value, caption, url);
    if (err) return fail("Пост не сохранился. Причина: " + DB.detail());
  } catch (e) {
    console.error(e);
    return fail("Ошибка: " + String(e.message || e).slice(0, 120));
  }
  closeModal(); toast("Опубликовано"); S.moments = null; go("moments");
}

// ---------- Публичный профиль ----------
async function openProfile(id) {
  if (S.sheet) { S.sheet = false; renderSheet(); }
  S.profileId = id; S.prof = null;
  S.view = "profile"; render();
  const [p, posts] = await Promise.all([DB.profile(id), DB.userPosts(id)]);
  if (S.profileId !== id) return;
  S.prof = { p, posts: posts.data };
  if (S.view === "profile") render(true);
}

function viewProfile() {
  const d = S.prof;
  if (!d) return `<div class="empty">Загружаем…</div>`;
  const p = d.p;
  if (!p) return `<div class="empty">Профиль не найден.</div>`;
  const pt = p.profile_track ? track(p.profile_track) : null, mineP = p.id === me(), nt = nowText(p);
  return `<button class="x back" data-view="moments" aria-label="Назад">${ICON.back}</button>
  <section class="card prof" style="--acc:${accentOf(p.accent)}">
    <div class="banner" style="background:${bannerBg(p.banner)}"></div>
    <div class="prof-in"><div class="ava-ring">${avatar(p, 88)}</div>
      <div class="title">${esc(p.display_name || p.username)}</div><div class="muted">@${esc(p.username)}</div>
      ${nt ? `<div class="sticker lime">${nowHtml(p)}</div>` : ""}
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
      ${profStats(p, d.posts)}
      ${pt ? `<div class="muted small" style="margin-top:12px">Песня профиля</div>${momentBtn(pt, pt.hot, "Моя песня")}` : ""}
      ${profileActions(p, mineP)}
    </div></section>
  ${artistBlock(p)}
  <h3 class="sec">Посты</h3>${d.posts.length ? d.posts.map(postCard).join("") : `<div class="empty">Пока ничего не опубликовано.</div>`}`;
}

// ---------- События ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-profile],[data-newpost],[data-modalclose],[data-writeto],[data-banner],[data-accent]");
  if (!el) return;
  const d = el.dataset;
  if (d.profile) return openProfile(d.profile);
  if (d.newpost !== undefined) return openComposer();
  if (d.modalclose) return closeModal();
  if (d.writeto) { S.view = "chats"; S.chat.q = ""; await loadPeers(); return openPeer(d.writeto); }
  if (d.banner !== undefined || d.accent !== undefined) {
    const f = d.banner !== undefined ? { banner: +d.banner } : { accent: +d.accent };
    const r = await Auth.saveProfile(me(), f);
    if (r.error) return toast("Нужен SQL из шага 5");
    S.auth.profile = r.profile; render(true);
  }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.id === "photoIn" && t.files[0]) {
    const pr = $("#photoPrev"); pr.src = URL.createObjectURL(t.files[0]); pr.hidden = false; $("#pickTxt").hidden = true;
  }
  if (t.id === "trackSel") syncComposer();
  if (t.id === "avatarIn" && t.files[0]) {
    toast("Загружаем аватар…");
    const up = await Media.upload(await Media.shrink(t.files[0], 400, true), me());
    if (up.error) return toast(up.error === "setup" ? "Нужен SQL из шага 5" : up.error);
    const r = await Auth.saveProfile(me(), { avatar_url: up.url });
    if (r.error) return toast("Не получилось");
    S.auth.profile = r.profile; render(true); toast("Аватар обновлён");
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "startRange") { const t = track($("#trackSel").value); if (t) $("#startLbl").textContent = range(t, +e.target.value); }
});

document.addEventListener("submit", (e) => {
  if (e.target.id === "postForm") { e.preventDefault(); e.stopImmediatePropagation(); publishPost(e.target); }
}, true);

/* ===== tracks.js ===== */
// ============================================================
// Свои песни: загрузка mp3, обложка, цвет, удаление.
// ============================================================
const TracksDB = (() => {
  const c = Auth.client;

  async function list() {
    if (!c) return [];
    const { data, error } = await c
      .from("user_tracks")
      .select("id,user_id,title,artist,genre,src,dur,color,cover_url,profiles!user_tracks_user_id_fkey(username,display_name)")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) { console.error(error); return []; }
    return data || [];
  }

  // Узнаём длину песни до загрузки
  function duration(file) {
    return new Promise((res) => {
      const a = new Audio(), u = URL.createObjectURL(file);
      a.preload = "metadata";
      a.onloadedmetadata = () => { URL.revokeObjectURL(u); res(Math.round(a.duration) || 0); };
      a.onerror = () => { URL.revokeObjectURL(u); res(0); };
      a.src = u;
    });
  }

  async function add(file, fields, coverFile) {
    const uid = me();
    const ext = ((file.name.match(/\.(\w{2,5})$/) || [])[1] || "mp3").toLowerCase();
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const up = await c.storage.from("tracks").upload(path, file, { contentType: file.type || "audio/mpeg" });
    if (up.error) return { error: "Песня не загрузилась: " + String(up.error.message || up.error).slice(0, 120) };
    const src = c.storage.from("tracks").getPublicUrl(path).data.publicUrl;
    let cover_url = null;
    if (coverFile) {
      const im = await Media.upload(await Media.shrink(coverFile, 600, true), uid);
      if (im.url) cover_url = im.url;
    }
    const { error } = await c.from("user_tracks").insert({ ...fields, src, cover_url });
    if (error) return { error: "Песня не сохранилась: " + DB.say(error) + " " + DB.detail() };
    return {};
  }

  async function remove(t) {
    const { error } = await c.from("user_tracks").delete().eq("id", t.dbid);
    if (error) return DB.say(error);
    const m = String(t.src).split("/tracks/")[1];
    if (m) c.storage.from("tracks").remove([decodeURIComponent(m)]).then(() => {});
    return "";
  }

  return { list, duration, add, remove };
})();

async function loadUserTracks() {
  setUserTracks(await TracksDB.list());
}

function openTrackForm() {
  if (!S.auth.user) { toast("Сначала войдите"); return go("me"); }
  const m = $("#modal");
  m.hidden = false; document.body.classList.add("noscroll");
  const p = S.auth.profile || {};
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Загрузить песню</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="trackForm" class="form">
      <label class="pick" id="pickTrack"><input type="file" id="trackFile" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden><span>${ICON.note}<b id="trackFileName">Выбрать mp3-файл</b><small>до 15 МБ</small></span></label>
      <label class="field">Название<input name="title" maxlength="60" required placeholder="Как называется песня"></label>
      <label class="field">Исполнитель<input name="artist" maxlength="60" value="${esc(p.display_name || p.username || "")}"></label>
      <label class="field">Жанр<input name="genre" maxlength="24" placeholder="Например: рэп, поп, инди"></label>
      <div class="field">Цвет обложки<div class="swatches">${BANNERS.map((_, i) => `<label><input type="radio" name="color" value="${i}" ${i === 0 ? "checked" : ""} hidden><i style="background:${bannerBg(i)}"></i></label>`).join("")}</div></div>
      <label class="pick small" id="pickCover"><input type="file" id="coverFile" accept="image/*" hidden><span id="coverTxt">${ICON.camera}<b>Своя обложка</b><small>необязательно</small></span><img id="coverPrev" alt="" hidden></label>
      <p class="muted small">Загружай только свою музыку или ту, которую можно публиковать. Чужие песни без разрешения автора загружать нельзя.</p>
      <div class="alert" id="trackErr" hidden></div>
      <button class="btn-a" id="trackGo">Загрузить</button></form></div>`;
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-newtrack],[data-deltrack]");
  if (!el) return;
  if (el.dataset.newtrack !== undefined) return openTrackForm();
  const t = track(el.dataset.deltrack);
  if (!t || !confirm("Удалить песню «" + t.title + "»?")) return;
  if (S.nowId === t.id) { au.pause(); }
  const err = await TracksDB.remove(t);
  if (err) return toast("Не получилось удалить");
  await loadUserTracks(); toast("Песня удалена"); render(true);
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "trackFile" && t.files[0]) {
    $("#trackFileName").textContent = t.files[0].name;
    const f = $("#trackForm").title; if (!f.value) f.value = t.files[0].name.replace(/\.\w+$/, "").slice(0, 60);
  }
  if (t.id === "coverFile" && t.files[0]) {
    const pr = $("#coverPrev"); pr.src = URL.createObjectURL(t.files[0]); pr.hidden = false; $("#coverTxt").hidden = true;
  }
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "trackForm") return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = e.target, btn = $("#trackGo"), er = $("#trackErr"), file = $("#trackFile").files[0];
  const fail = (msg) => { btn.disabled = false; btn.textContent = "Загрузить"; er.hidden = false; er.textContent = msg; };
  er.hidden = true;
  if (!file) return fail("Сначала выберите файл с песней.");
  if (file.size > 15 * 1024 * 1024) return fail("Файл слишком большой. Максимум 15 МБ.");
  btn.disabled = true; btn.textContent = "Загружаем…";
  try {
    const dur = await TracksDB.duration(file);
    if (dur < 5) return fail("Не удалось прочитать песню. Попробуйте mp3.");
    const r = await TracksDB.add(file, { title: f.title.value.trim(), artist: f.artist.value.trim(), genre: f.genre.value.trim(), dur, color: +f.color.value }, $("#coverFile").files[0]);
    if (r.error) return fail(r.error);
  } catch (x) {
    console.error(x);
    return fail("Ошибка: " + String(x.message || x).slice(0, 120));
  }
  closeModal(); await loadUserTracks(); toast("Песня загружена"); go("tracks");
}, true);

/* ===== rooms.js ===== */
// ============================================================
// Группы и каналы: база, экран и события.
// ============================================================
const freshRooms = () => ({ mine: [], found: [], err: "", cur: null, role: null, msgs: [], loaded: false, info: false });
S.rooms = freshRooms();
const pcache = {}; // профили авторов сообщений

const RoomsDB = (() => {
  const c = Auth.client;
  const ROOM = "id,kind,name,about,color,owner,emoji,cover_url,rules,is_public,invite_code,room_members(count)";
  const cnt = (r) => (r.room_members && r.room_members[0] ? r.room_members[0].count : 0);

  async function lists(uid) {
    const a = await c.from("room_members").select(`role,rooms(${ROOM})`).eq("user_id", uid);
    if (a.error) return { error: DB.say(a.error), mine: [], found: [] };
    const mine = (a.data || []).filter((x) => x.rooms).map((x) => ({ ...x.rooms, role: x.role, n: cnt(x.rooms) }));
    const b = await c.from("rooms").select(ROOM).eq("is_public", true).order("created_at", { ascending: false }).limit(30);
    const ids = new Set(mine.map((r) => r.id));
    const found = (b.data || []).filter((r) => !ids.has(r.id)).map((r) => ({ ...r, n: cnt(r) }));
    return { error: "", mine, found };
  }
  async function create(kind, name, about, color, extra) {
    const { data, error } = await c.from("rooms").insert({ kind, name, about, color, ...(extra || {}) }).select().maybeSingle();
    if (error || !data) return { error: DB.say(error) || "Не получилось." };
    const m = await c.from("room_members").insert({ room_id: data.id, role: "owner" });
    return { room: data, error: DB.say(m.error) };
  }
  async function join(id) { return DB.say((await c.from("room_members").insert({ room_id: id, role: "member" })).error); }
  async function leave(id, uid) { return DB.say((await c.from("room_members").delete().eq("room_id", id).eq("user_id", uid)).error); }
  async function role(id, uid) {
    const { data } = await c.from("room_members").select("role").eq("room_id", id).eq("user_id", uid).maybeSingle();
    return data ? data.role : null;
  }
  async function messages(id) {
    const { data, error } = await c.from("room_messages")
      .select("id,room_id,sender,body,track_id,start_sec,photo_url,voice_url,voice_dur,created_at,profiles!room_messages_sender_fkey(username,display_name,avatar_url)")
      .eq("room_id", id).order("created_at", { ascending: true }).limit(200);
    return { data: data || [], error: DB.say(error) };
  }
  async function send(room_id, body, track_id, start_sec, photo_url, voice) {
    const row = { room_id, body: (body || "").slice(0, 2000) };
    if (track_id) { row.track_id = track_id; row.start_sec = start_sec; }
    if (photo_url) row.photo_url = photo_url;
    if (voice) { row.voice_url = voice.url; row.voice_dur = voice.dur; }
    const { data, error } = await c.from("room_messages").insert(row).select("*").maybeSingle();
    return { msg: data, error: DB.say(error) };
  }
  async function update(id, fields) { return DB.say((await c.from("rooms").update(fields).eq("id", id)).error); }
  async function deleteRoom(id) { return DB.say((await c.from("rooms").delete().eq("id", id)).error); }
  let ch = null;
  function watch(id, cb) {
    unwatch();
    ch = c.channel("room-" + id).on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: "room_id=eq." + id }, (p) => cb(p.new)).subscribe();
  }
  function unwatch() { if (ch) c.removeChannel(ch); ch = null; }
  async function preview(code) {
    const { data, error } = await c.rpc("preview_room", { code });
    return error || !data || !data[0] ? null : data[0];
  }
  async function joinByCode(code) {
    const { data, error } = await c.rpc("join_room_by_code", { code });
    return error ? { error: DB.say(error) } : { id: data };
  }
  async function resetCode(id) {
    const code = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).replace(/[^a-z0-9]/gi, "").slice(0, 12);
    const { error } = await c.from("rooms").update({ invite_code: code }).eq("id", id);
    return error ? { error: DB.say(error) } : { code };
  }
  return { lists, create, update, join, leave, role, messages, send, deleteRoom, watch, unwatch, preview, joinByCode, resetCode };
})();

// ---------- Экран ----------
const KIND = { group: "Группа", channel: "Канал" };
const roomIcon = (r, size = 48) => `<span class="roomic" style="width:${size}px;height:${size}px;background:${bannerBg(r.color)};font-size:${Math.round(size * 0.46)}px">${r.emoji && ICO[r.emoji] ? ico(r.emoji, Math.round(size * 0.52)) : r.emoji ? esc(r.emoji) : esc((r.name || "?").trim()[0] || "?").toUpperCase()}</span>`;
const canPostHere = () => S.rooms.cur && S.rooms.role && (S.rooms.cur.kind === "group" || ["owner", "admin"].includes(S.rooms.role));

function roomMsg(m) {
  const mineMsg = m.sender === me(), who = m.profiles || pcache[m.sender] || { username: "…", display_name: "…" };
  const t = m.track_id ? track(m.track_id) : null;
  const chan = S.rooms.cur.kind === "channel";
  const head = !mineMsg || chan ? `<button class="rname" data-profile="${m.sender}">${esc(who.display_name || who.username)}</button>` : "";
  return `<div class="bubble ${mineMsg && !chan ? "me" : ""} ${chan ? "wide" : ""}">${head}
    ${m.photo_url ? `<img class="photo" src="${esc(m.photo_url)}" alt="Фото" loading="lazy">` : ""}
    ${m.body ? `<div>${esc(m.body)}</div>` : ""}${m.voice_url ? voiceBtn(m) : ""}${t ? momentBtn(t, m.start_sec || 0, m.photo_url ? "Саундтрек" : "Момент") : ""}</div>`;
}

const iconPicker = (cur) =>
  `<label><input type="radio" name="emoji" value="" ${!cur ? "checked" : ""} hidden><span class="ipick">Аа</span></label>` +
  ROOM_ICONS.map((k) => `<label><input type="radio" name="emoji" value="${k}" ${cur === k ? "checked" : ""} hidden><span class="ipick">${ico(k, 22)}</span></label>`).join("");

function roomInfo(r, owner) {
  return `<div class="roominfo">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="">` : ""}<div class="ri-in"><b>${esc(r.name)}</b><p>${esc(r.about || "Описания пока нет.")}</p>
    ${r.rules ? `<div class="muted small"><b>Правила</b><br>${esc(r.rules)}</div>` : ""}
    ${r.is_public === false && r.invite_code ? `<div class="invite"><b class="small">Ссылка-приглашение</b><input readonly id="inviteLink" value="${esc(inviteLink(r.invite_code))}"><div class="row wrap"><button class="btn-s sm" data-copyinvite="1">Скопировать</button>${owner ? `<button class="btn-s sm" data-resetinvite="1">Сбросить ссылку</button>` : ""}</div></div>` : ""}
    ${owner ? `<button class="btn-s sm" data-delroom="${r.id}">Удалить сообщество</button>` : ""}</div></div>`;
}

function viewRooms() {
  const R = S.rooms;
  if (!S.auth.user) return `<header class="top"><h1 class="h1">Сообщества</h1></header><div class="empty"><b>Чтобы вступать в группы и каналы, войдите.</b></div>` + authCard().replace(/<header[\s\S]*?<\/header>/, "");
  if (R.cur) {
    const r = R.cur, joined = !!R.role, owner = R.role === "owner";
    const foot = canPostHere()
      ? `<form class="compose empty" id="roomCompose"><button type="button" class="send ghost" data-roommoment="1" aria-label="Отправить момент">${ICON.note}</button>
          <label class="send ghost" aria-label="Фото">${ICON.camera}<input type="file" id="roomPhoto" accept="image/*" hidden></label>
          <input name="text" placeholder="${r.kind === "channel" ? "Новый пост в канале…" : "Сообщение…"}" autocomplete="off" maxlength="2000"><button class="send sendb" aria-label="Отправить">${ICON.send}</button><button type="button" class="send micb" aria-label="Голосовое: удерживайте">${ICON.mic}</button></form>`
      : `<div class="roomfoot">${joined ? "В этом канале пишут только админы" : `<button class="btn-a" data-join="${r.id}">${r.kind === "channel" ? "Подписаться" : "Вступить"}</button>`}</div>`;
    return `<div class="card chat"><div class="chat-head"><button class="x" data-roomback="1" aria-label="Назад">${ICON.back}</button>${roomIcon(r, 38)}
      <div class="grow"><b>${esc(r.name)}</b><div class="muted small">${r.is_public === false ? ico("lock", 13) + " Закрытый · " : ""}${KIND[r.kind]} · ${r.n || 0} уч.${r.about ? " · " + esc(r.about.slice(0, 40)) : ""}</div></div>
      ${joined && r.kind === "group" ? `<button class="x tg" data-together="1" aria-label="Слушать вместе" title="Слушать вместе">${ico("headphones", 20)}</button>` : ""}<button class="x" data-roominfo="1" aria-label="О сообществе">${ico("info", 20)}</button>${owner ? `<button class="x" data-roomedit="1" aria-label="Настроить">${ico("settings", 20)}</button>` : ""}${joined && !owner ? `<button class="btn-s sm" data-leave="${r.id}">Выйти</button>` : ""}</div>
      ${togetherBar()}${R.info ? roomInfo(r, owner) : ""}
      <div class="msgs" id="msgs">${R.err === "setup" ? setupNotice() : R.msgs.length ? R.msgs.map(roomMsg).join("") : `<div class="empty">${canPostHere() ? "Пока пусто. Напиши первым" : "Здесь пока нет записей."}</div>`}</div>${foot}</div>`;
  }
  const card = (r) => `<button class="card person" data-room="${r.id}">${roomIcon(r)}<div class="grow"><b>${esc(r.name)}</b><div class="muted small">${r.is_public === false ? ico("lock", 13) + " Закрытый · " : ""}${KIND[r.kind]} · ${r.n || 0} уч.${r.about ? " · " + esc(r.about.slice(0, 36)) : ""}</div></div></button>`;
  return `<header class="top row"><h1 class="h1 grow">Сообщества</h1><button class="btn-s sm" data-joincode="1">${ico("lock", 16)} По коду</button><button class="btn-a sm" data-newroom="1">${ICON.plus} Создать</button></header>
    ${R.err === "setup" ? setupNotice() : ""}
    ${R.mine.length ? `<h3 class="sec">Мои</h3>${R.mine.map(card).join("")}` : ""}
    <h3 class="sec">Найти</h3>${R.found.length ? R.found.map(card).join("") : `<div class="empty">${R.loaded ? "Пока нет открытых сообществ. Создай первое!" : "Загружаем…"}</div>`}`;
}

async function loadRooms() {
  const r = await RoomsDB.lists(me());
  S.rooms.mine = r.mine; S.rooms.found = r.found; S.rooms.err = r.error; S.rooms.loaded = true;
  if (S.view === "rooms" && !S.rooms.cur) render(true);
}

async function openRoom(id) {
  const R = S.rooms, r = [...R.mine, ...R.found].find((x) => x.id === id);
  if (!r) return;
  R.cur = r; R.msgs = []; R.role = r.role || null; R.err = ""; R.info = false;
  render();
  const [role, msgs] = await Promise.all([RoomsDB.role(id, me()), RoomsDB.messages(id)]);
  if (!R.cur || R.cur.id !== id) return;
  R.role = role; R.msgs = msgs.data; R.err = msgs.error;
  RoomsDB.watch(id, onRoomMsg);
  if (typeof Together !== "undefined") Together.join(id);
  render(true);
}

function onRoomMsg(m) {
  const R = S.rooms;
  if (!R.cur || R.cur.id !== m.room_id || R.msgs.some((x) => x.id === m.id)) return;
  R.msgs.push(m);
  if (S.view === "rooms") render(true);
}

function closeRoom() { RoomsDB.unwatch(); if (typeof Together !== "undefined") Together.leave(); S.rooms.cur = null; loadRooms(); render(); }

// ---------- Создание ----------
function openRoomForm() {
  const m = $("#modal"); m.hidden = false; document.body.classList.add("noscroll");
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Новое сообщество</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="roomForm" class="form">
      <div class="seg"><label><input type="radio" name="kind" value="group" checked hidden><span>${ico("people", 22)} Группа<small>пишут все</small></span></label><label><input type="radio" name="kind" value="channel" hidden><span>${ico("megaphone", 22)} Канал<small>пишет только админ</small></span></label></div>
      <div class="seg"><label><input type="radio" name="vis" value="public" checked hidden><span>${ico("people", 22)} Открытое<small>видно всем в поиске</small></span></label><label><input type="radio" name="vis" value="private" hidden><span>${ico("lock", 22)} Закрытое<small>вход по ссылке</small></span></label></div>
      <label class="field">Название<input name="name" maxlength="40" required placeholder="Например: Лоу-фай по вечерам"></label>
      <label class="field">Описание<input name="about" maxlength="120" placeholder="О чём это сообщество"></label>
      <div class="field">Значок<div class="swatches">${iconPicker("")}</div></div>
      <div class="field">Цвет<div class="swatches">${BANNERS.map((_, i) => `<label><input type="radio" name="color" value="${i}" ${i === 0 ? "checked" : ""} hidden><i style="background:${bannerBg(i)}"></i></label>`).join("")}</div></div>
      <button class="btn-a">Создать</button></form></div>`;
}

function openRoomEdit() {
  const r = S.rooms.cur;
  const m = $("#modal"); m.hidden = false; document.body.classList.add("noscroll");
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Настройки</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="roomEditForm" class="form">
      <div class="seg"><label><input type="radio" name="vis" value="public" ${r.is_public !== false ? "checked" : ""} hidden><span>${ico("people", 22)} Открытое<small>видно всем в поиске</small></span></label><label><input type="radio" name="vis" value="private" ${r.is_public === false ? "checked" : ""} hidden><span>${ico("lock", 22)} Закрытое<small>вход по ссылке</small></span></label></div>
      <label class="field">Название<input name="name" maxlength="40" required value="${esc(r.name)}"></label>
      <label class="field">Описание<input name="about" maxlength="120" value="${esc(r.about || "")}"></label>
      <label class="field">Правила<textarea name="rules" maxlength="400" placeholder="Например: без спама, только музыка">${esc(r.rules || "")}</textarea></label>
      <div class="field">Значок<div class="swatches">${iconPicker(r.emoji || "")}</div></div>
      <div class="field">Цвет<div class="swatches">${BANNERS.map((_, i) => `<label><input type="radio" name="color" value="${i}" ${(r.color || 0) === i ? "checked" : ""} hidden><i style="background:${bannerBg(i)}"></i></label>`).join("")}</div></div>
      <label class="pick small"><input type="file" id="roomCover" accept="image/*" hidden><span id="rcTxt">${ICON.camera}<b>${r.cover_url ? "Сменить обложку" : "Обложка"}</b><small>необязательно</small></span><img id="rcPrev" alt="" hidden></label>
      <div class="alert" id="roomErr" hidden></div>
      <button class="btn-a" id="roomGo">Сохранить</button></form></div>`;
}

// ---------- События ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-copyinvite],[data-resetinvite],[data-joincode],[data-confirmjoin],[data-room],[data-newroom],[data-roomback],[data-join],[data-leave],[data-roommoment],[data-delroom],[data-roominfo],[data-roomedit]");
  if (!el) return;
  const d = el.dataset, R = S.rooms;
  if (d.copyinvite !== undefined) {
    const link = inviteLink(R.cur.invite_code);
    try { await navigator.clipboard.writeText(link); toast("Ссылка скопирована"); } catch (x) { const i = $("#inviteLink"); if (i) { i.select(); } toast("Скопируйте ссылку из поля"); }
    return;
  }
  if (d.resetinvite !== undefined) {
    if (!confirm("Старая ссылка перестанет работать. Сбросить?")) return;
    const r = await RoomsDB.resetCode(R.cur.id);
    if (r.error) return toast("Не получилось");
    R.cur.invite_code = r.code; toast("Новая ссылка готова"); return render(true);
  }
  if (d.joincode !== undefined) return openJoinCode();
  if (d.confirmjoin) return confirmJoin(d.confirmjoin);
  if (d.room) return openRoom(+d.room);
  if (d.newroom) return openRoomForm();
  if (d.roominfo) { R.info = !R.info; return render(true); }
  if (d.roomedit) return openRoomEdit();
  if (d.roomback) return closeRoom();
  if (d.join) {
    const err = await RoomsDB.join(+d.join);
    if (err) return toast("Не получилось вступить");
    R.role = "member"; if (R.cur) R.cur.n = (R.cur.n || 0) + 1; toast("Готово"); return render(true);
  }
  if (d.leave) {
    if (!confirm("Выйти из сообщества?")) return;
    const err = await RoomsDB.leave(+d.leave, me());
    if (err) return toast("Не получилось");
    return closeRoom();
  }
  if (d.delroom) {
    if (!confirm("Удалить сообщество и все сообщения? Это нельзя отменить.")) return;
    const err = await RoomsDB.deleteRoom(+d.delroom);
    if (err) return toast("Не получилось удалить");
    return closeRoom();
  }
  if (d.roommoment) {
    if (!S.nowId) return toast("Сначала включи трек и выбери момент");
    const r = await RoomsDB.send(R.cur.id, "", S.nowId, S.mstart);
    if (r.error || !r.msg) return toast("Не отправилось");
    onRoomMsg({ ...r.msg, profiles: S.auth.profile });
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "roomCover" && e.target.files[0]) { const pr = $("#rcPrev"); pr.src = URL.createObjectURL(e.target.files[0]); pr.hidden = false; $("#rcTxt").hidden = true; return; }
  if (e.target.id !== "roomPhoto" || !e.target.files[0]) return;
  const f = e.target.files[0], text = ($("#roomCompose input[name=text]") || {}).value || "";
  toast("Отправляем фото…");
  const up = await Media.upload(await Media.shrink(f, 1280, false), me());
  if (up.error) return toast(up.error === "setup" ? "Нужен SQL из шага 5" : up.error);
  const r = await RoomsDB.send(S.rooms.cur.id, text.trim(), null, null, up.url);
  if (r.error || !r.msg) return toast("Не отправилось");
  onRoomMsg({ ...r.msg, profiles: S.auth.profile });
});

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id === "roomCompose") {
    e.preventDefault(); e.stopImmediatePropagation();
    const text = f.text.value.trim();
    if (!text) return;
    const r = await RoomsDB.send(S.rooms.cur.id, text);
    if (r.error || !r.msg) return toast("Не отправилось");
    onRoomMsg({ ...r.msg, profiles: S.auth.profile });
    const i = $("#roomCompose input[name=text]"); if (i) i.focus();
  }
  if (f.id === "roomEditForm") {
    e.preventDefault(); e.stopImmediatePropagation();
    const btn = $("#roomGo"), er = $("#roomErr"), r = S.rooms.cur, v = Object.fromEntries(new FormData(f));
    const fail = (msg) => { btn.disabled = false; btn.textContent = "Сохранить"; er.hidden = false; er.textContent = msg; };
    btn.disabled = true; btn.textContent = "Сохраняем…"; er.hidden = true;
    try {
      const fields = { name: v.name.trim(), about: (v.about || "").trim(), rules: (v.rules || "").trim(), emoji: (v.emoji || "").trim(), color: +v.color, is_public: v.vis !== "private" };
      const file = $("#roomCover").files[0];
      if (file) {
        const up = await Media.upload(await Media.shrink(file, 1280, false), me());
        if (up.error) return fail(up.error);
        fields.cover_url = up.url;
      }
      const err = await RoomsDB.update(r.id, fields);
      if (err) return fail(err === "setup" ? "Нужен SQL шага 6 (step6.sql)." : "Не сохранилось.");
      Object.assign(r, fields);
    } catch (x) { console.error(x); return fail("Ошибка: " + String(x.message || x).slice(0, 100)); }
    closeModal(); toast("Сохранено"); render(true); return;
  }
  if (f.id === "roomForm") {
    e.preventDefault(); e.stopImmediatePropagation();
    const v = Object.fromEntries(new FormData(f));
    const r = await RoomsDB.create(v.kind, v.name.trim(), (v.about || "").trim(), +v.color, { emoji: (v.emoji || "").trim(), is_public: v.vis !== "private" });
    if (r.error) return toast(r.error === "setup" ? "Нужен SQL из шага 5" : r.error);
    closeModal(); toast("Создано");
    await loadRooms(); openRoom(r.room.id);
  }
}, true);


// ---------- Вход по приглашению ----------
const inviteLink = (code) => location.origin + location.pathname + "#join=" + code;
const codeFrom = (t) => { const m = String(t || "").match(/join=([a-z0-9]+)/i); return (m ? m[1] : String(t || "").trim()).replace(/[^a-z0-9]/gi, ""); };

S.pendingInvite = codeFrom((location.hash.match(/join=[a-z0-9]+/i) || [""])[0]) || null;

function openJoinCode() {
  const m = $("#modal"); m.hidden = false; document.body.classList.add("noscroll");
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Вступить по приглашению</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="joinForm" class="form"><label class="field">Ссылка или код приглашения<input name="code" required placeholder="Вставьте ссылку сюда" autocomplete="off"></label><button class="btn-a">Далее</button></form></div>`;
}

async function openJoinModal(code) {
  const m = $("#modal"); m.hidden = false; document.body.classList.add("noscroll");
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Приглашение</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div><div class="muted">Проверяем ссылку…</div></div>`;
  const r = await RoomsDB.preview(code);
  if (!$("#modal").innerHTML) return;
  const body = !r
    ? `<div class="alert">Приглашение недействительно или ссылку сбросили.</div>`
    : `<div class="row">${roomIcon(r, 56)}<div class="grow"><div class="title">${esc(r.name)}</div><div class="muted small">${KIND[r.kind]} · ${r.members} уч.</div></div></div>
       ${r.about ? `<p class="muted">${esc(r.about)}</p>` : ""}<button class="btn-a" data-confirmjoin="${esc(code)}">${r.kind === "channel" ? "Подписаться" : "Вступить"}</button>`;
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Приглашение</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>${body}</div>`;
}

async function confirmJoin(code) {
  const r = await RoomsDB.joinByCode(code);
  if (r.error) return toast(r.error === "setup" ? "Нужен SQL шага 9" : "Не получилось вступить");
  closeModal(); history.replaceState(null, "", location.pathname + location.search);
  S.view = "rooms"; await loadRooms(); toast("Вы вступили");
  if ([...S.rooms.mine, ...S.rooms.found].some((x) => x.id === r.id)) openRoom(r.id); else render();
}

document.addEventListener("submit", (e) => {
  if (e.target.id !== "joinForm") return;
  e.preventDefault(); e.stopImmediatePropagation();
  const code = codeFrom(e.target.code.value);
  if (code) openJoinModal(code);
}, true);

/* ===== together.js ===== */
// ============================================================
// «Слушать вместе»: один включает трек, у остальных он играет синхронно.
// Работает через живой канал Supabase (ничего не хранится в базе).
// ============================================================
S.together = { live: null, follow: false, host: false };

const Together = (() => {
  const c = Auth.client;
  let ch = null, quiet = 0;

  function join(roomId) {
    leave();
    if (!c) return;
    ch = c.channel("listen-" + roomId, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "sync" }, ({ payload }) => onSync(payload))
      .subscribe();
  }

  function leave() {
    if (ch && c) c.removeChannel(ch);
    ch = null;
    S.together = { live: null, follow: false, host: false };
  }

  function send() {
    if (!ch || !S.together.host || !track(S.nowId)) return;
    const p = S.auth.profile || {};
    ch.send({ type: "broadcast", event: "sync", payload: { by: me(), name: p.display_name || p.username || "Кто-то", trackId: S.nowId, pos: au.currentTime, playing: S.playing } });
  }

  function onSync(p) {
    if (!p || p.by === me()) return;
    S.together.live = { ...p, got: Date.now() };
    if (S.together.follow) apply();
    refresh();
  }

  function apply() {
    const L = S.together.live;
    if (!L) return;
    if (!track(L.trackId)) return toast("Этого трека нет у вас. Обновите страницу.");
    const target = L.pos + (L.playing ? (Date.now() - L.got) / 1000 : 0);
    if (L.trackId !== S.nowId) {
      quiet = Date.now() + 4000;
      startPlayback(L.trackId, target, null, L.trackId);
      if (!L.playing) au.addEventListener("loadedmetadata", () => au.pause(), { once: true });
      return;
    }
    quiet = Date.now() + 1000;
    if (L.playing) {
      if (au.paused) au.play().catch(() => {});
      if (Math.abs(au.currentTime - target) > 1.5) au.currentTime = target;
    } else {
      if (!au.paused) au.pause();
      if (Math.abs(au.currentTime - target) > 1.5) au.currentTime = target;
    }
  }

  // Вызывается при play / pause / перемотке на этом устройстве
  function onLocal() {
    if (S.together.host) return send();
    if (S.together.follow && Date.now() > quiet) { S.together.follow = false; refresh(); }
  }

  function startHost() {
    if (!S.nowId) return toast("Сначала включи трек в разделе «Треки»");
    S.together.host = true; S.together.follow = false;
    send(); refresh(); toast("Теперь все в группе могут слушать вместе с тобой");
  }
  function stopHost() { S.together.host = false; refresh(); }
  function follow() { S.together.follow = true; apply(); refresh(); }
  function unfollow() { S.together.follow = false; refresh(); }

  function inner() {
    const T = S.together, L = T.live, fresh = L && Date.now() - L.got < 15000;
    if (T.host) return `<div class="tbar on">${ico("headphones", 18)} <span class="grow">Вы ведёте: <b>${esc((track(S.nowId) || {}).title || "")}</b></span><button class="btn-s sm" data-tstop="1">Остановить</button></div>`;
    if (!fresh) return "";
    const t = track(L.trackId), name = esc(L.name), title = esc(t ? t.title : "трек");
    if (T.follow) return `<div class="tbar on">${ico("headphones", 18)} <span class="grow">Слушаете вместе с <b>${name}</b>: «${title}»</span><button class="btn-s sm" data-tleave="1">Выйти</button></div>`;
    return `<div class="tbar">${ico("headphones", 18)} <span class="grow"><b>${name}</b> слушает «${title}»</span><button class="btn-a sm" data-tjoin="1">Присоединиться</button></div>`;
  }

  function refresh() { const el = $("#tbar"); if (el) el.innerHTML = inner(); }
  setInterval(() => { if (S.together.host && S.playing) send(); refresh(); }, 4000);

  return { join, leave, onLocal, startHost, stopHost, follow, unfollow, inner };
})();

const togetherBar = () => `<div id="tbar">${Together.inner()}</div>`;

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-together],[data-tjoin],[data-tleave],[data-tstop]");
  if (!el) return;
  const d = el.dataset;
  if (d.together !== undefined) return S.together.host ? Together.stopHost() : Together.startHost();
  if (d.tjoin) return Together.follow();
  if (d.tleave) return Together.unfollow();
  if (d.tstop) return Together.stopHost();
});

["play", "pause", "seeked"].forEach((ev) => au.addEventListener(ev, () => Together.onLocal()));

/* ===== fx.js ===== */
// ============================================================
// Звук: громкость, эквалайзер, повтор и случайный порядок.
// ============================================================
S.shuffle = false;
S.repeat = 0; // 0 = выкл, 1 = весь список, 2 = один трек
S.eqOpen = false;

const FX = (() => {
  const BANDS = [[60, "60 Гц"], [230, "230 Гц"], [910, "1 кГц"], [3600, "4 кГц"], [14000, "14 кГц"]];
  const PRESETS = [["Плоский", [0, 0, 0, 0, 0]], ["Бас", [8, 5, 0, -1, 0]], ["Вокал", [-2, 0, 4, 3, 0]], ["Яркий", [-1, 0, 1, 5, 7]], ["Ночь", [3, 2, -1, -3, -5]]];
  let st = { vol: 1, eq: [0, 0, 0, 0, 0] };
  try {
    const j = JSON.parse(localStorage.getItem("drop-fx") || "null");
    if (j && Array.isArray(j.eq) && j.eq.length === 5) st = { vol: typeof j.vol === "number" ? clamp(j.vol, 0, 1) : 1, eq: j.eq.map((x) => clamp(Number(x) || 0, -12, 12)) };
  } catch (e) {}
  let ctx = null, gain = null, filters = [], failed = false;
  const save = () => { try { localStorage.setItem("drop-fx", JSON.stringify(st)); } catch (e) {} };

  // Подключаем эквалайзер к плееру (один раз, после первого нажатия)
  function init() {
    if (ctx || failed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      let prev = ctx.createMediaElementSource(au);
      filters = BANDS.map(([f], i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? "lowshelf" : i === BANDS.length - 1 ? "highshelf" : "peaking";
        b.frequency.value = f; b.Q.value = 1; b.gain.value = st.eq[i];
        prev.connect(b); prev = b;
        return b;
      });
      gain = ctx.createGain();
      gain.gain.value = st.vol;
      prev.connect(gain); gain.connect(ctx.destination);
      au.volume = 1;
    } catch (e) {
      console.error(e); ctx = null; failed = true; au.volume = st.vol;
    }
  }
  function resume() { if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); }
  function setVol(v) { st.vol = clamp(v, 0, 1); if (gain) gain.gain.value = st.vol; else au.volume = st.vol; save(); }
  function setBand(i, db) { st.eq[i] = clamp(db, -12, 12); if (filters[i]) filters[i].gain.value = st.eq[i]; save(); }
  function setAll(arr) { arr.forEach((v, i) => setBand(i, v)); }

  function next() {
    if (S.repeat === 2) { au.currentTime = 0; au.play().catch(() => {}); return; }
    const L = trackList(), i = L.findIndex((t) => t.id === S.nowId);
    if (S.shuffle && L.length > 1) {
      let n; do { n = L[Math.floor(Math.random() * L.length)]; } while (n.id === S.nowId);
      return playTrack(n.id);
    }
    if (i === L.length - 1 && S.repeat === 0) return;
    step(1);
  }

  return { init, resume, setVol, setBand, setAll, next, BANDS, PRESETS, vol: () => st.vol, eq: () => st.eq.slice() };
})();

const dbText = (v) => (v > 0 ? "+" : "") + v + " дБ";

// Блок «Звук» в большом плеере
function soundPanel() {
  const eq = FX.eq(), vol = Math.round(FX.vol() * 100);
  return `<div class="card spanel">
    <div class="row"><span id="volIc">${vol ? ico("volume", 22) : ico("mute", 22)}</span><input type="range" id="volRange" min="0" max="100" value="${vol}" aria-label="Громкость"><b class="small" id="volVal">${vol}%</b></div>
    <button class="btn-s sm eqtoggle" data-eqtoggle="1">${ico("eq", 18)} Эквалайзер</button>
    <div class="eq" id="eqBox" ${S.eqOpen ? "" : "hidden"}>
      <div class="chips">${FX.PRESETS.map(([n], i) => `<button type="button" class="chip" data-eqpreset="${i}">${n}</button>`).join("")}</div>
      ${FX.BANDS.map(([, l], i) => `<label class="eqrow"><span>${l}</span><input type="range" min="-12" max="12" step="1" value="${eq[i]}" data-eqband="${i}" aria-label="${l}"><b id="eqv${i}">${dbText(eq[i])}</b></label>`).join("")}
    </div></div>`;
}

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "volRange") {
    FX.setVol(+t.value / 100);
    $("#volVal").textContent = t.value + "%";
    $("#volIc").innerHTML = +t.value ? ico("volume", 22) : ico("mute", 22);
  }
  if (t.dataset && t.dataset.eqband !== undefined) {
    const i = +t.dataset.eqband;
    FX.setBand(i, +t.value);
    $("#eqv" + i).textContent = dbText(+t.value);
  }
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-eqtoggle],[data-eqpreset],[data-shuffle],[data-repeat]");
  if (!el) return;
  const d = el.dataset;
  if (d.eqtoggle) { S.eqOpen = !S.eqOpen; $("#eqBox").hidden = !S.eqOpen; return; }
  if (d.eqpreset !== undefined) {
    const arr = FX.PRESETS[+d.eqpreset][1];
    FX.setAll(arr);
    $$("[data-eqband]").forEach((r, i) => { r.value = arr[i]; $("#eqv" + i).textContent = dbText(arr[i]); });
    return;
  }
  if (d.shuffle) { S.shuffle = !S.shuffle; el.classList.toggle("on", S.shuffle); return; }
  if (d.repeat) {
    S.repeat = (S.repeat + 1) % 3;
    el.classList.toggle("on", S.repeat > 0);
    el.innerHTML = S.repeat === 2 ? ICON.repeat1 : ICON.repeat;
  }
});

/* ===== voice.js ===== */
// ============================================================
// Голосовые сообщения: держишь кнопку микрофона и говоришь,
// отпускаешь, и сообщение отправлено. Сдвинь палец влево, чтобы отменить.
// ============================================================
const vau = new Audio(); // отдельный плеер для голосовых
let vurl = null;

function voiceBtn(m) {
  const hs = waveHeights(String(m.voice_url).slice(-10), 26);
  return `<button class="voice" data-voice="${esc(m.voice_url)}" data-vd="${m.voice_dur || 0}"><span class="vplay">${ICON.play}${ICON.pause}</span><span class="vwave">${hs.map((h) => `<b style="height:${h}%"></b>`).join("")}</span><span class="vtime">${fmt(m.voice_dur || 0)}</span></button>`;
}

function voiceSync() {
  $$("[data-voice]").forEach((b) => {
    const on = b.dataset.voice === vurl, dur = +b.dataset.vd || vau.duration || 0;
    b.classList.toggle("playing", on && !vau.paused);
    const bars = $$(".vwave b", b), pct = on && dur ? clamp(vau.currentTime / dur, 0, 1) : 0;
    bars.forEach((x, i) => x.classList.toggle("done", on && i / bars.length < pct));
    const t = $(".vtime", b);
    if (t) t.textContent = fmt(on && !vau.paused ? vau.currentTime : dur);
  });
}
["timeupdate", "play", "pause", "ended"].forEach((ev) => vau.addEventListener(ev, voiceSync));
au.addEventListener("play", () => { if (!vau.paused) vau.pause(); });

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-voice]");
  if (!b) return;
  const url = b.dataset.voice;
  if (vurl === url && !vau.paused) return vau.pause();
  if (!au.paused) au.pause();
  if (vurl !== url) { vurl = url; vau.src = url; }
  vau.play().catch(() => toast("Не удалось воспроизвести голосовое"));
});

// ---------- Запись ----------
let R = null;

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function recUi(on, form, btn) {
  if (on) {
    form.classList.add("recording");
    btn.classList.add("rec");
    const bar = document.createElement("div");
    bar.className = "recbar";
    bar.innerHTML = `<i class="dot"></i><b id="recT">0:00</b><span class="small" id="recHint">‹ сдвиньте влево для отмены</span>`;
    form.appendChild(bar);
  } else {
    form.classList.remove("recording");
    btn.classList.remove("rec");
    const bar = $(".recbar", form);
    if (bar) bar.remove();
  }
}

function cleanup(my) {
  clearInterval(my.timer);
  if (my.stream) my.stream.getTracks().forEach((t) => t.stop());
  recUi(false, my.form, my.btn);
  if (R === my) R = null;
}

document.addEventListener("contextmenu", (e) => { if (e.target.closest(".micb")) e.preventDefault(); });

document.addEventListener("pointerdown", async (e) => {
  const btn = e.target.closest(".micb");
  if (!btn || R) return;
  e.preventDefault();
  if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast("Запись голоса не поддерживается в этом браузере");
  const my = (R = { form: btn.closest("form"), btn, startX: e.clientX, id: e.pointerId, held: true, cancel: false, chunks: [], discard: false });
  try { btn.setPointerCapture(e.pointerId); } catch (x) {}
  recUi(true, my.form, btn);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (x) { cleanup(my); return toast("Нет доступа к микрофону. Разрешите его в настройках браузера."); }
  if (R !== my || !my.held) { stream.getTracks().forEach((t) => t.stop()); cleanup(my); return; }
  my.stream = stream;
  const mime = pickMime();
  my.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  my.mime = (my.rec.mimeType || mime || "audio/webm").split(";")[0];
  my.rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) my.chunks.push(ev.data); };
  my.rec.onstop = () => finishRec(my);
  my.rec.start();
  my.t0 = Date.now();
  my.timer = setInterval(() => {
    const sec = (Date.now() - my.t0) / 1000, t = $("#recT");
    if (t) t.textContent = fmt(sec);
    if (sec >= 120 && my.rec.state === "recording") my.rec.stop();
  }, 200);
});

document.addEventListener("pointermove", (e) => {
  if (!R || e.pointerId !== R.id) return;
  R.cancel = e.clientX - R.startX < -90;
  const bar = $(".recbar", R.form), h = $("#recHint");
  if (bar) bar.classList.toggle("cancel", R.cancel);
  if (h) h.textContent = R.cancel ? "отпустите, чтобы отменить" : "‹ сдвиньте влево для отмены";
});

function endHold(e) {
  if (!R || e.pointerId !== R.id) return;
  const my = R;
  my.held = false;
  if (!my.rec) return; // микрофон ещё не открылся: запись отменится сама
  const short = Date.now() - my.t0 < 800;
  my.discard = my.cancel || short || e.type === "pointercancel";
  if (short && !my.cancel) toast("Удерживайте кнопку, чтобы записать");
  if (my.rec.state === "recording") my.rec.stop(); else cleanup(my);
}
document.addEventListener("pointerup", endHold);
document.addEventListener("pointercancel", endHold);

async function finishRec(my) {
  const sec = Math.max(1, Math.round((Date.now() - my.t0) / 1000)), form = my.form;
  cleanup(my);
  if (my.discard || !my.chunks.length) return;
  const blob = new Blob(my.chunks, { type: my.mime });
  const ext = my.mime.includes("mp4") ? "m4a" : my.mime.includes("ogg") ? "ogg" : "webm";
  const path = `${me()}/${Date.now()}.${ext}`;
  toast("Отправляем голосовое…");
  const up = await Auth.client.storage.from("voice").upload(path, blob, { contentType: my.mime });
  if (up.error) { console.error(up.error); return toast("Голосовое не загрузилось"); }
  const voice = { url: Auth.client.storage.from("voice").getPublicUrl(path).data.publicUrl, dur: sec };
  if (form.id === "compose" && S.chat.peer) {
    const r = await DB.send(S.chat.peer.id, "", null, null, voice);
    if (r.error || !r.msg) return toast(r.error === "setup" ? "Нужен SQL шага 7" : "Не отправилось");
    S.chat.msgs.push(r.msg); if (S.view === "chats") render(true);
  } else if (form.id === "roomCompose" && S.rooms.cur) {
    const r = await RoomsDB.send(S.rooms.cur.id, "", null, null, null, voice);
    if (r.error || !r.msg) return toast(r.error === "setup" ? "Нужен SQL шага 7" : "Не отправилось");
    onRoomMsg({ ...r.msg, profiles: S.auth.profile });
  }
}

// Пустое поле = микрофон, есть текст = «отправить» (как в Телеграме)
document.addEventListener("input", (e) => {
  const f = e.target.closest && e.target.closest(".compose");
  if (f && e.target.name === "text") f.classList.toggle("empty", !e.target.value.trim());
});

/* ===== social.js ===== */
// ============================================================
// Комментарии, чёрный список, конфиденциальность и карточка исполнителя.
// ============================================================
S.cm = { open: null, items: [], loading: false };
S.blocks = new Set();
S.blockedList = [];
S.queue = null;

const Social = (() => {
  const c = Auth.client;

  // ---------- Чёрный список ----------
  async function loadBlocks(uid) {
    if (!c) return;
    const { data } = await c.from("blocks").select("blocked").eq("blocker", uid);
    S.blocks = new Set((data || []).map((r) => r.blocked));
    if (S.moments) S.moments = S.moments.filter((m) => !S.blocks.has(m.user_id));
  }
  async function loadBlockedList() {
    if (!c || !me()) return;
    await loadBlocks(me());
    const ids = [...S.blocks];
    S.blockedList = ids.length ? (await c.from("profiles").select("id,username,display_name,avatar_url").in("id", ids)).data || [] : [];
    if (S.view === "me") render(true);
  }
  async function block(id) {
    const { error } = await c.from("blocks").insert({ blocked: id });
    if (error) return DB.say(error);
    S.blocks.add(id);
    return "";
  }
  async function unblock(id) {
    const { error } = await c.from("blocks").delete().eq("blocker", me()).eq("blocked", id);
    if (error) return DB.say(error);
    S.blocks.delete(id);
    return "";
  }

  // ---------- Комментарии ----------
  async function comments(mid) {
    const { data, error } = await c.from("comments")
      .select("id,moment_id,user_id,body,created_at,profiles!comments_user_id_fkey(username,display_name,avatar_url)")
      .eq("moment_id", mid).order("created_at", { ascending: true }).limit(100);
    return { data: data || [], error: DB.say(error) };
  }
  async function addComment(mid, body) {
    const { error } = await c.from("comments").insert({ moment_id: mid, body: body.slice(0, 500) });
    return DB.say(error);
  }
  async function delComment(id) {
    const { error } = await c.from("comments").delete().eq("id", id);
    return DB.say(error);
  }

  return { loadBlocks, loadBlockedList, block, unblock, comments, addComment, delComment };
})();

const findPost = (id) => [...(S.moments || []), ...((S.prof && S.prof.posts) || [])].find((x) => String(x.id) === String(id));
const cmCount = (m) => (m.comments && m.comments[0] ? m.comments[0].count : 0);
const setCmCount = (m, n) => { m.comments = [{ count: Math.max(0, n) }]; };

// ---------- Разметка ----------
function commentsBox(m) {
  const open = S.cm.open === m.id, n = cmCount(m);
  let h = `<button class="cmtoggle ${open ? "on" : ""}" data-cm="${m.id}">${ico("chat", 18)} Комментарии${n ? " · " + n : ""}</button>`;
  if (!open) return h;
  const items = S.cm.items.filter((x) => !S.blocks.has(x.user_id));
  const list = S.cm.loading ? `<div class="muted small">Загружаем…</div>` : items.length
    ? items.map((x) => {
        const who = x.profiles || { username: "user" };
        const can = x.user_id === me() || m.user_id === me();
        return `<div class="cm"><button data-profile="${x.user_id}">${avatar(who, 30)}</button>
          <div class="grow"><b>${esc(who.display_name || who.username)}</b> <span class="muted small">${ago(x.created_at)}</span><div class="cmtext">${esc(x.body)}</div></div>
          ${can ? `<button class="x sm" data-delcm="${x.id}" aria-label="Удалить">${ico("trash", 16)}</button>` : ""}</div>`;
      }).join("")
    : `<div class="muted small">Пока нет комментариев. Напиши первым.</div>`;
  return h + `<div class="cmbox">${list}<form class="cmform" id="cmForm" data-mid="${m.id}"><input name="text" placeholder="Написать комментарий…" maxlength="500" autocomplete="off"><button class="send" aria-label="Отправить">${ICON.send}</button></form></div>`;
}

const artistLink = (t) => (t.user_id ? `<button class="alink" data-profile="${t.user_id}">${esc(t.artist)}</button>` : esc(t.artist));

function profStats(p, posts) {
  const songs = TRACKS.filter((t) => t.user_id === p.id).length;
  return `<div class="stats"><span><b>${songs}</b> песен</span><span><b>${posts.length}</b> постов</span></div>`;
}

function artistBlock(p) {
  const songs = TRACKS.filter((t) => t.user_id === p.id);
  if (!songs.length) return "";
  return `<div class="row" style="margin-top:6px"><h3 class="sec grow">Песни</h3><button class="btn-a sm" data-playall="${p.id}">${ICON.play.replace('width="22" height="22"', 'width="16" height="16"')} Слушать всё</button></div>` +
    songs.map((t) => `<div class="card songrow" style="--c1:${t.c1};--c2:${t.c2}"><button class="cover-btn" data-open="${t.id}">${cover(t)}</button>
      <div class="grow"><b>${esc(t.title)}</b><div class="muted small">${esc(t.genre)} · ${fmt(t.dur)}</div></div>
      <button class="playbtn sm" data-playq="${t.id}" aria-label="Играть">${ICON.play}${ICON.pause}</button></div>`).join("");
}

function profileActions(p, mine) {
  if (mine) return `<div class="row" style="margin-top:14px"><button class="btn-s" data-view="me">Редактировать</button></div>`;
  const blocked = S.blocks.has(p.id);
  const dm = p.dm_policy === "none" ? `<span class="muted small">Личные сообщения закрыты</span>` : blocked ? "" : `<button class="btn-a" data-writeto="${p.id}">Написать</button>`;
  return `<div class="row wrap" style="margin-top:14px">${dm}<button class="btn-s" data-block="${p.id}">${ico("block", 18)} ${blocked ? "Разблокировать" : "Заблокировать"}</button></div>`;
}

function privacyCard(p) {
  const blocked = S.blockedList.length
    ? `<div class="field">Чёрный список${S.blockedList.map((u) => `<div class="row blk">${avatar(u, 32)}<span class="grow">${esc(u.display_name || u.username)} <span class="muted small">@${esc(u.username)}</span></span><button class="btn-s sm" data-unblock="${u.id}">Разблокировать</button></div>`).join("")}</div>`
    : `<div class="muted small">Чёрный список пуст. Заблокировать человека можно на его странице.</div>`;
  return `<section class="card form"><b>${ico("lock", 20)} Конфиденциальность</b>
    <label class="tg"><span>Показывать, что я слушаю сейчас</span><input type="checkbox" data-priv="show_now" ${p.show_now !== false ? "checked" : ""}></label>
    <label class="tg"><span>Находить меня в поиске</span><input type="checkbox" data-priv="searchable" ${p.searchable !== false ? "checked" : ""}></label>
    <label class="field">Кто может писать мне
      <select class="cap-in" data-priv="dm_policy"><option value="all" ${p.dm_policy !== "none" ? "selected" : ""}>Все</option><option value="none" ${p.dm_policy === "none" ? "selected" : ""}>Никто</option></select></label>
    ${blocked}</section>`;
}

// ---------- События ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-cm],[data-delcm],[data-block],[data-unblock],[data-playall],[data-playq]");
  if (!el) return;
  const d = el.dataset;
  if (d.cm) {
    const id = +d.cm;
    if (S.cm.open === id) { S.cm.open = null; return render(true); }
    S.cm = { open: id, items: [], loading: true };
    render(true);
    const r = await Social.comments(id);
    if (S.cm.open !== id) return;
    S.cm.items = r.data; S.cm.loading = false;
    const m = findPost(id); if (m) setCmCount(m, r.data.length);
    return render(true);
  }
  if (d.delcm) {
    if (!confirm("Удалить комментарий?")) return;
    const err = await Social.delComment(+d.delcm);
    if (err) return toast("Не получилось удалить");
    S.cm.items = S.cm.items.filter((x) => String(x.id) !== d.delcm);
    const m = findPost(S.cm.open); if (m) setCmCount(m, S.cm.items.length);
    return render(true);
  }
  if (d.block) {
    const id = d.block;
    if (S.blocks.has(id)) { const err = await Social.unblock(id); if (err) return toast("Не получилось"); toast("Разблокирован"); }
    else {
      if (!confirm("Заблокировать? Вы не увидите его посты и комментарии, а он не сможет вам писать.")) return;
      const err = await Social.block(id);
      if (err) return toast(err === "setup" ? "Нужен SQL шага 8" : "Не получилось");
      if (S.moments) S.moments = S.moments.filter((m) => m.user_id !== id);
      toast("Заблокирован");
    }
    return render(true);
  }
  if (d.unblock) {
    const err = await Social.unblock(d.unblock);
    if (err) return toast("Не получилось");
    S.blockedList = S.blockedList.filter((u) => u.id !== d.unblock);
    toast("Разблокирован"); return render(true);
  }
  if (d.playall) {
    const ids = TRACKS.filter((t) => t.user_id === d.playall).map((t) => t.id);
    if (!ids.length) return;
    S.queue = ids; return playTrack(ids[0]);
  }
  if (d.playq) {
    const t = track(d.playq);
    S.queue = t && t.user_id ? TRACKS.filter((x) => x.user_id === t.user_id).map((x) => x.id) : null;
    return playTrack(d.playq);
  }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (!t.dataset || !t.dataset.priv) return;
  const key = t.dataset.priv, val = t.type === "checkbox" ? t.checked : t.value, f = { [key]: val };
  if (key === "show_now" && !val) { f.now_track = null; f.now_at = null; }
  const r = await Auth.saveProfile(me(), f);
  if (r.error || !r.profile) { toast("Нужен SQL шага 8"); return render(true); }
  S.auth.profile = r.profile; toast("Сохранено");
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "cmForm") return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = e.target, mid = +f.dataset.mid, text = f.text.value.trim();
  if (!text) return;
  if (!S.auth.user) { toast("Сначала войдите"); return go("me"); }
  f.text.disabled = true;
  const err = await Social.addComment(mid, text);
  if (err) { f.text.disabled = false; return toast(err === "setup" ? "Нужен SQL шага 8" : "Не отправилось"); }
  const r = await Social.comments(mid);
  S.cm.items = r.data;
  const m = findPost(mid); if (m) setCmCount(m, r.data.length);
  render(true);
}, true);

/* ===== app.js ===== */
// ============================================================
// Главный файл: показывает экраны и реагирует на нажатия.
// ============================================================
const VIEW = { moments: viewMoments, tracks: viewTracks, chats: viewChats, rooms: viewRooms, profile: viewProfile, me: viewMe };
const unreadTotal = () => Object.values(S.unread).reduce((a, b) => a + b, 0);
let onInputTimer = null;

function render(keep) {
  const y = window.scrollY;
  $("#nav").innerHTML = TABS.map(([k, l]) =>
    `<button data-view="${k}" class="${S.view === k ? "on" : ""}">${ICON[k]}<span>${l}</span>${k === "chats" && unreadTotal() ? `<i class="dot"></i>` : ""}</button>`).join("");
  $("#view").innerHTML = VIEW[S.view]();
  sync(true);
  if (S.view === "chats" && S.chat.peer) { const m = $("#msgs"); if (m) m.scrollTop = m.scrollHeight; }
  window.scrollTo(0, keep ? y : 0);
}

function go(v) {
  S.view = v; S.auth.error = ""; S.auth.notice = "";
  if (v === "moments") loadMoments();
  if (v === "chats" && S.auth.user) loadPeers();
  if (v === "rooms" && S.auth.user) loadRooms();
  if (v === "me" && S.auth.user) Social.loadBlockedList();
  render();
}

async function loadMoments() {
  const r = await DB.moments();
  S.moments = r.data.filter((m) => !S.blocks.has(m.user_id)); S.momentsErr = r.error;
  if (S.view === "moments") render(true);
}
async function loadPeers() {
  const r = await DB.peers(me());
  S.chat.peers = r.list.filter((p) => !S.blocks.has(p.id)); S.chat.err = r.error;
  if (S.view === "chats" && !S.chat.peer) render(true);
}
async function openPeer(id) {
  const p = [...S.chat.peers, ...S.chat.found].find((x) => x.id === id) || (await DB.profile(id));
  if (!p) return;
  S.chat.peer = p; S.chat.msgs = []; S.chat.err = ""; delete S.unread[id];
  render();
  const r = await DB.thread(me(), id);
  S.chat.msgs = r.data; S.chat.err = r.error;
  if (S.chat.peer && S.chat.peer.id === id) render(true);
}

function openSheet(id) {
  const t = track(id);
  if (!t) return;
  if (S.nowId !== id) { S.nowId = id; S.mstart = t.hot; playKey = null; until = null; au.pause(); au.src = t.src; }
  S.sheet = true;
  renderPlayer(); renderSheet(); sync(false);
}

function onAuth({ user, profile }) {
  S.auth.user = user; S.auth.profile = profile;
  if (user) { DB.subscribe(user.id, onIncoming); Social.loadBlocks(user.id); }
  else { DB.unsubscribe(); S.chat = { peer: null, msgs: [], peers: [], found: [], q: "", err: "", loading: false }; S.unread = {}; RoomsDB.unwatch(); S.rooms = freshRooms(); }
  if (user && S.view === "chats") loadPeers();
  if (user && S.view === "rooms") loadRooms();
  if (S.pendingInvite) {
    if (user) { const code = S.pendingInvite; S.pendingInvite = null; openJoinModal(code); }
    else if (S.view !== "me") { S.view = "me"; S.auth.notice = "Войдите или зарегистрируйтесь, чтобы принять приглашение."; }
  }
  render(true);
}

async function onIncoming(m) {
  if (S.chat.peer && S.chat.peer.id === m.sender) {
    S.chat.msgs.push(m);
    if (S.view === "chats") render(true);
  } else {
    S.unread[m.sender] = (S.unread[m.sender] || 0) + 1;
    toast("Новое сообщение");
    if (S.view === "chats" && !S.chat.peer) loadPeers(); else render(true);
  }
}

// ---------- Нажатия ----------
const CLICKABLE = "[data-view],[data-play],[data-moment],[data-toggle],[data-step],[data-open],[data-sheet],[data-sheetclose],[data-previewmoment],[data-postmoment],[data-react],[data-delmoment],[data-authmode],[data-logout],[data-copy],[data-peer],[data-chatback],[data-sendmoment],#theme";

document.addEventListener("click", async (e) => {
  const w = e.target.closest("#wave");
  if (w) {
    const t = track(S.nowId), r = w.getBoundingClientRect();
    if (t) { until = null; au.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * t.dur; sync(false); }
    return;
  }
  const el = e.target.closest(CLICKABLE);
  if (!el) return;
  const d = el.dataset;
  if (el.id === "theme") return setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  if (d.view) return go(d.view);
  if (d.play) { S.queue = null; return playTrack(d.play); }
  if (d.moment) { const [id, st] = d.moment.split(":"); return playMoment(id, +st); }
  if (d.toggle) return toggleNow();
  if (d.step) return step(+d.step);
  if (d.open) return openSheet(d.open);
  if (d.sheet) return openSheet(S.nowId);
  if (d.sheetclose) { S.sheet = false; return renderSheet(); }
  if (d.previewmoment) return playMoment(S.nowId, S.mstart);
  if (d.postmoment) return openComposer(S.nowId, S.mstart);
  if (d.react) {
    if (!S.auth.user) { toast("Войдите, чтобы реагировать"); return go("me"); }
    const [id, emoji] = d.react.split(":"), m = [...(S.moments || []), ...((S.prof && S.prof.posts) || [])].find((x) => String(x.id) === id);
    if (!m) return;
    const had = m.reactions.find((r) => r.user_id === me());
    m.reactions = m.reactions.filter((r) => r.user_id !== me());
    const newEmoji = had && rk(had.emoji) === emoji ? null : emoji;
    if (newEmoji) m.reactions.push({ emoji: newEmoji, user_id: me() });
    render(true);
    const err = await DB.setReaction(m.id, me(), newEmoji);
    if (err) { toast("Не получилось"); loadMoments(); }
    return;
  }
  if (d.delmoment) {
    if (!confirm("Удалить этот момент?")) return;
    const err = await DB.deleteMoment(+d.delmoment);
    if (err) return toast("Не получилось удалить");
    return loadMoments();
  }
  if (d.authmode) { S.auth.mode = d.authmode; S.auth.error = ""; S.auth.notice = ""; return render(true); }
  if (d.logout) { await Auth.signOut(); S.auth.mode = "login"; return onAuth({ user: null, profile: null }); }
  if (d.copy) { try { await navigator.clipboard.writeText(location.href.split("#")[0]); toast("Ссылка скопирована"); } catch (x) { toast(location.href); } return; }
  if (d.peer) return openPeer(d.peer);
  if (d.chatback) { S.chat.peer = null; loadPeers(); return render(); }
  if (d.sendmoment) {
    if (!S.nowId) return toast("Сначала включи трек в разделе «Треки» и выбери момент");
    const r = await DB.send(S.chat.peer.id, "", S.nowId, S.mstart);
    if (r.error || !r.msg) return toast("Не отправилось");
    S.chat.msgs.push(r.msg); return render(true);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "mrange") { S.mstart = +e.target.value; paintSheet(); }
  if (e.target.id === "q") {
    S.chat.q = e.target.value;
    clearTimeout(onInputTimer);
    onInputTimer = setTimeout(async () => {
      S.chat.found = S.chat.q.trim() ? await DB.search(S.chat.q, me()) : [];
      render(true);
      const q = $("#q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }, 300);
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sheet) { S.sheet = false; renderSheet(); } });

// ---------- Формы ----------
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, v = Object.fromEntries(new FormData(f));
  if (f.id === "authForm") {
    S.auth.busy = true; S.auth.error = ""; S.auth.notice = ""; render(true);
    const reg = S.auth.mode === "register";
    const r = reg
      ? await Auth.signUp({ email: v.email, password: v.password, username: v.username, name: v.name })
      : await Auth.signIn({ email: v.email, password: v.password });
    S.auth.busy = false;
    if (r.error) { S.auth.error = r.error; return render(true); }
    if (r.notice) { S.auth.notice = r.notice; S.auth.mode = "login"; return render(true); }
    onAuth({ user: r.user, profile: r.profile });
    return go("moments");
  }
  if (f.id === "profileForm") {
    S.auth.busy = true; render(true);
    const r = await Auth.saveProfile(me(), { display_name: v.display_name.trim(), bio: v.bio.trim(), profile_track: v.profile_track || null });
    S.auth.busy = false;
    if (r.error) S.auth.error = r.error === "setup" ? "Нужен SQL из шага 5" : r.error; else { S.auth.profile = r.profile; S.auth.notice = "Сохранено"; S.auth.error = ""; }
    return render(true);
  }
  if (f.id === "compose") {
    const text = (v.text || "").trim();
    if (!text || !S.chat.peer) return;
    const r = await DB.send(S.chat.peer.id, text);
    if (r.error || !r.msg) return toast(r.error === "setup" ? "Нужен SQL из шага 4" : r.error === "denied" ? "Этот человек ограничил личные сообщения" : "Не отправилось");
    S.chat.msgs.push(r.msg); render(true);
    const i = $("#compose input"); if (i) i.focus();
  }
});

// ---------- Старт ----------
(function start() {
  let t = "dark";
  try { t = localStorage.getItem("drop-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); } catch (e) {}
  setTheme(t);
  $$("[data-app-name]").forEach((n) => (n.textContent = APP_NAME));
  render();
  loadUserTracks().then(() => { loadMoments(); render(true); });
  Auth.init(onAuth);
})();
