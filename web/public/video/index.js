
const share = window.mhgl_share;
let system = null;
let scriptTimes = {};
let maskEnabled = 1;
let recentFiles = share.getCache__("recent");
let start = -1;
let end = -1;
let playingId = -1;
let lastActionTime = new Date().getTime();

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

    if (document.querySelector('#replaceWords:focus')) {
        return true;
    }

    if (event.code === "Space") {
        if (player) {
            if (player.paused()) {
                player.play();
            } else {
                player.pause();
            }

            return false;
        }
    } else if (event.code === "ArrowRight") {
        if (player) {

            let time = player.currentTime();
            var step = 3;
            if (event.ctrlKey) {
                step = 10;
            }
            // 判断是否按下了Shift键
            if (event.shiftKey) {
                step = 15;
            }

            // 判断是否按下了Alt键
            if (event.altKey) {
                step = 20;
            }

            // 判断是否按下了Meta键（例如 Windows 键或 Command 键）
            if (event.metaKey) {
                step = 30;
            }

            player.currentTime(time + step);
        }

        return false;
    } else if (event.code === "ArrowLeft") {
        if (player) {
            let time = player.currentTime();
            var step = 3;
            if (event.ctrlKey) {
                step = 10;
            }
            // 判断是否按下了Shift键
            if (event.shiftKey) {
                step = 15;
            }

            // 判断是否按下了Alt键
            if (event.altKey) {
                step = 20;
            }

            // 判断是否按下了Meta键（例如 Windows 键或 Command 键）
            if (event.metaKey) {
                step = 30;
            }

            player.currentTime(time - step);
        }

        return false;
    } else if (event.code === "ArrowUp") {
        if (player) {
            player.volume = Math.min(video.volume + 0.1, 1);
        }

        return false;
    } else if (event.code === "ArrowDown") {
        if (player) {
            player.volume = Math.max(video.volume - 0.1, 0);
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

function updateScript(index, file, oldScript, newScript, deletedWord, newWord, oldWords, success, fail, replaceAll) {
    var url = "./updateScript";
    var params = {
        "params": JSON.stringify({
            index, file, oldScript, newScript, deletedWord, newWord, oldWords, replaceAll
        })
    };
    share.httpPost__(
        url,
        params,
        success,
        fail ? fail : share.toastError__
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
    if (self.metadata && self.metadata.position) {
        player.currentTime(self.metadata.position);
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
        updatePosition();
    });

    function updatePosition() {
        var url = "./updatePosition";
        var fileName = share.getParameter__("f");
        var params = {
            fileName: fileName,
            position: player.currentTime()
        };

        var success = function (res) {
            share.closeDialog__();
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
            playingId = id;
            scrollScript();
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
                lastActionTime = new Date().getTime();
                let line = $(this).html();
                let time = getSeconds(line);
                if (time > -1) {
                    player.currentTime(time);
                    player.play();
                    updatePosition();
                }

                setTimeout(function () {
                    dblclick = false;
                }, dblClickInterval);
            });

            $(".scriptLine").on("click", function (e) {

                lastActionTime = new Date().getTime();
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
                            lastActionTime = new Date().getTime();
                            event.stopPropagation();
                            if (event.key == "Delete" || event.key == "Backspace") {
                                scriptBeforeDel = event.target.value;
                                let dw = scriptBeforeDel.substring(event.target.selectionStart, event.target.selectionEnd);
                                if (dw == "") {
                                } else {
                                    deletedWord = dw;
                                    $("#replaceWords").val(deletedWord + " => ");
                                }
                                console.log("Deleted word: " + deletedWord);
                            }
                        });
                        $(".scriptInput").on("keyup", function (event) {
                            event.stopPropagation();
                            if (event.key == "Enter") {
                                let newScript = $(this).val().trim();
                                //line = time + " " + newScript;
                                //script[id] = line;

                                let newWord = newScript.substring(event.target.selectionStart, event.target.selectionEnd);
                                if (deletedWord != "" && newWord != "") {
                                    $("#replaceWords").val(deletedWord + " => " + newWord);
                                } else {
                                    $("#replaceWords").val("");
                                }
                                var fileName = share.getParameter__("f");
                                var replaceAll = event.shiftKey;
                                updateScript(id, fileName + ".htm", oldScript, newScript, deletedWord, newWord, "", null, null, replaceAll);
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

    bindVideoEvent();
}
let scrolling = false;
let $rectangle = $('#rectangle');
let isDrawing = false;
let $video = $("video");
function scrollScript() {
    var now = new Date().getTime();
    if (now - lastActionTime > 1000 * 10) {
        if (!scrolling) {
            scrolling = true;
            if (playingId > -1) {
                let ele = $("#script_" + playingId);
                if (!share.isInView__(ele)) {
                    ele[0].scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }
            }
            setTimeout(() => { scrolling = false; }, 1000);
        }
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

function showReplacer() {
    var temp = $("#templateReplacer").html();
    var html = Object.keys(self.replacers).map((r, i) => {
        var html = temp.replace(/#data#/g, r);
        html = html.replace(/#content#/g, r + "=>" + self.replacers[r]);
        return html;
    }).join("");

    $("#replacers").html(html);
    $("#replacerContainer").removeClass("hide");
}

function toReplace() {
    var fileName = share.getParameter__("f");
    var oldWords = Object.keys(self.replacers);
    updateScript("", fileName + ".htm", "", "", "", "", JSON.stringify(oldWords), function () {
        location.reload();
    });

    $("#replacerContainer").addClass("hide");
}

function toShowReplacers() {
    var url = "./replacers";
    var params = {
    };

    var success = function (res) {
        share.closeDialog__();
        self.replacers = res.data;
        showReplacer();
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

function toShowSegments() {
    var buttons = [];
    var segs = self.metadata.segments;
    Object.keys(segs).forEach((seg, i) => {
        let time = self.metadata.segments[seg];
        buttons.push({
            text: seg + ":" + share.getDurationText1__(time.start) + "-" + share.getDurationText1__(time.end),
            onTap: function (e) {
                player.currentTime(time.start);
                start = time.start;
                end = time.end;
                $("#segmentName").val(seg);
                showStartEnd();
                player.play();
                share.closeDialog__();
            }
        })
    });

    share.showActionSheet__('请选择', buttons);
}

function getMetadata(fileName) {
    var url = "./metadata";
    var params = {
        fileName
    };

    var success = function (res) {
        share.closeDialog__();
        self.metadata = res.data;
        play(fileName);
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

function showStartEnd() {
    if (start > -1) {
        $("#replaceWords").val(share.getDurationText1__(start) + " => ");
        $("#segmentNameDiv").removeClass("hide");
        if (end > start) {
            $("#replaceWords").val(share.getDurationText1__(start) + " => " + share.getDurationText1__(end));

        } else {
        }
    } else {
        $("#replaceWords").val();
        $("#segmentNameDiv").addClass("hide");
    }

}
function buttonStartClicked(e) {
    if (e.shiftKey) {
        let end = $("#replaceWords").val().split("=>")[0].trim();
        let str = end.split(":");
        let s = 1 * str[str.length - 1] + 60 * str[str.length - 2];
        if (str.length == 3) {
            s += 3600 * str[0];
        }

        player.currentTime(s);
    } else {
        start = player.currentTime();
        if (end < start) {
            end = -1;
        }
        showStartEnd();
    }
}

function buttonEndClicked(e) {
    if (e.shiftKey) {
        let end = $("#replaceWords").val().split("=>")[1].trim();
        let str = end.split(":");
        let s = 1 * str[str.length - 1] + 60 * str[str.length - 2];
        if (str.length == 3) {
            s += 3600 * str[0];
        }

        player.currentTime(s);
    } else {
        end = player.currentTime();

        if (end < start) {
            start = -1;
        }

        showStartEnd();
    }
}

// 更新比例显示
function updateRatioDisplay(left, right, top, bottom) {
    console.log("left:" + left + ", right:" + right + ", top:" + top + ", bottom:" + bottom);
    $('#leftRatio').text(left.toFixed(4));
    $('#rightRatio').text(right.toFixed(4));
    $('#topRatio').text(top.toFixed(4));
    $('#bottomRatio').text(bottom.toFixed(4));
}
function updateRatio(left, right, top, bottom) {
    var url = "./setScriptPos";
    var fileName = share.getParameter__("f");
    var params = {
        fileName: fileName,
        top: top,
        bottom: bottom,
        left: left,
        right: right
    };

    var success = function (res) {
        share.closeDialog__();
        if (res.error) {
            share.toastError__(res.error);
        } else {
            share.closeDialog__();
        }
    };

    var fail = function (e) {
        share.toastError__(e.message);
    };

    share.httpGet__(
        url,
        params,
        success,
        fail
    );
}

// 计算并显示比例
function calculateAndDisplayRatios(update) {
    var videoWidth = $video.width();
    var videoHeight = $video.height();

    var rectLeft = parseInt($rectangle.css('left')) || 0;
    var rectTop = parseInt($rectangle.css('top')) || 0;
    var rectWidth = parseInt($rectangle.css('width')) || 0;
    var rectHeight = parseInt($rectangle.css('height')) || 0;

    var rectRight = rectLeft + rectWidth;
    var rectBottom = rectTop + rectHeight;

    var leftRatio = rectLeft / videoWidth;
    var rightRatio = rectRight / videoWidth;
    var topRatio = rectTop / videoHeight;
    var bottomRatio = rectBottom / videoHeight;
    if (update) {
        updateRatio(leftRatio, rightRatio, topRatio, bottomRatio);
    }

    updateRatioDisplay(leftRatio, rightRatio, topRatio, bottomRatio);
}

function bindVideoEvent() {
    $video = $("video");
    // 鼠标按下开始绘制
    $video.on('mousedown', function (e) {
        console.log("mouse down on video");
        if (isDrawing) {
            isDrawing = false;
            calculateAndDisplayRatios(true);
        } else {
            isDrawing = true;
            startX = e.pageX - $video.offset().left;
            startY = e.pageY - $video.offset().top;

            $rectangle.css({
                'left': startX,
                'top': startY,
                'width': 0,
                'height': 0
            }).show();
        }

    });

    // 鼠标移动绘制矩形
    $video.on('mousemove', function (e) {
        if (!isDrawing) return;

        console.log("mouse move on video");

        var currentX = e.pageX - $video.offset().left;
        var currentY = e.pageY - $video.offset().top;

        var width = currentX - startX;
        var height = currentY - startY;

        // 确保矩形不超出视频边界
        currentX = Math.max(0, Math.min(currentX, $video.width()));
        currentY = Math.max(0, Math.min(currentY, $video.height()));

        $rectangle.css({
            'width': Math.abs(width),
            'height': Math.abs(height),
            'left': width > 0 ? startX : currentX,
            'top': height > 0 ? startY : currentY
        });

        calculateAndDisplayRatios();
    });

    // 鼠标释放结束绘制
    $video.on('mouseup', function () {
        if (!isDrawing) return;
        isDrawing = false;
        calculateAndDisplayRatios(true);
    });


}

$(function () {
    $('#holder').enhsplitter({ handle: 'lotsofdots', minSize: 50, vertical: true });

    $("#playButton").on("click", function () {
        play($("#fileName").val());
    });
    $("#buttonReplace").on("click", function () {
        toShowReplacers();
    });
    $("#buttonSegments").on("click", function () {
        toShowSegments();
    });
    $("#buttonReplacerClose").on("click", function () {
        $("#replacerContainer").addClass("hide");
    });
    $("#buttonReplacerConfirm").on("click", function () {
        toReplace();
    });

    $("#script").on("mousemove", function (e) {
        lastActionTime = new Date().getTime();
    });

    $("#script").on("wheel", function (e) {
        lastActionTime = new Date().getTime();
    });

    $("#replaceWords").on("keydown", function (event) {
        //lastActionTime = new Date().getTime();
        event.stopPropagation();
    });

    $("#segmentName").on("keydown", function (event) {
        //lastActionTime = new Date().getTime();
        event.stopPropagation();
    });

    $("#buttonStart").on("click", function (e) {
        buttonStartClicked(e);
    });
    $("#buttonEnd").on("click", function (e) {
        buttonEndClicked(e);
    });
    $("#buttonAddSegment").on("click", function () {
        toAddSegment();
    });

    function toAddSegment() {
        var url = "./addSegment";
        var name = $("#segmentName").val().trim();
        if (name == "") {
            share.toastError__("请先输入片段名");
            return;
        }
        var fileName = share.getParameter__("f");
        var ss = $("#replaceWords").val().split("=>");
        start = share.getSeconds(ss[0]);
        end = share.getSeconds(ss[1]);
        var params = {
            start, end, name, fileName
        };

        var success = function (res) {
            share.closeDialog__();
            self.metadata = res.data;
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


    var fileName = share.getParameter__("f");
    if (fileName != null && fileName.trim() != "") {

        getMetadata(fileName);

    } else {
        loadRecent();
    }
});



