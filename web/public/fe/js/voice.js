window.voice = window.voice || (function () {
    const share = window.mhgl_share;
    let system = null;
    let scriptTimes = {};
    let maskEnabled = 1;
    let start = -1;
    let end = -1;
    let playingId = -1;
    let lastActionTime = new Date().getTime();
    let videoContentPosition;

    let self = {
        data: {
            maxVoiceWidth: 150,
            minVoiceWidth: 50,
        },

        initialize__: function () {
            self.getVoices();
            self.initAudio__();
            self.initHeartbeat__();
        },
        initHeartbeat__: function () {
            var formatTime = function(ts) {
                if (!ts) return "";
                var d = new Date(ts);
                return d.getFullYear() + "-" +
                    String(d.getMonth() + 1).padStart(2, '0') + "-" +
                    String(d.getDate()).padStart(2, '0') + " " +
                    String(d.getHours()).padStart(2, '0') + ":" +
                    String(d.getMinutes()).padStart(2, '0') + ":" +
                    String(d.getSeconds()).padStart(2, '0');
            };
            var loadHeartbeatInfo = function() {
                $.get("/voice/ping", function(config) {
                    var info = "";
                    if (config) {
			config = JSON.parse(config);
                        var keys = Object.keys(config);
                        if (keys.length > 0) {
                            var key = keys[0];
                            var value = config[key];
                            info = key;
                            if (value && value.updateTime) {
                                info += " - " + formatTime(value.updateTime);
                            }
                        }
                    }
                    if (info) {
                        $("#heartbeatText").text(info);
                        $("#heartbeat").show();
                    } else {
                        $("#heartbeat").hide();
                    }
                }).fail(function() {
                    $("#heartbeat").hide();
                });
            };
            loadHeartbeatInfo();
            setInterval(loadHeartbeatInfo, 30000);
        },
        deleteSelectedVoices__: function (e) {
            e.preventDefault();
            var selectedIndexes = [];
            $(".voiceCheckbox:checked").each(function () {
                selectedIndexes.push($(this).data("index"));
            });
            if (selectedIndexes.length === 0) {
                share.toast__("请先勾选要删除的语音");
                return;
            }
            var fileNames = selectedIndexes.map(function (i) {
                return self.data.newMessages[i].name;
            });
            share.confirm__(share.getString__("confirmDelete"), function () {
                $.ajax({
                    url: "/video/voice",
                    type: "DELETE",
                    contentType: "application/json",
                    data: JSON.stringify({ files: fileNames }),
                    success: function () {
                        share.toast__(share.getString__("deleted"));
                        self.getVoices();
                    },
                    error: function (e) {
                        share.toastError__(e);
                    }
                });
            });
        },
        parseFileTime__: function(fileName) {
            var parts = fileName.split(".");
            if (parts.length >= 2) {
                var datePart = parts[0];
                if (datePart.length === 6 && /^\d{6}$/.test(datePart)) {
                    return parseInt(datePart);
                }
            }
            return 0;
        },
        getFileIndex__: function(e) {
            var player = $(e.target).closest(".player");
            if (player.length > 0) {
                var id = player[0].id;
                var match = id.match(/player_(\d+)/);
                if (match) {
                    return parseInt(match[1]);
                }
            }
            return -1;
        },
        deleteOldVoices__: function (e) {
            e.preventDefault();
            var index = self.getFileIndex__(e);
            if (index < 0 || !self.data.newMessages || !self.data.newMessages[index]) {
                share.toast__("无法获取当前文件");
                return;
            }
            var targetFile = self.data.newMessages[index];
            var targetTime = self.parseFileTime__(targetFile.name);
            var files = self.data.newMessages;
            var oldFiles = files.filter(function(f, i) {
                return i !== index && self.parseFileTime__(f.name) < targetTime;
            }).map(function(f) {
                return f.name;
            });
            if (oldFiles.length === 0) {
                share.toast__("没有比此文件更旧的文件");
                return;
            }
            share.confirm__("确定删除 " + oldFiles.length + " 个旧文件？", function () {
                $.ajax({
                    url: "/video/voice",
                    type: "DELETE",
                    contentType: "application/json",
                    data: JSON.stringify({ files: oldFiles }),
                    success: function () {
                        share.toast__("已删除 " + oldFiles.length + " 个文件");
                        self.getVoices();
                    },
                    error: function (e) {
                        share.toastError__(e);
                    }
                });
            });
        },
        getVoiceWidth__: function (duration) {
            return self.data.minVoiceWidth + 1.0 * duration / self.data.maxVoiceDuration * (self.data.maxVoiceWidth - self.data.minVoiceWidth);
        },
        getVoices: function () {
            let voiceHtmls = [];
            $.get("/video/voice", function (data) {
                data = JSON.parse(data);
                var files = data.files;
                self.data.newMessages = files;
                for (let i = 0; i < files.length; ++i) {

                    var templateVoice = $("#templateVoice").html();
                    message = templateVoice.replace(/#id#/g, i);
                    message = message.replace(/#fileName#/g, files[i].name);
                    let strs = files[i].name.split(".");
                    files[i].duration = parseInt(strs[2]) * 60 + parseInt(strs[3]);
                    message = message.replace(/ _width_/g, self.getVoiceWidth__(files[i].duration));
                    message = message.replace(/#duration#/g, share.getDurationText__(files[i].duration));
                    voiceHtmls.push(message);
                }


                $("#items").html(voiceHtmls.join(""));
                share.onClick__($(".voiceIcon"), self.voiceIconClicked__);
                share.onClick__($(".fileName"), self.fileNameClicked__);
                $(".voiceDuration").off("mousedown").on("mousedown", self.voiceDurationTouchStart__);
                $(".voiceDuration").off("mousemove").on("mousemove", self.voiceDurationTouchMove__);
                $(".voiceDuration").off("mouseup").on("mouseup", self.voiceDurationTouchEnd__);

                $(".voiceDuration").off("touchstart").on("touchstart", self.voiceDurationTouchStart__);
                $(".voiceDuration").off("touchmove").on("touchmove", self.voiceDurationTouchMove__);
                $(".voiceDuration").off("touchend").on("touchend", self.voiceDurationTouchEnd__);

                $(".voiceDeleteBtn").off("click").on("click", self.deleteSelectedVoices__);
                $(".voiceDeleteOldBtn").off("click").on("click", self.deleteOldVoices__);
                new bootstrap.Dropdown($(".voiceMoreBtn"));
            });
        },
        initAudio__: function () {
            var audio = self.getAudio__();
            audio.bind('canplay', function () {
                if (self.data.seekTo > 0) {
                    audio[0].currentTime = self.data.seekTo;
                    self.data.seekTo = 0;
                }

                var duration = this.duration;
                self.updateDuration__(Math.ceil(duration));
                self.updateVoicePlayingTime__(self.getAudio__()[0].currentTime);
            }).bind('ended', function () {
                self.updateVoicePlayingTime__(0);
                var playing = $(".voiceIconPlaying");
                playing.removeClass("voiceIconPlaying");
                playing.addClass("voiceIcon");
                self.playVoice__(self.data.playingIndex + 1);
            });
        },
        voiceDurationTouchStart__: function (e) {
            share.debug__("voiceDurationTouchStart__");
            var x = e.clientX;
            if (x == null) {
                x = e.originalEvent.changedTouches[0].clientX;
            }
            self.data.touchX = x;
            self.data.touchStartTime = self.getAudio__()[0].currentTime;
            var id = e.currentTarget.id;

            var index = id.split("_")[1];
            var si = self.data.newMessages[index];

            if (self.data.playingIndex != index) {
                return;
            }
        },
        voiceDurationTouchMove__: function (e) {
            share.debug__("voiceDurationTouchMove__");
            if (self.data.touchX == null || self.data.touchX < 0) {
                share.debug__("touchX not set:" + self.data.touchX);
                return false;
            }
            var x = e.clientX;
            if (x == null) {
                x = e.originalEvent.changedTouches[0].clientX;
            }
            var id = e.currentTarget.id;

            var index = id.split("_")[1];
            var si = self.data.newMessages[index];

            if (self.data.playingIndex != index) {
                return false;
            }
            // var x = e.clientX;
            var ele = $("#voiceBody_" + index);
            var sx = self.data.touchX;// ele.offset().left;
            var width = ele.width();
            var seekTo = self.data.touchStartTime + (x - sx) / width * si.duration;
            self.data.seekTo = seekTo;
            self.updateVoicePlayingTime__(self.data.seekTo);
            return true;
        },
        voiceDurationTouchEnd__: function (e) {
            share.debug__("voiceDurationTouchEnd__");
            if (self.voiceDurationTouchMove__(e)) {
                self.seekVoice__(self.data.seekTo);
            }

            self.data.touchX = -1;
        },

        updateVoicePlayingTime__: function (time) {
            if (self.data.playingIndex == null || self.data.playingIndex < 0) {
                return;
            }

            var item = self.data.newMessages[self.data.playingIndex];
            var bar = $("#progressBar_" + self.data.playingIndex);
            var p = 1.0 * time / item.duration * 100;
            if (p < 1) {
                p = 1;
                bar.css("width", "0px");
            } else {
                if (p > 100) {
                    p = 100;
                }

                bar.css("width", p + "%");
            }

            bar.html(share.getDurationText__(time));
        },
        unSelectAllItems__: function () {
            self.data.selectedMessage = null;
            self.data.notesSelected = false;
            $("#qaNotesBar").removeClass("selected");
            $("#qaTitleBar").removeClass("selected");
            self.data.newMessages.forEach(function (id, i) {
                $("#id_" + i).removeClass("selected");
            });
        },
        voiceDurationClicked__: function (e) {
            var id = e.currentTarget.id;
            share.debug__("voice duration clicked:" + id);

            self.unSelectAllItems__();
            var index = id.split("_")[1];
            var si = self.data.newMessages[index];
            self.data.selectedMessage = si;

            if (self.data.playingIndex != index) {
                return;
            }

            var x = e.clientX;
            var ele = $("#voiceBody_" + index);
            var sx = ele.offset().left;
            var width = ele.width();
            var seekTo = (x - sx) / width * si.duration;
            share.debug__("x=" + x + ";sx=" + sx + ";seekTo=" + seekTo);
            self.seekVoice__(seekTo);
        },
        voiceIconClicked__: function (e) {
            var id = e.currentTarget.id;
            share.debug__("item clicked:" + id);

            self.unSelectAllItems__();
            var index = id.split("_")[1];
            var si = self.data.newMessages[index];
            self.data.selectedMessage = si;

            self.playVoice__(index);

        },
        fileNameClicked__: function (e) {
            var id = $(this).parents(".player")[0].id;
            share.debug__("fileName clicked:" + id);
            var index = id.split("_")[1];
            var si = self.data.newMessages[index];
            var fileName = $(this).html();
            var url = "../video/voice/" + fileName + ".txt";

            var params = {
            };

            var success = function (data) {
            };

            var fail = function (e) {
                share.toastError__(e);
            };

            $.get(url, function (data) {
                share.closeDialog__();
                var script = data.split("\n");

                let template = $("#scriptTemplate").html();
                let htmls = [];
                for (let i = 0; i < script.length; ++i) {
                    let line = script[i].replace(/-->.*\] /g, "");
                    line = line.replace(/ <br>/g, "");
                    line = line.replace(/\[/g, "");
                    let html = template.replace(/#script#/g, line);
                    html = html.replace(/#id#/g, i);
                    htmls.push(html);
                }

                $("#script").html(htmls.join(""));
            });
        },
        getAudio__: function () {
            return $("#audio");
        },
        startTimer__: function () {
            if (self.data.playerStatus != "playing") {
                return;
            }

            var audio = self.getAudio__();
            self.data.playingTime = audio[0].currentTime;
            if (self.data.seekTo > 0) {
                self.updateVoicePlayingTime__(self.data.seekTo);
            } else {
                self.updateVoicePlayingTime__(self.data.playingTime);
            }

            setTimeout(self.startTimer__, 500);
        },
        seekVoice__: function (seekTo) {
            share.debug__("seekVoice__:seekTo=" + seekTo);
            if (self.data.playerStatus == "playing") {
                self.getAudio__()[0].currentTime = seekTo;
                self.data.seekTo = 0;
            } else {
                self.data.seekTo = seekTo;
                self.playVoice__(self.data.playingIndex);
            }
        },
        pauseVoice__: function () {
            share.debug__("pauseVoice");
            var playing = $(".voiceIconPlaying");
            playing.removeClass("voiceIconPlaying");
            playing.addClass("voiceIcon");
            self.data.playerStatus = "paused";
            var audio = self.getAudio__();
            self.data.seekTo = audio[0].currentTime;
            audio[0].pause();
        },
        stopVoice__: function () {
            var playing = $(".voiceIconPlaying");
            playing.removeClass("voiceIconPlaying");
            playing.addClass("voiceIcon");
            self.updateVoicePlayingTime__(0);
            self.data.playerStatus = "stopped";
            self.data.playingIndex = -1;
        },

        playVoice__: function (index) {
            share.debug__("playVoice:" + index);
            var item = null;
            if (index >= 0) {
                if (index < self.data.newMessages.length) {
                    item = self.data.newMessages[index];
                }
            }

            if (item == null) {
                self.data.playingIndex = -1;
                self.data.playerStatus = "stopped";
                self.data.playingVoice = false;
                return;
            }

            var audio = self.getAudio__();

            share.debug__("playingIndex=" + self.data.playingIndex);
            share.debug__("playerStatus=" + self.data.playerStatus);
            if (self.data.playingIndex == index) {
                if (self.data.playerStatus == 'playing') {
                    self.pauseVoice__();
                    return;
                } else {
                }
            } else {
                self.updateVoicePlayingTime__(0);
            }

            var playing = $(".voiceIconPlaying");
            playing.removeClass("voiceIconPlaying");
            playing.addClass("voiceIcon");
            $("#voiceIcon_" + index).addClass("voiceIconPlaying");
            $("#voiceIcon_" + index).removeClass("voiceIcon");
            self.data.playingIndex = index / 1;
            audio[0].src = "../video/voice/" + item.name;
            audio[0].play();
            if (self.data.seekTo > 0) {
                self.updateVoicePlayingTime__(self.data.seekTo);
            }

            self.data.playerStatus = "playing";
            self.startTimer__();
        },

    }

    $(function () {
        self.initialize__();
    });

    return self;
})();


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

let scrolling = false;
let $rectangle = $('#rectangle');
let isDrawing = false;
let $video = $("video");


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

$('#holder').enhsplitter({ handle: 'lotsofdots', minSize: 50, vertical: true });

$("#playButton").on("click", function () {
    play($("#fileName").val());
});
$("#buttonReplace").on("click", function () {
    toShowReplacers();
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


