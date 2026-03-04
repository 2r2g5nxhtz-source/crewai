const QUEUE_KEY = "pwa-agent-queue-v1";
const API_ENDPOINT = "/api/agent";

const els = {
  input: document.getElementById("command-input"),
  sendBtn: document.getElementById("send-btn"),
  voiceBtn: document.getElementById("voice-btn"),
  flushBtn: document.getElementById("flush-btn"),
  modePill: document.getElementById("mode-pill"),
  status: document.getElementById("status-line"),
  queueSize: document.getElementById("queue-size"),
  response: document.getElementById("response-box"),
};

function setStatus(message) {
  if (els.status) els.status.textContent = message;
}

function updateQueueLabel() {
  const queue = getQueue();
  if (els.queueSize) els.queueSize.textContent = `Queued items: ${queue.length}`;
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function setQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  updateQueueLabel();
}

function enqueue(payload) {
  const queue = getQueue();
  queue.push(payload);
  setQueue(queue);
}

function makeRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function callAgent(payload) {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function sendWithRetry(payload) {
  const delays = [2000, 5000, 10000, 20000];
  let lastError = null;

  for (let i = 0; i < delays.length; i += 1) {
    try {
      const result = await callAgent(payload);
      return result;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }
  }

  throw lastError || new Error("Request failed");
}

async function submitCommand(rawCommand) {
  const command = rawCommand.trim();
  if (!command) {
    setStatus("Command is empty.");
    return;
  }

  const payload = {
    request_id: makeRequestId(),
    source: "safari-pwa",
    command,
    sent_at: new Date().toISOString(),
  };

  setStatus("Sending command...");
  try {
    const result = await sendWithRetry(payload);
    els.response.textContent = JSON.stringify(result, null, 2);
    setStatus("Command processed.");
  } catch (_) {
    enqueue(payload);
    setStatus("Network unavailable. Command queued.");
  }
}

async function flushQueue() {
  const queue = getQueue();
  if (!queue.length) {
    setStatus("Queue is empty.");
    return;
  }

  setStatus(`Flushing ${queue.length} queued item(s)...`);
  const remaining = [];

  for (const payload of queue) {
    try {
      const result = await sendWithRetry(payload);
      els.response.textContent = JSON.stringify(result, null, 2);
    } catch (_) {
      remaining.push(payload);
    }
  }

  setQueue(remaining);
  if (remaining.length) {
    setStatus(`${remaining.length} item(s) still queued.`);
  } else {
    setStatus("Queue flushed successfully.");
  }
}

function initDisplayMode() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isIOSStandalone = window.navigator.standalone === true;
  if (isStandalone || isIOSStandalone) {
    document.body.classList.add("pwa-mode");
    if (els.modePill) els.modePill.textContent = "PWA Mode";
  }
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js");
      setStatus("Service Worker active.");
    } catch (error) {
      setStatus(`SW registration failed: ${error.message}`);
    }
  });
}

class VoiceController {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }

  init() {
    if (!this.isSupported || !els.voiceBtn) {
      if (els.voiceBtn) els.voiceBtn.disabled = true;
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.lang = "en-US";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      els.voiceBtn.classList.add("listening");
      setStatus("Listening...");
    };

    this.recognition.onend = () => {
      this.isListening = false;
      els.voiceBtn.classList.remove("listening");
    };

    this.recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (els.input) els.input.value = transcript;
      await submitCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      setStatus(`Voice error: ${event.error}`);
    };

    els.voiceBtn.addEventListener("click", () => {
      if (!this.recognition) return;
      this.recognition.start();
    });
  }
}

function bindActions() {
  if (els.sendBtn) {
    els.sendBtn.addEventListener("click", async () => {
      await submitCommand(els.input?.value || "");
    });
  }

  if (els.flushBtn) {
    els.flushBtn.addEventListener("click", async () => {
      await flushQueue();
    });
  }

  window.addEventListener("online", () => {
    flushQueue().catch(() => null);
  });
}

function init() {
  initDisplayMode();
  initServiceWorker();
  bindActions();
  updateQueueLabel();
  new VoiceController().init();
}

init();
