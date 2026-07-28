import { app, BrowserWindow, shell } from "electron";

import { defaultDevelopmentWebUrl } from "@code/config/urls";

function createWindow() {
  const webUrl = new URL(process.env.CODE_WEB_URL ?? defaultDevelopmentWebUrl);
  const window = new BrowserWindow({
    title: "Code",
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#0b0e14",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: new URL("../preload/index.mjs", import.meta.url).pathname,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== webUrl.origin) event.preventDefault();
  });
  loadWebApp(window, webUrl);
}

function loadWebApp(window: BrowserWindow, webUrl: URL) {
  let retry: ReturnType<typeof setTimeout> | undefined;

  const load = () => {
    if (window.isDestroyed()) return;
    void window.loadURL(webUrl.href).catch(() => {
      retry = setTimeout(load, 500);
    });
  };

  window.once("closed", () => {
    if (retry) clearTimeout(retry);
  });
  load();
}

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
