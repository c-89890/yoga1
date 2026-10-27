import {
  angleAt, avgOf, mid, torsoTilt, shoulderTilt, hipTilt
} from "./angles.js";

const kneeL  = lm => angleAt(lm[23], lm[25], lm[27]);
const kneeR  = lm => angleAt(lm[24], lm[26], lm[28]);
const wristMidY    = lm => mid(lm[15], lm[16]).y;
const shoulderMidY = lm => mid(lm[11], lm[12]).y;

export const POSES = [
  /* ---------------- 山式 ---------------- */
  {
    id: "mountain",
    name: "山式 Tadasana",
    rules: [
      { label: "双膝伸直", calc: lm => avgOf(kneeL(lm), kneeR(lm)),
        target: 176, tol: 8, unit: "°", weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "膝盖还弯着，慢慢把双腿伸直",
        cueAbove: "别把膝盖锁死向后顶，微收一点" },

      { label: "躯干垂直", calc: lm => torsoTilt(lm),
        target: 2, tol: 6, unit: "°", weight: 3, joints: [11, 12, 23, 24],
        cueAbove: "身体有点歪，收腹、把重心放回脚掌中间" },

      { label: "双肩齐平", calc: lm => shoulderTilt(lm),
        target: 2, tol: 5, unit: "°", weight: 1.5, joints: [11, 12],
        cueAbove: "放松高的一侧肩膀，让两肩齐平" },

      { label: "手臂垂于体侧", calc: lm => wristMidY(lm) - shoulderMidY(lm),
        target: 0.34, tol: 0.16, unit: "", weight: 1, joints: [13, 14, 15, 16],
        cue: "手臂放松垂在身体两侧，掌心朝内"
      }
    ]
  },

  /* ---------------- 树式 ---------------- */
  {
    id: "tree",
    name: "树式 Vrksasana",
    rules: [
      { label: "支撑腿伸直", calc: lm => Math.max(kneeL(lm), kneeR(lm)),
        target: 176, tol: 10, unit: "°", weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "把站立的那条腿再伸直一些" },

      { label: "抬腿屈膝", calc: lm => Math.min(kneeL(lm), kneeR(lm)),
        target: 50, tol: 22, unit: "°", weight: 2.5, joints: [25, 26],
        cueBelow: "脚掌贴到支撑腿大腿内侧，膝盖再弯一点",
        cueAbove: "抬起的腿放松些，不必贴得太紧" },

      { label: "骨盆水平", calc: lm => hipTilt(lm),
        target: 0, tol: 6, unit: "°", weight: 2, joints: [23, 24],
        cueAbove: "抬起腿一侧的髋部别往上翻，保持骨盆水平" },

      { label: "双手上举过头", calc: lm => wristMidY(lm) - lm[0].y,
        target: -0.18, tol: 0.12, unit: "", weight: 1.5, joints: [13, 14, 15, 16],
        cue: "双手向上伸展，合十过头顶" }
    ]
  },

  /* ---------------- 战士二式 ---------------- */
  {
    id: "warrior2",
    name: "战士二式 Virabhadrasana II",
    rules: [
      { label: "前腿屈膝约 90°", calc: lm => Math.min(kneeL(lm), kneeR(lm)),
        target: 95, tol: 15, unit: "°", weight: 3, joints: [25, 26],
        cueBelow: "前腿再弯一点，膝盖对准脚踝正上方",
        cueAbove: "前腿别弯太多，小腿垂直地面就好" },

      { label: "后腿伸直", calc: lm => Math.max(kneeL(lm), kneeR(lm)),
        target: 174, tol: 10, unit: "°", weight: 2.5, joints: [27, 28],
        cueBelow: "后腿膝盖伸直，脚跟踩实地面" },

      { label: "双臂平举", calc: lm => avgOf(
          angleAt(lm[11], lm[15], { x: lm[15].x + 1, y: lm[15].y }),
          angleAt(lm[12], lm[16], { x: lm[16].x + 1, y: lm[16].y })),
        target: 0, tol: 14, unit: "°", weight: 2.5, joints: [13, 14, 15, 16],
        cue: "双臂抬到与地面平行，指尖向两端延展" },

      { label: "躯干垂直", calc: lm => torsoTilt(lm),
        target: 0, tol: 8, unit: "°", weight: 2, joints: [11, 12, 23, 24],
        cueAbove: "上身别前倾，重心落在两腿之间" }
    ]
  },

  /* ---------------- 下犬式 ---------------- */
  {
    id: "downdog",
    name: "下犬式 Adho Mukha Svanasana",
    rules: [
      { label: "髋部充分折叠", calc: lm => avgOf(
          angleAt(lm[11], lm[23], lm[27]),
          angleAt(lm[12], lm[24], lm[28])),
        target: 85, tol: 18, unit: "°", weight: 3, joints: [23, 24, 25, 26],
        cueBelow: "把坐骨再往上推，髋部顶高",
        cueAbove: "髋部别塌下来，尾骨向上" },

      { label: "双膝伸直", calc: lm => avgOf(kneeL(lm), kneeR(lm)),
        target: 172, tol: 12, unit: "°", weight: 2.5, joints: [25, 26, 27, 28],
        cueBelow: "腿后侧紧就先微屈膝，再慢慢蹬直" },

      { label: "手掌落地", calc: lm => wristMidY(lm) - shoulderMidY(lm),
        target: 0.35, tol: 0.15, unit: "", weight: 2, joints: [15, 16],
        cue: "手掌压实地面，肩膀在手腕正上方" },

      { label: "背部延展", calc: lm => torsoTilt(lm),
        target: 55, tol: 20, unit: "°", weight: 1.5, joints: [11, 23],
        cue: "从髋部折叠，让背部保持一条直线" }
    ]
  },

  /* ---------------- 幻椅式 ---------------- */
  {
    id: "chair",
    name: "幻椅式 Utkatasana",
    rules: [
      { label: "屈膝约 100°", calc: lm => avgOf(kneeL(lm), kneeR(lm)),
        target: 100, tol: 15, unit: "°", weight: 3, joints: [25, 26],
        cueBelow: "臀部再往后坐，像要坐上椅子",
        cueAbove: "膝盖别超过脚尖太多，重心后移" },

      { label: "躯干前倾约 30°", calc: lm => torsoTilt(lm),
        target: 30, tol: 10, unit: "°", weight: 2.5, joints: [11, 12, 23, 24],
        cueBelow: "胸口再往前送一点，背部延展",
        cueAbove: "上身别趴下去，收腹提胸" },

      { label: "双臂上举过头", calc: lm => wristMidY(lm) - shoulderMidY(lm),
        target: -0.32, tol: 0.18, unit: "", weight: 2, joints: [13, 14, 15, 16],
        cue: "双臂举过头顶，尽量贴近耳朵" }
    ]
  }
];
