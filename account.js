
const SUPABASE_URL =
  "https://xptfqqdfmuylsjyawjgt.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_GklL8Y4iLFl5vggQSuzjtA_CQW2s8-4";

const CHAT_STORAGE_KEY = "questionbar-mobile-v1_chats";
const LAST_USER_KEY = "questionbar-last-user";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let cloudSyncRunning = false;

const accountElement = id => document.getElementById(id);

// ========================================
// MELDUNGEN UND ANZEIGE
// ========================================

function showAccountMessage(message, type = "info") {
  const element = accountElement("accountMessage");

  element.textContent = message;
  element.className = "account-message " + type;
}

function setAccountLoading(loading) {
  accountElement("loginBtn").disabled = loading;
  accountElement("registerBtn").disabled = loading;
  accountElement("logoutBtn").disabled = loading;

  accountElement("loginBtn").textContent =
    loading ? "Bitte warten ..." : "Anmelden";

  accountElement("registerBtn").textContent =
    loading ? "Bitte warten ..." : "Neues Konto erstellen";
}

function updateAccountDisplay(user) {
  const loggedIn = Boolean(user);

  accountElement("accountLoggedOut").hidden = loggedIn;
  accountElement("accountLoggedIn").hidden = !loggedIn;

  accountElement("accountUserEmail").textContent =
    user?.email || "";

  accountElement("accountBtn").classList.toggle(
    "account-active",
    loggedIn
  );
}

// ========================================
// REGISTRIERUNG
// ========================================

async function registerAccount() {
  const email = accountElement("accountEmail").value.trim();
  const password = accountElement("accountPassword").value;

  if (!email || !password) {
    showAccountMessage(
      "Bitte gib deine E-Mail-Adresse und dein Passwort ein.",
      "error"
    );
    return;
  }

  if (password.length < 8) {
    showAccountMessage(
      "Dein Passwort muss mindestens 8 Zeichen lang sein.",
      "error"
    );
    return;
  }

  setAccountLoading(true);
  showAccountMessage("Dein Konto wird erstellt ...");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          window.location.origin + window.location.pathname
      }
    });

    if (error) throw error;

    if (data.session) {
      showAccountMessage(
        "Konto erstellt. Du bist jetzt angemeldet.",
        "success"
      );
    } else {
      showAccountMessage(
        "Fast fertig! Öffne die Bestätigungs-E-Mail von Supabase und bestätige deine Adresse.",
        "success"
      );
    }

  } catch (error) {
    console.error("Registrierungsfehler:", error);
    showAccountMessage(error.message, "error");

  } finally {
    setAccountLoading(false);
  }
}

// ========================================
// ANMELDUNG
// ========================================

async function loginAccount() {
  const email = accountElement("accountEmail").value.trim();
  const password = accountElement("accountPassword").value;

  if (!email || !password) {
    showAccountMessage(
      "Bitte gib deine E-Mail-Adresse und dein Passwort ein.",
      "error"
    );
    return;
  }

  setAccountLoading(true);
  showAccountMessage("Du wirst angemeldet ...");

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    showAccountMessage("Anmeldung erfolgreich.", "success");

  } catch (error) {
    console.error("Anmeldefehler:", error);
    showAccountMessage(error.message, "error");

  } finally {
    setAccountLoading(false);
  }
}

// ========================================
// ABMELDUNG
// ========================================

async function logoutAccount() {
  setAccountLoading(true);

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    showAccountMessage("Du wurdest abgemeldet.", "success");

  } catch (error) {
    console.error("Abmeldefehler:", error);
    showAccountMessage(error.message, "error");

  } finally {
    setAccountLoading(false);
  }
}

// ========================================
// CHATS AUS DEM LOKALEN SPEICHER
// ========================================

function getLocalChats() {
  try {
    return JSON.parse(
      localStorage.getItem(CHAT_STORAGE_KEY) || "[]"
    );
  } catch (error) {
    console.error("Lokale Chats konnten nicht gelesen werden:", error);
    return [];
  }
}

function normalizeChats(chats) {
  return chats.map(chat => ({
    id: chat.id,
    title: chat.title || "Neuer Chat",
    messages: Array.isArray(chat.messages) ? chat.messages : []
  }));
}

function chatsAreEqual(first, second) {
  const a = normalizeChats(first).sort((x, y) =>
    x.id.localeCompare(y.id)
  );

  const b = normalizeChats(second).sort((x, y) =>
    x.id.localeCompare(y.id)
  );

  return JSON.stringify(a) === JSON.stringify(b);
}

// ========================================
// CHATS IN SUPABASE LADEN
// ========================================

async function loadCloudChats(user) {
  const previousUser = localStorage.getItem(LAST_USER_KEY);

  // Keine Chats eines anderen Kontos übernehmen.
  if (previousUser && previousUser !== user.id) {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  const { data, error } = await supabaseClient
    .from("chats")
    .select("id, title, messages, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Cloud-Chats konnten nicht geladen werden:", error);
    showAccountMessage(
      "Deine Chats konnten nicht geladen werden: " + error.message,
      "error"
    );
    return;
  }

  const cloudChats = normalizeChats(data || []);
  const localChats = getLocalChats();

  if (cloudChats.length > 0) {
    if (!chatsAreEqual(localChats, cloudChats)) {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(cloudChats)
      );

      localStorage.setItem(LAST_USER_KEY, user.id);

      // Die bestehende App lädt ihre Chats beim Start aus localStorage.
      // Deshalb einmal neu laden, damit die Cloud-Chats angezeigt werden.
      sessionStorage.setItem("questionbar-cloud-reload", "1");
      window.location.reload();
      return;
    }
  } else if (localChats.length > 0) {
    // Beim ersten Login vorhandene lokale Chats übernehmen.
    await saveChatsToCloud(localChats, user);
  }

  localStorage.setItem(LAST_USER_KEY, user.id);
}

// ========================================
// CHATS IN SUPABASE SPEICHERN
// ========================================

async function saveChatsToCloud(chats, user = currentUser) {
  if (!user || cloudSyncRunning || !Array.isArray(chats)) return;

  if (chats.length === 0) return;

  cloudSyncRunning = true;

  try {
    const rows = normalizeChats(chats).map(chat => ({
      id: chat.id,
      user_id: user.id,
      title: chat.title,
      messages: chat.messages,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseClient
      .from("chats")
      .upsert(rows, { onConflict: "id" });

    if (error) throw error;

    localStorage.setItem(LAST_USER_KEY, user.id);

  } catch (error) {
    console.error("Cloud-Synchronisierung fehlgeschlagen:", error);
    showAccountMessage(
      "Cloud-Speicherung fehlgeschlagen: " + error.message,
      "error"
    );

  } finally {
    cloudSyncRunning = false;
  }
}

async function syncLocalChats() {
  if (!currentUser) return;

  const chats = getLocalChats();
  await saveChatsToCloud(chats, currentUser);
}

// ========================================
// LÖSCHEN DER CLOUD-CHATS
// ========================================

async function replaceCloudChatsWithLocal() {
  if (!currentUser) return;

  try {
    const { error: deleteError } = await supabaseClient
      .from("chats")
      .delete()
      .eq("user_id", currentUser.id);

    if (deleteError) throw deleteError;

    const chats = getLocalChats();

    if (chats.length > 0) {
      await saveChatsToCloud(chats, currentUser);
    }

  } catch (error) {
    console.error("Cloud-Verlauf konnte nicht aktualisiert werden:", error);
  }
}

// ========================================
// APP-FUNKTIONEN MIT CLOUD-SYNC VERBINDEN
// ========================================

function connectChatSync() {
  if (typeof window.saveActive === "function") {
    const originalSaveActive = window.saveActive;

    window.saveActive = function (...args) {
      const result = originalSaveActive.apply(this, args);
      syncLocalChats();
      return result;
    };
  }

  if (typeof window.newChat === "function") {
    const originalNewChat = window.newChat;

    window.newChat = function (...args) {
      const result = originalNewChat.apply(this, args);
      syncLocalChats();
      return result;
    };
  }

  // Nach dem Löschen den Cloud-Verlauf ebenfalls aktualisieren.
  accountElement("clearHistory").addEventListener("click", () => {
    setTimeout(() => {
      if (currentUser) {
        replaceCloudChatsWithLocal();
      }
    }, 100);
  });
}

// ========================================
// AUTHENTIFIZIERUNG
// ========================================

async function handleUserSession(user, event = "") {
  currentUser = user || null;
  updateAccountDisplay(currentUser);

  if (currentUser) {
    await loadCloudChats(currentUser);
    return;
  }

  // Nur bei einer tatsächlichen Abmeldung private Chats entfernen.
  if (event === "SIGNED_OUT") {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(LAST_USER_KEY);
    window.location.reload();
  }
}

async function initializeAccount() {
  connectChatSync();

  accountElement("accountBtn").addEventListener("click", () => {
    accountElement("accountMessage").textContent = "";
    accountElement("accountDialog").showModal();
  });

  accountElement("closeAccount").addEventListener("click", () => {
    accountElement("accountDialog").close();
  });

  accountElement("loginBtn").addEventListener("click", loginAccount);
  accountElement("registerBtn").addEventListener("click", registerAccount);
  accountElement("logoutBtn").addEventListener("click", logoutAccount);

  accountElement("accountPassword").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      loginAccount();
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    // Supabase empfiehlt, den asynchronen Vorgang aus dem Callback
    // herauszuschieben, damit der Auth-Callback nicht blockiert.
    setTimeout(() => {
      handleUserSession(session?.user || null, event);
    }, 0);
  });

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Supabase-Sitzung konnte nicht geladen werden:", error);
    showAccountMessage(error.message, "error");
    return;
  }

  await handleUserSession(data.session?.user || null);
}

initializeAccount();
