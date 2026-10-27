import { FilesetResolver, PoseLandmarker } from
  "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM_PATH = "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export const MODELS = {
  // lite ≈ 5MB，手机首选；full ≈ 9MB，精度更好但明显更吃性能
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
};

/** 创建姿态检测器：优先 GPU，失败自动回退 CPU */
export async function createPoseLandmarker({ quality = "lite" } = {}) {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

  const build = (delegate) => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODELS[quality], delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  try {
    return await build("GPU");
  } catch (e) {
    console.warn("[pose] GPU delegate 不可用，回退 CPU:", e);
    return await build("CPU");
  }
}

/** 打开摄像头（分辨率别开太高，640~960 宽足够，能省一半推理时间） */
export async function openCamera({ facing = "user", width = 960, height = 540 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前环境不支持摄像头（需 https 或 localhost）");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: facing,
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 30, max: 30 }
    }
  });
}
