export class CastSender {
  constructor() {
    this.pres = null;
    this.bc = null;
    this.ws = null;
    this.lastAt = 0;
  }

  get connected() {
    return !!(this.pres || this.bc || (this.ws && this.ws.readyState === 1));
  }

  async startPresentation() {
    if (!("PresentationRequest" in window)) throw new Error("此浏览器不支持系统投屏");
    const req = new PresentationRequest([new URL("./cast.html", location.href).href]);
    this.pres = await req.start();
    this.pres.addEventListener("close", () => { this.pres = null; });
    return "presentation";
  }

  /** 跨设备通道：需要在 server.js 下运行 */
  startWebSocket(url) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { return reject(e); }
      const timer = setTimeout(() => { ws.close(); reject(new Error("连接超时")); }, 4000);
      ws.onopen = () => { clearTimeout(timer); this.ws = ws; resolve("ws"); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("WebSocket 失败")); };
      ws.onclose = () => { if (this.ws === ws) this.ws = null; };
    });
  }

  /** 同设备多窗口 */
  startBroadcast() {
    this.bc = new BroadcastChannel("yoga-cast");
    return "broadcast";
  }

  stop() {
    try { this.pres?.terminate(); } catch {}
    try { this.ws?.close(); } catch {}
    try { this.bc?.close(); } catch {}
    this.pres = this.ws = this.bc = null;
  }

  send(payload, minInterval = 60) {
    if (!this.connected) return;
    const now = performance.now();
    if (now - this.lastAt < minInterval) return;
    this.lastAt = now;
    const msg = JSON.stringify(payload);
    try {
      if (this.pres) this.pres.send(msg);
      else if (this.ws && this.ws.readyState === 1) this.ws.send(msg);
      else if (this.bc) this.bc.postMessage(msg);
    } catch {
      this.ws = this.pres = null;
    }
  }
}
