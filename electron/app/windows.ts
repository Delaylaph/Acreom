import * as path from 'path';
import electron, {
    app,
    BrowserWindow,
    ipcMain,
    IpcMain,
    shell,
} from 'electron';
import windowStateKeeper from 'electron-window-state';
import { isSameDay } from 'date-fns';
import { ElectronBlocker, adsLists } from '@cliqz/adblocker-electron';
import fetch from 'cross-fetch';
import { isLinux, isMac, isWindows } from '@/helpers';

let lastOpenedDate = new Date();

let isAcreomFocused = false;
export const shouldGiveupControl = () => {
    return !isAcreomFocused;
};

export const setAcreomFocused = (focused: boolean) => {
    isAcreomFocused = focused;
};

type AppWindows = {
    main: BrowserWindow | null;
    quickNote: BrowserWindow | null;
    loginWindow: BrowserWindow | null;
    settings: BrowserWindow | null;
};

export const appWindows: AppWindows = {
    main: null,
    quickNote: null,
    settings: null,
    loginWindow: null,
};

const registerTrackingHandlers = (ipcMain: IpcMain) => {
    ipcMain.handle('track-event', (_, eventType, eventProperties) => {
        appWindows.main?.webContents.send(
            'track-event',
            eventType,
            eventProperties,
        );
    });
};

const registerMiscHandlers = (window: BrowserWindow, mainWindowState: any) => {
    window.on('focus', () => {
        window.webContents.send('focus');
    });

    window.on('blur', () => {
        window.webContents.send('blur');
    });

    window.on('maximize', () => {
        window.webContents.send('maximize');
    });

    window.on('unmaximize', () => {
        window.webContents.send('unmaximize');
    });

    if (process.env.NODE_ENV === 'development') {
        window.on('moved', () => {
            mainWindowState.saveState(window);
        });

        window.on('resized', () => {
            mainWindowState.saveState(window);
        });
    }
};

export const registerControlButtonsListeners = (
    ipcMain: IpcMain,
    isTrayEnabled: boolean,
) => {
    ipcMain.handle('maximize', () => {
        if (isMac) {
            if (!appWindows.main.isFullScreenable()) return;
            if (appWindows.main.isFullScreen()) {
                appWindows.main.setFullScreen(false);
                return;
            }
            appWindows.main.setFullScreen(true);
            return;
        }
        if (!appWindows.main.isMaximizable()) return;
        if (appWindows.main.isMaximized()) {
            appWindows.main.unmaximize();
            return;
        }

        appWindows.main.maximize();
    });

    ipcMain.handle('minimize', () => {
        if (!appWindows.main.isMinimizable()) return;
        appWindows.main.minimize();
    });

    ipcMain.handle('close', () => {
        if (appWindows.main.isFullScreen()) {
            appWindows.main.setFullScreen(false);
        }

        if (isLinux) {
            if (!appWindows.main.isClosable()) return;
            appWindows.main.close();
            return;
        }

        if (isMac) {
            appWindows.main.hide();
            return;
        }

        if (isWindows) {
            if (isTrayEnabled) {
                appWindows.main.hide();
                return;
            } else {
                if (
                    appWindows.quickNote &&
                    !appWindows.quickNote.isDestroyed()
                ) {
                    appWindows.quickNote.destroy();
                }
                appWindows.main.close();
                return;
            }
        }

        if (!appWindows.main.isClosable()) return;
        appWindows.main.close();
    });
};

const initializeSpellcheckDictionary = (browserWindow: BrowserWindow) => {
    browserWindow.webContents.session.addWordToSpellCheckerDictionary('acreom');
};

export const registerQuickCaptureHandlers = (ipcMain: IpcMain) => {
    ipcMain.handle('capture-close', (_, source?: string) => {
        if (appWindows.quickNote.isDestroyed()) return;

        if (
            process.platform === 'darwin' &&
            appWindows.quickNote.getOpacity() === 1 &&
            appWindows.quickNote.isVisible()
        ) {
            if (shouldGiveupControl()) {
                electron.Menu.sendActionToFirstResponder('hide:');
            } else {
                appWindows.main.focus();
            }
            appWindows.quickNote.webContents.send('window-hide');
            // appWindows.quickNote.blur();
            appWindows.quickNote.setOpacity(0);
            appWindows.quickNote.setIgnoreMouseEvents(true);
        } else {
            appWindows.quickNote.hide();
        }

        appWindows.main?.webContents.send('track-event', 'Quick Capture', {
            action: 'Close',
            source,
        });
    });
    ipcMain.handle('append-daily-doc', (_event, text) => {
        if (appWindows.quickNote.isDestroyed()) return; // possibly not needed?
        appWindows.main?.webContents.send('quick-capture', { text });
    });
    ipcMain.handle('add-page', (_event, page) => {
        if (appWindows.quickNote.isDestroyed()) return;
        appWindows.main?.webContents.send('quick-capture-page', { page });
    });
    ipcMain.handle('resize-quick-capture', (_event, height) => {
        if (appWindows.quickNote.isDestroyed()) return;
        appWindows.quickNote.setMinimumSize(
            appWindows.quickNote.getSize()[0],
            height,
        );
        appWindows.quickNote.setSize(appWindows.quickNote.getSize()[0], height);
    });
};

export const createMainWindow = async (
    FRONTEND_PATH: string,
    ARGS: any,
): Promise<void> => {
    if (appWindows.main) {
        if (isMac) {
            appWindows.main.show();
        }
        return;
    }

    const mainWindowState = windowStateKeeper({
        defaultWidth: 1200,
        defaultHeight: 750,
    });

    appWindows.main = new BrowserWindow({
        show: !app.isPackaged,
        width: mainWindowState.width,
        height: mainWindowState.height,
        x: mainWindowState.x,
        y: mainWindowState.y,
        minWidth: 600,
        minHeight: 600,
        backgroundColor: '#1e232d',
        autoHideMenuBar: true,
        frame: false,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            preload: path.join(__dirname, '..', '/preload/preload.js'),
            webSecurity: false,
        },
        icon: path.join(FRONTEND_PATH, 'static/android-chrome-512x512.png'),
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: {
            x: 15,
            y: 12,
        },
        fullscreenable: isMac,
    });

    ElectronBlocker.fromLists(fetch, adsLists, {
        enableCompression: true,
    })
        .then(blocker => {
            blocker.enableBlockingInSession(
                appWindows.main.webContents.session,
            );
        })
        .catch(e => {
            console.log(e);
        });

    registerMiscHandlers(appWindows.main, mainWindowState);
    registerTrackingHandlers(ipcMain);
    if (process.platform === 'darwin') {
        appWindows.main.setWindowButtonVisibility(false);
    }

    mainWindowState.manage(appWindows.main);

    if (ARGS.dev) {
        appWindows.main.webContents.openDevTools();
    }

    const isTest = app.commandLine.getSwitchValue('test') === 'true';
    if (ARGS.dev || isTest) {
        appWindows.main.loadURL('http://localhost:3000');
    } else {
        appWindows.main.loadURL('app://acreom/index.html');
    }

    appWindows.main.on('closed', () => {
        appWindows.quickNote.destroy();
        appWindows.main = null;
    });

    appWindows.main.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
          appWindows.main.webContents.openDevTools();
        }
    });

    appWindows.main.on('show', () => {
        if (!isSameDay(lastOpenedDate, new Date())) {
            appWindows.main.webContents.send('new-day');
        }

        lastOpenedDate = new Date();
    });

    appWindows.main.on('ready-to-show', () => {
        appWindows.main.show();
    });

    appWindows.main.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    initializeSpellcheckDictionary(appWindows.main);
};

export const createSubWindows = (FRONTEND_PATH: string, ARGS: any) => {
    createQuickNoteWindow(FRONTEND_PATH, ARGS);
};

const createQuickNoteWindow = (FRONTEND_PATH: string, ARGS: any) => {
    const isFullScreen = appWindows.main?.isFullScreen();
    if (process.platform === 'darwin') {
        if (isFullScreen) {
            // Since macOS Sequoia, if you hide a fullscreen window, it will not show again
            // This is a workaround to prevent that
            appWindows.main.setFullScreen(false);
        }
        app.dock.hide();
    }

    appWindows.quickNote = new BrowserWindow({
        title: 'Quick Capture',
        width: 557,
        height: 237,
        show: false,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        closable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        roundedCorners: false,
        useContentSize: true,
        opacity: 1,
        darkTheme: true,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(
                __dirname,
                '..',
                '/preload/quick-capture-preload.js',
            ),
        },
        alwaysOnTop: true,
        icon: path.join(FRONTEND_PATH, 'static/android-chrome-512x512.png'),
        titleBarStyle: 'hiddenInset',
    });

    appWindows.quickNote.setAlwaysOnTop(true, 'screen-saver');
    appWindows.quickNote.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
    });
    if (ARGS.dev) {
        appWindows.quickNote.loadURL('http://localhost:3002');
    } else {
        appWindows.quickNote.loadURL('quick://quick-capture/index.html');
    }

    appWindows.quickNote.on('closed', () => {
        appWindows.quickNote = null;
    });

    initializeSpellcheckDictionary(appWindows.quickNote);
    if (process.platform === 'darwin') {
        setTimeout(() => {
            if (isFullScreen) {
                // Restore the fullscreen state - macOS Sequoia workaround
                appWindows.main.setFullScreen(true);
            }
            app.dock.show();
        }, 500);
    }
};

export const createLoginWindow = (url: string) => {
    appWindows.loginWindow = new BrowserWindow({
        title: 'acreom login',
        width: 560,
        height: 600,
        minWidth: 400,
        minHeight: 450,
        backgroundColor: '#1e232d',
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, '..', '/preload/preload.js'),
        },
        alwaysOnTop: true,
    });
    appWindows.loginWindow.loadURL(url);
};
