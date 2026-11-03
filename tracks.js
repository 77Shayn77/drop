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
