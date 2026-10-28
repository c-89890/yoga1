import { speakText, unlockVoice, preloadVoice, stopVoice } from "./voice.js";

export class VoiceCoach {
  constructor({ rate = 1.05, volume = 1, cooldown = 4000 } = {}) {
    this.supported = "speechSynthesis" in window;
    this.enabled = true;
    this.rate = rate;
    this.volume = volume;
    this.cooldown = cooldown;
    if (this.supported) {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
  }

  unlock() {
    unlockVoice();
    preloadVoice();
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

  speak(text, opts = {}) {
    if (!this.enabled) return;
    const t = String(text);

    const m = t.match(/已定格[^\d]*(\d+)\s*分/);
    if (m) {
      const n = Math.max(0, Math.min(100, Math.round(Number(m[1]) / 5) * 5));
      speakText(`已定格${n}分`);
      return;
    }

    if (t.startsWith("已切换到")) {
      const name = t.replace("已切换到", "").trim().split(" ")[0];
      speakText("已切换到" + name);
      return;
    }

    speakText(t);
  }

  coach(cues, score) {
    if (cues?.length) return this.speak(cues[0]);
    if (score >= 0.93) this.speak("很好");
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      stopVoice();
      if (this.supported) speechSynthesis.cancel();
    }
  }
}
