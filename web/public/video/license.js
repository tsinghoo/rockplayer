const ipcRenderer = require('electron').ipcRenderer;
const share = window.mhgl_share;
let system = null;

function onSubmit() { 
    ipcRenderer.send("submitLicense", $("#licenseKey").val());
}

function init() { 
    $("#buttonSubmit").on("click", onSubmit);
}

let holder = document.getElementById('holder');

function initQrCode() {
    //new QRCode(document.getElementById('deviceId'), 'your content');

    // 设置参数方式
    var qrcode = new QRCode('deviceId', {
        text: system.deviceId,
        width: 120,
        height: 120,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // 使用 API
    qrcode.clear();
    qrcode.makeCode(system.deviceId);
}

ipcRenderer.on('setSystem', function (e, sys) {
    system = sys;
    console.log("system=" + JSON.stringify(system));
    initQrCode();
});

ipcRenderer.send("ipcRendererReady", "true");

init();

