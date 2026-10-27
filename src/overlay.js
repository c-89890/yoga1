const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32]
];

const KEY_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/** mirror = true 时按 x' = W - x*W 绘制，用于已经水平翻转过的截图 */
export function paintSkeleton(ctx, lm, bad, W, H, mirror = false) {
  const badSet = new Set(bad);
  const X = (x) => (mirror ? W - x * W : x * W);
  const Y = (y) => y * H;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [i, j] of CONNECTIONS) {
    const a = lm[i], b = lm[j];
    if (!a || !b) continue;
    if ((a.visibility ?? 1) < 0.3 || (b.visibility ?? 1) < 0.3) continue;
    const hot = badSet.has(i) || badSet.has(j);
    ctx.strokeStyle = hot ? "rgba(255,176,32,.95)" : "rgba(61,220,151,.85)";
    ctx.lineWidth = hot ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
  }

  for (const i of KEY_POINTS) {
    const p = lm[i];
    if (!p || (p.visibility ?? 1) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), badSet.has(i) ? 7.5 : 5, 0, Math.PI * 2);
    ctx.fillStyle = badSet.has(i) ? "#ffb020" : "#fff";
    ctx.fill();
  }
}

export class Overlay {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
  }
  resize(w, h) {
    if (this.c.width !== w || this.c.height !== h) {
      this.c.width = w;
      this.c.height = h;
    }
  }
  clear() { this.ctx.clearRect(0, 0, this.c.width, this.c.height); }
  draw(lm, bad = []) {
    this.ctx.clearRect(0, 0, this.c.width, this.c.height);
    paintSkeleton(this.ctx, lm, bad, this.c.width, this.c.height, false);
  }
}
