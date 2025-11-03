// src/utils/qz.js
export async function checkQZTray() {
  if (typeof qz === "undefined") {
    return { ok: false, message: "QZ Tray no está cargado en la página." };
  }

  try {
    await qz.websocket.connect({ retries: 1, delay: 500 });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: "No se pudo conectar a QZ Tray." };
  }
}

export function downloadQZ() {
  window.open("https://qz.io/download/", "_blank");
}
