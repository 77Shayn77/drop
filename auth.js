// ============================================================
// Вход, регистрация и профиль. Здесь вся связь с Supabase.
// ============================================================
const Auth = (() => {
  const cfg = window.DROP_CONFIG || {};
  const client =
    window.supabase && cfg.supabaseUrl ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  // Переводим технические ошибки в понятные фразы
  function friendly(err) {
    const m = (err && err.message) || "";
    if (/already registered/i.test(m)) return "Этот email уже зарегистрирован. Попробуйте войти.";
    if (/invalid login/i.test(m)) return "Неверная почта или пароль.";
    if (/at least 6/i.test(m)) return "Пароль должен быть не короче 6 символов.";
    if (/valid email|invalid format|email address/i.test(m)) return "Проверьте адрес почты.";
    if (/rate limit/i.test(m)) return "Слишком много попыток. Подождите минуту.";
    if (err && err.code === "23505") return "Этот ник уже занят.";
    return "Не получилось. Попробуйте ещё раз.";
  }

  // Достаём профиль; если его нет (редкий случай) — создаём простой
  async function loadProfile(user) {
    const { data } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) return data;
    const username = "user_" + user.id.slice(0, 6);
    const { data: created } = await client
      .from("profiles")
      .insert({ id: user.id, username, display_name: username })
      .select()
      .maybeSingle();
    return created || null;
  }

  // Запускается при открытии сайта: смотрит, вошёл ли человек раньше
  async function init(onChange) {
    if (!client) return;
    const { data } = await client.auth.getSession();
    const user = data && data.session ? data.session.user : null;
    onChange({ user, profile: user ? await loadProfile(user) : null });
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") onChange({ user: null, profile: null });
    });
  }

  async function signUp({ email, password, username, name }) {
    if (!client) return { error: "Нет связи с сервером. Обновите страницу." };
    username = (username || "").toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return { error: "Ник: 3–20 символов, только латинские буквы, цифры и _" };
    const { data: taken } = await client.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) return { error: "Этот ник уже занят." };
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) { console.error(error); return { error: friendly(error) }; }
    if (!data.session) return { notice: "Мы отправили письмо. Подтвердите адрес, потом войдите." };
    const { data: profile, error: e2 } = await client
      .from("profiles")
      .insert({ id: data.user.id, username, display_name: name || username })
      .select()
      .maybeSingle();
    if (e2) { console.error(e2); return { error: friendly(e2) }; }
    return { user: data.user, profile };
  }

  async function signIn({ email, password }) {
    if (!client) return { error: "Нет связи с сервером. Обновите страницу." };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { console.error(error); return { error: friendly(error) }; }
    return { user: data.user, profile: await loadProfile(data.user) };
  }

  async function signOut() {
    if (client) await client.auth.signOut();
  }

  async function saveProfile(id, fields) {
    const { data, error } = await client.from("profiles").update(fields).eq("id", id).select().maybeSingle();
    if (error) { console.error(error); return { error: friendly(error) }; }
    return { profile: data };
  }

  return { init, signUp, signIn, signOut, saveProfile };
})();
