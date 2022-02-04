// Modules to control application life and create native browser window
// import {app, BrowserWindow, Menu, ipcMain} from 'electron'
console.log("loading main.js");
const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const electron = require('electron');
const dialog = require('electron').dialog;
const fs = require('fs')
import video from 'fluent-ffmpeg/lib/options/video';
import { videoSupport } from './ffmpeg-helper';
import VideoServer from './VideoServer';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const INDEX_HTML = './src/renderer/index.html';

const historyFilePath = process.argv[0].replace(/rock-player\.exe/g,"../history") ;
let mainWindow;
let httpServer;
let isRendererReady = false;

var history = {
    files: {},
    items: [],
    lastFilePath: null
};

function getScript(videoFilePath) {
    var strs = videoFilePath.split(".");
    var scriptPath = "";
    if (strs.length > 1) {
        var len = strs[strs.length - 1].length;
        scriptPath = videoFilePath.substring(0, videoFilePath.length - len) + "txt";
    }
    if (fs.existsSync(scriptPath)) {
        try {
            const data = fs.readFileSync(scriptPath, 'utf8');
            return data.split("\n");
        } catch (err) {
            console.error(err)
        }
    }
}

function appendArray(arr, item) {
    var found = -1;
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i] == item) {
            found = i;
        }
    }

    if (found > -1) {
        arr.splice(found, 1);
    }

    arr.push(item);
}

function onVideoFileSeleted(videoFilePath) {
    videoSupport(videoFilePath).then((checkResult) => {

        let playParams = {};

        playParams.script = getScript(videoFilePath);
        var lastData = history.files[videoFilePath];
        if (lastData != null) {
            playParams.position = lastData.position;
        }

        if ((checkResult.videoCodecSupport || checkResult.onlyAudio) && checkResult.audioCodecSupport) {
            if (httpServer) {
                httpServer.killFfmpegCommand();
            }
            playParams.type = "native";
            playParams.videoSource = videoFilePath;
            if (isRendererReady) {
                console.log("fileSelected=", playParams)

                mainWindow.webContents.send('fileSelected', playParams);
            } else {
                ipcMain.once("ipcRendererReady", (event, args) => {
                    console.log("fileSelected", playParams)
                    mainWindow.webContents.send('fileSelected', playParams);
                    isRendererReady = true;
                })
            }
        }
        if ((!checkResult.videoCodecSupport && !checkResult.onlyAudio) || !checkResult.audioCodecSupport) {
            if (!httpServer) {
                httpServer = new VideoServer();
            }
            httpServer.videoSourceInfo = { videoSourcePath: videoFilePath, checkResult: checkResult };
            httpServer.createServer();
            console.log("createVideoServer success");
            playParams.type = "stream";
            playParams.videoSource = "http://127.0.0.1:8888?startTime=0";
            playParams.duration = checkResult.duration
            if (isRendererReady) {
                console.log("fileSelected=", playParams)

                mainWindow.webContents.send('fileSelected', playParams);
            } else {
                ipcMain.once("ipcRendererReady", (event, args) => {
                    console.log("fileSelected", playParams)
                    mainWindow.webContents.send('fileSelected', playParams);
                    isRendererReady = true;
                })
            }
        }

        history.files[videoFilePath] = { position: 0 };
        if (history.items == null) {
            history.items = [];
        }
        appendArray(history.items, videoFilePath);
        history.lastFilePath = videoFilePath;
    }).catch((err) => {
        console.log("video format error", err);
        const options = {
            type: 'info',
            title: 'Error',
            message: "It is not a video file!",
            buttons: ['OK']
        }
        dialog.showMessageBox(options, function (index) {
            console.log("showMessageBox", index);
        })
    })
}

function onRecentClicked() {
    mainWindow.webContents.send('recentClicked', history.items);
}

let application_menu = [
    {
        label: 'Rock Player',
        submenu: [
            {
                label: 'About Rock Player',
                click: () => {
                    let version = app.getVersion();

                    const options = {
                        type: 'info',
                        title: 'About Rock Player',
                        message: "Version: " + version + '\n' + "Github: \nhttps://github.com/ziyang0116/rockplayer\n",
                        buttons: ['OK']
                    }
                    dialog.showMessageBox(options)
                }
            }
        ]
    },
    {
        label: 'File',
        submenu: [
            {
                label: 'Open video...',
                accelerator: 'CmdOrCtrl+O',
                click: () => {
                    electron.dialog.showOpenDialog({
                        properties: ['openFile'],
                        // filters: [
                        //     {name: 'Movies', extensions: ['mkv', 'avi', 'mp4', 'rmvb', 'flv', 'ogv','webm', '3gp', 'mov']},
                        // ]
                    }).then((result) => {
                        console.log(result);
                        let canceled = result.canceled;
                        let filePaths = result.filePaths;
                        if (!canceled && mainWindow && filePaths.length > 0) {
                            onVideoFileSeleted(filePaths[0])
                        }
                    });
                }
            },
            {
                label: 'Recent',
                click: () => {
                    onRecentClicked();
                }
            }
        ]
    },
    {
        label: 'Tools',
        submenu: [
            {
                label: 'Reload',
                accelerator: 'CmdOrCtrl+R',
                click: function (item, focusedWindow) {
                    if (focusedWindow)
                        focusedWindow.reload();
                }
            },
            {
                label: 'Toggle Developer Tools',
                accelerator: (function () {
                    if (process.platform == 'darwin')
                        return 'Alt+Command+I';
                    else
                        return 'Ctrl+Shift+I';
                })(),
                click: function (item, focusedWindow) {
                    if (focusedWindow)
                        focusedWindow.toggleDevTools();
                }
            },
        ]
    },
];


function loadRecent() {
    if (fs.existsSync(historyFilePath)) {
        try {
            const data = fs.readFileSync(historyFilePath, 'utf8');
            history = JSON.parse(data);
            /*
            if (history.lastFilePath) {
                onVideoFileSeleted(history.lastFilePath);
            }
            */
        } catch (err) {
            console.error(err)
        }
    }
}


function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow(
        {
            width: 1020,
            height: 600,
            webPreferences: {
                nodeIntegration: true
            }
        })

    // and load the index.html of the app.
    mainWindow.loadFile(INDEX_HTML)

    ipcMain.once("ipcRendererReady", (event, args) => {
        console.log("ipcRendererReady")
        isRendererReady = true;

        loadRecent();
        var filePath = process.argv;
        console.log("argv:" + JSON.stringify(filePath));
        if (filePath.length > 1 && (filePath[1].substring(0, 1) != "-")) {
            onVideoFileSeleted(filePath[1]);
        } else {
            onRecentClicked();
        }
    })
    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })

    mainWindow.on('resize', function () {
        mainWindow.webContents.send('resize')
    })

    var menu = Menu.buildFromTemplate(application_menu);
    Menu.setApplicationMenu(menu);
    ipcMain.on('fileDrop', (event, arg) => {
        console.log("fileDrop:", arg);
        onVideoFileSeleted(arg);
    });

    ipcMain.on('timeupdate', (event, arg) => {
        console.log("fileDrop:", arg);
        history.files[history.lastFilePath].position = arg;
    });

    ipcMain.on('openRecent', (event, arg) => {
        console.log("openRecent:", arg);
        var i = arg;
        onVideoFileSeleted(history.items[i]);
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q

    if (history.items.length > 10) {
        for (var i = 0; i < history.items.length - 10; ++i) {
            delete history.files[history.items[i]];
        }

        history.items.splice(0, history.items.length - 10);
    }

    fs.writeFileSync(historyFilePath, JSON.stringify(history));
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})
// fix:Uncaught (in promise) DOMException: play() failed because the user didn't interact with the document first
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');




// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
