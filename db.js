// ============================================================
// Моменты, реакции и сообщения. Всё общение с базой здесь.
// ============================================================
const DB = (() => {
  const c = Auth.client;

  // Если таблиц ещё нет (не выполнен SQL) — говорим об этом по-человечески
  let lastErr = "";
  function say(error) {
    if (!error) return "";
    console.error(error);
    lastErr = (error.code || "") + " " + String(error.message || "").slice(0, 160);
    if (["42P01", "42703", "PGRST205", "PGRST204", "PGRST200", "PGRST100"].includes(error.code) || /does not exist|schema cache|relationship|column/i.test(error.message || ""))
      return "setup";
    return "Не получилось (" + (error.code || "") + " " + String(error.message || "").slice(0, 90) + ")";
  }

  async function moments() {
    if (!c) return { data: [], error: "Нет связи с сервером." };
    const { data, error } = await c
      .from("moments")
      .select("id,user_id,track_id,start_sec,caption,photo_url,created_at,profiles!moments_user_id_fkey(username,display_name,avatar_url,accent),reactions(emoji,user_id)")
      .order("created_at", { ascending: false })
      .limit(40);
    return { data: data || [], error: say(error) };
  }

  async function postMoment(track_id, start_sec, caption, photo_url) {
    const { error } = await c.from("moments").insert({ track_id: track_id || null, start_sec: track_id ? start_sec : null, caption: (caption || "").slice(0, 300), photo_url: photo_url || null });
    return say(error);
  }

  async function deleteMoment(id) {
    const { error } = await c.from("moments").delete().eq("id", id);
    return say(error);
  }

  async function setReaction(moment_id, user_id, emoji) {
    if (!emoji) {
      const { error } = await c.from("reactions").delete().eq("moment_id", moment_id).eq("user_id", user_id);
      return say(error);
    }
    const { error } = await c.from("reactions").upsert({ moment_id, user_id, emoji }, { onConflict: "moment_id,user_id" });
    return say(error);
  }

  async function search(q, meId) {
    const clean = (q || "").replace(/[^\p{L}\p{N}_ ]/gu, "").trim();
    if (!clean) return [];
    const { data } = await c
      .from("profiles")
      .select("id,username,display_name,avatar_url,now_track,now_at")
      .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
      .neq("id", meId)
      .limit(8);
    return data || [];
  }

  // Список собеседников: берём последние сообщения и группируем
  async function peers(meId) {
    const { data, error } = await c
      .from("messages")
      .select("id,sender,receiver,body,track_id,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { list: [], error: say(error) };
    const last = new Map();
    for (const m of data) {
      const other = m.sender === meId ? m.receiver : m.sender;
      if (!last.has(other)) last.set(other, m);
    }
    const ids = [...last.keys()];
    let profs = [];
    if (ids.length) profs = (await c.from("profiles").select("id,username,display_name,avatar_url,now_track,now_at").in("id", ids)).data || [];
    const list = profs.map((p) => ({ ...p, last: last.get(p.id) }));
    list.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
    return { list, error: "" };
  }

  async function thread(meId, peerId) {
    const { data, error } = await c
      .from("messages")
      .select("id,sender,receiver,body,track_id,start_sec,created_at")
      .or(`and(sender.eq.${meId},receiver.eq.${peerId}),and(sender.eq.${peerId},receiver.eq.${meId})`)
      .order("created_at", { ascending: true })
      .limit(200);
    return { data: data || [], error: say(error) };
  }

  async function send(receiver, body, track_id, start_sec) {
    const row = { receiver, body: (body || "").slice(0, 2000) };
    if (track_id) { row.track_id = track_id; row.start_sec = start_sec; }
    const { data, error } = await c.from("messages").insert(row).select().maybeSingle();
    return { msg: data, error: say(error) };
  }

  let channel = null;
  function subscribe(meId, onMessage) {
    unsubscribe();
    if (!c) return;
    channel = c
      .channel("msgs-" + meId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "receiver=eq." + meId }, (p) => onMessage(p.new))
      .subscribe();
  }
  function unsubscribe() {
    if (channel && c) c.removeChannel(channel);
    channel = null;
  }

  async function profile(id) {
    const { data } = await c.from("profiles").select("*").eq("id", id).maybeSingle();
    return data;
  }

  async function userPosts(uid) {
    const { data, error } = await c
      .from("moments")
      .select("id,user_id,track_id,start_sec,caption,photo_url,created_at,profiles!moments_user_id_fkey(username,display_name,avatar_url,accent),reactions(emoji,user_id)")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(30);
    return { data: data || [], error: say(error) };
  }

  let lastNow = 0;
  function setNow(trackId, uid) {
    if (!c || !uid || Date.now() - lastNow < 20000) return;
    lastNow = Date.now();
    c.from("profiles").update({ now_track: trackId, now_at: new Date().toISOString() }).eq("id", uid).then(() => {});
  }

  return { moments, postMoment, deleteMoment, setReaction, search, peers, thread, send, subscribe, unsubscribe, profile, userPosts, setNow, say, client: c, detail: () => lastErr };
})();
