
const share = window.mhgl_share;
let system = null;
let scriptTimes = {};

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
        } else {
            break;
        }
    }
    let end = -1;
    for (var i = 0; i < os.length && i < ns.length; ++i) {
        if (os.charAt(os.length - i - 1) == ns.charAt(ns.length - i - 1)) {
            end = i;
        } else {
            break;
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
holder.onkeydown = (event) => {
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

    return true;
}
window.addEventListener('resize', function () {
    console.log('resize')
    const vid = document.getElementById('my-video')
    if (vid) {
        const [width, height] = getWindowSize()
        vid.style.width = width + 'px'
        vid.style.height = height + 'px'
    }

    Resizable.activeContentWindows[0].changeSize(window.innerWidth, window.innerHeight);
    Resizable.activeContentWindows[0].childrenResize();
});


let getSeconds = function (line) {

    let time = find(/\d\d:\d\d/gi, line);
    if (time != null) {
        let t = time.split(":");
        let sec = parseInt(t[0]) * 60 + parseInt(t[1]);
        return sec;
    }

    time = find(/\d\d:\d\d:\d\d./gi, line);
    if (time != null) {
        let t = time.split(":");
        let sec = parseInt(t[0]) * 3600 + parseInt(t[1]) * 60 + parseInt(t[2]);
        return sec;
    }

    return -1;
};

function play(fileName) {
    console.log('fileSelected:', fileName);

    var prefix = "http://sg.91taogu.cn/download/";
    var message = {
        videoSource: prefix + fileName + ".mp4",
        script: prefix + fileName + ".htm",
        type: "native"
    };

    $("#recent").addClass("hide");
    $("#holder").removeClass("hide");
    let vid = document.getElementById("my-video");
    if (vid != null) {
        videojs(vid).dispose();
    }

    var vh = createVideoHtml(message.videoSource);
    //videoContainer.innerHTML = vh;
    $("#video_container").html(vh);
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
        $("#mask").css("z-index", 100);
    });

    //拖动
    player.on('seeking', function () {
        let newtime = player.currentTime();
        console.log('newtime: ' + newtime);
        //player.currentTime(vue.currTime);
    })

    player.on('timeupdate', function () {
        //ipcRenderer.send("timeupdate", player.currentTime());
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
        $.get(script, function (data) {
            var script = data.split("\n");

            let template = $("#scriptTemplate").html();
            let htmls = [];
            scriptTimes = {};
            for (let i = 0; i < script.length; ++i) {
                let line = script[i].replace(/-->.*\] /g, "");
                line = line.replace(/ <br>/g, "");
                line = line.replace(/\[/g, "");
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

            $(".scriptLine").on("dblclick", function (e) {
                let line = $(this).html();
                let time = getSeconds(line);
                if (time > -1) {
                    player.currentTime(time);
                    player.play();
                    $("#mask").css("z-index", 1);
                }
            });
        });
    }
}

$(function () {
    $("#playButton").on("click", function () {
        play($("#fileName").val());
    });

    document.getElementById("holder").style.width = window.innerWidth + "px";
    document.getElementById("holder").style.height = window.innerHeight + "px";

    var sizes = {
        "win1": 0.5,
        "win3": 0.75,
        "win4": 0.5,
        "win6": 0.4,
        "win11": 0.8,
        "win9": 0.5,
        "win13": 0.4
    };

    //Resizable.initialise("main", sizes);
    Resizable.initialise("holder", {});
    var fileName = share.getParameter__("f");
    if (fileName != null && fileName.trim() != "") {
        play(fileName);
    }
});



