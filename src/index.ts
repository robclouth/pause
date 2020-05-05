declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

import {
  BrowserWindow,
  app,
  Menu,
  Tray,
  nativeImage,
  screen,
  shell
} from "electron";

import path from "path";
import fs from "fs";
//@ts-ignore
import activeWin from "active-win";
//@ts-ignore
import Config from "electron-config";
const config = new Config();

require("update-electron-app")();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

let breakWindow: BrowserWindow;

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

  browserWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return browserWindow;
}

let tray = null;

const instanceLock = app.requestSingleInstanceLock();

if (!instanceLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const trayIcon = path.join(__dirname, require("./assets/tray.png"));
    const image = nativeImage.createFromPath(trayIcon);
    tray = new Tray(image);
    const contextMenu = Menu.buildFromTemplate([
      { label: "Edit config", click: () => shell.openItem(config.path) },
      { label: "Quit", click: () => app.quit() }
    ]);

    tray.setToolTip("Pause");
    tray.setContextMenu(contextMenu);

    const executablePath = path.join(__dirname, "native_modules/main");
    fs.chmodSync(executablePath, "755");

    breakWindow = createBreakWindow();

    app.hide();
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    });

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

enum State {
  Waiting,
  Warning,
  Break
}

let breakProgress = 0;
let isActive = false;
let currState = State.Waiting;
let seconds = 0;
const loopSeconds = breakSpacing + breakDuration;

function setState(nextState: State) {
  if (currState !== nextState) {
    if (nextState === State.Waiting) {
      breakWindow.webContents.send("breakProgress", -1);
      breakWindow.hide();
    } else if (nextState === State.Warning) {
      breakWindow.setIgnoreMouseEvents(true);
      breakWindow.setFocusable(false);
      breakWindow.showInactive();
      breakWindow.webContents.send("message", message);
    } else if (nextState === State.Break) {
      breakProgress = 0;
      breakWindow.setIgnoreMouseEvents(false);
      breakWindow.setFocusable(true);
      breakWindow.show();
      breakWindow.webContents.send("breakProgress", 0);
    }

    currState = nextState;
  }
}

function startBreakLoop() {
  setInterval(() => {
    isActive = false;
    try {
      let activeWindow = activeWin.sync();
      if (activeWindow && appList.includes(activeWindow.owner.name)) {
        isActive = true;
      }
    } catch {}

    if ((isActive || currState === State.Break) && breakWindow) {
      if (seconds >= loopSeconds - breakDuration) setState(State.Break);
      else if (seconds >= loopSeconds - breakDuration - breakWarning)
        setState(State.Warning);
      else setState(State.Waiting);

      if (currState === State.Break) {
        breakProgress += 1 / breakDuration;
        breakWindow.webContents.send("breakProgress", breakProgress);
      } else if (currState === State.Warning) {
        breakWindow.webContents.send("breakWarning");
      }

      seconds++;
      if (seconds >= loopSeconds) seconds = 0;
    }
  }, 1000);
}
