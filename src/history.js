const KEY = "yoga-snaps-v1";
const MAX = 40;

export class SnapshotBook {
  constructor() { this.items = this.#load(); }

  #load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  }
  #save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.items)); }
    catch (e) { console.warn("[snaps] 本地存储已满，旧的记录会被丢弃", e); }
  }

  add({ thumb, pose, score, cues, ts = Date.now() }) {
    const item = {
      id: ts + "-" + Math.random().toString(36).slice(2, 7),
      thumb, pose, score, cues, ts
    };
    this.items.unshift(item);
    if (this.items.length > MAX) this.items.length = MAX;
    this.#save();
    return item;
  }

  remove(id) { this.items = this.items.filter((i) => i.id !== id); this.#save(); }
  clear() { this.items = []; this.#save(); }
  get all() { return this.items; }
}
