import { unlockVoice, preloadVoice, cue, sayPhrase, stopVoice } from "./voice.js";
import { createPoseLandmarker, openCamera } from "./pose.js";
import { POSES } from "./poses.js";
import { LandmarkSmoother, Ema, repairLandmarks } from "./smoothing.js";
import { evaluate, detectBestPose } from "./scorer.js";
import { Overlay, paintSkeleton } from "./overlay.js";
import { CastSender } from "./cast.js";
import { connectHeartRate, bleSupported } from "./ble.js";
import { VoiceCoach } from "./speech.js";
import { SnapshotBook } from "./history.js";

const $ = (id) => document.getElementById(id);

const video = $("video"), canvas = $("overlay");
const splash = $("splash"), splashHint = $("splashHint"), startBtn = $("startBtn");
const poseSelect = $("poseSelect"), qualitySel = $("qualitySel");
const gradeEl = $("grade"), scoreEl = $("score"), cuesEl = $("cues");
const holdEl = $("hold"), fpsEl = $("fps"), ruleList = $("ruleList");
const hrBox = $("hrBox"), hrEl = $("hr");
const statLine = $("statLine"), suggestEl = $("suggest");
const gallery = $("gallery"), galleryList = $("galleryList");

const overlay = new Overlay(canvas);
const cast = new CastSender();
const voice = new VoiceCoach({ rate: 1.05 });
const snaps = new SnapshotBook();
const fullCache = new Map();

const QUALITY = {
  speed:    { quality: "lite", width: 640,  height: 480, fps: 15, strict: 1.25 },
  balanced: { quality: "lite", width: 960,  height: 540, fps: 18, strict: 1.0 },
  accurate: { quality: "full", width: 1280, height: 720, fps: 12, strict: 0.85 }
};

const state = {
  running: false, landmarker: null, stream: null, facing: "user",
  pose: POSES[0], quality: "balanced",
  smoother: new LandmarkSmoother(), ema: new Ema(0.25),
  frameInterval: 1000 / 18, lastDetectAt: 0, lastVideoTime: -1,
  hold: 0, lastTick: 0,
  voiceOn: true, lastVoiceAt: 0,
  lastDetectPoseAt: 0, suggest: null,
  last: null,
  scores: [], startedAt: 0
};

/* ---------------- UI 初始化 ---------------- */
POSES.forEach((p, i) => {
  const o = document.createElement("option");
  o.value = i; o.textContent = p.name;
  poseSelect.appendChild(o);
});

poseSelect.addEventListener("change", () => {
  state.pose = POSES[+poseSelect.value];
  state.smoother.reset(); state.ema.reset();
  state.hold = 0; state.scores = [];
  renderRules(null); cuesEl.innerHTML = "";
  hideSuggest();
  voice.speak("已切换到" + state.pose.name.split(" ")[0]);
});

qualitySel.addEventListener("change", async () => {
  state.quality = qualitySel.value;
  const q = QUALITY[state.quality];
  state.frameInterval = 1000 / q.fps;
  toast("已切换画质：" + (state.quality === "accurate" ? "精细" : state.quality === "speed" ? "流畅" : "均衡"));
  if (state.running) await restartPipeline();
});

/* ---------------- 启动 ---------------- */
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  voice.unlock();                      // 必须在用户手势里解锁语音
  try {
    await bootPipeline();
    splash.classList.add("hide");
    $("dot").classList.add("on");
    state.running = true;
    state.startedAt = performance.now();
    state.lastTick = performance.now();
    video.requestVideoFrameCallback(tick);
    voice.speak("开始练习");
  } catch (e) {
    console.error(e);
    splashHint.textContent = "启动失败：" + (e?.message || e);
    startBtn.disabled = false;
  }
});

async function bootPipeline() {
  const q = QUALITY[state.quality];
  splashHint.textContent = "正在加载模型…";
  state.landmarker = await createPoseLandmarker({ quality: q.quality });

  splashHint.textContent = "正在打开摄像头…";
  state.stream = await openCamera({ facing: state.facing, width: q.width, height: q.height });
  video.srcObject = state.stream;
  await video.play();
  await new Promise((r) =>
    video.readyState >= 2 ? r() : video.addEventListener("loadeddata", r, { once: true }));

  overlay.resize(video.videoWidth, video.videoHeight);
}

async function restartPipeline() {
  const wasRunning = state.running;
  state.running = false;
  try {
    state.stream?.getTracks().forEach((t) => t.stop());
    state.smoother.reset(); state.ema.reset();
    await bootPipeline();
  } catch (e) {
    toast("切换失败：" + e.message);
  }
  state.running = wasRunning;
  if (wasRunning) {
    state.lastTick = performance.now();
    video.requestVideoFrameCallback(tick);
  }
}

/* ---------------- 主循环 ---------------- */
let fpsCount = 0, fpsAt = performance.now();

function tick() {
  if (!state.running) return;
  video.requestVideoFrameCallback(tick);

  const now = performance.now();
  const dt = now - state.lastTick;
  state.lastTick = now;

  if (now - state.lastDetectAt < state.frameInterval) return;
  state.lastDetectAt = now;
  if (video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;

  let res;
  try { res = state.landmarker.detectForVideo(video, now); }
  catch (e) { console.warn(e); return; }

  const raw = res?.landmarks?.[0];
  if (!raw) { onNoPose(); return; }

  const lm = state.smoother.update(repairLandmarks(raw, 0.35));
  const { strict } = QUALITY[state.quality];
  const out = evaluate(state.pose, lm, { strict });
  const score = state.ema.push(out.score);

  if (score >= 0.78) state.hold += dt; else state.hold = 0;
  state.last = { lm, out, score };

  if (video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
    overlay.resize(video.videoWidth, video.videoHeight);
  }
  overlay.draw(lm, out.badJoints);
  updateUI(score, out);
  pushScore(score);

  // 语音：4 秒冷却，避免刷屏
  if (state.voiceOn && now - state.lastVoiceAt > 4000) {
    if (out.cues.length) { voice.coach(out.cues, score); state.lastVoiceAt = now; }
    else if (score >= 0.93) { voice.speak("很好"); state.lastVoiceAt = now; }
  }

  // 动作自动识别：1.5 秒一次
  if (now - state.lastDetectPoseAt > 1500) {
    state.lastDetectPoseAt = now;
    const best = detectBestPose(POSES, lm);
    if (best && best.pose !== state.pose && best.score > 0.72 && best.score - out.score > 0.12) {
      showSuggest(best.pose, best.score);
    } else hideSuggest();
  }

  if (cast.connected) {
    cast.send({
      score, hold: state.hold, pose: state.pose.name, cues: out.cues,
      lm: lm.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.visibility ?? 1).toFixed(2)])
    });
  }

  fpsCount++;
  if (now - fpsAt > 1000) {
    fpsEl.textContent = fpsCount + " fps";
    fpsCount = 0; fpsAt = now;
  }
}

function onNoPose() {
  overlay.clear();
  state.ema.reset();
  state.hold = 0;
  state.last = null;
  scoreEl.textContent = "0";
  gradeEl.textContent = "--";
  cuesEl.innerHTML = `<div class="cue">请后退一步，让全身进入画面</div>`;
  holdEl.textContent = "保持 0.0s";
  renderRules(null);
}

function pushScore(s) {
  state.scores.push(s);
  if (state.scores.length > 3000) state.scores.shift();
}

/* ---------------- UI ---------------- */
function updateUI(score, out) {
  const s = Math.round(score * 100);
  scoreEl.textContent = s;
  const [g, c] =
    s >= 90 ? ["优秀", "#3ddc97"] :
    s >= 75 ? ["良好", "#a8e6a1"] :
    s >= 60 ? ["及格", "#ffb020"] : ["需调整", "#ff5d5d"];
  gradeEl.textContent = g;
  gradeEl.style.color = c;
  scoreEl.style.color = c;

  holdEl.textContent = `保持 ${(state.hold / 1000).toFixed(1)}s`;
  cuesEl.innerHTML = (out.cues || []).slice(0, 3)
    .map((x) => `<div class="cue">${x}</div>`).join("");

  renderRules(out);
  renderStats();
}

function renderRules(out) {
  ruleList.innerHTML = state.pose.rules.map((r) => {
    const res = out?.results.find((x) => x.rule === r);
    const st = !res ? "idle" : res.missing ? "bad" : res.s >= 0.85 ? "ok" : res.s >= 0.5 ? "warn" : "bad";
    const pct = res && !res.missing ? Math.round(res.s * 100) : 0;
    return `<li class="rule ${st}">
      <span class="bar"><i style="width:${pct}%"></i></span>
      <span class="lb">${r.label}${res?.missing ? "（未识别）" : ""}</span>
    </li>`;
  }).join("");
}

function renderStats() {
  if (!state.scores.length) { statLine.textContent = "—"; return; }
  const avg = state.scores.reduce((a, b) => a + b, 0) / state.scores.length;
  const max = Math.max(...state.scores);
  const min = Math.min(...state.scores);
  const dur = Math.round((performance.now() - state.startedAt) / 1000);
  statLine.textContent =
    `平均 ${Math.round(avg * 100)} · 最高 ${Math.round(max * 100)} · 最低 ${Math.round(min * 100)} · 时长 ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`;
}

function showSuggest(pose, score) {
  state.suggest = pose;
  suggestEl.hidden = false;
  suggestEl.textContent = `看起来你在做「${pose.name}」（${Math.round(score * 100)} 分）—— 点这里切换`;
}
function hideSuggest() { state.suggest = null; suggestEl.hidden = true; }

suggestEl.addEventListener("click", () => {
  if (!state.suggest) return;
  state.pose = state.suggest;
  poseSelect.value = String(POSES.indexOf(state.suggest));
  state.smoother.reset(); state.ema.reset(); state.hold = 0;
  renderRules(null);
  hideSuggest();
  voice.speak("已切换到" + state.pose.name.split(" ")[0]);
});

/* ---------------- 定格 ---------------- */
$("snapBtn").addEventListener("click", takeSnapshot);

function takeSnapshot() {
  const s = state.last;
  if (!s?.lm) { toast("还没检测到人体，先站进画面"); return; }
  if (!video.videoWidth) { toast("视频还没就绪"); return; }

  const W = video.videoWidth, H = video.videoHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");

  g.save();
  g.translate(W, 0); g.scale(-1, 1);
  g.drawImage(video, 0, 0, W, H);
  g.restore();

  paintSkeleton(g, s.lm, s.out.badJoints, W, H, true);

  const pad = Math.round(W * 0.03);
  g.font = `600 ${Math.round(W / 22)}px -apple-system,"PingFang SC",sans-serif`;
  g.textBaseline = "top";
  g.fillStyle = "rgba(0,0,0,.45)";
  g.fillRect(pad, pad, W * 0.42, H * 0.13);
  g.fillStyle = "#3ddc97";
  g.fillText(`${Math.round(s.score * 100)} 分`, pad * 1.6, pad * 1.4);
  g.fillStyle = "#e9eef5";
  g.font = `400 ${Math.round(W / 40)}px -apple-system,"PingFang SC",sans-serif`;
  g.fillText(state.pose.name, pad * 1.6, pad * 1.4 + W / 22 + 8);

  const full = c.toDataURL("image/jpeg", 0.92);

  const t = document.createElement("canvas");
  const tw = 360, th = Math.round((tw * H) / W);
  t.width = tw; t.height = th;
  t.getContext("2d").drawImage(c, 0, 0, tw, th);
  const thumb = t.toDataURL("image/jpeg", 0.7);

  const item = snaps.add({
    thumb, pose: state.pose.name, score: s.score, cues: s.out.cues
  });
  fullCache.set(item.id, full);

  toast("已定格 " + Math.round(s.score * 100) + " 分");
  voice.speak("已定格，" + Math.round(s.score * 100) + " 分", { force: true });
  renderGallery();
}

/* ---------------- 记录抽屉 ---------------- */
function renderGallery() {
  const items = snaps.all;
  if (!items.length) {
    galleryList.innerHTML = `<div class="empty">还没有定格。<br>练习时点「📸 定格」，会保存当时的姿势和分数。</div>`;
    return;
  }
  galleryList.innerHTML = items.map((it) => {
    const s = Math.round(it.score * 100);
    const color = s >= 90 ? "#3ddc97" : s >= 75 ? "#a8e6a1" : s >= 60 ? "#ffb020" : "#ff5d5d";
    return `<figure class="snap">
      <img src="${it.thumb}" alt="">
      <figcaption>
        <b style="color:${color}">${s} 分</b>
        <span>${it.pose}</span>
        <time>${new Date(it.ts).toLocaleString("zh-CN", { hour12: false })}</time>
        <div class="snap-btns">
          <button data-dl="${it.id}">下载</button>
          <button data-del="${it.id}">删除</button>
        </div>
      </figcaption>
    </figure>`;
  }).join("");
}

galleryList.addEventListener("click", (e) => {
  const dl = e.target.dataset?.dl;
  const del = e.target.dataset?.del;
  if (dl) {
    const it = snaps.all.find((i) => i.id === dl);
    if (!it) return;
    const a = document.createElement("a");
    a.href = fullCache.get(dl) || it.thumb;
    a.download = `yoga-${it.pose}-${Math.round(it.score * 100)}-${dl}.jpg`;
    a.click();
  }
  if (del) { snaps.remove(del); fullCache.delete(del); renderGallery(); }
});

$("galleryBtn").addEventListener("click", () => {
  renderGallery();
  gallery.hidden = false;
});
$("galleryClose").addEventListener("click", () => { gallery.hidden = true; });
$("galleryClear").addEventListener("click", () => {
  if (!snaps.all.length) return;
  if (confirm("清空全部定格记录？")) { snaps.clear(); fullCache.clear(); renderGallery(); }
});

/* ---------------- 语音开关 ---------------- */
$("voiceBtn").addEventListener("click", (e) => {
  state.voiceOn = !state.voiceOn;
  voice.setEnabled(state.voiceOn);
  e.target.classList.toggle("on", state.voiceOn);
  e.target.textContent = state.voiceOn ? "🔊 语音" : "🔇 静音";
  toast(state.voiceOn ? "语音已开启" : "语音已关闭");
});

/* ---------------- 投屏 ---------------- */
$("castBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (cast.connected) {
    cast.stop(); btn.classList.remove("on"); toast("已断开投屏"); return;
  }
  try {
    await cast.startPresentation();
    btn.classList.add("on"); toast("已投屏到第二屏");
    return;
  } catch {}

  const proto = location.protocol === "https:" ? "wss" : "ws";
  try {
    await cast.startWebSocket(`${proto}://${location.host}/ws`);
    btn.classList.add("on");
    toast("投屏通道已开，另一台设备打开 /cast.html");
  } catch {
    cast.startBroadcast();
    btn.classList.add("on");
    toast("同机投屏：新窗口打开 /cast.html");
  }
});

/* ---------------- 蓝牙 ---------------- */
$("bleBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (!bleSupported()) { toast("此浏览器不支持蓝牙，请用安卓 Chrome"); return; }
  try {
    await connectHeartRate((bpm) => {
      hrBox.hidden = false;
      hrEl.textContent = bpm ?? "--";
    });
    btn.classList.add("on");
    toast("心率带已连接");
  } catch (err) {
    toast("蓝牙失败：" + (err?.message || err));
  }
});

/* ---------------- 镜头切换 ---------------- */
$("flipBtn").addEventListener("click", async () => {
  state.facing = state.facing === "user" ? "environment" : "user";
  if (!state.stream) return;
  await restartPipeline();
});

/* ---------------- 提示条 ---------------- */
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

/* ---------------- PWA ---------------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
