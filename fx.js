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
    const i = TRACKS.findIndex((t) => t.id === S.nowId);
    if (S.shuffle && TRACKS.length > 1) {
      let n; do { n = TRACKS[Math.floor(Math.random() * TRACKS.length)]; } while (n.id === S.nowId);
      return playTrack(n.id);
    }
    if (i === TRACKS.length - 1 && S.repeat === 0) return;
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
