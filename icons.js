// ============================================================
// Значки, нарисованные для Дропа (вместо смайликов).
// ico("fire", 20) возвращает готовую картинку нужного размера.
// ============================================================
const ICO = {
  headphones: `<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.6" height="7" rx="2.2"/><rect x="16.4" y="14" width="4.6" height="7" rx="2.2"/>`,
  fire: `<path d="M12 2.8c.9 3.2 5.2 5.2 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2.2 1-3.4 2.2-4.6.2 1.6.9 2.2 1.9 2.4-1-3 0-5.6 1.1-8z"/>`,
  heart: `<path d="M12 20.2s-7.2-4.4-7.2-10.2a4.2 4.2 0 0 1 7.2-2.9 4.2 4.2 0 0 1 7.2 2.9c0 5.8-7.2 10.2-7.2 10.2z"/>`,
  wow: `<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"/><ellipse cx="12" cy="15.6" rx="2" ry="2.6"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="7.7" r="0.7" fill="currentColor"/>`,
  settings: `<path d="M3.5 7h9M17 7h3.5M3.5 17H7M11.5 17h9"/><circle cx="14.8" cy="7" r="2.3"/><circle cx="9.2" cy="17" r="2.3"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/>`,
  moon: `<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
  star: `<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`,
  vinyl: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>`,
  rocket: `<path d="M12 2.8c3 2 4.8 5 4.8 8.7l-2 3.2H9.2l-2-3.2c0-3.7 1.8-6.7 4.8-8.7z"/><circle cx="12" cy="9.6" r="1.6"/><path d="M9.2 14.7 7 19l3.2-1M14.8 14.7 17 19l-3.2-1"/>`,
  crown: `<path d="m3 8.5 4.2 3.6L12 5l4.8 7.1L21 8.5 19 19H5z"/>`,
  drop: `<path d="M12 3s6.2 6.6 6.2 11a6.2 6.2 0 0 1-12.4 0C5.8 9.6 12 3 12 3z"/>`,
  volume: `<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.3 9a4.2 4.2 0 0 1 0 6M18.8 6.5a7.6 7.6 0 0 1 0 11"/>`,
  mute: `<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="m17 9.5 4 5M21 9.5l-4 5"/>`,
  eq: `<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14.5" r="2.2"/><circle cx="12" cy="8.5" r="2.2"/><circle cx="18" cy="12.5" r="2.2"/>`,
  repeat: `<path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11V9.5A4 4 0 0 1 8 5.5h12"/><path d="m7 21.5-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/>`,
  repeat1: `<path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11V9.5A4 4 0 0 1 8 5.5h12"/><path d="m7 21.5-3-3 3-3"/><path d="M20 13v1.5a4 4 0 0 1-4 4H4"/><path d="M11 10.5l1.6-1v6"/>`,
  shuffle: `<path d="M16 3.5h4.5V8"/><path d="M3.5 20.5 20.5 3.5"/><path d="M20.5 16v4.5H16"/><path d="m14.5 14.5 6 6"/><path d="m3.5 3.5 5 5"/>`,
  megaphone: `<path d="M3.5 10v4l10.5 4.2V5.8z"/><path d="M14 8.2c3 0 5 1.5 5 3.8s-2 3.8-5 3.8"/><path d="m6.5 14.4 1 5.1h3l-1-4"/>`,
  trash: `<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>`,
  stop: `<rect x="6" y="6" width="12" height="12" rx="2.5"/>`,
  people: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-4 3-5.5 6.5-5.5s5.9 1.5 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.8.6 2.7 2.2 3 5.2"/>`,
};

const ico = (name, size = 20) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[name] || ""}</svg>`;

// Значки, которые можно выбрать для сообщества
const ROOM_ICONS = ["headphones", "fire", "star", "heart", "vinyl", "mic", "rocket", "crown", "drop", "moon", "sun", "eq"];

// Реакции на посты. Старые смайлики из базы превращаем в новые значки
const REACT_KEYS = ["fire", "heart", "wow"];
const REACT_LEGACY = { "🔥": "fire", "💜": "heart", "😮": "wow" };
const rk = (e) => REACT_LEGACY[e] || e;

// Иконки с размером по умолчанию для общего набора
Object.assign(ICON, {
  headphones: ico("headphones", 22), settings: ico("settings", 22), info: ico("info", 22),
  mic: ico("mic", 22), megaphone: ico("megaphone", 22), people: ico("people", 22),
  volume: ico("volume", 20), mute: ico("mute", 20), eq: ico("eq", 20), stop: ico("stop", 20),
  repeat: ico("repeat", 22), repeat1: ico("repeat1", 22), shuffle: ico("shuffle", 22), trash: ico("trash", 20),
});
