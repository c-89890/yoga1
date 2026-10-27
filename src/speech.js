/** 中文语音播报：同一句话冷却 4s，正在说话时不插队，除非强制打断 */
export class VoiceCoach {
  constructor({ rate = 1.05, volume = 1, cooldown = 4000 } = {}) {
    this.supported = "speechSynthesis" in window;
    this.enabled = true;
    this.rate = rate;
    this.volume = volume;
    this.cooldown = cooldown;
    this.last = new Map();
    this.speaking = false;
    if (this.supported) {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
  }

  /** 必须在用户点击事件里调一次，iOS / 部分安卓才会允许后续自动播报 */
  unlock() {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  pickVoice() {
    const vs = speechSynthesis.getVoices();
    return (
      vs.find((v) => /zh[-_]CN/i.test(v.lang) && /xiaoxiao|yaoyao|huihui|tingting|female/i.test(v.name)) ||
      vs.find((v) => /zh/i.test(v.lang)) ||
      null
    );
  }

  speak(text, { force = false } = {}) {
    if (!this.supported || !this.enabled || !text) return;
    const now = performance.now();
    if (now - (this.last.get(text) ?? -1e9) < this.cooldown) return;
    if (this.speaking && !force) return;
    if (force) speechSynthesis.cancel();

    this.last.set(text, now);
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice();
    if (v) u.voice = v;
    u.lang = "zh-CN";
    u.rate = this.rate;
    u.volume = this.volume;
    u.onstart = () => { this.speaking = true; };
    u.onend = u.onerror = () => { this.speaking = false; };
    speechSynthesis.speak(u);
  }

  /** 从纠错列表挑最重要的那条播 */
  coach(cues, score) {
    if (cues?.length) return this.speak(cues[0]);
    if (score >= 0.93) this.speak("很好，保持住");
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v && this.supported) speechSynthesis.cancel();
  }
}
