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
    if (T.host) return `<div class="tbar on">🎧 <span class="grow">Вы ведёте: <b>${esc((track(S.nowId) || {}).title || "")}</b></span><button class="btn-s sm" data-tstop="1">Остановить</button></div>`;
    if (!fresh) return "";
    const t = track(L.trackId), name = esc(L.name), title = esc(t ? t.title : "трек");
    if (T.follow) return `<div class="tbar on">🎧 <span class="grow">Слушаете вместе с <b>${name}</b>: «${title}»</span><button class="btn-s sm" data-tleave="1">Выйти</button></div>`;
    return `<div class="tbar">🎧 <span class="grow"><b>${name}</b> слушает «${title}»</span><button class="btn-a sm" data-tjoin="1">Присоединиться</button></div>`;
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
