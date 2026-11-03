// ============================================================
// Фото: уменьшаем перед загрузкой (чтобы было быстро) и храним в Supabase.
// ============================================================
const Media = (() => {
  // Уменьшает фото до max пикселей. square = обрезать в квадрат (для аватара)
  async function shrink(file, max, square) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const k = Math.min(1, max / Math.max(sw, sh));
    const cv = document.createElement("canvas");
    cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
    cv.getContext("2d").drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return new Promise((res) => cv.toBlob(res, "image/jpeg", 0.85));
  }

  // Загружает и возвращает ссылку на фото
  async function upload(blob, uid) {
    const c = Auth.client;
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error } = await c.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) { console.error(error); return { error: /bucket|not found/i.test(error.message || "") ? "setup" : "Не удалось загрузить фото." }; }
    return { url: c.storage.from("photos").getPublicUrl(path).data.publicUrl };
  }

  return { shrink, upload };
})();
