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
