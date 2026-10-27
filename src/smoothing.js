/** 一阶指数平滑：给分数用 */
export class Ema {
  constructor(alpha = 0.3) { this.alpha = alpha; this.v = null; }
  push(x) {
    this.v = this.v == null ? x : this.v + this.alpha * (x - this.v);
    return this.v;
  }
  reset() { this.v = null; }
}

/** 逐关键点平滑：低置信度时加强平滑，避免“瞬移” */
export class LandmarkSmoother {
  constructor({ alpha = 0.55, minVis = 0.35 } = {}) {
    this.alpha = alpha;
    this.minVis = minVis;
    this.prev = null;
  }

  update(lm) {
    if (!this.prev || this.prev.length !== lm.length) {
      this.prev = lm.map(p => ({ ...p }));
      return lm;
    }
    const a0 = this.alpha;
    const out = lm.map((p, i) => {
      const q = this.prev[i];
      const conf = p.visibility ?? 1;
      const a = conf < this.minVis ? a0 * 0.35 : a0;   // 看不清 -> 更信任历史值
      return {
        x: q.x + a * (p.x - q.x),
        y: q.y + a * (p.y - q.y),
        z: (q.z ?? 0) + a * ((p.z ?? 0) - (q.z ?? 0)),
        visibility: conf
      };
    });
    this.prev = out;
    return out;
  }

  reset() { this.prev = null; }
}
/* ================= 关键点修复：减少“检测不到” ================= */
const MIRROR = {
  1: 4, 4: 1, 2: 5, 5: 2, 3: 6, 6: 3, 7: 8, 8: 7,
  11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15,
  23: 24, 24: 23, 25: 26, 26: 25, 27: 28, 28: 27,
  29: 30, 30: 29, 31: 32, 32: 31
};

/**
 * 可见度低的点，用镜像点沿身体中线反射补出来；
 * 膝/肘缺失时沿父-子连线插值。
 * 注意：补出来的点 visibility 只有 0.3，只用于算角度，不用于判断“是否看清”。
 */
export function repairLandmarks(lm, minVis = 0.35) {
  const out = lm.map((p) => ({ ...p }));
  const vis = (i) => out[i]?.visibility ?? 0;

  const axisX = out[23] && out[24]
    ? (out[23].x + out[24].x) / 2
    : out[11] && out[12]
      ? (out[11].x + out[12].x) / 2
      : 0.5;

  for (const key of Object.keys(MIRROR)) {
    const i = Number(key), j = MIRROR[i];
    if (vis(i) >= minVis) continue;
    if (vis(j) < minVis || !out[j]) continue;
    out[i] = {
      x: 2 * axisX - out[j].x,
      y: out[j].y,
      z: -(out[j].z ?? 0),
      visibility: 0.3
    };
  }

  const lerp = (idx, a, b, t) => {
    if (vis(idx) >= minVis || !out[a] || !out[b]) return;
    if (vis(a) < minVis || vis(b) < minVis) return;
    out[idx] = {
      x: out[a].x + (out[b].x - out[a].x) * t,
      y: out[a].y + (out[b].y - out[a].y) * t,
      z: 0,
      visibility: 0.3
    };
  };
  lerp(25, 23, 27, 0.5);
  lerp(26, 24, 28, 0.5);
  lerp(13, 11, 15, 0.5);
  lerp(14, 12, 16, 0.5);

  return out;
}
