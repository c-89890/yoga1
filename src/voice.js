const BASE = "./voice/";

let ctx = null, master = null;
let current = [];
const buffers = new Map();
let index = {};
let normIndex = {};
let lastText = "", lastAt = 0;
let loading = null;

const norm = (s) => String(s).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");

export function unlockVoice() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  ctx.resume();

  const gain = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 12;
  gain.gain.value = 1.4;
  gain.connect(comp).connect(ctx.destination);
  master = gain;

  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start(0);
}

export function preloadVoice() {
  if (loading) return loading;
  loading = (async () => {
    if (!ctx) unlockVoice();

    try {
      const res = await fetch(BASE + "index.json");
      const txt = (await res.text()).replace(/^\uFEFF/, "");
      index = JSON.parse(txt);
      normIndex = {};
      for (const [k, v] of Object.entries(index)) normIndex[norm(k)] = v;
    } catch (e) {
      console.warn("index.json 加载失败", e);
      return;
    }

    const files = [...new Set(Object.values(index).map(e => e.f))];
    await Promise.all(files.map(async f => {
      try {
        const r = await fetch(BASE + f);
        if (!r.ok) return;
        buffers.set(f, await ctx.decodeAudioData(await r.arrayBuffer()));
      } catch {}
    }));

    console.log("语音加载完成", buffers.size, "/", files.length);
  })();
  return loading;
}

export function stopVoice() {
  for (const s of current) { try { s.stop(); } catch {} }
  current = [];
}

function playEntry(e) {
  if (!ctx || !master) return false;
  const buf = buffers.get(e.f);
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start(ctx.currentTime + 0.01, e.o, e.d);
  current.push(src);
  return true;
}

function findEntry(text) {
  if (index[text]) return index[text];
  const n = norm(text);
  if (normIndex[n]) return normIndex[n];
  for (const [k, v] of Object.entries(normIndex)) {
    if (n.startsWith(k) || k.startsWith(n)) return v;
  }
  return null;
}

export function speakText(text) {
  const e = findEntry(text);
  console.log("[voice]", JSON.stringify(text), "→", e ? e.o + "s" : "未命中");

  const now = Date.now();
  if (text === lastText && now - lastAt < 4000) return;
  lastText = text;
  lastAt = now;

  stopVoice();
  if (e && playEntry(e)) return;

  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

export const cue = () => {};
export const sayPhrase = () => {};

