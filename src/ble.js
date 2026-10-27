export const bleSupported = () => "bluetooth" in navigator;

/** 标准心率带（Polar H10 / Coospo / 迈金…） */
export async function connectHeartRate(onChange) {
  if (!bleSupported()) throw new Error("当前浏览器不支持蓝牙（iOS Safari 不行，请用安卓 Chrome）");

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: ["heart_rate"] }],
    optionalServices: ["battery_service"]
  });
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService("heart_rate");
  const ch = await svc.getCharacteristic("heart_rate_measurement");

  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", (ev) => {
    const dv = ev.target.value;
    const flags = dv.getUint8(0);
    const bpm = (flags & 0x01) ? dv.getUint16(1, true) : dv.getUint8(1);
    onChange(bpm);
  });
  device.addEventListener("gattserverdisconnected", () => onChange(null));

  return { device, disconnect: () => { try { device.gatt.disconnect(); } catch {} } };
}

/**
 * 通用可写 BLE 设备（智能垫、震动马达、灯带等）
 * 传入你的 service / characteristic UUID
 */
export async function connectFeedback({ serviceUuid, charUuid, onLog = console.log }) {
  if (!bleSupported()) throw new Error("当前浏览器不支持蓝牙");

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [serviceUuid] }]
  });
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService(serviceUuid);
  const ch = await svc.getCharacteristic(charUuid);
  onLog("已连接：" + (device.name || device.id));

  return {
    device,
    /** 下发单个字节，例如 0x01 震动、0x00 停止 */
    async write(byte) {
      await ch.writeValue(new Uint8Array([byte]));
    },
    disconnect: () => { try { device.gatt.disconnect(); } catch {} }
  };
}
