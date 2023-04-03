import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import './js/StreamPlayTech';
const ipcRenderer = require('electron').ipcRenderer;
const share = window.mhgl_share;
let system = null;
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

function compare(os, ns) {
    let start = -1;
    for (var i = 0; i < os.length && i < ns.length; ++i) {
        if (os.charAt(i) == ns.charAt(i)) {
            start = i;
        }
    }
    let end = -1;
    for (var i = 0; i < os.length && i < ns.length; ++i) {
        if (os.charAt(os.length - i - 1) == ns.charAt(ns.length - i - 1)) {
            end = i;
        }
    }

    let src = os.substring(start + 1, os.length - end - 1);
    let dst = ns.substring(start + 1, ns.length - end - 1);

    return { src, dst };
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

let holder = document.getElementById('holder');

let videoContainer = document.getElementById("video_container")

/*
let videoHtml = createVideoHtml("http://vjs.zencdn.net/v/oceans.mp4")
videoContainer.innerHTML = videoHtml;
*/

let vid = document.getElementById("my-video");

let player;

if (vid) {
    player = videojs(vid);
}

let newSettings = {
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
    let file = e.dataTransfer.files[0];
    console.log('File you dragged here is', file.path);
    ipcRenderer.send('fileDrop', file.path);
    return false;
};
document.onkeydown = (event) => {
    console.log("onkeypress", event);
    if (event.code === "Space") {
        if (player) {
            if (player.paused()) {
                player.play();
                $("#mask").css("z-index", 1);
            } else {
                player.pause();
                $("#mask").css("z-index", 100);
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

ipcRenderer.on('setSystem', function (sys) {
    system = sys;
});

let getSeconds = function (line) {
    let time = find(/\d\d:\d\d:\d\d /gi, line);
    if (time != null) {
        let t = time.split(":");
        let sec = parseInt(t[0]) * 3600 + parseInt(t[1]) * 60 + parseInt(t[2]);
        return sec;
    }

    return -1;
};

let scriptTimes = {};

ipcRenderer.on('recentClicked', function (event, message) {

    let items = message;
    if (items != null) {
        let template = $("#recentTemplate").html();
        let htmls = [];
        for (let i = items.length - 1; i > -1; --i) {
            let line = items[i];
            let html = template.replace(/#item#/g, line);
            html = html.replace(/#id#/g, i);

            htmls.push(html);
        }

        $("#recent").html(htmls.join(""));
        $(".recentItem").on("dblclick", function (e) {
            let strs = $(this).attr("id").split("_");
            let id = strs[1];
            ipcRenderer.send("openRecent", id);
        });
    }

    $("#recent").removeClass("hide");
    $("#holder").addClass("hide");
});

ipcRenderer.on('fileSelected', function (event, message) {
    console.log('fileSelected:', message);
    $("#recent").addClass("hide");
    $("#holder").removeClass("hide");
    let vid = document.getElementById("my-video");
    if (vid != null) {
        videojs(vid).dispose();
    }

    videoContainer.innerHTML = createVideoHtml(message.videoSource);
    document.title = share.shrinkString__(message.videoSource, 80);
    vid = document.getElementById("my-video");
    if (message.type === 'native') {
        player = videojs(vid);
        player.play();
    } else if (message.type === 'stream') {
        player = videojs(vid, {
            techOrder: ['StreamPlay'],
            StreamPlay: { duration: message.duration }
        }, () => {
            player.play();
        });
    }
    // player.textTrackSettings.setDefaults();
    // player.textTrackSettings.setValues(newSettings);
    // player.textTrackSettings.updateDisplay();
    if (message.position) {
        player.currentTime(message.position);
    }

    player.on('play', function () {
        $("#mask").css("z-index", 1);
    });
    player.on('pause', function () {
    });

    //拖动
    player.on('seeking', function () {
        let newtime = player.currentTime();
        console.log('newtime: ' + newtime);
        //player.currentTime(vue.currTime);
    })

    player.on('timeupdate', function () {
        ipcRenderer.send("timeupdate", player.currentTime());
        let time = parseInt(player.currentTime());
        let id = scriptTimes[time];
        if (id != null) {
            $(".scriptLine").removeClass("selected");
            $("#script_" + id).addClass("selected");
        }
    });

    let script = message.script;
    if (script == null) {
        $("#script").html();
        $("#script").addClass("hide");
    } else {
        let template = $("#scriptTemplate").html();
        let htmls = [];
        scriptTimes = {};
        for (let i = 0; i < script.length; ++i) {
            let line = script[i];
            let html = template.replace(/#script#/g, line);
            html = html.replace(/#id#/g, i);
            let time = getSeconds(line);
            if (time > -1) {
                scriptTimes[time] = i;
            }

            htmls.push(html);
        }

        $("#script").html(htmls.join(""));
        $("#script").removeClass("hide");
        let dblclick = false;
        let dblClickInterval = 300;
        $(".scriptLine").on("dblclick", function (e) {
            dblclick = true;
            let line = $(this).html();
            let time = getSeconds(line);
            if (time > -1) {
                player.currentTime(time);
                player.play();
                $("#mask").css("z-index", 1);
            }

            setTimeout(function () {
                dblclick = false;
            }, dblClickInterval);
        });

        $(".scriptLine").on("click", function (e) {

            let ele = $(this);
            if (ele.html().indexOf("<input type") > 0) {
                return;
            }

            setTimeout(function () {

                if (!dblclick) {
                    let line = ele.text().trim();
                    let id = ele.attr("id").split("_")[1];
                    let time = find(/\d\d:\d\d:\d\d /gi, line);
                    let oldScript = line;
                    if (time != null) {
                        oldScript = line.split(time)[1].trim();
                    }

                    let html = $("#editorTemplate").html();
                    html = html.replace(/#time#/g, time);
                    html = html.replace(/#id#/g, id);
                    html = html.replace(/#script#/g, oldScript);
                    ele.html(html);

                    setTimeout(function () {
                        $(".scriptInput").focus();
                    }, 200);
                    $(".scriptInput").on("keyup", function (event) {
                        if (event.key == "Enter" && !event.shiftKey) {
                            let newScript = $(this).val().trim();
                            line = time + " " + newScript;
                            script[id] = line;

                            var res = compare(oldScript, newScript);
                            for (let i = 0; i < script.length; ++i) {
                                script[i] = script[i].replaceAll(res.src, res.dst);
                            }

                            $("#script_" + id).html(line);
                            ipcRenderer.send("updateScript", JSON.stringify(script));
                        }
                    });


                    $(".scriptInput").blur(function (e) {
                        let s = $(this).val().trim();
                        line = time + " " + s;
                        script[id] = line;
                        $("#script_" + id).html(line);
                        ipcRenderer.send("updateScript", JSON.stringify(script));
                    });

                    $(".scriptInput").on("click", function (e) {
                        e.stopPropagation();
                    });
                }
            }, dblClickInterval);
        });
    }
});

ipcRenderer.send("ipcRendererReady", "true");



