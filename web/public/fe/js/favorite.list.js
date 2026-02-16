window.message_list = window.message_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = window.mhgl_navbar;
  var self = {
    lastMessageTime: 0,
    choosingMore: false,
    checkedIds: {},
    autoRefresh: false,
    data: {
      notLogin: true,
      messages: [],
      maxVoiceWidth: 150,
      minVoiceWidth: 50,
      params: { pageIndex: 1 }
    },
    refreshIntervalMin: 5 * 1000,
    refreshIntervalMax: 20 * 1000,
    id: null,
    item: null,
    initialize__: function () {
      share.debug__("favorite_list.init");
      self.bindEvents__();
      self.initAudio__();
      page.setDoQuery(self.doQuery__);
      var roomId = share.getParameter__("id");

      self.getMessages__();
    },
    onNewChats__: function (chats) {
      for (var i = 0; i < chats.length; ++i) {
        var chat = chats[i];
        if (chat.roomId == self.data.room.address) {
          self.refreshMessages__();
          self.reloadGroups__();
          return;
        }
      }
    },
    doQuery__: function (pageIndex, pageSize) {
      self.getMessages__(pageIndex, pageSize);
    },
    bindEvents__: function () {
      $("#fileSelector").on("change", self.fileSelected__);

      share.onClick__($("#buttonSendFile"), self.buttonSendFileClicked__);

      share.onClick__($("#buttonCancel"), self.buttonCancelClicked__);

      share.onClick__($("#buttonDelete"), self.buttonDeleteClicked__);

      share.onClick__($(".autoReply"), function () {
        self.autoReplyClicked__(this);
      });
      share.onClick__($(".autoRefresh"), function () {
        self.autoRefreshClicked__(this);
      });
      share.onClick__($(".shareLink"), function () {
        self.shareLinkClicked__(this);
      });
    },
    buttonDeleteClicked__: function (e) {
      self.toDeleteMore__();
    },
    buttonCancelClicked__: function (e) {
      self.closeChooseMore__();
    },

    closeChooseMore__: function () {
      self.choosingMore = false;
      $("#moreOptions").addClass("hide");
      if (self.data.messages.pageIndex == 1) {
        $("#messageInput").removeClass("hide");
      } else {
        $("#pagination").removeClass("hide");
      }
      $(".chooseMore").addClass("hide");
    },

    toConfirmDownloadFile__: function (e) {
      var func = function () {
        self.toDownloadFile__(e);
      }

      if (share.inElectron) {
        func();
      } else {
        share.confirmOk__("<div class='breakword'>将要启动系统浏览器去下载该文件，要继续吗?</div>", func);
      }
    },
    toDownloadFile__: function (e) {
      const url = e.currentTarget.getAttribute('path');
      e.preventDefault();
      e.stopPropagation();
      const filename = e.currentTarget.getAttribute('filename');
      var path = url;
      if (path.indexOf("file://") == 0) {
        path = path.substring("file://".length, path.length);
      }

      if (parent.parent.electron) {
        var shell = parent.parent.electron.shell;

        function func() {
          if (shell.openItem != null) {
            shell.openItem(path);
          } else {
            shell.openPath(path);
          }
        }

        share.confirmOk__("<div class='breakword'>将要启动系统程序去打开文件'" + path + "'，要继续吗?</div>", func);
      } else if (parent.cordova.InAppBrowser) {
        // window.open(path, "_system");
        // return;

        var u = "http://localhost:7902" + path;
        //u = "http://localhost:7902/www/download.htm?url=" + encodeURIComponent(u);

        share.closeDialog__();
        parent.cordova.plugins.clipboard.copy(u);
        share.toastInfo__("链接已经复制到剪贴板，您也可以手工打开浏览器下载文件。", 5000);
        const link = document.createElement('a');
        link.setAttribute('href', u);
        //link.setAttribute('download', filename)
        link.setAttribute('target', '_blank')
        link.click();

        //parent.cordova.InAppBrowser.open(u, "_blank");
      } else {

        //parent.cordova.plugins.fileOpener2.open(
        parent.cordova.plugins.fileOpener2.showOpenWithDialog(
          path,
          '',
          {
            error: function (e) {
              console.log('Error status: ' + e.status + ' - Error message: ' + e.message);
            },
            success: function () {
              share.debug__('file opened successfully');
            }
          }
        );
      }
    },
    sendLink__: function (link, succ, fail) {
      self.sendJson__(link, succ, fail);
    },
    sendJson__: function (json, succ, fail) {
      self.sendMessage__({ type: share.TypeJson, data: json }, succ, fail);
    },
    sendVoice__: function (path, duration) {
      self.sendMessage__({ type: "v", data: path, duration: duration });
    },
    sendVideo__: function (path, duration) {
      self.sendMessage__({ type: "V", data: path, duration: duration });
    },
    toVoice1__: function () {
      share.debug__("to voice");

      //录制成功
      function onSuccess(mediaFiles) {
        var i, path, len, localUrl;
        //遍历获取录制的文件（iOS只支持一次录制一个视频或音频）
        for (i = 0, len = mediaFiles.length; i < len; i += 1) {
          share.debug__(mediaFiles);
          path = mediaFiles[i].fullPath;
          localUrl = mediaFiles[i].localURL;
          share.debug__("录制成功！\n\n"
            + "文件名：" + mediaFiles[i].name + "\n"
            + "大小：" + mediaFiles[i].size + "\n\n"
            + "localURL地址：" + mediaFiles[i].localURL + "\n\n"
            + "fullPath地址：" + mediaFiles[i].fullPath);


          parent.resolveLocalFileSystemURL(path, function (entry) {
            self.sendVoice__(entry.toURL());
            return;
            entry.file(
              function (file) {
                setTimeout(() => {
                  const reader = new FileReader();
                  reader.onloadend = function () {
                    var a = [this.result, file, entry];
                    //resolve([this.result, file, entry]);

                    self.sendVoice__(path);
                  };
                  reader.onerror = function (ev) {
                    share.debug__(ev);
                  };
                  reader.readAsDataURL(file);
                  //reader.readAsArrayBuffer(file);
                }, 1000);
              },
              function (err) {
                reject(err);
              }
            );

            var nativePath = entry.toURL();
            share.debug__('Native URI: ' + nativePath);
            //document.getElementById('video').src = nativePath;
          });

          self.sendVoice__(path);

        }
      }

      //录制失败
      function onError(error) {
        alert('录制失败！错误码：' + error.code);
      }

      parent.navigator.device.capture.captureAudio(
        onSuccess, onError, { limit: 15 }
      );
    },
    toVoice__: function () {
      share.debug__("to voice");
      var today = share.timeFormat__(new Date(), "yy-MM-dd-");
      var path = "cdvfile://localhost/temporary/" + today + share.uuid__() + ".mp3";
      var mediaRec = new parent.Media(path,
        // success callback
        function (e) {
          if (self.mediaStatus == "recorded") {
            self.mediaStatus = "playing"
            mediaRec.play();
            setTimeout(function () {
              mediaRec.stop();
            }, 100);
          } else if (self.mediaStatus == "playing") {
            var duration = Math.ceil(mediaRec.getDuration());
            parent.resolveLocalFileSystemURL(path,
              function (entry) {
                self.sendVoice__(entry.toURL(), duration);
              }, function (e) {
                console.log(e.toString());
              });
          }
        },

        // error callback
        function (err) {
          console.log("recordAudio():Audio Error: " + err.code);
        }
      );

      var title = "录音中";
      var content = '<span style="color:red;">正在录音(<span id="recordedTime">0</span>/60)</span>';
      var buttons = [
        {
          text: "暂停",
          onTap: function () {
          }
        },
        {
          text: "结束",
          onTap: function () {
            self.mediaStatus = "recorded";
            mediaRec.stopRecord();
            share.closeDialog__();
          }
        },
        {
          text: "取消",
          onTap: async function (e) {
            await share.closePopup__();
            self.mediaStatus = "recordCancelled";
            mediaRec.stopRecord();
          }
        }
      ];

      function onHide() {
        clearInterval(self.recordingInt);
        self.recordingInt = null;
        if (self.mediaStatus != "recorded") {
          mediaRec.stopRecord();
        }
      }

      share.showDialog__(title, content, buttons, onHide);

      self.mediaStatus = "recording";
      // Record audio
      mediaRec.startRecord();
      var recordedTime = 0;
      var recordingInt = setInterval(function () {
        recordedTime++;
        if (recordedTime == 60) {
          self.mediaStatus = "recorded";
          mediaRec.stopRecord();
          share.closeDialog__();
        } else {
          $("#recordedTime").html(recordedTime);
        }
      }, 1000);

      self.recordingInt = recordingInt;
      // Stop recording after 10 seconds
    },
    toVideo__: function () {
      share.debug__("to video");

      //录制成功
      function onSuccess(mediaFiles) {
        var i, path, len;
        //遍历获取录制的文件（iOS只支持一次录制一个视频或音频）
        for (i = 0, len = mediaFiles.length; i < len; i += 1) {
          share.debug__(mediaFiles);
          path = decodeURIComponent(mediaFiles[i].fullPath);
          var name = mediaFiles[i].name;
          var duration = 0;//Math.ceil(mediaRec.getDuration());

          parent.resolveLocalFileSystemURL(path,
            function (entry) {//
              var dir = "cdvfile://localhost/temporary/";
              dir = parent.cordova.file.applicationStorageDirectory;
              parent.resolveLocalFileSystemURL(dir,
                function (dirEntry) {
                  entry.copyTo(dirEntry, name, function () {
                    share.debug__(entry.nativeURL + " copied to " + dirEntry);
                    self.sendVideo__(dir + name, duration);
                  }, function (e) {
                    console.log("Failed to copy " + entry.nativeURL + " to " + dirEntry);
                  });
                },
                function (error) {
                  console.log("Failed to resolve " + dir);
                }
              );

              return;

              entry.file(function (file) {
                var fr = new FileReader();
                fr.onload = function () {
                  // 获取得到的结果
                  var data = fr.result;
                  self.sendFile__(data, file.name, file.size, file.path);
                }
                // 异步读取文件
                fr.readAsDataURL(file);
              }
              );
              //self.sendVideo__(entry.toURL(), duration);
            }, function (e) {
              console.log(e.toString());
            });

          continue;

          function readBinaryFile(fileEntry) {
            fileEntry.file(function (file) {
              var reader = new FileReader();

              reader.onloadend = function () {
                //加载成功显示图片
                var blob = new Blob([new Uint8Array(this.result)], { type: "image/png" });
                displayImage(blob);
              };

              reader.readAsArrayBuffer(file);

            }, onErrorReadFile);
          }

          var err = function (e) {
            console.log(e.toString());
          };

          parent.requestFileSystem(parent.LocalFileSystem.PERSISTENT, 0, function (fs) {
            share.debug__('打开的文件系统: ' + fs.name);
            fs.root.getFile(path, { create: false, exclusive: false },
              function (fileEntry) {
                readBinaryFile(fileEntry);
              }, err);

          }, err);

        }
      }

      //录制失败
      function onError(error) {
        alert('录制失败！错误码：' + error.code);
      }

      //开始录像（最长录制时间：15秒）
      parent.navigator.device.capture.captureVideo(onSuccess, onError, { duration: 20 });
    },
    toFile__: function () {
      $("#fileSelector").click();
    },
    toLinkPage__: function () {
      var template = $("#templateLinkPageForm").html();
      var id = share.uuid__();
      var content = template.replace(/#id#/g, id);
      var title = "发送网页链接";
      var dialog = null;
      var buttons = [{
        text: "确定",
        onTap: function () {
          var lt = $("#linkTitle" + id).val().trim();
          var ld = $("#linkDesc" + id).val().trim();
          var url = $("#linkUrl" + id).val().trim();
          if (url == "") {
            share.toastError__("请输入链接");
            return;
          }

          if (ld == "") {
            ld = url;
          }

          var link = {
            type: "LinkPage",
            title: lt,
            desc: ld,
            url: url
          };

          self.sendLink__(link, function () {
            dialog && dialog.close();
          });
        }
      }, {
        text: "取消",
        onTap: function () {
          dialog && dialog.close();
        }
      }
      ];
      dialog = share.showDialog__(title, content, buttons);
    },
    toLinkAudio__: function () {
      var template = $("#templateLinkAudioForm").html();
      var id = share.uuid__();
      var content = template.replace(/#id#/g, id);
      var title = "发送音频链接";
      var dialog = null;
      var buttons = [{
        text: "确定",
        onTap: function () {
          var lt = $("#linkTitle" + id).val().trim();
          var ld = $("#linkAuthor" + id).val().trim();
          var url = $("#linkUrl" + id).val().trim();
          if (url == "") {
            share.toastError__("请输入链接");
            return;
          }

          if (ld == "") {
            ld = url;
          }

          var link = {
            type: "LinkAudio",
            title: lt,
            author: ld,
            url: url
          };

          self.sendLink__(link, function () {
            dialog && dialog.close();
          });
        }
      }, {
        text: "取消",
        onTap: function () {
          dialog && dialog.close();
        }
      }
      ];
      dialog = share.showDialog__(title, content, buttons);
    },
    toLink__: function () {
      var buttons = [];
      buttons.push({
        text: "网页链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkPage__(e)
        }
      });
      buttons.push({
        text: "音乐链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkAudio__(e)
        }
      });
      buttons.push({
        text: "视频链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkVideo__(e)
        }
      });

      share.popupAction__('请选择', buttons);

    },
    toLinkVideo__: function () {
      var template = $("#templateLinkVideoForm").html();
      var id = share.uuid__();
      var content = template.replace(/#id#/g, id);
      var title = "发送视频链接";
      var dialog = null;
      var buttons = [{
        text: "确定",
        onTap: function () {
          var url = $("#linkUrl" + id).val().trim();
          if (url == "") {
            share.toastError__("请输入链接");
            return;
          }

          var link = {
            type: "LinkVideo",
            url: url
          };

          self.sendLink__(link, function () {
            dialog && dialog.close();
          });
        }
      }, {
        text: "取消",
        onTap: function () {
          dialog && dialog.close();
        }
      }
      ];
      dialog = share.showDialog__(title, content, buttons);
    },
    toLink__: function () {
      var buttons = [];
      buttons.push({
        text: "网页链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkPage__(e)
        }
      });
      buttons.push({
        text: "音乐链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkAudio__(e)
        }
      });
      buttons.push({
        text: "视频链接",
        onTap: function (e) {
          share.closeDialog__();
          self.toLinkVideo__(e)
        }
      });

      share.popupAction__('请选择', buttons);

    },
    buttonSendFileClicked__: function (e) {
      var buttons = [];
      if (share.inElectron) {
        buttons.push({
          text: "发送链接",
          onTap: async function (e) {
            await share.closePopup__();
            self.toLink__(e);
          }
        });
        buttons.push({
          text: share.getString__("sendFile"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toFile__(e)
          }
        });
        buttons.push({
          text: share.getString__("sendNewKey"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toResetKey__();
          }
        });
        buttons.push({
          text: share.getString__("showHistory"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toOldMessages__(e)
          }
        });
      } else {
        buttons.push({
          text: "发送语音",
          onTap: async function (e) {
            await share.closePopup__();
            self.toVoice__(e)
          }
        });

        buttons.push({
          text: "发送图片",
          onTap: async function (e) {
            await share.closePopup__();
            self.toImage__(e)
          }
        });

        buttons.push({
          text: share.getString__("sendVideo"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toVideo__(e)
          }
        });

        buttons.push({
          text: share.getString__("sendFile"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toFile__(e)
          }
        });
        buttons.push({
          text: share.getString__("showHistory"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toOldMessages__(e)
          }
        });
        buttons.push({
          text: share.getString__("chatSetting"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toGroupSetting__(e)
          }
        });

      }

      share.popupAction__('请选择', buttons);
    },
    toGroupSetting__: function (e) {
      share.todo__();
    },
    showLastMessage__: function () {
      var i = 0;
      setTimeout(self.focusInput__, 10);
      var messages = self.data.messages;
      if (messages && messages.length > 0) {
        i = 0;
        var last = $("#message_" + (messages.length - 1));
        // last[0].scrollIntoView();
        if (last.length < 1) {
          return;
        }

        var rect = last.offset().top + last.height();
        var ri = $("#input_message").offset().top;
        var body = $('html,body');
        var top = body.scrollTop();
        body.animate({
          scrollTop: (rect)
        }, 50, null, null);

      }

      var room = self.data.room;

      var now = new Date().getTime();
      share.callNodejs__(
        {
          func: "updateLastReadTime",
          params: {
            time: now,
            email: share.user__.email,
            address: room.address
          }
        }, function (res) {
          self.reloadGroups__();
        }, function (e) {
          share.toastError__(e);
        }
      );
    },
    sendMessage__: function (msg, s, f, room) {
      if (room == null) {
        room = self.data.room;
      }

      var now = (new Date()).getTime();

      share.saveOwnMessage__(room, msg,
        function (res) {
          //chat saved
          s && s();

          share.sendMessage__(room, res, function (json) {
            //chat status updated
          });
        },
        f ? f : share.toastError__);
    },
    toOldMessages__: function () {
      $("#pagination").removeClass("hide");
      $("#messageInput").addClass("hide");

      self.getMessages__("old", 2);
    },
    getHtml: function (item) {
      var template = $("#templateMessage").html();
      var templateSys = $("#templateMessageSys").html();
      var templateOwn = $("#templateOwnMessage").html();
      let now = new Date().getTime();
      var itemHtml = template.replace(/#id#/g, item.htmlIndex);


      var message = "";
      if (item.type == "Sys") {
        itemHtml = templateSys.replace(/#id#/g, item.htmlIndex);
        message = item.content;
      } else {
        message = self.getHtmlMessage(item);
      }

      if (message == null) {
        debugger;
      }
      var status = (item.marked == 1) ? "" : "hide";

      message = message.replace(/#messageId#/g, item.id);
      itemHtml = itemHtml.replace(/#messageId#/g, item.id);
      itemHtml = itemHtml.replace(/#important#/g, item.important);
      let voteImg = "./img/vote.png";
      if (item.important == 1) {
        voteImg = "./img/unvote.png";
      }
      itemHtml = itemHtml.replace(/#voteImg#/, voteImg);

      message = message.replace(/#markStatus#/g, status);
      itemHtml = itemHtml.replace(/#markStatus#/g, status);

      itemHtml = itemHtml.replace(/__message__/g, message);
      var time = share.timeFormat__(item.sendTime, "yy-MM-dd hh:mm");
      if (time == self.data.lastTime) {
        itemHtml = itemHtml.replace(/__time__/g, "");
      } else {
        itemHtml = itemHtml.replace(/__time__/g, time);
        self.data.lastTime = time;
      }
      let v = "";
      if (item.verified == 1) {
        v = "bg-lock";
      } else if (item.verified == 2) {
        v = "bg-warning";
      }
      itemHtml = itemHtml.replace(/__verified__/g, v);
      var publicKey = share.getPublicKey__(item.content.publicKey);
      itemHtml = itemHtml.replace(/#publicKey#/g, publicKey);

      itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.senderName));

      itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.senderEmail));
      return itemHtml;

    },

    getHtmlMessage: function (item) {
      var templateLogin = $("#templateMessageLogin").html();
      var templateImage = $("#templateImage").html();
      var templateText = $("#templateText").html();
      var templateVoice = $("#templateVoice").html();
      var templateSystem = $("#templateMessageSystem").html();
      var templateCancelled = $("#templateMessageCancelled").html();
      var templateAcceptKey = $("#templateMessageAcceptKey").html();
      var templateResetFriend = $("#templateMessageResetFriend").html();
      var templateConfirmFriend = $("#templateMessageConfirmFriend").html();
      var templateVideo = $("#templateVideo").html();
      var templateWebApp = $("#templateWebApp").html();
      var templateForward = $("#templateForward").html();
      var templateExportFriend = $("#templateExportFriend").html();
      var templateInviteToGroup = $("#templateInviteToGroup").html();
      var templateJoinGroup = $("#templateJoinGroup").html();
      var templateShareGroup = $("#templateShareGroup").html();
      var templateLinkAudio = $("#templateLinkAudio").html();
      var templateLinkVideo = $("#templateLinkVideo").html();
      var templateFile = $("#templateFile").html();
      var templateLinkPage = $("#templateLinkPage").html();

      try {
        item.content = JSON.parse(item.content);
      } catch (e) {
        item.content = { type: "decodeError", data: "error" }
      }

      if (item.content == null) {
        item.content = {};
        return "";
      }
      var data = item.content.data;

      if (item.type == "login") {

      } else if (item.type == "cancelled") {
      } else if (item.content.type == null) {
        debugger;
      } else if (item.content.type.charAt(0) == "v") {
        item.type = "Voice";
      } else if (item.content.type.charAt(0) == "V") {
        item.type = "Video";
      } else if (item.content.type.charAt(0) == "i") {
        item.type = "Image";
        item.name = item.content.type.substring(1, item.content.type.length);
      } else if (item.content.type == "decodeError") {
        item.type = "decodeError";
      } else if (item.content.type == "decodeGroupError") {
        item.type = "decodeGroupError";
      } else if (item.content.type == "acceptKey") {
        item.type = "acceptKey";
      } else if (item.content.type == "resetFriend") {
        item.type = "resetFriend";
      } else if (item.content.type == "confirmFriend") {
        item.type = "confirmFriend";
      } else if (item.content.type == share.TypeJson) {
        if (typeof (data) == 'string') {

        } else {
          var json = data;
          if (json.type == "LinkPage" || json.type == "LinkAudio" || json.type == "LinkVideo") {
            item.type = json.type;
            data = json;
          } else if (json.type == "Forward") {
            item.type = json.type;
            data = json;
          } else if (json.type == "exportFriends") {
            item.type = json.type;
            data = json;
          } else if (json.type == "inviteToGroup") {
            item.type = json.type;
            data = json;
          } else if (json.type == "shareGroup") {
            item.type = json.type;
            data = json;
          } else if (json.type == "joinGroup") {
            item.type = json.type;
            data = json;
          } else if (json.type == "deleteMember") {
            item.type = json.type;
            data = json;
          } else if (json.type == "acceptMember") {
            item.type = json.type;
            data = json;
          } else {
            item.type = json.type;
            data = "不支持的消息类型";
          }
        }
      } else if (item.content.type.charAt(0) == 'f') {
        item.type = "File";
        item.name = item.content.name;
        if (item.name == null || item.name == "") {
          item.name = item.content.type.substring(1, item.content.type.length);
        }
      }

      var message = "";
      if (item.type == "login") {
        message = templateLogin.replace(/#id#/g, item.htmlIndex);
        var info = "您从" + item.content.os + "登录； ";
        var did = item.content.deviceId;
        var didl = share.accounts__.deviceId;
        info += "共有" + item.content.accountsCount + "个账户； ";
        info += "当前账户有" + item.content.friendsCount + "个密友； ";
        if (share.user__.publicKey == item.content.key) {
          if (did != null && did == didl) {
            message = message.replace(/#buttonSyncHide#/g, "hide");
          } else {
            info += "<hr>";
            info += "要同步其账户和密友到本机吗?\n";
            message = message.replace(/#buttonSyncHide#/g, "");
          }
        } else {
          info += "<hr>";
          info += "如果是新设备，请及时同步密钥和通讯录给它。";
          message = message.replace(/#buttonSyncHide#/g, "");
        }

        message = message.replace(/#info#/g, info);
      } else if (item.type == "Image") {
        message = templateImage.replace(/#src#/g, data);
      } else if (item.type == "cancelled") {
        message = templateCancelled.replace(/#content#/g, share.getString__("", `e...`));
        message = message.replace(/#id#/g, item.htmlIndex);
        if (item.fromOwn == 1) {
          message = message.replace(/__button__/g, share.getString__("", `e`));
        } else {
          message = message.replace(/__button__/g, share.getString__("", `ehide`));
        }
      } else if (item.type == "decodeError") {
        message = templateSystem.replace(/#info#/g, "朋友消息解密失败<br>请重新发送秘钥给对方");
        message = message.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/__hide__/g, "");
      } else if (item.type == "decodeGroupError") {
        message = templateSystem.replace(/#info#/g, share.getString__("decodeGroupError"));
        message = message.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/__hide__/g, "hide");
      } else if (item.type == "acceptKey") {
        message = templateAcceptKey.replace(/#info#/g, "开始使用新秘钥:" + share.getPublicKey__(item.content.publicKey));
        message = message.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#send#/g, "");
      } else if (item.type == "resetFriend") {
        message = templateResetFriend.replace(/#info#/g, "发来新身份:" + share.getPublicKey__(item.content.publicKey));
        message = message.replace(/#id#/g, item.htmlIndex);
      } else if (item.type == "Voice") {
        message = templateVoice.replace(/#src#/g, "file://" + data);
        message = message.replace(/#id#/g, item.htmlIndex);
        item.duration = item.content.duration;
        if (item.duration == null) {
          item.duration = 1;
        }
        message = message.replace(/ _width_/g, self.getVoiceWidth__(item.duration));
        //message = message.replace(/ _width_/g, 5);
        message = message.replace(/#duration#/g, share.getDurationText__(item.duration));
        //message = message.replace(/#duration#/g, 5);
      } else if (item.type == "Video") {
        message = templateVideo.replace(/#src#/g, data);
        message = message.replace(/#id#/g, item.htmlIndex);
        item.duration = item.content.duration;
        if (item.duration == null) {
          item.duration = 1;
        }


        message = message.replace(/ _width_/g, self.getVoiceWidth__(item.duration));
        //message = message.replace(/ _width_/g, 5);
        message = message.replace(/#duration#/g, share.getDurationText__(item.duration));
        //message = message.replace(/#duration#/g, 5);
      } else if (item.type == "WebApp") {
        message = templateWebApp.replace(/#title#/g, item.fileName);
      } else if (item.type == "LinkAudio") {
        message = templateLinkAudio.replace(/#url#/g, data.url);
        message = message.replace(/#title#/g, share.htmlEncode__(data.title));
        message = message.replace(/#author#/g, share.htmlEncode__(data.author));
      } else if (item.type == "LinkVideo") {
        message = templateLinkVideo.replace(/#url#/g, data.url);
      } else if (item.type == "Forward") {
        message = templateForward.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#header#/g, share.getSeal(data.message.senderName));
        message = message.replace(/#from#/g, share.htmlEncode__(data.message.senderName));
        message = message.replace(/#time#/g, share.timeFormat__(data.message.createTime, "yy-MM-dd hh:mm"));
        message = message.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(data.message.senderEmail));
        message = message.replace(/#content#/g, self.getHtmlMessage(data.message));
      } else if (item.type == "exportFriends") {
        message = templateExportFriend.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#info#/g, "要导入" + data.fromOs + "的密钥及通讯录吗?");
      } else if (item.type == "inviteToGroup") {
        message = templateInviteToGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("", `e您已进入群聊`));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        message = message.replace(/#group#/g, share.getString__("", `e邀请你加入群聊'${roomName}'`));
      } else if (item.type == "shareGroup") {
        message = templateShareGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("", `e请点击接受邀请`));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        message = message.replace(/#group#/g, share.getString__("", `e邀请你加入群聊'${roomName}'`));
      } else if (item.type == "joinGroup") {
        message = templateJoinGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("", `e请点击批准加入`));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        var senderName = "";
        if (data && data.sender) {
          senderName = data.sender.comment;
        }

        message = message.replace(/#group#/g, share.getString__("", `e${senderName}邀请${item.senderName}加入群聊`));
      } else if (item.type == "deleteMember") {
        message = templateInviteToGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("", `e剔除群聊`));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        var senderName = item.senderName;
        var members = data.members;
        var memberNames = "";
        for (var i = 0; i < members.length; ++i) {
          if (i > 0) {
            memberNames += ",";
          }

          memberNames += members[i].comment;
        }

        var info = share.getString__("removeMember", `${senderName}将${memberNames}移出群聊`, senderName, memberNames);
        if (data.error == "managerNeeded") {
          info += "<br>非管理员操作，忽略";
        }
        if (data.error == "fired") {
          info = share.getString__("removeMember", `e${senderName}将你移出群聊`, senderName);
        }

        message = message.replace(/#group#/g, info);
      } else if (item.type == "acceptMember") {
        message = templateInviteToGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("", `e加入群聊`));

        var senderName = item.senderName;
        var members = data.members;
        var memberNames = "";
        for (var i = 0; i < members.length; ++i) {
          if (i > 0) {
            memberNames += ",";
          }

          memberNames += members[i].mname;
        }

        var info = share.getString__("", `e${senderName}将${memberNames}加入群聊`);
        if (data.error == "groupNotFound") {
          info += "<br>错误的群，忽略";
        }

        message = message.replace(/#group#/g, info);
      } else if (item.type == "File") {
        message = templateFile.replace(/#name#/g, share.htmlEncode__(item.name));
        message = message.replace(/#path#/g, "file://" + data);
        message = message.replace(/#fileIcon#/g, share.getFileIcon__(item.name));
      } else if (item.type == "LinkPage") {
        message = templateLinkPage.replace(/#url#/g, data.url);
        message = message.replace(/#title#/g, share.htmlEncode__(data.title));
        message = message.replace(/#desc#/g, share.htmlEncode__(data.desc));
      } else {
        message = templateText.replace(/#text#/g, share.htmlEncode__(data == null ? "" : data));
      }

      return message;
    },
    showMessages__: function (json) {
      var messages = json;
      page.update(json.pageIndex, json.pageSize, json.totalRows);
      if (json.totalRows > 0) {
        $("#emptyList").css("display", "none");
      }

      var startIndex = 0;

      var html = [];
      var items = messages.list;
      self.data.messages = items;

      for (var j = 0; j < items.length; ++j) {
        var item = items[j];
        var index = j + startIndex;
        item.htmlIndex = index;
        var itemHtml = self.getHtml(item);
        html.push(itemHtml);
      };

      $("#messages").html(html.join(" "));

      var maxVoiceDuration = 0;

      items.forEach(function (item, i) {
        if (item.type == "Voice") {
          if (item.duration == null || item.duration == 0) {
            item.duration = 1.0 * item.voiceLength / 1000;
          }

          if (item.duration > maxVoiceDuration) {
            maxVoiceDuration = item.duration;
          }
        }
      });

      self.data.maxVoiceDuration = maxVoiceDuration;
      self.data.lastTime = "";


      share.onClick__($(".messageImage"), self.imageClicked__);

      share.onClick__($(".toDownloadFile"), self.toConfirmDownloadFile__);
      share.onClick__($(".linkPageClicked"), self.linkPageClicked__);
      share.onClick__($(".buttonSync"), self.buttonSyncClicked__);
      share.onClick__($(".buttonImportFriends"), self.buttonImportFriendsClicked__);
      share.onClick__($(".inviteToGroupMessage"), self.inviteToGroupMessageClicked__);
      share.onClick__($(".joinGroupMessage"), self.joinGroupMessageClicked__);
      share.onClick__($(".shareGroupMessage"), self.shareGroupMessageClicked__);

      share.onClick__($(".buttonResetKey"), self.toResetKey__);
      share.onClick__($(".buttonResetFriend"), self.toResetFriend__);
      share.onClick__($(".buttonReEdit"), self.toReEdit__);

      share.onClick__($(".messageAction"), function () {
        self.messageActionClicked__(this);
      });

      share.onClick__($(".wechatMedia"), function () {
        self.mediaClicked__(this);
      });

      share.onClick__($(".maxHeightMessage"), function () {
        self.maxHeightMessageClicked__(this);
      });
      share.onClick__($(".wechatVideo"), function () {
        self.videoClicked__(this);
      });

      share.onClick__($("#imageFullScreenContainer"), function () {
        self.imageFullScreenContainerClicked__(this);
      });

      share.onClick__($(".vote"), self.vote__);

      share.onClick__($(".voiceIcon"), self.voiceIconClicked__);
      share.onClick__($(".listItemNc"), self.itemClicked__);
      // share.onClick__($(".voiceDuration"), self.voiceDurationClicked__);
      $(".voiceDuration").off("mousedown").on("mousedown", self.voiceDurationTouchStart__);
      $(".voiceDuration").off("mousemove").on("mousemove", self.voiceDurationTouchMove__);
      $(".voiceDuration").off("mouseup").on("mouseup", self.voiceDurationTouchEnd__);

      $(".voiceDuration").off("touchstart").on("touchstart", self.voiceDurationTouchStart__);
      $(".voiceDuration").off("touchmove").on("touchmove", self.voiceDurationTouchMove__);
      $(".voiceDuration").off("touchend").on("touchend", self.voiceDurationTouchEnd__);

      $('.voiceDuration').disableSelection();

      if (json.lastReadTime > 0) {
        self.data.lastReadTime = json.lastReadTime;
      }

      setTimeout(self.updateAllVoiceWidth__, 100);

      $("#body").removeClass("hide");
      $("#loading").addClass("hide");

      // var H = parseInt(share.getWindowHeight(window))+parseInt(share.getWindowScrollTop(window)) - 40;//此处的40是class为bottom的div元素高
      // $("#body").css("height", H + "px");
    },
    toReEdit__: function (e) {
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      if (si.content.type == "T") {
        $("#input_message").val(si.content.data);
      }
    },

    vote__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var item = self.data.messages[index];
      var img = $("#vote_" + index).attr('src');
      var important = 0;
      if (img == "./img/unvote.png") {
        img = "./img/vote.png";
        important = 0;
      } else {
        img = "./img/unvote.png";
        important = 1;
      }

      var succ = function (json) {
        if (json && json.message) {
          share.toastInfo__(json.message);
        } else {
          $("#vote_" + index).attr('src', img);
        }
      };

      var fail = function (e) {
        share.toastError__(e);
      };

      share.callNodejs__(
        {
          func: "voteMessage",
          params: { important: important, id: item.id }
        },
        succ,
        fail
      );
    },

    itemClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var checked = $("#checkbox_" + index).prop('checked');
      $("#checkbox_" + index).prop('checked', !checked).trigger("change");
    },

    linkPageClicked__: function (e) {
      share.debug__("linkPageClicked");
      e.preventDefault();
      e.stopPropagation();
      const url = e.currentTarget.getAttribute('url');
      var path = url;

      if (parent.parent.electron) {
        var shell = parent.parent.electron.shell;

        function func() {
          if (shell.openExternal != null) {
            shell.openExternal(path);
          } else if (shell.openItem != null) {
            shell.openItem(path);
          } else {
            shell.openPath(path);
          }
        }

        share.confirmOk__("<div class='breakword'> 将要启动系统程序去打开链接'" + path + "'，要继续吗?</div>", func);
      } else if (parent.parent.cordova.InAppBrowser) {
        const link = document.createElement('a');
        var u = path;

        link.setAttribute('href', u);
        //link.setAttribute('download', filename)
        link.setAttribute('target', '_blank')
        link.click();

        //parent.cordova.InAppBrowser.open(u, "_self");
      } else {

      }
    },

    buttonSyncClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      if (share.user__.publicKey == si.content.key) {
        var message = "确定要同步'" + si.content.os + "'上的通讯录到本机吗?";
        share.confirm__(message, function () {
          share.importFriends__(si.content, function () {
            share.toastSuccess__("从" + si.content.os + "成功导入通讯录");
            share.reloadAccounts__();
          });
        });
      } else {
        var message = "确定要同步密钥和通讯录给'" + si.content.os + "'吗?";
        message += "\n请从旧设备上执行此操作，不要用新设备上的密钥覆盖旧设备";
        share.confirm__(message, function () {
          share.exportFriends__(si.content, function () {
            share.toastSuccess__("已将密钥和通讯录以加密方式发出，请在新设备'" + si.content.os + "'上查看并执行导入操作。");
          });
        });
      }
    },
    reloadGroups__: function () {
      parent.mhgl_chat_list && parent.mhgl_chat_list.reloadGroups__();
    },
    buttonImportFriendsClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      var message = "确定要从'" + si.content.data.fromOs + "'导入密钥和通讯录吗?";
      share.confirm__(message, function () {
        si.content.data.clean = true;
        share.importFriends__(si.content.data, function () {
          share.toastSuccess__("从" + si.content.data.fromOs + "成功导入密钥和通讯录");
          share.reloadAccounts__();
          self.reloadGroups__();
        });
      });
    },
    inviteToGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      if (si.type == "shareGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__("这是您发起的邀请，请耐心等待对方加入群聊");
        } else {
          var message = share.getString__("", `e确定要加入群聊'${si.content.data.owner.roomName}'吗?<br>这会向群主发送入群申请。`);
          share.confirm__(message, function () {
            share.joinGroup__(si, self.refreshMessages__);
          });
        }
      }
    },
    joinGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      if (si.type == "joinGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__("这是您发起的申请，请耐心等待群主审批");
        } else {
          var message = share.getString__("", `e确定要允许${si.senderName}加入群聊吗?`);
          share.confirm__(message, function () {
            share.acceptJoinGroup__(si, self.refreshMessages__);
          });
        }
      }
    },
    shareGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      if (si.type == "shareGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__("请耐心等待对方接受邀请");
        } else {
          var message = share.getString__("", `e确定要接受邀请加入群聊吗?`);
          share.confirm__(message, function () {
            share.joinGroup__(si, self.refreshMessages__);
          });
        }
      }
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
    updateDuration__: function (duration) {
      var item = self.data.messages[self.data.playingIndex];
      if (duration != item.duration) {
        item.duration = duration;
        item.content.duration = duration;
        share.updateDuration__(item);
        $("#voiceDuration_" + self.data.playingIndex).html(share.getDurationText__(duration));
      }
    },
    ensureMaxVoiceWidthInited__: function (playingIndex) {
      self.data.maxVoiceWidth = $("#player_" + playingIndex).width();
    },
    updateAllVoiceWidth__: function () {
      self.data.messages.forEach(function (item, i) {
        if (item.type == "Voice") {
          //self.ensureMaxVoiceWidthInited__(i);
          $("#voiceBody_" + i).css("width", self.getVoiceWidth__(item.duration));
        }
      });
      self.data.messages.forEach(function (item, i) {
        if (item.type == "Voice") {
          //self.ensureMaxVoiceWidthInited__(i);
          $("#voiceBody_" + i).css("width", self.getVoiceWidth__(item.duration));
        }
      });
    },
    updateVoicePlayingTime__: function (time) {
      if (self.data.playingIndex == null || self.data.playingIndex < 0) {
        return;
      }

      var item = self.data.messages[self.data.playingIndex];
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
      var si = self.data.messages[index];

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
      var si = self.data.messages[index];

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

    getVoiceWidth__: function (duration) {
      if (duration > self.data.maxVoiceDuration) {
        self.data.maxVoiceDuration = duration;
      }

      return self.data.minVoiceWidth + 1.0 * duration / self.data.maxVoiceDuration * (self.data.maxVoiceWidth - self.data.minVoiceWidth);
    },
    imageFullScreenContainerClicked__: function (e) {
      $("#imageFullScreenContainer").addClass("hide");
    },
    voiceIconClicked__: function (e) {
      var id = e.currentTarget.id;
      share.debug__("item clicked:" + id);

      var index = id.split("_")[1];
      var si = self.data.messages[index];
      self.data.selectedMessage = si;

      self.playVoice__(index);

    },
    reSend__: function (chat) {
      share.sendMessage__(self.data.room, chat, function (json) {
        //chat status updated
        if (self.data.params.pageIndex == 1) {
          self.getMessages__("current");
        }
      });
    },
    unSelectAllItems__: function () {
      self.data.selectedMessage = null;
      self.data.notesSelected = false;
      $("#qaNotesBar").removeClass("selected");
      $("#qaTitleBar").removeClass("selected");
      self.data.messages.forEach(function (id, i) {
        $("#id_" + i).removeClass("selected");
      });
    },
    voiceDurationClicked__: function (e) {
      var id = e.currentTarget.id;
      share.debug__("voice duration clicked:" + id);

      self.unSelectAllItems__();
      var index = id.split("_")[1];
      var si = self.data.messages[index];
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
    getAudio__: function () {
      return $("#audio");
    },
    playVoice__: function (index) {
      share.debug__("playVoice:" + index);
      var item = null;
      if (index >= 0) {
        if (index < self.data.messages.length) {
          item = self.data.messages[index];
        }
      }

      if (item == null) {
        self.data.playingIndex = -1;
        self.data.playerStatus = "stopped";
        self.data.playingVoice = false;
        return;
      }

      if (item.type == 'Voice') {

      } else {
        self.playVoice__(index + 1);
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
      audio[0].src = item.content.data;

      audio[0].play();
      if (self.data.seekTo > 0) {
        self.updateVoicePlayingTime__(self.data.seekTo);
      }

      self.data.playerStatus = "playing";
      self.startTimer__();
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
    maxHeightMessageClicked__: function (e) {
      var el = $(e);
      if (el.is('.maxHeightMessage')) {
        el.removeClass("maxHeightMessage");
      } else {
        el.addClass("maxHeightMessage");
      }
    },
    imageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      $("#imageFullScreen").attr("src", e.currentTarget.src);
      $("#imageFullScreenContainer").removeClass("hide");
      return false;
    },
    videoClicked__: function (e) {
      var ele = e;
      if (ele.paused) {
        ele.play();
      } else {
        ele.pause();
      }
    },
    mediaClicked__: function (e) {
      var id = $(e).attr("data-id");

      var url = share.getBaseUrl__() + "/mvc/wx/robot/file/download";
      var params = {
        id: id,
        url: share.getBaseUrl__() + "/video"
      };
      var success = function (json) {
        if (json.message) {
          share.toastInfo__(json.message);
        } else {
          share.open__(json.url);
        }
      };

      var fail = function (e) {
        share.toastError__(e);
      };

      share.httpGet__(url, params, success, fail);
      /*
       * var id = $(e).attr("data-id"); var url = share.getBaseUrl__() +
       * "/mvc/wx/robot/file"; var params = { id : id }; var success =
       * function(json) { if (json.message) { share.toastInfo__(json.message); }
       * else { share.open__(share.getBaseUrl__() + "/image/" + id); } };
       * 
       * var fail = function(e) { if (json.message) {
       * share.toastError__(json.message); } };
       * 
       * share.httpGet__(url, params, success, fail); return false;
       */
    },
    messageActionClicked__: function (e) {
      if (self.choosingMore) {
        return;
      }
      self.selectedItem && self.selectedItem.removeClass("selected");

      self.selectedItem = $(e).parents(".listItemNc");
      self.selectedItem.addClass("selected");

      var id = e.id;
      var index = id.split("_")[1];
      var si = self.data.messages[index];
      self.data.selectedMessage = si;

      var buttons = [];

      buttons.push({
        text: share.getString__("forward"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toForward__(e)
        }
      });

      buttons.push({
        text: share.getString__("delete"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toDelete__(e)
        }
      });

      buttons.push({
        text: share.getString__("selectMore"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toChooseMore__(e)
        }
      });

      share.popupAction__('请选择', buttons);
    },

    toChooseMore__: function (e) {
      self.choosingMore = true;
      self.checkedIds = {};
      $("#moreOptions").removeClass("hide");
      $("#messageInput").addClass("hide");
      $("#pagination").addClass("hide");
      $(".chooseMore").removeClass("hide");
      $(".form-check-input").off("change").on("change", self.checkBoxChanged__);
      share.onClick__($(".form-check-input"), self.checkBoxClicked__);

      $(".form-check-input").prop('checked', false);
      self.checkedIds = {};
    },

    checkBoxChanged__: function (e) {
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      self.itemChoosed__(index);
    },

    checkBoxClicked__: function (e) {
      //e.preventDefault();
      e.stopPropagation();
    },

    toCancel__: function (e) {
      var id = $(e).attr("data-id");
      var succ = function (res) {
        self.getMessages__("current");
      };

      var fail = function (e) {
        share.toastError__(e);
      };
      share.cancelMessage__(self.data.room, id, succ, fail);
    },

    toForward__: async function (e) {
      let params = {
        keyName: "",
        email: share.user__.email,
        pageIndex: 1,
        pageSize: 1024000
      }

      let data = await share.getChatList__(params);

      var id = self.data.selectedMessage.id;
      var list = data.list;
      var groupTemplate = $$("#templateGroup").html();
      var html = [];
      list.forEach(function (item, i) {
        var itemHtml = groupTemplate.replace(/#desc#/g, item.lastMessage);
        itemHtml = itemHtml.replace(/#id#/g, i);
        itemHtml = itemHtml.replace(/#name#/g, item.alias == "" ? item.name : item.alias);

        itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.name));
        itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.address));

        html.push(itemHtml);
      });

      self.groups = list;

      $("#groups").html(html.join(""));
      $("#groups").removeClass("hide");
      $("#messages").addClass("hide");
      $("#pagination").addClass("hide");

      share.onClick__($(".group"), function () {
        self.groupSelected(this, id);
      });
    },

    forwardMessage__: function (msg, group, succ, fail) {
      var content = JSON.parse(msg.content);
      self.sendMessage__(content, succ, fail, group);
    },

    groupSelected: function (e, messageId) {
      var id = e.id;
      var index = id.split("_")[1];
      var group = self.groups[index];
      var f = async function (confirmed) {
        if (confirmed) {
          let res = await share.getFavoriteById__(messageId);

          self.forwardMessage__(res, group,
            function (res) {
              $("#groups").addClass("hide");
              $("#messages").removeClass("hide");
              $("#pagination").removeClass("hide");
            }, function (e) {
              share.toastError__(JSON.stringify(e))
            });

        } else {
          $("#groups").addClass("hide");
          $("#messages").removeClass("hide");
          $("#pagination").removeClass("hide");
        }
      };

      let name = group.alias;
      if (name == null || name == "") {
        name = group.name;
      }

      share.confirm__(share.getString__("confirmToForwardMessage", name), f);
    },

    toDeleteMore__: function (e) {
      var del = function (confirmed) {
        if (!confirmed) {
          return;
        }

        var ids = Object.keys(self.checkedIds);
        for (var i = 0; i < ids.length; ++i) {
          ids[i] = self.data.messages[ids[i]].id;
        }

        ids = ids.join("','");
        ids = "'" + ids + "'";

        var succ = function (json) {
          if (json && json.message) {
            share.toastInfo__(json.message);
          } else {

          }
          self.closeChooseMore__();
          ids = Object.keys(self.checkedIds);
          for (var i = 0; i < ids.length; ++i) {
            $("#checkbox_" + ids[i]).parents(".listItemNc").remove();
          }
        };

        var fail = function (e) {
          share.toastError__(e);
        };

        share.callNodejs__(
          {
            func: "deleteMoreFavorite",
            params: { ids: ids }
          },
          succ,
          fail
        );
      };

      share.confirm__("确定要删除选中的收藏吗?", del);
    },

    toDelete__: function (e) {
      var del = function (confirmed) {
        if (!confirmed) {
          return;
        }

        let target = share.currentTarget;
        var id = target.id;
        var index = id.split("_")[1];
        id = self.data.messages[index].id;

        var succ = function (json) {
          if (json && json.message) {
            share.toastInfo__(json.message);
          } else {

          }

          $(target).parents(".listItemNc").remove();
        };

        var fail = function (e) {
          share.toastError__(e);
        };

        share.callNodejs__(
          {
            func: "deleteMoreFavorite",
            params: { ids: "'" + id + "'" }
          },
          succ,
          fail
        );
      };

      share.confirm__("确定要删除本消息吗?", del);
    },

    prevPageClicked__: function (e) {
      page.gotoNextPage();
    },
    autoReplyClicked__: function (e) {
      var si = self.data.si;
      share.open__("./autoReply.list.htm?nickName=" + encodeURIComponent(si.nickName) + "&selfNickName=" + encodeURIComponent(self.data.myself.nickName));
    },
    autoRefreshClicked__: function (e) {
      var refresh = self.autoRefresh;
      self.autoRefresh = !refresh;
      self.showAutoRefresh__();
    },
    showAutoRefresh__: function (e) {
      if (self.autoRefresh) {
        $(".autoRefresh").removeClass("delete");
        share.toastSuccess__("自动刷新已开启", 2000);
        self.refreshMessages__();
      } else {
        $(".autoRefresh").addClass("delete");
        share.toastSuccess__("自动刷新已关闭，请手动刷新本网页查看最新消息", 2000);
      }
    },
    setRefreshTimer__: function () {
      try {
        clearTimeout(self.data.refreshTimer);
      } catch (e) {

      }

      self.data.refreshTimer = setTimeout(self.refreshMessages__, 10000);
    },
    shareLinkClicked__: function (e) {

      var url = share.getBaseUrl__() + "/mvc/wx/robot/messages/share";
      var success = function (json) {
        var content = "请复制以下链接分享给好友<br>" + json.link;
        share.toastInfo__(content);
      };

      var fail = function (e) {
      };

      var params = {
        si: self.data.si,
        myself: self.data.myself
      };

      params = JSON.stringify(params);
      params = JSON.parse(params);
      // params.uid = share.user__.id;
      delete params.si.lastReadTime;
      delete params.si.updateTime;
      delete params.si.createTime;
      params = JSON.stringify(params);
      var link = share.getBaseUrl__() + "/fe/robot.htm?params=" + encodeURIComponent(params);
      params = {
        link: link,
        encode: 0
      };

      share.httpGet__(url, params, success, fail, null, null, null, "");
    },

    focusInput__: function () {
      $("#input_message")[0].select();//trigger("focus");
    },
    refreshMessages__: function () {
      self.data.params.pageIndex = 1;
      self.getMessages__("new");
    },
    itemChoosed__: function (index) {
      var checked = $("#checkbox_" + index).prop('checked');
      if (checked) {
        self.checkedIds[index] = 1;
      } else {
        delete self.checkedIds[index];
      }
    },
    getMessages__: async function (pageIndex, pageSize) {
      share.debug__("getMessage started");

      if (pageIndex == null) {
        pageIndex = 1;
      }


      let params = {
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let json = await share.getFavoriteList__(params);

      try {
        self.showMessages__(json);
      } catch (e) {
        share.toastError__(e.message);
      }
    }
  };

  $(function () {
    if (share.needInit__(/favorite\.list\.htm/g))
      self.initialize__();
  });

  var app = share;
  return self;
})();


