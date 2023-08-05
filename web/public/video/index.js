
const share = window.mhgl_share;
let system = null;
let scriptTimes = {};
let maskEnabled = 1;
let recentFiles = share.getCache__("recent");
if (recentFiles == null) {
    recentFiles = [];
} else {
    recentFiles = JSON.parse(recentFiles);
}
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
window.document.onkeydown = (event) => {
    console.log("onkeypress", event);
    if (event.code === "Space") {
        if (player) {
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }

            return false;
        }
    }
    else if (event.code === "ArrowRight") {
        if (player) {
            let time = player.currentTime();
            var step = 5;
            if (event.ctrlKey) {
                step = 15;
            }
            player.currentTime(time + step);
        }
        return false;
    }
    else if (event.code === "ArrowLeft") {
        if (player) {
            let time = player.currentTime();
            var step = 5;
            if (event.ctrlKey) {
                step = 15;
            }
            player.currentTime(time - step);
        }
        return false;
    }

    return true;
}
$("#mask").on("click", (event) => {
    console.log("mask.onclick", event);
    if (player) {
        if (player.paused()) {
            player.play();
        } else {
            player.pause();
        }

        return false;
    }

    return true;
});

window.addEventListener('resize', function () {
    console.log('resize')
    const vid = document.getElementById('my-video')
    if (vid) {
        const [width, height] = getWindowSize()
        vid.style.width = width + 'px'
        vid.style.height = height + 'px'
    }
});


let getSeconds = function (line) {

    let time = find(/\d\d:\d\d:\d\d/gi, line);
    if (time != null) {
        let t = time.split(":");
        let sec = parseInt(t[0]) * 3600 + parseInt(t[1]) * 60 + parseInt(t[2]);
        return sec;
    }

    time = find(/\d\d:\d\d/gi, line);
    if (time != null) {
        let t = time.split(":");
        let sec = parseInt(t[0]) * 60 + parseInt(t[1]);
        return sec;
    }

    return -1;
};

function updateScript(index, file, oldScript, newScript, deletedWord, newWord) {
    var url = "./updateScript";
    var files = [self.clickedFile];
    var params = {
        "params": JSON.stringify({
            index, file, oldScript, newScript, deletedWord, newWord
        })
    };

    var success = function (res) {
    };

    var fail = function (e) {
        share.toastError__(e);
    };


    share.httpGet__(
        url,
        params,
        success,
        fail
    );
}

function play(fileName) {
    console.log('fileSelected:', fileName);
    fileName = encodeURIComponent(fileName);
    var prefix = "/video/download/";
    var message = {
        videoSource: prefix + fileName,
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

    for (var i = 0; i < recentFiles.length; ++i) {
        if (recentFiles[i].name == fileName && recentFiles[i].time != null) {
            player.currentTime(recentFiles[i].time);
        }
    }

    // player.textTrackSettings.setDefaults();
    // player.textTrackSettings.setValues(newSettings);
    // player.textTrackSettings.updateDisplay();
    if (message.position) {
        player.currentTime(message.position);
    }

    $("#maskCheckbox").change(function () {
        maskEnabled = this.checked;

        if (maskEnabled) {
            $("#mask").css("z-index", 100);
        } else {
            $("#mask").css("z-index", 1);
        }
    });
    player.on('pause', function () {
        //maskEnabled && $("#mask").css("z-index", 100);
        for (var i = 0; i < recentFiles.length; ++i) {
            var file = recentFiles[i];
            if (file.name == fileName) {
                file.time = player.currentTime();

                if (i != 0) {
                    recentFiles.splice(i);
                    recentFiles.splice(0, 0, file);
                }

                share.setCache__("recent", recentFiles);
            }

        }
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
    let editing = false;
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
            let dblclick = false;
            let dblClickInterval = 300;

            $(".scriptLine").on("dblclick", function (e) {
                dblclick = true;
                let line = $(this).html();
                let time = getSeconds(line);
                if (time > -1) {
                    player.currentTime(time);
                    player.play();
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
                        let time = find(/\d\d:\d\d.\d\d\d /gi, line);
                        let oldScript = line;
                        if (time != null) {
                            oldScript = line.split(time)[1].trim();
                        }

                        let html = $("#editorTemplate").html();
                        html = html.replace(/#time#/g, time);
                        html = html.replace(/#id#/g, id);
                        html = html.replace(/#script#/g, oldScript);
                        ele.html(html);
                        let scriptBeforeDel = "";
                        let deletedWord = "";
                        setTimeout(function () {
                            $(".scriptInput").focus();
                            editing = true;
                            scriptBeforeDel = "";
                        }, 200);
                        $(".scriptInput").on("keydown", function (event) {
                            event.stopPropagation();
                            if (event.key == "Delete" || event.key == "Backspace") {
                                scriptBeforeDel = event.target.value;
                                deletedWord = scriptBeforeDel.substring(event.target.selectionStart, event.target.selectionEnd);
                                console.log("Deleted word: " + deletedWord);
                            }
                        });
                        $(".scriptInput").on("keyup", function (event) {
                            event.stopPropagation();
                            if (event.key == "Enter" && !event.shiftKey) {
                                let newScript = $(this).val().trim();
                                //line = time + " " + newScript;
                                //script[id] = line;

                                let newWord = newScript.substring(event.target.selectionStart, event.target.selectionEnd);
                                var fileName = share.getParameter__("f");
                                updateScript(id, fileName + ".htm", oldScript, newScript, deletedWord, newWord);
                                if (deletedWord != "" && newWord != "") {
                                    console.log(deletedWord + "->" + newWord);
                                    for (let i = 0; i < script.length; ++i) {
                                        script[i] = script[i].replace(new RegExp(deletedWord, "g"), newWord);
                                        let line = script[i].replace(/-->.*\] /g, "");
                                        line = line.replace(/ <br>/g, "");
                                        line = line.replace(/\[/g, "");
                                        $("#script_" + i).html(line);
                                    }
                                    deletedWord = "";
                                } else {
                                    script[id] = script[id].replace(new RegExp(oldScript), newScript);
                                    let line = script[id].replace(/-->.*\] /g, "");
                                    line = line.replace(/ <br>/g, "");
                                    line = line.replace(/\[/g, "");
                                    $("#script_" + id).html(line);
                                }

                                //$("#script_" + id).html(line);
                            }
                        });


                        $(".scriptInput").blur(function (e) {
                            let line = script[id].replace(/-->.*\] /g, "");
                            line = line.replace(/ <br>/g, "");
                            line = line.replace(/\[/g, "");
                            $("#script_" + id).html(line);
                        });

                        $(".scriptInput").on("click", function (e) {
                            e.stopPropagation();
                        });
                    }
                }, dblClickInterval);
            });
        });
    }
}

function loadRecent() {
    $.get("/video/download/recent", function (data) {
        var files = data.split("\n");

        let filesKey = {};
        for (let i = 0; i < files.length; ++i) {
            let f = files[i];
            filesKey[f] = i;
            let exists = -1;
            for (let j = 0; j < recentFiles.length; ++j) {
                if (recentFiles[j].name == f) {
                    exists = j;
                    break;
                }
            }
            if (exists < 0) {
                recentFiles.push({ name: f });
            }
        }
        let j = 0;
        while (j < recentFiles.length) {
            if (filesKey[recentFiles[j].name] == null) {
                recentFiles.splice(j);
            } else {
                ++j;
            }
        }

        share.setCache__("recent", recentFiles);

        let template = $("#recentTemplate").html();
        let htmls = [];
        for (let i = 0; i < recentFiles.length; ++i) {

            let html = template.replace(/#name#/g, recentFiles[i].name);
            html = html.replace(/#id#/g, i);

            htmls.push(html);
        }

        $("#recent").html(htmls);
        $("#recent").removeClass("hide");

        $("#holder").addClass("hide");

        $(".recentItem").on("click", function (e) {
            var lst = e.currentTarget.id.split("_");
            var file = recentFiles[lst[1]].name;
            window.open("./index.html?f=" + file, file);
        })

    });
}

$(function () {
    $('#holder').enhsplitter({ handle: 'lotsofdots', minSize: 50, vertical: true });

    $("#playButton").on("click", function () {
        play($("#fileName").val());
    });

    var fileName = share.getParameter__("f");
    if (fileName != null && fileName.trim() != "") {
        play(fileName);
    } else {
        loadRecent();
    }
});



