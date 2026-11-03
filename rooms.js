// ============================================================
// Группы и каналы: база, экран и события.
// ============================================================
const freshRooms = () => ({ mine: [], found: [], err: "", cur: null, role: null, msgs: [], loaded: false });
S.rooms = freshRooms();
const pcache = {}; // профили авторов сообщений

const RoomsDB = (() => {
  const c = Auth.client;
  const ROOM = "id,kind,name,about,color,owner,room_members(count)";
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
  async function create(kind, name, about, color) {
    const { data, error } = await c.from("rooms").insert({ kind, name, about, color }).select().maybeSingle();
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
      .select("id,room_id,sender,body,track_id,start_sec,photo_url,created_at,profiles(username,display_name,avatar_url)")
      .eq("room_id", id).order("created_at", { ascending: true }).limit(200);
    return { data: data || [], error: DB.say(error) };
  }
  async function send(room_id, body, track_id, start_sec, photo_url) {
    const row = { room_id, body: (body || "").slice(0, 2000) };
    if (track_id) { row.track_id = track_id; row.start_sec = start_sec; }
    if (photo_url) row.photo_url = photo_url;
    const { data, error } = await c.from("room_messages").insert(row).select("*").maybeSingle();
    return { msg: data, error: DB.say(error) };
  }
  async function deleteRoom(id) { return DB.say((await c.from("rooms").delete().eq("id", id)).error); }
  let ch = null;
  function watch(id, cb) {
    unwatch();
    ch = c.channel("room-" + id).on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: "room_id=eq." + id }, (p) => cb(p.new)).subscribe();
  }
  function unwatch() { if (ch) c.removeChannel(ch); ch = null; }
  return { lists, create, join, leave, role, messages, send, deleteRoom, watch, unwatch };
})();

// ---------- Экран ----------
const KIND = { group: "Группа", channel: "Канал" };
const roomIcon = (r, size = 48) => `<span class="roomic" style="width:${size}px;height:${size}px;background:${bannerBg(r.color)};font-size:${size * 0.42}px">${esc((r.name || "?").trim()[0] || "?").toUpperCase()}</span>`;
const canPostHere = () => S.rooms.cur && S.rooms.role && (S.rooms.cur.kind === "group" || ["owner", "admin"].includes(S.rooms.role));

function roomMsg(m) {
  const mineMsg = m.sender === me(), who = m.profiles || pcache[m.sender] || { username: "…", display_name: "…" };
  const t = m.track_id ? track(m.track_id) : null;
  const chan = S.rooms.cur.kind === "channel";
  const head = !mineMsg || chan ? `<button class="rname" data-profile="${m.sender}">${esc(who.display_name || who.username)}</button>` : "";
  return `<div class="bubble ${mineMsg && !chan ? "me" : ""} ${chan ? "wide" : ""}">${head}
    ${m.photo_url ? `<img class="photo" src="${esc(m.photo_url)}" alt="Фото" loading="lazy">` : ""}
    ${m.body ? `<div>${esc(m.body)}</div>` : ""}${t ? momentBtn(t, m.start_sec || 0, m.photo_url ? "Саундтрек" : "Момент") : ""}</div>`;
}

function viewRooms() {
  const R = S.rooms;
  if (!S.auth.user) return `<header class="top"><h1 class="h1">Сообщества</h1></header><div class="empty"><b>Чтобы вступать в группы и каналы, войдите.</b></div>` + authCard().replace(/<header[\s\S]*?<\/header>/, "");
  if (R.cur) {
    const r = R.cur, joined = !!R.role, owner = R.role === "owner";
    const foot = canPostHere()
      ? `<form class="compose" id="roomCompose"><button type="button" class="send ghost" data-roommoment="1" aria-label="Отправить момент">${ICON.note}</button>
          <label class="send ghost" aria-label="Фото">${ICON.camera}<input type="file" id="roomPhoto" accept="image/*" hidden></label>
          <input name="text" placeholder="${r.kind === "channel" ? "Новый пост в канале…" : "Сообщение…"}" autocomplete="off" maxlength="2000"><button class="send" aria-label="Отправить">${ICON.send}</button></form>`
      : `<div class="roomfoot">${joined ? "В этом канале пишут только админы" : `<button class="btn-a" data-join="${r.id}">${r.kind === "channel" ? "Подписаться" : "Вступить"}</button>`}</div>`;
    return `<div class="card chat"><div class="chat-head"><button class="x" data-roomback="1" aria-label="Назад">${ICON.back}</button>${roomIcon(r, 38)}
      <div class="grow"><b>${esc(r.name)}</b><div class="muted small">${KIND[r.kind]} · ${r.n || 0} уч.${r.about ? " · " + esc(r.about.slice(0, 40)) : ""}</div></div>
      ${joined && !owner ? `<button class="btn-s sm" data-leave="${r.id}">Выйти</button>` : ""}${owner ? `<button class="x" data-delroom="${r.id}" aria-label="Удалить">${ICON.close}</button>` : ""}</div>
      <div class="msgs" id="msgs">${R.err === "setup" ? setupNotice() : R.msgs.length ? R.msgs.map(roomMsg).join("") : `<div class="empty">${canPostHere() ? "Пока пусто. Напиши первым 👋" : "Здесь пока нет записей."}</div>`}</div>${foot}</div>`;
  }
  const card = (r) => `<button class="card person" data-room="${r.id}">${roomIcon(r)}<div class="grow"><b>${esc(r.name)}</b><div class="muted small">${KIND[r.kind]} · ${r.n || 0} уч.${r.about ? " · " + esc(r.about.slice(0, 36)) : ""}</div></div></button>`;
  return `<header class="top row"><h1 class="h1 grow">Сообщества</h1><button class="btn-a sm" data-newroom="1">${ICON.plus} Создать</button></header>
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
  R.cur = r; R.msgs = []; R.role = r.role || null; R.err = "";
  render();
  const [role, msgs] = await Promise.all([RoomsDB.role(id, me()), RoomsDB.messages(id)]);
  if (!R.cur || R.cur.id !== id) return;
  R.role = role; R.msgs = msgs.data; R.err = msgs.error;
  RoomsDB.watch(id, onRoomMsg);
  render(true);
}

function onRoomMsg(m) {
  const R = S.rooms;
  if (!R.cur || R.cur.id !== m.room_id || R.msgs.some((x) => x.id === m.id)) return;
  R.msgs.push(m);
  if (S.view === "rooms") render(true);
}

function closeRoom() { RoomsDB.unwatch(); S.rooms.cur = null; loadRooms(); render(); }

// ---------- Создание ----------
function openRoomForm() {
  const m = $("#modal"); m.hidden = false; document.body.classList.add("noscroll");
  m.innerHTML = `<div class="modal-in"><div class="row"><b class="title grow">Новое сообщество</b><button class="x" data-modalclose="1" aria-label="Закрыть">${ICON.close}</button></div>
    <form id="roomForm" class="form">
      <div class="seg"><label><input type="radio" name="kind" value="group" checked hidden><span>👥 Группа<small>пишут все</small></span></label><label><input type="radio" name="kind" value="channel" hidden><span>📣 Канал<small>пишет только админ</small></span></label></div>
      <label class="field">Название<input name="name" maxlength="40" required placeholder="Например: Лоу-фай по вечерам"></label>
      <label class="field">Описание<input name="about" maxlength="120" placeholder="О чём это сообщество"></label>
      <div class="field">Цвет<div class="swatches">${BANNERS.map((_, i) => `<label><input type="radio" name="color" value="${i}" ${i === 0 ? "checked" : ""} hidden><i style="background:${bannerBg(i)}"></i></label>`).join("")}</div></div>
      <button class="btn-a">Создать</button></form></div>`;
}

// ---------- События ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-room],[data-newroom],[data-roomback],[data-join],[data-leave],[data-roommoment],[data-delroom]");
  if (!el) return;
  const d = el.dataset, R = S.rooms;
  if (d.room) return openRoom(+d.room);
  if (d.newroom) return openRoomForm();
  if (d.roomback) return closeRoom();
  if (d.join) {
    const err = await RoomsDB.join(+d.join);
    if (err) return toast("Не получилось вступить");
    R.role = "member"; if (R.cur) R.cur.n = (R.cur.n || 0) + 1; toast("Готово ✓"); return render(true);
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
  if (f.id === "roomForm") {
    e.preventDefault(); e.stopImmediatePropagation();
    const v = Object.fromEntries(new FormData(f));
    const r = await RoomsDB.create(v.kind, v.name.trim(), (v.about || "").trim(), +v.color);
    if (r.error) return toast(r.error === "setup" ? "Нужен SQL из шага 5" : r.error);
    closeModal(); toast("Создано ⚡");
    await loadRooms(); openRoom(r.room.id);
  }
}, true);
