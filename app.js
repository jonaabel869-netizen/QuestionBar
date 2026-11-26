
const state = {
  history: [],
  chats: [],
  activeChat: null,
  busy: false
};

const STORAGE = "questionbar-mobile-v1";

const IMAGE_API_URL =
  "https://questionbar-image-api.jonaabel869.workers.dev/";

const defaultSettings = {
  provider: "gemini",
  model: "gemini-3.8-flash",
  apiKeyGemini: "",
  apiKeyGroq: "",
  rememberChat: true
};

let settings = { ...defaultSettings };
let imageBusy = false;

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
      apiKeyGemini:
        savedSettings.apiKeyGemini ||
        (savedSettings.provider === "gemini"
          ? savedSettings.apiKey || ""
          : ""),
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
  updateProviderFields();
}

function persist() {
  localStorage.setItem(STORAGE + "_settings", JSON.stringify(settings));

  if (settings.rememberChat) {
    localStorage.setItem(STORAGE + "_chats", JSON.stringify(state.chats));
  } else {
    localStorage.removeItem(STORAGE + "_chats");
  }
}

function saveActive() {
  if (!state.activeChat) return;

  const chat = state.chats.find(c => c.id === state.activeChat);

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
  const provider = $("provider");
  const model = $("model");
  const keyLabel = $("apiKeyLabel");
  const keyInput = $("apiKey");

  if (!provider || !model || !keyLabel || !keyInput) return;

  const selectedProvider = provider.value;

  if (selectedProvider === "groq") {
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
      ? marked.parse(content, { gfm: true, breaks: true })
      : `<p>${escapeHtml(content)}</p>`;

    body.innerHTML = window.DOMPurify
      ? DOMPurify.sanitize(html)
      : html;

    body.querySelectorAll("pre").forEach(pre => {
      const code = pre.querySelector("code");
      const lang =
        (code?.className.match(/language-([\w+-]+)/) || [])[1] || "Code";

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
        await navigator.clipboard.writeText(code?.textContent || "");
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

function appendGeneratedImage(imageUrl, prompt) {
  const lastMessage = $("messages").lastElementChild;
  const body = lastMessage?.querySelector(".message-body");

  if (!body) return;

  const img = document.createElement("img");
  img.className = "generated-image";
  img.alt = prompt;
  img.src = imageUrl;
  img.loading = "lazy";

  body.insertBefore(img, body.querySelector(".message-actions"));

  const openLink = document.createElement("a");
  openLink.className = "image-download";
  openLink.textContent = "Bild öffnen";
  openLink.href = imageUrl;
  openLink.target = "_blank";
  openLink.rel = "noopener";

  body.insertBefore(openLink, body.querySelector(".message-actions"));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
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
      "history-item" + (c.id === state.activeChat ? " active" : "");
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
        waitTime = Math.max(waitTime, retryDate - Date.now());
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
    if (remaining <= 0) throw new Error("TIMEOUT");

    const controller = new AbortController();
    const requestTimeout = Math.min(120000, remaining);
    const timeout = setTimeout(() => controller.abort(), requestTimeout);

    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers,
        body: JSON.stringify(body)
      });
    } catch (err) {
      if (err.name === "AbortError") throw new Error("TIMEOUT");

      if (err instanceof TypeError && attempt < maxAttempts - 1) {
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
    if (response.ok) return data;

    const error = new Error(
      data.error?.message || `HTTP ${response.status}`
    );

    error.status = response.status;
    error.apiStatus =
      data.error?.status ||
      data.error?.code ||
      data.error?.type ||
      "Nicht verfügbar";
    error.attempts = attempt + 1;

    const retryableStatuses = [429, 500, 502, 503, 504];

    if (
      retryableStatuses.includes(response.status) &&
      attempt < maxAttempts - 1
    ) {
      const waitTime = getRetryDelay(response, attempt);
      const timeLeft = deadline - Date.now();

      if (timeLeft <= waitTime) throw error;

      console.warn(
        `${providerName} HTTP ${response.status}. Neuer Versuch in ${Math.ceil(waitTime / 1000)} Sekunden.`
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
    generationConfig: { temperature: 0.7 }
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
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const messages = [
    {
      role: "system",
      content:
        "Du bist QuestionBar, ein hilfreicher deutschsprachiger KI-Assistent. Antworte klar und ausführlich, wenn nötig. Verwende Markdown, insbesondere Codeblöcke mit korrekter Sprachangabe. Erkläre Code auf Wunsch Schritt für Schritt. Bei langen Textaufträgen sollst du ausführlich antworten und nicht unnötig abkürzen."
    },
    ...contents.map(message => ({
      role: message.role === "model" ? "assistant" : "user",
      content: message.parts.map(part => part.text || "").join("\n")
    }))
  ];

  const body = {
    model: settings.model,
    messages,
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
  if (settings.provider === "groq") return requestGroq(contents);
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
// BILDERKENNUNG
// ========================================

function isImageRequest(text) {
  const value = text.trim();

  // Klassische Bildanfragen
  if (
    /\b(?:generiere|erstelle|erzeuge|zeichne|male|mach|mache)\b[\s\S]{0,120}\b(?:bild|foto|fotografie|zeichnung|illustration|grafik|render)\b/i.test(value) ||
    /\b(?:bild|foto|fotografie|zeichnung|illustration|grafik|render)\b[\s\S]{0,120}\b(?:generieren|erstellen|erzeugen|zeichnen|malen)\b/i.test(value) ||
    /\b(?:bildgenerierung|bildgenerator)\b/i.test(value)
  ) {
    return true;
  }

  // Auch reine Bildbeschreibungen erkennen:
  // "Ein grüner Apfel auf einem weißen Tisch, realistisches Foto."
  return (
    /\b(?:foto|fotografie|bild|illustration|zeichnung|grafik|render)\b/i.test(value) &&
    /\b(?:realistisch|fotorealistisch|realistisches|realistische|generiert|erstellt)\b/i.test(value)
  );
}

// Folgeanfragen wie:
// "Erstelle es jetzt in Rot"
// "Mach den Lamborghini blau"
// "Ändere die Farbe zu Schwarz"

function isImageFollowUp(text) {
  const value = text.trim();

  const hasReference =
    /\b(?:es|ihn|sie|das|dieses|davon|denselben|dieselbe|gleiches|gleiche|bild|auto|wagen)\b/i.test(value);

  const hasChange =
    /\b(?:erstelle|erzeuge|generiere|mach|mache|ändere|aendere|wandle|verändere|veraendere|jetzt|stattdessen|aber|nur|farbe|farbig|rot|grün|gruen|blau|schwarz|weiß|weiss|gelb|orange|lila|violett|rosa|pink|silber|gold|dunkler|heller|größer|groesser|kleiner|hintergrund|perspektive|stil|mit|ohne|in)\b/i.test(value);

  const shortChange =
    /^(?:und\s+)?(?:jetzt\s+)?(?:in|mit|ohne)\s+\w+/i.test(value);

  return (hasReference && hasChange) || shortChange;
}

// Sucht das letzte Bild oder eine Bildbeschreibung im aktuellen Chat.

function getPreviousImagePrompt() {
  // Zuerst nach einem erfolgreich generierten Bild suchen.
  for (let i = state.history.length - 1; i >= 0; i--) {
    const message = state.history[i];

    if (
      message.role === "assistant" &&
      message.content === "🖼️ Dein Bild wurde erstellt."
    ) {
      if (message.imagePrompt) {
        return message.imagePrompt;
      }

      for (let j = i - 1; j >= 0; j--) {
        if (state.history[j].role === "user") {
          return state.history[j].content;
        }
      }
    }
  }

  // Falls noch kein Bild existiert:
  // Die letzte passende Bildbeschreibung suchen.
  for (let i = state.history.length - 1; i >= 0; i--) {
    const message = state.history[i];

    if (
      message.role === "user" &&
      isImageRequest(message.content)
    ) {
      return message.content;
    }
  }

  return null;
}

// Baut einen neuen Prompt aus dem ursprünglichen Bild
// und der Änderungsanweisung.

function buildImagePrompt(originalPrompt, followUp) {
  return [
    "Create a new image based on the following original image description:",
    originalPrompt,
    "",
    "The user now requests this change:",
    followUp,
    "",
    "Keep the same main subject and overall scene.",
    "Apply the latest user instruction as the highest priority.",
    "If the new instruction conflicts with the original description, the new instruction wins.",
    "Generate the actual image. Do not return a text description."
  ].join("\n");
}

// ========================================
// CLOUDFLARE BILDGENERIERUNG
// ========================================

async function requestCloudflareImage(prompt) {
  if (imageBusy) {
    throw new Error("Es wird bereits ein Bild erstellt. Bitte warte kurz.");
  }

  imageBusy = true;

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.error || errorData.message || errorText;
      } catch {}

      throw new Error(
        errorMessage || `Cloudflare HTTP ${response.status}`
      );
    }

    const imageBlob = await response.blob();

    if (!imageBlob.type.startsWith("image/")) {
      throw new Error("Cloudflare hat keine Bilddatei zurückgegeben.");
    }

    return URL.createObjectURL(imageBlob);

  } finally {
    imageBusy = false;
  }
}

// ========================================
// FRAGE AN QUESTIONBAR SENDEN
// ========================================

async function ask(text) {
  text = text.trim();
  if (!text || state.busy) return;

  // Vor der neuen Nachricht den bisherigen Bildkontext suchen.
  const previousImagePrompt = getPreviousImagePrompt();

  const directImageRequest = isImageRequest(text);

  const imageFollowUp =
    !directImageRequest &&
    Boolean(previousImagePrompt) &&
    isImageFollowUp(text);

  const shouldGenerateImage =
    directImageRequest || Boolean(imageFollowUp);

  // Für Bilder wird kein Gemini- oder Groq-Key benötigt.
  if (!shouldGenerateImage && !getCurrentApiKey()) {
    $("settingsDialog").showModal();
    $("provider").value = settings.provider;
    $("model").value = settings.model;
    updateProviderFields();
    $("apiKey").focus();
    return;
  }

  const finalImagePrompt = imageFollowUp
    ? buildImagePrompt(previousImagePrompt, text)
    : text;

  state.busy = true;
  $("welcome").style.display = "none";

  state.history.push({ role: "user", content: text });
  addMessage("user", text);

  $("prompt").value = "";
  autoResize();
  typing(true);
  saveActive();

  try {
    // ====================================
    // BILDANFRAGE DIREKT AN CLOUDFLARE
    // ====================================

    if (shouldGenerateImage) {
      try {
        const imageUrl = await requestCloudflareImage(finalImagePrompt);

        const imageMessage = "🖼️ Dein Bild wurde erstellt.";

        state.history.push({
          role: "assistant",
          content: imageMessage,
          imagePrompt: finalImagePrompt
        });

        typing(false);
        addMessage("assistant", imageMessage);
        appendGeneratedImage(imageUrl, finalImagePrompt);
        saveActive();

      } catch (imageError) {
        typing(false);

        const errorText =
          `**Bild konnte nicht erstellt werden**\n\n${imageError.message}`;

        state.history.push({
          role: "assistant",
          content: errorText
        });

        addMessage("assistant", errorText);
        saveActive();

        console.error("QuestionBar Bildgenerierung:", imageError);
      }

      return;
    }

    // ====================================
    // NORMALE CHAT-ANFRAGE AN GROQ/GEMINI
    // ====================================

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

    state.history.push({ role: "assistant", content: answer });
    typing(false);
    addMessage("assistant", answer);
    saveActive();

  } catch (err) {
    typing(false);

    const providerName =
      settings.provider === "groq" ? "Groq" : "Gemini";

    let message;

    if (err.message === "TIMEOUT") {
      message = `${providerName} hat nicht innerhalb der verfügbaren Zeit geantwortet. Bitte versuche es erneut.`;
    } else if (err.name === "TypeError") {
      message = `Verbindungsfehler: QuestionBar konnte ${providerName} nicht erreichen.`;
    } else if (err.status === 503) {
      message = `${providerName} ist momentan überlastet. Bitte versuche es später erneut.`;
    } else if ([500, 502, 504].includes(err.status)) {
      message = `Der ${providerName}-Server ist momentan nicht erreichbar.`;
    } else if (err.status === 429) {
      message = `Das Nutzungslimit von ${providerName} wurde möglicherweise erreicht.`;
    } else if (err.status === 400) {
      message = `Die Anfrage wurde von ${providerName} abgelehnt. Prüfe den Modellnamen und die Anfrage.`;
    } else if (err.status === 401) {
      message = `Der API-Key für ${providerName} ist ungültig.`;
    } else if (err.status === 403) {
      message = "Zugriff verweigert. Prüfe deinen API-Key und die Berechtigungen.";
    } else if (err.status === 404) {
      message = `Das angegebene Modell wurde bei ${providerName} nicht gefunden.`;
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

    state.history.push({ role: "assistant", content: errorText });
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
  t.style.height = Math.min(t.scrollHeight, 150) + "px";
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
// SEPARATES BILDFENSTER
// ========================================

function createImageDialog() {
  if ($("imageDialog")) return;

  const dialog = document.createElement("dialog");
  dialog.id = "imageDialog";
  dialog.className = "image-dialog";

  dialog.innerHTML = `
    <div class="image-panel">
      <div class="settings-head">
        <h2>Bild erstellen</h2>
        <button class="icon-btn" id="closeImageDialog"
          type="button" aria-label="Schließen">×</button>
      </div>

      <p class="image-description">
        Beschreibe das Bild, das QuestionBar für dich erstellen soll.
      </p>

      <label for="imagePrompt">Bildbeschreibung</label>

      <textarea
        id="imagePrompt"
        class="image-prompt"
        placeholder="z. B. Eine futuristische Stadt bei Sonnenuntergang ..."
        rows="4"
      ></textarea>

      <p class="image-cost-note">
        Bildgenerierung über Cloudflare Workers AI.
      </p>

      <button class="primary-btn" id="generateImage" type="button">
        Bild generieren
      </button>

      <div id="imageResult" class="image-result" aria-live="polite"></div>
    </div>
  `;

  document.body.append(dialog);

  $("closeImageDialog").onclick = () => dialog.close();
  $("generateImage").onclick = generateCloudflareImage;
}

async function generateCloudflareImage() {
  const prompt = $("imagePrompt").value.trim();
  const result = $("imageResult");
  const button = $("generateImage");

  if (!prompt) {
    result.textContent = "Bitte gib zuerst eine Bildbeschreibung ein.";
    return;
  }

  if (imageBusy) {
    result.textContent = "Es wird bereits ein Bild erstellt.";
    return;
  }

  button.disabled = true;
  button.textContent = "Bild wird erstellt ...";
  result.innerHTML =
    '<div class="image-loading">QuestionBar erstellt dein Bild ...</div>';

  try {
    const imageUrl = await requestCloudflareImage(prompt);

    const img = document.createElement("img");
    img.className = "generated-image";
    img.alt = prompt;
    img.src = imageUrl;

    result.innerHTML = "";
    result.append(img);

    const download = document.createElement("a");
    download.className = "image-download";
    download.textContent = "Bild öffnen";
    download.href = imageUrl;
    download.target = "_blank";
    download.rel = "noopener";

    result.append(download);

  } catch (error) {
    console.error("Bildgenerierung:", error);
    result.textContent =
      "Bild konnte nicht erstellt werden: " + error.message;

  } finally {
    button.disabled = false;
    button.textContent = "Bild generieren";
  }
}

// ========================================
// MENÜPUNKTE
// ========================================

function addQuestionBarMenu() {
  const drawer = $("drawer");
  const newChatButton = $("newChat");

  if (!drawer || !newChatButton || !drawer.querySelector(".drawer-bottom")) {
    console.error("QuestionBar-Menü konnte nicht erweitert werden.");
    return;
  }

  if ($("imageMenuButton")) return;

  const imageButton = document.createElement("button");
  imageButton.id = "imageMenuButton";
  imageButton.className = "drawer-action image-menu-button";
  imageButton.type = "button";
  imageButton.textContent = "✦ Bild erstellen";

  imageButton.onclick = () => {
    closeDrawer();
    $("imageDialog").showModal();
  };

  newChatButton.insertAdjacentElement("afterend", imageButton);
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

$("provider").addEventListener("change", updateProviderFields);

$("saveSettings").onclick = () => {
  const oldProvider = settings.provider;
  const newProvider = $("provider").value;
  const newModel = $("model").value.trim();

  settings.provider = newProvider;
  setCurrentApiKey($("apiKey").value.trim());

  settings.model = newModel || (
    newProvider === "groq"
      ? "openai/gpt-oss-120b"
      : "gemini-3.8-flash"
  );

  settings.rememberChat = $("rememberChat").checked;
  persist();

  console.log(`QuestionBar: Anbieter ${oldProvider} → ${newProvider}`);
};

$("deleteKey").onclick = () => {
  $("apiKey").value = "";
  setCurrentApiKey("");
  persist();
};

$("clearHistory").onclick = () => {
  if (confirm("Den gesamten gespeicherten Gesprächsverlauf löschen?")) {
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
    if (location.protocol === "http:" || location.protocol === "https:") {
      navigator.serviceWorker
        .register("./sw.js")
        .catch(err => console.error("Service Worker:", err));
    }
  });
}

// ========================================
// START
// ========================================

createImageDialog();
addQuestionBarMenu();
load();
