// MediaPipe Pose 33 关键点索引
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
  L_HEEL: 29,     R_HEEL: 30,
  L_FOOT: 31,     R_FOOT: 32
};

/** 三点夹角（度），b 为顶点 */
export function angleAt(a, b, c) {
  if (!a || !b || !c) return NaN;
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const m = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!m) return NaN;
  const cos = (abx * cbx + aby * cby) / m;
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

export const mid = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: ((a.z ?? 0) + (b.z ?? 0)) / 2
});

/** 躯干相对竖直方向的倾角（0 = 完全直立） */
export function torsoTilt(lm) {
  const s = mid(lm[11], lm[12]);
  const h = mid(lm[23], lm[24]);
  return Math.abs(Math.atan2(s.x - h.x, h.y - s.y) * 180 / Math.PI);
}

/** 线段 a→b 与竖直方向夹角（不分左右，只用于“是否竖直”判断） */
export function angVertical(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(Math.atan2(dx, Math.abs(dy)) * 180 / Math.PI);
}

/** 线段 a→b 与水平方向夹角（0 = 水平） */
export function angHorizontal(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI);
}

/** 双肩连线倾角（0 = 两肩齐平） */
export function shoulderTilt(lm) {
  const dx = lm[12].x - lm[11].x, dy = lm[12].y - lm[11].y;
  return Math.abs(Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI);
}

/** 骨盆倾角（0 = 骨盆水平） */
export function hipTilt(lm) {
  const dx = lm[24].x - lm[23].x, dy = lm[24].y - lm[23].y;
  return Math.abs(Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI);
}

/** 求有限数值的平均（自动忽略 NaN） */
export function avgOf(...vals) {
  const v = vals.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}
