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
const EMOJIS = ["🔥", "💜", "😮"];

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "только что";
  if (s < 3600) return Math.floor(s / 60) + " мин назад";
  if (s < 86400) return Math.floor(s / 3600) + " ч назад";
  return Math.floor(s / 86400) + " дн назад";
}
const range = (t, start) => `${fmt(start)}–${fmt(Math.min(start + MOMENT_LEN, t.dur))}`;

function setupNotice() {
  return `<div class="notice">Этот раздел ещё не подключён к базе. Нужно один раз выполнить SQL из инструкции в чате, потом обновить страницу.</div>`;
}

// ---------- Карточка «Момента» ----------
function momentBtn(t, start, label) {
  return `<button class="mbtn" data-moment="${t.id}:${start}" aria-label="Играть момент">
    <span class="mplay">${ICON.play}${ICON.pause}</span>
    <span class="mtxt"><b>${esc(label || "Момент")}</b><small>${esc(t.title)} · ${range(t, start)}</small></span>
    <span class="mprog"><span></span></span>
  </button>`;
}

function momentCard(m) {
  const t = track(m.track_id);
  if (!t) return "";
  const who = m.profiles || { username: "user", display_name: "user" };
  const rs = m.reactions || [];
  const mine = rs.find((r) => r.user_id === me());
  const btns = EMOJIS.map((e) => {
    const n = rs.filter((r) => r.emoji === e).length;
    return `<button class="react ${mine && mine.emoji === e ? "on" : ""}" data-react="${m.id}:${e}">${e}<span>${n || ""}</span></button>`;
  }).join("");
  return `<article class="card moment" style="--c1:${t.c1};--c2:${t.c2}">
    <div class="row">${avatar(who, 38)}<div class="grow"><b>${esc(who.display_name || who.username)}</b><div class="muted small">@${esc(who.username)} · ${ago(m.created_at)}</div></div>
    ${m.user_id === me() ? `<button class="x" data-delmoment="${m.id}" aria-label="Удалить">${ICON.close}</button>` : ""}</div>
    ${m.caption ? `<p class="cap">${esc(m.caption)}</p>` : ""}
    ${momentBtn(t, m.start_sec, "Момент")}
    <div class="reacts">${btns}</div>
  </article>`;
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
  return `<header class="top"><h1 class="h1">Треки</h1><p class="muted">Оригинальные демо-треки. Тапни на обложку, чтобы открыть плеер.</p></header>` +
    TRACKS.map((t) => `<article class="card track" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="row">
        <button class="cover-btn" data-open="${t.id}" aria-label="Открыть плеер">${cover(t, "big")}</button>
        <div class="grow"><div class="title">${esc(t.title)}</div><div class="muted">${esc(t.artist)}</div><span class="sticker">${esc(t.genre)} · ${fmt(t.dur)}</span></div>
        <button class="playbtn" data-play="${t.id}" aria-label="Играть">${ICON.play}${ICON.pause}</button>
      </div>
      ${momentBtn(t, t.hot, "Лучший момент")}
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
  <div class="card"><b>Пригласи друзей</b><p class="muted">Отправь ссылку на сайт. Пусть зарегистрируются, найдут тебя по нику <b>@${esc(p.username)}</b> и напишут.</p>
    <button class="btn-s" data-copy="1">Скопировать ссылку</button></div>`;
}

// ---------- Чаты ----------
function msgBubble(m) {
  const mineMsg = m.sender === me();
  let inner = m.body ? `<div>${esc(m.body)}</div>` : "";
  const t = m.track_id ? track(m.track_id) : null;
  if (t) inner += momentBtn(t, m.start_sec || 0, "Момент");
  return `<div class="bubble ${mineMsg ? "me" : ""}">${inner}</div>`;
}

function viewChats() {
  const c = S.chat;
  if (!S.auth.user) return `<header class="top"><h1 class="h1">Чаты</h1></header><div class="empty"><b>Чтобы переписываться, войдите.</b></div>` + authCard().replace(/<header[\s\S]*?<\/header>/, "");
  if (c.peer) {
    const p = c.peer;
    return `<div class="card chat">
      <div class="chat-head"><button class="x" data-chatback="1" aria-label="Назад">${ICON.back}</button><button data-profile="${p.id}">${avatar(p, 38)}</button><div class="grow"><b>${esc(p.display_name || p.username)}</b><div class="muted small">${esc(nowText(p) || "@" + p.username)}</div></div></div>
      <div class="msgs" id="msgs">${c.err === "setup" ? setupNotice() : c.msgs.length ? c.msgs.map(msgBubble).join("") : `<div class="empty">Напиши первым 👋<br><span class="small">Кнопка ${ICON.note.replace(/width="22" height="22"/, 'width="16" height="16"')} отправит момент из плеера.</span></div>`}</div>
      <form class="compose" id="compose">
        <button type="button" class="send ghost" data-sendmoment="1" aria-label="Отправить момент">${ICON.note}</button>
        <input name="text" placeholder="Сообщение…" autocomplete="off" maxlength="2000">
        <button class="send" aria-label="Отправить">${ICON.send}</button>
      </form></div>`;
  }
  const people = c.q.trim() ? c.found : c.peers;
  let body = "";
  if (c.err === "setup") body = setupNotice();
  else if (!people.length) body = `<div class="empty">${c.q.trim() ? "Никого не нашли." : "Диалогов пока нет. Найди человека по нику и напиши."}</div>`;
  else body = people.map((p) => `<button class="card person" data-peer="${p.id}">${avatar(p, 46)}<div class="grow"><b>${esc(p.display_name || p.username)}</b><div class="muted small">${nowText(p) ? esc(nowText(p)) : "@" + esc(p.username)}${p.last ? " · " + (p.last.track_id ? "🎵 момент" : esc((p.last.body || "").slice(0, 40))) : ""}</div></div>${S.unread[p.id] ? `<span class="badge">${S.unread[p.id]}</span>` : ""}</button>`).join("");
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
    <div class="art" style="background:${coverBg(t)}"><i></i></div>
    <div class="center"><div class="title">${esc(t.title)}</div><div class="muted">${esc(t.artist)} · ${esc(t.genre)}</div></div>
    <div class="wave" id="wave">${hs.map((h, i) => `<b data-i="${i}" style="height:${h}%"></b>`).join("")}</div>
    <div class="times"><span id="sCur">0:00</span><span>${fmt(t.dur)}</span></div>
    <div class="ctrl"><button data-step="-1" aria-label="Назад">${ICON.prev}</button><button class="playbtn big" data-toggle="1" aria-label="Играть">${ICON.play}${ICON.pause}</button><button data-step="1" aria-label="Дальше">${ICON.next}</button></div>
    <div class="card mpanel">
      <div class="row"><b>${ICON.bolt} Твой момент</b><span class="sticker lime grow-r" id="mLabel"></span></div>
      <input type="range" id="mrange" min="0" max="${max}" value="${clamp(S.mstart, 0, max)}" aria-label="Начало момента">
      <div class="muted small">Двигай ползунок: подсвечены 15 секунд, которые получат друзья.</div>
      <button class="btn-s" data-previewmoment="1">${ICON.play.replace(/width="22" height="22"/, 'width="16" height="16"')} Прослушать момент</button>
      <input class="cap-in" id="mcap" maxlength="140" placeholder="Подпись: почему этот момент? (необязательно)">
      <button class="btn-a" data-postmoment="1">Опубликовать в ленту</button>
    </div></div>`;
  paintSheet();
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
}
