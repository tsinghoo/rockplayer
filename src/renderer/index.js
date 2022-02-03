import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import './js/StreamPlayTech';
const ipcRenderer = require('electron').ipcRenderer;
const share = window.mhgl_share;
function find(reg, text) {
    let matchArr = reg.exec(text);
    let infoFound;
    if (matchArr && matchArr.length > 0) {
        infoFound = matchArr[0].trim();
    }
    return infoFound;
}

function getWindowSize() {
    const { offsetWidth, offsetHeight } = document.documentElement
    const { innerHeight } = window // innerHeight will be blank in Windows system
    return [
        offsetWidth,
        innerHeight > offsetHeight ? offsetHeight : innerHeight
    ]
}

function createVideoHtml(source) {
    const [width, height] = getWindowSize()
    const videoHtml =
        `<video id="my-video" class="video-js vjs-big-play-centered" controls preload="auto" width="${width}"
    height="${height}" data-setup="{}">
    <source src="${source}" type="video/mp4">
    <p class="vjs-no-js">
    To view this video please enable JavaScript, and consider upgrading to a web browser that
    <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
    </p>
    </video>`
    return videoHtml;
}

var holder = document.getElementById('holder');

let videoContainer = document.getElementById("video_container")
let videoHtml = createVideoHtml("http://vjs.zencdn.net/v/oceans.mp4")
videoContainer.innerHTML = videoHtml;


var newSettings = {
    backgroundOpacity: '0',
    edgeStyle: 'dropshadow',
    fontPercent: 1.25,
};

holder.ondragover = function () {
    return false;
};
holder.ondragleave = holder.ondragend = function () {
    return false;
};
holder.ondrop = function (e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    console.log('File you dragged here is', file.path);
    ipcRenderer.send('fileDrop', file.path);
    return false;
};
let vid = document.getElementById("my-video");

let player = videojs(vid);
document.onkeydown = (event) => {
    console.log("onkeypress", event);
    if (event.code === "Space") {
        if (player) {
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }
        }
        return false;
    }
}

ipcRenderer.on('resize', function () {
    console.log('resize')
    const vid = document.getElementById('my-video')
    if (vid) {
        const [width, height] = getWindowSize()
        vid.style.width = width + 'px'
        vid.style.height = height + 'px'
    }
});

var getSeconds = function (line) {
    var time = find(/\d\d:\d\d:\d\d /gi, line);
    if (time != null) {
        var t = time.split(":");
        var sec = parseInt(t[0]) * 3600 + parseInt(t[1]) * 60 + parseInt(t[2]);
        return sec;
    }

    return -1;
};

var scriptTimes = {};

ipcRenderer.on('fileSelected', function (event, message) {
    console.log('fileSelected:', message)
    let vid = document.getElementById("my-video");
    videojs(vid).dispose();

    videoContainer.innerHTML = createVideoHtml(message.videoSource);
    document.title = share.shrinkString__(message.videoSource,80);
    vid = document.getElementById("my-video");
    if (message.type === 'native') {
        player = videojs(vid);
        //player.play();
    } else if (message.type === 'stream') {
        player = videojs(vid, {
            techOrder: ['StreamPlay'],
            StreamPlay: { duration: message.duration }
        }, () => {
            //player.play()
        });
    }
    // player.textTrackSettings.setDefaults();
    // player.textTrackSettings.setValues(newSettings);
    // player.textTrackSettings.updateDisplay();
    if (message.position) { 
        player.currentTime(message.position);
    }

    player.on('play', function () {
    });
    player.on('pause', function () {


    });

    //拖动
    player.on('seeking', function () {
        var newtime = player.currentTime();
        console.log('newtime: ' + newtime);
        //player.currentTime(vue.currTime);
    })

    player.on('timeupdate', function () {
        ipcRenderer.send("timeupdate", player.currentTime());
        var time = parseInt(player.currentTime());
        var id = scriptTimes[time];
        if (id != null) {
            $(".scriptLine").removeClass("selected");
            $("#script" + id).addClass("selected");
        }
    });

    var script = message.script;
    if (script != null) {
        var template = $("#scriptTemplate").html();
        var htmls = [];
        scriptTimes = {};
        for (var i = 0; i < script.length; ++i) {
            var line = script[i];
            var html = template.replace(/#script#/g, line);
            html = html.replace(/#id#/g, i);
            var time = getSeconds(line);
            if (time > -1) {
                scriptTimes[time] = i;
            }

            htmls.push(html);
        }

        $("#script").html(htmls.join(""));
        $(".scriptLine").on("click", function (e) {
            var line = $(this).html();
            var time = getSeconds(line);
            if (time > -1) {
                player.currentTime(time);
                player.play();
            }
        });
    }
});

ipcRenderer.send("ipcRendererReady", "true");



