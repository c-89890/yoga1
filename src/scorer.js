const PART_NAME = {
  0: "头部", 11: "左肩", 12: "右肩", 13: "左肘", 14: "右肘",
  15: "左手腕", 16: "右手腕", 23: "左髋", 24: "右髋",
  25: "左膝", 26: "右膝", 27: "左脚踝", 28: "右脚踝"
};

function grade(value, target, tol, strict = 1) {
  const dev = Math.abs(value - target);
  const t = tol * strict;
  if (dev <= t) return { dev, s: 1 };
  if (dev >= t * 3) return { dev, s: 0 };
  return { dev, s: 1 - (dev - t) / (t * 2) };
}

export function evaluate(template, lm, { strict = 1, minVis = 0.3 } = {}) {
  const results = [];

  for (const rule of template.rules) {
    const lack = (rule.joints ?? []).filter((i) => (lm[i]?.visibility ?? 1) < minVis);
    let value = NaN;
    try { value = rule.calc(lm); } catch {}
    const tol = rule.tol ?? 10;

    if (!Number.isFinite(value)) {
      results.push({ rule, missing: true, value: NaN, dev: Infinity, s: 0, lack });
      continue;
    }
    const g = grade(value, rule.target, tol, strict);
    results.push({ rule, value, dev: g.dev, s: g.s, lack });
  }

  const valid = results.filter((r) => !r.missing);

  if (!valid.length) {
    const parts = [...new Set(results.flatMap((r) => r.lack ?? []))]
      .map((i) => PART_NAME[i]).filter(Boolean);
    return {
      score: 0, results, badJoints: [],
      cues: [parts.length
        ? `看不到${parts.slice(0, 3).join("、")}，请调整位置让这些部位入镜`
        : "没有识别到人体，请后退一步让全身进入画面"]
    };
  }

  let wsum = 0, acc = 0;
  for (const r of results) {
    const w = (r.rule.weight ?? 1) * (r.missing ? 0.5 : 1);
    wsum += w;
    acc += w * r.s;
  }
  const score = acc / wsum;

  const cues = results
    .filter((r) => r.missing || r.dev > (r.rule.tol ?? 10) * strict)
    .sort((a, b) =>
      (b.missing ? 1e6 : b.dev / (b.rule.tol || 1)) -
      (a.missing ? 1e6 : a.dev / (a.rule.tol || 1)))
    .slice(0, 3)
    .map((r) => {
      if (r.missing) {
        const p = (r.lack ?? []).map((i) => PART_NAME[i]).filter(Boolean).slice(0, 2).join("、");
        return p ? `看不到${p}，调整一下站位` : r.rule.cue || "";
      }
      return (r.value < r.rule.target ? r.rule.cueBelow : r.rule.cueAbove) || r.rule.cue || "";
    })
    .filter(Boolean);

  const badJoints = [...new Set(
    valid.filter((r) => r.s < 0.85).flatMap((r) => r.rule.joints ?? [])
  )];

  return { score, results, cues, badJoints };
}

/** 用所有模板试算一遍，猜用户在做哪个动作 */
export function detectBestPose(templates, lm) {
  let best = null;
  for (const t of templates) {
    const r = evaluate(t, lm);
    if (!best || r.score > best.score) best = { pose: t, score: r.score };
  }
  return best;
}
