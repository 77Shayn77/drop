// ============================================================
// Посты (фото + музыка) и публичный профиль.
// ============================================================

// ---------- Карточка поста ----------
function postCard(m) {
  const t = m.track_id ? track(m.track_id) : null;
  const who = m.profiles || { username: "user", display_name: "user" };
  const rs = m.reactions || [];
  const mine = rs.find((r) => r.user_id === me());
  const btns = EMOJIS.map((e) => {
    const n = rs.filter((r) => r.emoji === e).length;
    return `<button class="react ${mine && mine.emoji === e ? "on" : ""}" data-react="${m.id}:${e}">${e}<span>${n || ""}</span></button>`;
  }).join("");
  return `<article class="card post" ${t ? `style="--c1:${t.c1};--c2:${t.c2}"` : ""}>
    <div class="row"><button class="who" data-profile="${m.user_id}">${avatar(who, 40)}<span class="grow"><b>${esc(who.display_name || who.username)}</b><span class="muted small">@${esc(who.username)} · ${ago(m.created_at)}</span></span></button>
    ${m.user_id === me() ? `<button class="x" data-delmoment="${m.id}" aria-label="Удалить">${ICON.close}</button>` : ""}</div>
    ${m.photo_url ? `<img class="photo" src="${esc(m.photo_url)}" alt="Фото" loading="lazy">` : ""}
    ${m.caption ? `<p class="cap">${esc(m.caption)}</p>` : ""}
    ${t ? momentBtn(t, m.start_sec || 0, m.photo_url ? "Саундтрек" : "Момент") : ""}
    <div class="reacts">${btns}</div></article>`;
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
  closeModal(); toast("Опубликовано ⚡"); S.moments = null; go("moments");
}

// ---------- Публичный профиль ----------
async function openProfile(id) {
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
      ${nt ? `<div class="sticker lime">${esc(nt)}</div>` : ""}
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
      ${pt ? `<div class="muted small" style="margin-top:12px">Песня профиля</div>${momentBtn(pt, pt.hot, "Моя песня")}` : ""}
      <div class="row" style="margin-top:14px">${mineP ? `<button class="btn-s" data-view="me">Редактировать</button>` : `<button class="btn-a" data-writeto="${p.id}">Написать</button>`}</div>
    </div></section>
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
