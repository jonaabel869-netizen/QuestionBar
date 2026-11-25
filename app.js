
const state = {
  history: [],
  chats: [],
  activeChat: null,
  busy: false
};

const STORAGE = "questionbar-mobile-v1";

const defaultSettings = {
  provider: "gemini",
  model: "gemini-3.8-flash",
  apiKeyGemini: "",
  apiKeyGroq: "",
  rememberChat: true
};

let settings = { ...defaultSettings };

const $ = id => document.getElementById(id);

// ========================================
// EINSTELLUNGEN UND SPEICHERN
// ========================================

function load() {
  try {
    const savedSettings = JSON.parse(
      localStorage.getItem(STORAGE + "_settings") || "{}"
    );

    settings = {
      ...defaultSettings,
      ...savedSettings,

      // Alte Gemini-Einstellungen übernehmen
      apiKeyGemini:
        savedSettings.apiKeyGemini ||
        (savedSettings.provider === "gemini"
          ? savedSettings.apiKey || ""
          : ""),

      // Alte Groq-Einstellungen übernehmen
      apiKeyGroq:
        savedSettings.apiKeyGroq ||
        (savedSettings.provider === "groq"
          ? savedSettings.apiKey || ""
          : "")
    };

    delete settings.apiKey;

    if (settings.rememberChat) {
      state.chats = JSON.parse(
        localStorage.getItem(STORAGE + "_chats") || "[]"
      );
    }
  } catch (err) {
    console.error("Fehler beim Laden:", err);
  }

  if (state.chats.length) {
    state.activeChat = state.chats[0].id;
    state.history = state.chats[0].messages || [];
  } else {
    newChat(false);
  }

  render();
}

function persist() {
  localStorage.setItem(
    STORAGE + "_settings",
    JSON.stringify(settings)
  );

  if (settings.rememberChat) {
    localStorage.setItem(
      STORAGE + "_chats",
      JSON.stringify(state.chats)
    );
  } else {
    localStorage.removeItem(STORAGE + "_chats");
  }
}

function saveActive() {
  if (!state.activeChat) return;

  const chat = state.chats.find(
    c => c.id === state.activeChat
  );

  if (chat) {
    chat.messages = state.history;

    chat.title =
      state.history.find(m => m.role === "user")
        ?.content?.slice(0, 48) || "Neuer Chat";
  }

  persist();
}

// ========================================
// API-KEYS
// ========================================

function getCurrentApiKey() {
  return settings.provider === "groq"
    ? settings.apiKeyGroq
    : settings.apiKeyGemini;
}

function setCurrentApiKey(value) {
  if (settings.provider === "groq") {
    settings.apiKeyGroq = value;
  } else {
    settings.apiKeyGemini = value;
  }
}

function updateProviderFields() {
  const provider = $("provider").value;
  const model = $("model");
  const keyLabel = $("apiKeyLabel");
  const keyInput = $("apiKey");

  if (provider === "groq") {
    if (!model.value || model.value === "gemini-3.8-flash") {
      model.value = "openai/gpt-oss-120b";
    }

    keyLabel.textContent = "Groq API-Key";
    keyInput.placeholder = "Groq API-Key einfügen";

    keyInput.value = settings.apiKeyGroq || "";

  } else {
    if (!model.value || model.value === "openai/gpt-oss-120b") {
      model.value = "gemini-3.8-flash";
    }

    keyLabel.textContent = "Gemini API-Key";
    keyInput.placeholder = "Gemini API-Key einfügen";

    keyInput.value = settings.apiKeyGemini || "";
  }
}

// ========================================
// CHATS
// ========================================

function newChat(shouldRender = true) {
  const chat = {
    id: crypto.randomUUID(),
    title: "Neuer Chat",
    messages: []
  };

  state.chats.unshift(chat);
  state.activeChat = chat.id;
  state.history = [];

  if (shouldRender) {
    render();
    closeDrawer();
    $("prompt").focus();
  }

  persist();
}

function openChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;

  state.activeChat = id;
  state.history = chat.messages || [];

  render();
  closeDrawer();
}

// ========================================
// DARSTELLUNG
// ========================================

function render() {
  const box = $("messages");
  box.innerHTML = "";

  $("welcome").style.display =
    state.history.length ? "none" : "block";

  for (const msg of state.history) {
    addMessage(msg.role, msg.content, false);
  }

  renderHistory();

  $("chat").scrollTop = $("chat").scrollHeight;
}

function addMessage(role, content, scroll = true) {
  const box = $("messages");
  const row = document.createElement("article");

  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Du" : "Q";

  const body = document.createElement("div");
  body.className = "message-body";

  if (role === "user") {
    body.textContent = content;
  } else {
    const html = window.marked
      ? marked.parse(content, {
          gfm: true,
          breaks: true
        })
      : `<p>${escapeHtml(content)}</p>`;

    body.innerHTML = window.DOMPurify
      ? DOMPurify.sanitize(html)
      : html;

    body.querySelectorAll("pre").forEach(pre => {
      const code = pre.querySelector("code");

      const lang =
        (code?.className.match(/language-([\w+-]+)/) || [])[1]
        || "Code";

      const wrap = document.createElement("div");
      wrap.className = "code-wrap";

      const head = document.createElement("div");
      head.className = "code-head";

      const label = document.createElement("span");
      label.textContent = lang;

      const copy = document.createElement("button");
      copy.className = "copy-code";
      copy.textContent = "Code kopieren";

      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(
          code?.textContent || ""
        );

        copy.textContent = "Kopiert ✓";

        setTimeout(() => {
          copy.textContent = "Code kopieren";
        }, 1300);
      });

      head.append(label, copy);

      pre.parentNode.insertBefore(wrap, pre);
      wrap.append(head, pre);
    });
  }

  row.append(avatar, body);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = document.createElement("button");
    copy.className = "mini-action";
    copy.textContent = "Antwort kopieren";

    copy.onclick = async () => {
      await navigator.clipboard.writeText(content);

      copy.textContent = "Kopiert ✓";

      setTimeout(() => {
        copy.textContent = "Antwort kopieren";
      }, 1200);
    };

    actions.append(copy);
    body.append(actions);
  }

  box.append(row);

  if (scroll) {
    $("chat").scrollTop = $("chat").scrollHeight;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = "";

  for (const c of state.chats) {
    const b = document.createElement("button");

    b.className =
      "history-item" +
      (c.id === state.activeChat ? " active" : "");

    b.textContent = c.title || "Neuer Chat";
    b.onclick = () => openChat(c.id);

    list.append(b);
  }
}

// ========================================
// TIPPANIMATION
// ========================================

function typing(show) {
  let t = $("typing");

  if (show) {
    if (!t) {
      t = document.createElement("div");
      t.id = "typing";
      t.className = "typing";

      t.innerHTML =
        'QuestionBar denkt nach <span class="dots"><i></i><i></i><i></i></span>';

      $("messages").append(t);
    }
  } else {
    t?.remove();
  }

  $("sendBtn").disabled = show;
}

// ========================================
// HILFSFUNKTIONEN
// ========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(response, attempt) {
  const retryDelays = [2000, 4000, 8000];

  let waitTime = retryDelays[attempt] || 8000;

  const retryAfter = response.headers.get("Retry-After");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      waitTime = Math.max(waitTime, seconds * 1000);
    } else {
      const retryDate = Date.parse(retryAfter);

      if (!Number.isNaN(retryDate)) {
        waitTime = Math.max(
          waitTime,
          retryDate - Date.now()
        );
      }
    }
  }

  return waitTime;
}

// ========================================
// GEMEINSAME API-ANFRAGE MIT WIEDERHOLUNG
// ========================================

async function requestJSON(url, headers, body, providerName) {
  const maxAttempts = 4;
  const totalTimeout = 240000;
  const deadline = Date.now() + totalTimeout;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new Error("TIMEOUT");
    }

    const controller = new AbortController();

    // Lange Antworten dürfen bis zu 120 Sekunden benötigen.
    const requestTimeout = Math.min(120000, remaining);

    const timeout = setTimeout(() => {
      controller.abort();
    }, requestTimeout);

    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify(body)
      });

    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("TIMEOUT");
      }

      if (
        err instanceof TypeError &&
        attempt < maxAttempts - 1
      ) {
        const waitTime = [2000, 4000, 8000][attempt];
        console.warn(
          `${providerName}: Verbindungsfehler. Neuer Versuch in ${waitTime / 1000} Sekunden.`
        );

        await sleep(waitTime);
        continue;
      }

      throw err;

    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return data;
    }

    const error = new Error(
      data.error?.message ||
      data.error?.message ||
      `HTTP ${response.status}`
    );

    error.status = response.status;
    error.apiStatus =
      data.error?.status ||
      data.error?.code ||
      data.error?.type ||
      "Nicht verfügbar";

    error.attempts = attempt + 1;

    const retryableStatuses = [
      429, 500, 502, 503, 504
    ];

    if (
      retryableStatuses.includes(response.status) &&
      attempt < maxAttempts - 1
    ) {
      const waitTime = getRetryDelay(response, attempt);
      const timeLeft = deadline - Date.now();

      if (timeLeft <= waitTime) {
        throw error;
      }

      console.warn(
        `${providerName} HTTP ${response.status}. Versuch ${attempt + 1}/${maxAttempts} fehlgeschlagen. Neuer Versuch in ${Math.ceil(waitTime / 1000)} Sekunden.`
      );

      await sleep(waitTime);
      continue;
    }

    throw error;
  }

  throw new Error("Die maximale Anzahl an Versuchen wurde erreicht.");
}

// ========================================
// GEMINI API
// ========================================

async function requestGemini(contents) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`;

  const body = {
    systemInstruction: {
      parts: [{
        text:
          "Du bist QuestionBar, ein hilfreicher deutschsprachiger KI-Assistent. Antworte klar und ausführlich, wenn nötig. Verwende Markdown, insbesondere Codeblöcke mit korrekter Sprachangabe. Erkläre Code auf Wunsch Schritt für Schritt."
      }]
    },

    contents,

    generationConfig: {
      temperature: 0.7
    }
  };

  return requestJSON(
    url,
    {
      "Content-Type": "application/json",
      "x-goog-api-key": settings.apiKeyGemini
    },
    body,
    "Gemini"
  );
}

// ========================================
// GROQ API
// ========================================

async function requestGroq(contents) {
  const url =
    "https://api.groq.com/openai/v1/chat/completions";

  const messages = [
    {
      role: "system",
      content:
        "Du bist QuestionBar, ein hilfreicher deutschsprachiger KI-Assistent. Antworte klar und ausführlich, wenn nötig. Verwende Markdown, insbesondere Codeblöcke mit korrekter Sprachangabe. Erkläre Code auf Wunsch Schritt für Schritt. Bei langen Textaufträgen sollst du ausführlich antworten und nicht unnötig abkürzen."
    },

    ...contents.map(message => ({
      role: message.role === "model"
        ? "assistant"
        : "user",

      content: message.parts
        .map(part => part.text || "")
        .join("\n")
    }))
  ];

  const body = {
    model: settings.model,
    messages,

    // Erlaubt längere Antworten.
    max_completion_tokens: 8192
  };

  return requestJSON(
    url,
    {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKeyGroq}`
    },
    body,
    "Groq"
  );
}

// ========================================
// ANBIETER AUSWÄHLEN
// ========================================

async function requestAI(contents) {
  if (settings.provider === "groq") {
    return requestGroq(contents);
  }

  return requestGemini(contents);
}

function extractAnswer(data) {
  if (settings.provider === "groq") {
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  return data.candidates?.[0]?.content?.parts
    ?.map(p => p.text || "")
    .join("\n")
    .trim() || "";
}

// ========================================
// FRAGE AN QUESTIONBAR SENDEN
// ========================================

async function ask(text) {
  text = text.trim();

  if (!text || state.busy) return;

  if (!getCurrentApiKey()) {
    $("settingsDialog").showModal();
    $("provider").value = settings.provider;
    $("model").value = settings.model;
    updateProviderFields();
    $("apiKey").focus();
    return;
  }

  state.busy = true;

  $("welcome").style.display = "none";

  state.history.push({
    role: "user",
    content: text
  });

  addMessage("user", text);

  $("prompt").value = "";
  autoResize();

  typing(true);
  saveActive();

  try {
    const contents = state.history.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const data = await requestAI(contents);
    const answer = extractAnswer(data);

    if (!answer) {
      throw new Error(
        `${settings.provider === "groq" ? "Groq" : "Gemini"} hat eine leere Antwort zurückgegeben.`
      );
    }

    state.history.push({
      role: "assistant",
      content: answer
    });

    typing(false);

    addMessage("assistant", answer);
    saveActive();

  } catch (err) {
    typing(false);

    const providerName =
      settings.provider === "groq" ? "Groq" : "Gemini";

    let message;

    if (err.message === "TIMEOUT") {
      message =
        `${providerName} hat nicht innerhalb der verfügbaren Zeit geantwortet. Bitte versuche es erneut.`;

    } else if (err.name === "TypeError") {
      message =
        `Verbindungsfehler: QuestionBar konnte ${providerName} nicht erreichen.`;

    } else if (err.status === 503) {
      message =
        `${providerName} ist momentan überlastet. Bitte versuche es später erneut.`;

    } else if (
      err.status === 500 ||
      err.status === 502 ||
      err.status === 504
    ) {
      message =
        `Der ${providerName}-Server ist momentan nicht erreichbar.`;

    } else if (err.status === 429) {
      message =
        `Das kostenlose Nutzungslimit von ${providerName} wurde möglicherweise erreicht. Warte etwas und versuche es erneut.`;

    } else if (err.status === 400) {
      message =
        `Die Anfrage wurde von ${providerName} abgelehnt. Prüfe den Modellnamen und die Anfrage.`;

    } else if (err.status === 401) {
      message =
        `Der API-Key für ${providerName} ist ungültig. Bitte überprüfe ihn in den Einstellungen.`;

    } else if (err.status === 403) {
      message =
        `Zugriff verweigert. Prüfe deinen API-Key und die Berechtigungen.`;

    } else if (err.status === 404) {
      message =
        `Das angegebene Modell wurde bei ${providerName} nicht gefunden.`;

    } else {
      message = err.message || "Unbekannter Fehler.";
    }

    const errorText =
      `**QuestionBar-Fehler**\n\n${message}\n\n` +
      `**Anbieter:** ${providerName}\n` +
      `**Modell:** ${settings.model}\n` +
      `**HTTP-Status:** ${err.status || "Nicht verfügbar"}\n` +
      `**API-Status:** ${err.apiStatus || "Nicht verfügbar"}\n` +
      `**Versuche:** ${err.attempts || 1}\n` +
      `**Details:** ${err.message}`;

    state.history.push({
      role: "assistant",
      content: errorText
    });

    addMessage("assistant", errorText);
    saveActive();

    console.error(`QuestionBar ${providerName} Fehler:`, err);

  } finally {
    state.busy = false;
    $("sendBtn").disabled = false;
  }
}

// ========================================
// EINGABEFELD
// ========================================

function autoResize() {
  const t = $("prompt");

  t.style.height = "auto";

  t.style.height =
    Math.min(t.scrollHeight, 150) + "px";
}

// ========================================
// MENÜ
// ========================================

function openDrawer() {
  $("drawer").classList.add("open");
  $("drawerBackdrop").classList.add("open");
}

function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawerBackdrop").classList.remove("open");
}

// ========================================
// EVENT LISTENER
// ========================================

$("composer").addEventListener("submit", e => {
  e.preventDefault();
  ask($("prompt").value);
});

$("prompt").addEventListener("input", autoResize);

$("prompt").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("composer").requestSubmit();
  }
});

document.querySelectorAll(".suggestion").forEach(b => {
  b.addEventListener("click", () => {
    $("prompt").value = b.dataset.prompt + " ";
    $("prompt").focus();
    autoResize();
  });
});

$("menuBtn").onclick = openDrawer;
$("closeDrawer").onclick = closeDrawer;
$("drawerBackdrop").onclick = closeDrawer;

$("newChat").onclick = () => newChat();

$("settingsBtn").onclick = () => {
  $("provider").value = settings.provider;
  $("model").value = settings.model;

  updateProviderFields();

  $("rememberChat").checked = settings.rememberChat;

  $("settingsDialog").showModal();
};

// Anbieter wechseln
$("provider").addEventListener("change", () => {
  updateProviderFields();
});

$("saveSettings").onclick = () => {
  const oldProvider = settings.provider;

  const newProvider = $("provider").value;
  const newModel = $("model").value.trim();

  // API-Key des aktuell ausgewählten Anbieters speichern
  settings.provider = newProvider;
  setCurrentApiKey($("apiKey").value.trim());

  settings.model = newModel || (
    newProvider === "groq"
      ? "openai/gpt-oss-120b"
      : "gemini-3.8-flash"
  );

  settings.rememberChat = $("rememberChat").checked;

  persist();

  console.log(
    `QuestionBar: Anbieter ${oldProvider} → ${newProvider}`
  );
};

$("deleteKey").onclick = () => {
  $("apiKey").value = "";
  setCurrentApiKey("");
  persist();
};

$("clearHistory").onclick = () => {
  if (
    confirm("Den gesamten gespeicherten Gesprächsverlauf löschen?")
  ) {
    state.chats = [];
    newChat();
    persist();
  }
};

// ========================================
// SERVICE WORKER
// ========================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (
      location.protocol === "http:" ||
      location.protocol === "https:"
    ) {
      navigator.serviceWorker
        .register("./sw.js")
        .catch(err => console.error("Service Worker:", err));
    }
  });
}

// ========================================
// START
// ========================================

load();
