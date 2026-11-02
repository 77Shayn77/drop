// ============================================================
// Главный файл: показывает экраны и реагирует на нажатия.
// ============================================================
const VIEW = { moments: viewMoments, tracks: viewTracks, chats: viewChats, me: viewMe };
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
  render();
}

async function loadMoments() {
  const r = await DB.moments();
  S.moments = r.data; S.momentsErr = r.error;
  if (S.view === "moments") render(true);
}
async function loadPeers() {
  const r = await DB.peers(me());
  S.chat.peers = r.list; S.chat.err = r.error;
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
  if (user) DB.subscribe(user.id, onIncoming);
  else { DB.unsubscribe(); S.chat = { peer: null, msgs: [], peers: [], found: [], q: "", err: "", loading: false }; S.unread = {}; }
  if (user && S.view === "chats") loadPeers();
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
  if (d.play) return playTrack(d.play);
  if (d.moment) { const [id, st] = d.moment.split(":"); return playMoment(id, +st); }
  if (d.toggle) return toggleNow();
  if (d.step) return step(+d.step);
  if (d.open) return openSheet(d.open);
  if (d.sheet) return openSheet(S.nowId);
  if (d.sheetclose) { S.sheet = false; return renderSheet(); }
  if (d.previewmoment) return playMoment(S.nowId, S.mstart);
  if (d.postmoment) {
    if (!S.auth.user) { toast("Сначала войдите"); S.sheet = false; renderSheet(); return go("me"); }
    el.disabled = true;
    const err = await DB.postMoment(S.nowId, S.mstart, ($("#mcap") || {}).value);
    el.disabled = false;
    if (err) return toast(err === "setup" ? "Нужен SQL из шага 4" : err);
    toast("Момент опубликован ⚡");
    S.sheet = false; renderSheet(); S.moments = null; return go("moments");
  }
  if (d.react) {
    if (!S.auth.user) { toast("Войдите, чтобы реагировать"); return go("me"); }
    const [id, emoji] = d.react.split(":"), m = (S.moments || []).find((x) => String(x.id) === id);
    if (!m) return;
    const had = m.reactions.find((r) => r.user_id === me());
    m.reactions = m.reactions.filter((r) => r.user_id !== me());
    const newEmoji = had && had.emoji === emoji ? null : emoji;
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
    const r = await Auth.saveProfile(me(), { display_name: v.display_name.trim(), bio: v.bio.trim() });
    S.auth.busy = false;
    if (r.error) S.auth.error = r.error; else { S.auth.profile = r.profile; S.auth.notice = "Сохранено"; S.auth.error = ""; }
    return render(true);
  }
  if (f.id === "compose") {
    const text = (v.text || "").trim();
    if (!text || !S.chat.peer) return;
    const r = await DB.send(S.chat.peer.id, text);
    if (r.error || !r.msg) return toast(r.error === "setup" ? "Нужен SQL из шага 4" : "Не отправилось");
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
  loadMoments();
  Auth.init(onAuth);
})();
