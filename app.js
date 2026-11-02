// ============================================================
// «Дроп» — первая версия. Всё, что вы видите, рисуется здесь.
// Название сайта меняется в ОДНОМ месте — строкой ниже.
// ============================================================
const APP_NAME = "Дроп";

// ----- Данные для примера (потом их заменит настоящая база) -----
const USERS = {
  me:    { name: "Саша Ветров", handle: "sasha_vetrov", init: "С", color: "#7c8cff" },
  mira:  { name: "Мира Лед",    handle: "mira_led",     init: "М", color: "#ff4fa3" },
  dima:  { name: "Дима К.",     handle: "dimak",        init: "Д", color: "#22c7a9" },
  olya:  { name: "Оля и Тоня",  handle: "olya_tonya",   init: "О", color: "#ffb020" },
  kosta: { name: "Костя Бит",   handle: "kosta_beat",   init: "К", color: "#b06cff" },
};

const GENRE_COLORS = { "synth-pop": "#ff4fa3", "lo-fi": "#c6f432", indie: "#ffb020", "hip-hop": "#b06cff", ambient: "#22c7a9", "электроника": "#7cc4ff" };

const tracks = [
  { id: 1, by: "mira",  title: "Ночной автобус",    genre: "synth-pop",   dur: 192, likes: 128, bg: "#3b2d7a", dot: "#ff4fa3" },
  { id: 2, by: "dima",  title: "Кухонные демо №3",  genre: "lo-fi",       dur: 167, likes: 64,  bg: "#17463f", dot: "#c6f432" },
  { id: 3, by: "olya",  title: "Лето в лифте",      genre: "indie",       dur: 245, likes: 211, bg: "#5a3a12", dot: "#ffb020" },
  { id: 4, by: "kosta", title: "Подвал 808",        genre: "hip-hop",     dur: 148, likes: 97,  bg: "#4b1e4f", dot: "#b06cff" },
  { id: 5, by: "me",    title: "Двор в семь утра",  genre: "ambient",     dur: 220, likes: 18,  bg: "#123b52", dot: "#22c7a9" },
];

const chat = [
  { me: false, text: "Привет! Дописала «Ночной автобус», наконец-то" },
  { me: true,  text: "Огонь! Припев прям залипает" },
  { me: false, text: "Завтра скину ещё демо, послушаешь?" },
];

// ----- Состояние: то, что меняется, пока вы пользуетесь сайтом -----
const state = { view: "feed", nowId: 1, playing: false, pos: 0, liked: { 3: true } };

const NAV = [
  { id: "feed",    label: "Лента",   d: "M3 11l9-8 9 8M5 10v10h14V10" },
  { id: "explore", label: "Обзор",   d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" },
  { id: "chats",   label: "Чаты",    d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
  { id: "profile", label: "Профиль", d: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-6 8-6s8 2 8 6" },
];

// ----- Вспомогательное -----
const $ = (sel) => document.querySelector(sel);
const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = (d, size = 22, fill = "none") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const PLAY = "M7 4.5v15l13-7.5z";
const PAUSE = "M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z";
const HEART = "M12 20.5s-8-5-8-10.8A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.7c0 5.8-8 10.8-8 10.8z";
const SEND = "M4 12l16-8-6 16-3-7z";

function waveform(id, progress) {
  let html = "";
  for (let i = 0; i < 64; i++) {
    const h = Math.round(8 + Math.abs(Math.sin(i * 0.55 + id * 1.7) * 14 + Math.sin(i * 1.7 + id * 3.4) * 10));
    html += `<b class="${(i + 1) / 64 <= progress ? "done" : ""}" style="height:${h}px"></b>`;
  }
  return html;
}

// ----- Экраны -----
function trackCard(t) {
  const u = USERS[t.by];
  const isNow = state.nowId === t.id;
  const playing = isNow && state.playing;
  const liked = !!state.liked[t.id];
  const progress = isNow ? state.pos / t.dur : 0;
  return `
    <article class="card ${isNow ? "now" : ""}">
      <div class="row">
        <div class="avatar" style="background:${u.color}">${u.init}</div>
        <div><strong>${esc(u.name)}</strong><div class="muted" style="font-size:13px">@${esc(u.handle)}</div></div>
      </div>
      <div class="row" style="margin-top:16px;align-items:flex-start">
        <div class="cover" style="background:${t.bg}"><i style="background:${t.dot}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <span class="title">${esc(t.title)}</span>
            <span class="sticker" style="background:${GENRE_COLORS[t.genre]}">${esc(t.genre)}</span>
          </div>
          <div class="bars" aria-hidden="true">${waveform(t.id, progress)}</div>
        </div>
        <button class="playbtn" data-play="${t.id}" aria-label="${playing ? "Пауза" : "Слушать"}: ${esc(t.title)}">${icon(playing ? PAUSE : PLAY, 26, "currentColor")}</button>
      </div>
      <div class="actions">
        <button data-like="${t.id}" class="${liked ? "liked" : ""}" aria-label="Нравится">${icon(HEART, 22, liked ? "currentColor" : "none")}<span>${t.likes + (liked ? 1 : 0)}</span></button>
        <span style="flex:1"></span>
        <span class="muted">${fmt(t.dur)}</span>
      </div>
    </article>`;
}

const VIEWS = {
  feed: () => `
    <div class="hero"><h2>Выложи трек.<br>Сделай дроп.</h2><p>Свои демки, наброски и готовые вещи. Без лейблов.</p></div>
    ${tracks.map(trackCard).join("")}`,

  explore: () => `
    <h1 class="h1">Обзор</h1>
    <div class="empty muted">Поиск и жанры появятся на следующих этапах.</div>
    ${tracks.slice().sort((a, b) => b.likes - a.likes).map(trackCard).join("")}`,

  chats: () => `
    <h1 class="h1">Чаты</h1>
    <div class="card chat">
      <div class="row" style="padding:12px 16px;border-bottom:2px solid var(--line)">
        <div class="avatar" style="background:${USERS.mira.color}">${USERS.mira.init}</div>
        <div><strong>${USERS.mira.name}</strong><div class="muted" style="font-size:13px">в сети</div></div>
      </div>
      <div class="msgs" id="msgs">${chat.map((m) => `<div class="bubble ${m.me ? "me" : ""}">${esc(m.text)}</div>`).join("")}</div>
      <form class="compose" id="compose">
        <label class="sr" for="msg" style="position:absolute;left:-9999px">Сообщение</label>
        <input id="msg" autocomplete="off" placeholder="Сообщение">
        <button class="send" aria-label="Отправить">${icon(SEND, 20)}</button>
      </form>
    </div>`,

  profile: () => {
    const u = USERS.me;
    return `
      <div class="card row" style="gap:24px;align-items:flex-start">
        <div class="avatar" style="width:112px;height:112px;font-size:44px;background:${u.color}">${u.init}</div>
        <div><h1 class="h1" style="font-size:26px">${u.name}</h1><div class="muted">@${u.handle}</div>
        <p>Пишу ambient и lo-fi по ночам. Рад новым людям и коллабам.</p></div>
      </div>
      ${tracks.filter((t) => t.by === "me").map(trackCard).join("")}`;
  },
};

// ----- Рисуем страницу -----
function renderNav() {
  $("#nav").innerHTML = NAV.map(
    (n) => `<button data-view="${n.id}" class="${state.view === n.id ? "on" : ""}">${icon(n.d, 24)}<span>${n.label}</span></button>`
  ).join("");
}

function renderPlayer() {
  const t = tracks.find((x) => x.id === state.nowId);
  const u = USERS[t.by];
  $("#player").innerHTML = `
    <div class="cover" style="width:48px;height:48px;border-radius:14px;background:${t.bg}"><i style="background:${t.dot};width:30px;height:30px;right:-7px;bottom:-7px"></i></div>
    <div class="info"><div><strong>${esc(t.title)}</strong></div><div class="muted" style="font-size:13px">${esc(u.name)}</div></div>
    <button class="playbtn" data-play="${t.id}" style="width:48px;height:48px" aria-label="${state.playing ? "Пауза" : "Играть"}">${icon(state.playing ? PAUSE : PLAY, 22, "currentColor")}</button>
    <span class="muted" style="font-size:12px">${fmt(state.pos)}</span>
    <div class="progress"><span style="width:${(state.pos / t.dur) * 100}%"></span></div>
    <span class="muted" style="font-size:12px">${fmt(t.dur)}</span>`;
}

function render() {
  renderNav();
  $("#view").innerHTML = VIEWS[state.view]();
  renderPlayer();
  const box = $("#msgs");
  if (box) box.scrollTop = box.scrollHeight;
}

// ----- Нажатия (одно место для всех кнопок) -----
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.view) { state.view = btn.dataset.view; render(); }
  if (btn.dataset.play) {
    const id = Number(btn.dataset.play);
    if (state.nowId === id) { state.playing = !state.playing; }
    else { state.nowId = id; state.pos = 0; state.playing = true; }
    render();
  }
  if (btn.dataset.like) { const id = btn.dataset.like; state.liked[id] = !state.liked[id]; render(); }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "compose") return;
  e.preventDefault();
  const input = $("#msg");
  const text = input.value.trim();
  if (!text) return;
  chat.push({ me: true, text });
  render();
  $("#msg").focus();
});

// Каждую секунду двигаем «воспроизведение» (пока это имитация, без звука)
setInterval(() => {
  if (!state.playing) return;
  const t = tracks.find((x) => x.id === state.nowId);
  state.pos += 1;
  if (state.pos >= t.dur) { state.pos = 0; state.playing = false; }
  // В чате перерисовываем только плеер, чтобы не стирать набираемое сообщение
  if (state.view === "chats") renderPlayer(); else render();
}, 1000);

// ----- Тема: светлая / тёмная -----
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#theme").textContent = theme === "dark" ? "Тёмная" : "Светлая";
  try { localStorage.setItem("theme", theme); } catch (e) {}
}
$("#theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

// ----- Старт -----
document.title = APP_NAME;
document.querySelectorAll("[data-app-name]").forEach((el) => (el.textContent = APP_NAME));
let saved = "dark";
try { saved = localStorage.getItem("theme") || "dark"; } catch (e) {}
setTheme(saved);
render();
