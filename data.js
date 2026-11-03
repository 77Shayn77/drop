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
const coverBg = (t) => `linear-gradient(135deg, ${t.c1}, ${t.c2})`;

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

// Кто сейчас слушает (последние 10 минут)
function nowText(p) {
  if (!p || !p.now_track || !p.now_at) return "";
  const t = track(p.now_track);
  return t && Date.now() - new Date(p.now_at).getTime() < 600000 ? `🎧 слушает «${t.title}»` : "";
}
