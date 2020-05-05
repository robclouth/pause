"use strict";

import {
  BrowserWindow,
  app,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell
} from "electron";
import * as path from "path";
import { format as formatUrl } from "url";
import activeWin from "active-win";
import { autoUpdater } from "electron-updater";

import Config from "electron-config";
const config = new Config();

const isDevelopment = process.env.NODE_ENV !== "production";

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let breakWindow;

function createBreakWindow() {
  const mainScreen = screen.getPrimaryDisplay();

  const browserWindow = new BrowserWindow({
    width: mainScreen.size.width,
    height: mainScreen.size.height,
    show: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    center: true,
    webPreferences: { nodeIntegration: true }
  });

  if (isDevelopment) {
    browserWindow.webContents.openDevTools();
  }

  if (isDevelopment) {
    browserWindow.loadURL(
      `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`
    );
  } else {
    browserWindow.loadURL(
      formatUrl({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file",
        slashes: true
      })
    );
  }

  browserWindow.on("closed", () => {
    breakWindow = null;
  });

  return browserWindow;
}

let tray = null;

const instanceLock = app.requestSingleInstanceLock();

if (!instanceLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const trayIcon = path.join(__dirname, "tray.png");
    const image = nativeImage.createFromPath(trayIcon);
    tray = new Tray(image);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Edit config", click: () => shell.openItem(config.path) }
    ]);

    tray.setToolTip("Pause");
    tray.setContextMenu(contextMenu);

    autoUpdater.checkForUpdatesAndNotify();

    breakWindow = createBreakWindow();

    app.hide();

    startBreakLoop();
  });
}

if (!config.has("breakDuration")) config.set("breakDuration", 20);
const breakDuration = config.get("breakDuration");

if (!config.has("breakSpacing")) config.set("breakSpacing", 60 * 10);
const breakSpacing = config.get("breakSpacing");

if (!config.has("breakWarning")) config.set("breakWarning", 5);
const breakWarning = config.get("breakWarning");

if (!config.has("appList")) config.set("appList", []);
const appList = config.get("appList", []);

if (!config.has("message"))
  config.set("message", "Let your arms drop loose and drink some water.");
const message = config.get("message");

let breakProgress = 0;
let breakWarningTimer = 0;
let breakTimer;

function startBreakLoop() {
  setInterval(() => {
    const activeWindow = activeWin.sync();
    if (activeWindow && !appList.includes(activeWindow.owner.name)) {
      return;
    }

    breakProgress = 0;
    breakWarningTimer = 0;

    if (breakWindow) {
      breakWindow.setIgnoreMouseEvents(true);
      breakWindow.setFocusable(false);
      breakWindow.showInactive();
      breakWindow.webContents.send("message", message);
    }

    clearInterval(breakTimer);
    breakTimer = setInterval(() => {
      if (breakWarningTimer < breakWarning) {
        if (breakWindow) breakWindow.webContents.send("breakWarning");
        breakWarningTimer++;
        if (breakWarningTimer >= breakWarning) {
          breakWindow.setIgnoreMouseEvents(false);
          breakWindow.setFocusable(true);
          breakWindow.show();
          breakWindow.webContents.send("breakProgress", 0);
        }
      } else {
        breakProgress += 1 / (breakDuration - 1);

        if (breakWindow)
          breakWindow.webContents.send("breakProgress", breakProgress);

        if (breakProgress > 1) {
          clearInterval(breakTimer);
          breakWindow.webContents.send("breakProgress", -1);
          breakWindow.hide();
        }
      }
    }, 1000);
  }, (breakSpacing + breakDuration - breakWarningTimer) * 1000);
}
