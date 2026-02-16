window.message_list = window.message_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    creatingGroup: null,
    toConfirmFriend: null,
    lastMessageTime: 0,
    a: 8,
    choosingMore: false,
    checkedIds: {},
    autoRefresh: false,
    data: {
      notLogin: true,
      newMessages: [],
      maxVoiceWidth: 150,
      minVoiceWidth: 50,
      params: { pageIndex: 1 }
    },
    refreshIntervalMin: 5 * 1000,
    refreshIntervalMax: 20 * 1000,
    id: null,
    item: null,
    initialize__: function () {
      share.debug__("message_list.init");
      parent.mhgl_page.hidePagination__();
      self.bindEvents__();
      self.initAudio__();
      navbar.highlight__("group");
      navbar.showCommon__();
      page.setDoQuery(self.doQuery__);
      var roomId = share.getParameter__("id");
      share.getRoomById__(roomId, function (res) {
        self.data.room = res;
        if (res == null) {
          share.toastError__(share.getString__("friendNotExist"));
        } else {
          // setInterval(self.getStatus__, 2000);
          $("#main").removeClass("hide");
          let alias = self.data.room.alias;
          if (alias == null || alias == "") {
            alias = self.data.room.name;
          }
          parent.window.document.title = "密信-" + alias;
          if (share.isGroup__(self.data.room)) {
            $("#input_message_label_totalMembers").html(share.formatNumber__(self.data.room.totalMembers, 3));
          }

          $("#input_message_label").html(share.getString__("inputMessageHint", alias));
          self.getMessages__();
        }
      })

      self.translate__();
    },
    translate__: function () {
      /*
      let ph = {
        ".inputTitle": share.string.inputTitle,
        ".inputAbstract": share.string.inputAbstract,
        ".inputLink": share.string.inputLink,
        ".inputAudioTitle": share.string.inputAudioTitle,
        ".inputAudioAuthor": share.string.inputAudioAuthor,
        ".inputAudioLink": share.string.inputAudioLink,
        ".inputVideoLink": share.string.inputVideoLink,
        "#input_message": share.string.inputMessage,
      };

      Object.entries(ph).forEach(([key, value]) => {
        share.setPlaceholder__(key, value);
      });
      */

      let html = {
        "#loading": "loading",
        ".emptyList": "emptyList",
        "#buttonSend": "send",
        "#buttonDelete": "delete",
        "#buttonCancel": "cancel",
        ".linkHint": "link",
        ".nameHint": "name",
        ".authorHint": "author",
        ".confirmDeleteMessage": "confirmDeleteMessage",
        ".delBefore": "delBeforeMessage",
        ".prevPage": "moreMessage",
        ".messageForbidden": "messageForbidden",
        ".buttonSync": "sync",
        ".buttonResetKey": "resetKey",
        ".buttonResetFriend": "accept",
        ".cancelled": "messageCancelled",
        ".buttonImportFriends": "import",
        ".unsupportAudioLink": "unsupportAudioLink",
        ".unsupportVideoLink": "unsupportVideoLink",
        ".me": "me",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });

    },
    toSend__: function () {
      var msg = $("#input_message").val();
      if (msg.trim() == "") {
        return;
      }
      self.sendMessage__({ type: "T", data: msg });
    },
    fileSelected__: async function (e) {
      const files = e.target.files;
      if (files.length < 1) {
        return;
      }

      var file = files[0];
      let waiting = file.path ? null : share.toastWaiting__(share.getString__("loading"));
      let res = await share.getFilePath(file);
      waiting && waiting.close();
      $("#fileSelector").val("");
      let exceeded = await share.exceededAttachmentSize(file.size);
      if (!exceeded) {
        self.sendFile__(file.name, file.size, res.path);
      }
    },
    setInputHeight__: function () {
      var msg = $("#input_message").val();
      var str = msg.split("\n");
      var rows = str.length;
      if (rows < 1) {
        //rows = 1;
      }

      if (rows > 1) {
      } else {
      }

      if (rows > 7) {
        rows = 7;
      } else {
      }

      $("#input_message")[0].style.height = (rows * 1.25 + 1.625) + 'rem'; // 设置为内容高度
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
      self.getMessages__("old", pageIndex, pageSize);
    },
    bindEvents__: function () {
      share.onClick__($("#buttonSend"), self.toSend__);
      $("#fileSelector").on("change", self.fileSelected__);
      $("#input_message").on("keyup", function (event) {
        if (share.inElectron && event.key == "Enter" && !event.shiftKey) {
          self.toSend__();
        }
        self.setInputHeight__();

      });
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
        let guide = share.getString__("downloadFileWithBrowser");
        share.confirmOk__(`<div class='breakword'>${guide}</div>`, func);
      }
    },
    toDownloadFile__: function (e) {
      const path = e.currentTarget.getAttribute('path');
      e.preventDefault();
      e.stopPropagation();
      self.doDownload__(path);
    },
    sendFile__: function (fileName, size, path) {
      var buttons = [];
      var fileButton = {
        text: share.getString__("sendAsFile"),
        onTap: async function (e) {
          await share.closePopup__();
          self.sendMessage__({ type: "f", name: fileName, size: size, path: path });
        }
      };

      if (share.isVideo__(fileName)) {
        buttons.push({
          text: share.getString__("sendAsVideo"),
          onTap: async function (e) {
            await share.closePopup__();
            self.sendMessage__({ type: "V", data: path, name: fileName, size: size });
          }
        });

        buttons.push(fileButton);
        share.popupAction__(share.getString__("isTheFileVideo"), buttons);
      } else if (share.isAudio__(fileName)) {
        buttons.push({
          text: share.getString__("sendAsAudio"),
          onTap: async function (e) {
            await share.closePopup__();
            self.sendMessage__({ type: "v", data: path, size: 1, duration: 1 });
          }
        });

        buttons.push(fileButton);
        share.popupAction__(share.getString__("isTheFileAudio"), buttons);
      } else if (share.isImage__(fileName)) {
        buttons.push({
          text: share.getString__("sendAsImage"),
          onTap: async function (e) {
            await share.closePopup__();
            self.sendMessage__({ type: "i", data: path, name: fileName, size: size });
          }
        });

        buttons.push(fileButton);
        share.popupAction__(share.getString__("isTheFileImage"), buttons);
      } else {
        self.sendMessage__({ type: "f", name: fileName, size: size, path: path });
      }
    },
    sendLink__: function (link, succ, fail) {
      self.sendJson__(link, succ, fail);
    },
    sendJson__: function (json, succ, fail) {
      self.sendMessage__({ type: share.TypeJson, data: json }, succ, fail);
    },
    sendVoice__: function (path, duration) {
      share.debug__("sendVoice__");
      self.sendMessage__({ type: "v", data: path, size: duration, duration: duration });
    },
    sendVideo__: function (path, name, duration) {
      self.sendMessage__({ type: "V", data: path, name: name, size: duration });
    },
    sendImage__: function (path, name, size) {
      self.sendMessage__({ type: "i", data: path, name: name, size: size });
    },
    toVoice__: async function () {
      share.debug__("to voice");

      let { result, error } = await share.checkMicrophonePermission();
      if (error) {
        share.toastError__(error);
        return;
      }

      if (!result) {
        return;
      }


      var today = share.timeFormat__(new Date(), "yy-MM-dd-");
      let relativePath = "voice_" + today + share.uuid__() + ".m4a";
      var path = "cdvfile://localhost/temporary/" + relativePath;
      if (share.isIos__()) {
        path = "cdvfile://localhost/library/" + relativePath;
      }
      var title = share.getString__("recording");
      var content = `<span style="color:red;">${title}(<span id="recordedTime">0</span>/60)</span>`;
      var buttons = [
        {
          text: share.getString__("end"),
          onTap: function () {
            self.mediaStatus = "recorded";
            mediaRec.stopRecord();
            share.closeDialog__();
          }
        },
        {
          text: share.getString__("cancel"),
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
      var recordedTime = 0;
      var mediaRec = new parent.Media(path,
        // success callback
        function (e) {
          if (self.mediaStatus == "recorded") {
            self.mediaStatus = "stopped";
            if (recordedTime > 0) {
              self.sendVoice__(relativePath, recordedTime);
            }
          }
        },
        // error callback
        function (err) {
          share.error__("recordAudio():Audio Error: " + err.message);
        }
      );

      share.debug__("mediaRec created");

      self.mediaStatus = "recording";
      // Record audio
      mediaRec.startRecord();
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

      function onSuccess(mediaFiles) {
        var i, path, len;
        //遍历获取录制的文件（iOS只支持一次录制一个视频或音频）
        for (i = 0, len = mediaFiles.length; i < len; i += 1) {
          share.debug__(mediaFiles);
          path = decodeURIComponent(mediaFiles[i].fullPath);
          if (share.isIos__()) {
            path = decodeURIComponent(mediaFiles[i].localURL);
          }
          var name = mediaFiles[i].name;
          var duration = 0;//Math.ceil(mediaRec.getDuration());

          parent.resolveLocalFileSystemURL(path,
            function (entry) {//
              var size = entry.size;

              let func = async function () {
                let res = await share.copyFile__(entry.nativeURL.replace("file://", ""), "chatVideos", name);
                if (res.error) {
                  share.error__(JSON.stringify(res.error));
                } else {
                  self.sendVideo__(res.dstPath, name, duration);
                }
              };

              func();
            }, function (e) {
              share.error__(e.toString());
            }
          );
        }
      }

      function onError(error) {
        share.toastWarning(share.getString__("captureCancelled"), 2000);
      }

      //开始录像（最长录制时间：15秒）
      parent.navigator.device.capture.captureVideo(onSuccess, onError, { duration: 20 });
    },
    toImage__: function () {
      share.debug__("to image");

      //录制成功
      function onSuccess(mediaFiles) {
        var i, path, len;
        //遍历获取录制的文件（iOS只支持一次录制一个视频或音频）
        for (i = 0, len = mediaFiles.length; i < len; i += 1) {
          share.debug__(mediaFiles);
          path = decodeURIComponent(mediaFiles[i].fullPath);
          if (share.isIos__()) {
            path = decodeURIComponent(mediaFiles[i].localURL);
          }
          var name = mediaFiles[i].name;

          parent.resolveLocalFileSystemURL(path,
            function (entry) {//
              var size = entry.size;

              let func = async function () {
                let res = await share.copyFile__(entry.nativeURL.replace("file://", ""), "chatImages", name);
                if (res.error) {
                  share.error__(JSON.stringify(res.error));
                } else {
                  self.sendImage__(res.dstPath, name, size);
                }
              };

              func();
            }, function (e) {
              share.error__(e.toString());
            }
          );
        }
      }

      function onError(error) {
        share.toastWarning(share.getString__("captureCancelled"), 2000);
      }

      //开始录像（最长录制时间：15秒）
      parent.navigator.device.capture.captureImage(onSuccess, onError, { limit: 1 });
    },
    toFile__: function () {

    },
    toLinkPage__: async function () {
      let succ = function (link, dialog) {
        self.sendLink__(link, function () {
          dialog && dialog.close();
        });
      }

      share.inputPageLink__(succ)
    },
    toLinkAudio__: async function () {
      var template = $("#templateLinkAudioForm").html();
      var id = share.uuid__();
      var content = template.replace(/#id#/g, id);
      content = content.replace(/#title#/, share.getString__("sendVoiceLink"));
      var dialog = null;
      var buttons = [{
        text: share.getString__("confirm"),
        onTap: function () {
          var lt = $("#linkTitle" + id).val().trim();
          var ld = $("#linkAuthor" + id).val().trim();
          var url = $("#linkUrl" + id).val().trim();
          if (url == "") {
            share.toastError__(share.getString__("linkNeeded"));
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
        text: share.getString__("cancel"),
        onTap: function () {
          dialog && dialog.close();
        }
      }
      ];
      dialog = await share.popupAction__(content, buttons);
    },
    toLinkVideo__: async function () {
      var template = $("#templateLinkVideoForm").html();
      var id = share.uuid__();
      var content = template.replace(/#id#/g, id);
      content = content.replace(/#title#/, share.getString__("sendVideoLink"));
      var dialog = null;
      var buttons = [{
        text: share.getString__("confirm"),
        onTap: function () {
          var url = $("#linkUrl" + id).val().trim();
          if (url == "") {
            share.toastError__(share.getString__("linkNeeded"));
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
        text: share.getString__("cancel"),
        onTap: function () {
          dialog && dialog.close();
        }
      }
      ];
      dialog = await share.popupAction__(content, buttons);
    },
    toLink__: function () {
      var buttons = [];
      buttons.push({
        text: share.getString__("pageLink"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toLinkPage__(e)
        }
      });
      buttons.push({
        text: share.getString__("voiceLink"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toLinkAudio__(e)
        }
      });
      buttons.push({
        text: share.getString__("videoLink"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toLinkVideo__(e)
        }
      });

      share.popupAction__('', buttons);

    },
    buttonSendFileClicked__: function (e) {
      var buttons = [];
      const sendLinkButton = {
        text: share.getString__("sendLink"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toLink__(e);
        }
      };
      const sendFileButton = {
        text: share.getString__("sendFile"),
        labelFor: "fileSelector",
        onTap: async function (e) {
          await share.closePopup__();
          self.toFile__(e);
        }
      };
      const historyButton = {
        text: share.getString__("history"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toOldMessages__(e);
        }
      };
      const groupMembersButton = {
        text: share.getString__("groupMemebers"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toViewMembers();
        }
      };
      const sendVoiceButton = {
        text: share.getString__("sendVoice"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toVoice__(e);
        }
      };
      const sendPictureButton = {
        text: share.getString__("sendPicture"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toImage__(e);
        }
      };
      const sendVideoButton = {
        text: share.getString__("sendVideo"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toVideo__(e);
        }
      };
      const leaveGroupButton = {
        text: share.getString__("leaveGroup"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toLeaveGroup__(e);
        }
      };

      if (share.inElectron) {
        buttons.push(sendLinkButton);
        buttons.push(sendFileButton);
        self.addResetKeyButton__(buttons);
        buttons.push(historyButton);
        if (share.isGroup__(self.data.room)) {
          buttons.push(groupMembersButton);
          buttons.push(leaveGroupButton);
        }
      } else {
        buttons.push(sendVoiceButton);
        buttons.push(sendPictureButton);
        buttons.push(sendVideoButton);
        buttons.push(sendLinkButton);
        buttons.push(sendFileButton);
        self.addResetKeyButton__(buttons);
        buttons.push(historyButton);
        if (share.isGroup__(self.data.room)) {
          buttons.push(leaveGroupButton);
        }
      }

      share.popupAction__('', buttons);
    },
    toViewMembers: function () {
      var target = share.getOpenTarget__(640, "rightFrame");
      share.open__("member.list.htm", target);
      self.onResize__();
    },
    toGroupSetting__: function (e) {
      share.todo__();
    },
    showLastMessage__: function () {
      share.debug__("showLastMessage");
      let last = $('#messages').children().last();

      if (last == null) {
        return;
      }

      last[0].scrollIntoView({
        behavior: 'instant',  // smooth, instant, auto
        block: 'center',      // 垂直对齐方式：start, center, end
        inline: 'nearest'    // 水平对齐方式
      });

      setTimeout(function () {
        $('.messageImage').each(function () {
          $(this).height("auto");
        });
        $('.wechatVideo').each(function () {
          $(this).height("auto");
        });
      }, 200);
    },
    updateLastReadTime: function () {
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
      share.debug__("sendMessage");
      if (room == null) {
        room = self.data.room;
      }

      var now = (new Date()).getTime();

      share.saveOwnMessage__(room, msg,
        async function (res) {
          //chat saved
          $("#input_message").val("");
          self.setInputHeight__();
          s && s();
          self.data.params.pageIndex = 1;
          await self.getMessages__("current");

          share.sendMessage__(room, res, function (json) {
            //chat status updated
            if (self.data.params.pageIndex == 1) {
              self.getMessages__("current");
            }

            setTimeout(() => { parent.parent.mhgl_container.startSyncMails__() }, 2000);
          });
        },
        f ? f : share.toastError__);
    },
    joinGroup__: function (room, msg, succ, fail) {
      fail = fail || share.toastError__;

      let chat = {
        type: share.TypeJson,
        data: {
          type: "toJoinGroup",
          owner: msg.content.data.owner,
          sender: msg.content.data.sender
        }
      };

      share.saveOwnMessage__(room, chat,
        async function (res) {
          //chat saved
          succ && succ();
          self.data.params.pageIndex = 1;
          await self.getMessages__("current");

          share.sendMessage__(room, res, function (json) {
            //chat status updated
            if (self.data.params.pageIndex == 1) {
              self.getMessages__("current");
            }
          });
        },
        fail ? fail : share.toastError__);

    },
    toOldMessages__: function () {
      $("#pagination").removeClass("hide");
      $("#messageInput").addClass("hide");

      self.getMessages__("old", 2);
    },
    getHtml: function (chat) {
      var templateMessage = $("#templateMessage").html();
      var templateMessageSys = $("#templateMessageSys").html();
      var templateMessageForbidden = $("#templateMessageForbidden").html();
      var templateOwnMessage = $("#templateOwnMessage").html();
      var itemHtml = templateMessage.replace(/#id#/g, chat.htmlIndex);
      if (chat.senderEmail.toLowerCase() == share.user__.email.toLowerCase()) {
        chat.fromOwn = 1;
      }
      if (chat.fromOwn == 1) {
        itemHtml = templateOwnMessage.replace(/#id#/g, chat.htmlIndex);
      }

      var message = "";
      if (chat.type == "Sys") {
        itemHtml = templateMessageSys.replace(/#id#/g, chat.htmlIndex);
        message = chat.content;
      } else if (chat.verified == Common.VerifiedForbidden) {
        itemHtml = templateMessageForbidden.replace(/#id#/g, chat.htmlIndex);
        message = chat.content;
      } else {
        let res = self.getHtmlInner(chat, itemHtml);
        itemHtml = res.itemHtml;
        message = res.message;
      }

      itemHtml = self.updateStatus__(chat, itemHtml);

      if (message == null) {
        debugger;
      }
      var status = (chat.marked == 1) ? "" : "hide";

      message = message.replace(/#messageId#/g, chat.id);
      itemHtml = itemHtml.replace(/#messageId#/g, chat.id);
      itemHtml = itemHtml.replace(/#important#/g, chat.important);
      let voteImg = "./img/vote.png";
      if (chat.important == 1) {
        voteImg = "./img/unvote.png";
      }
      itemHtml = itemHtml.replace(/#voteImg#/, voteImg);

      message = message.replace(/#markStatus#/g, status);
      itemHtml = itemHtml.replace(/#markStatus#/g, status);

      itemHtml = itemHtml.replace(/__message__/g, message);
      var time = share.getTime__(chat.sendTime);
      if (time == self.data.lastTime) {
        itemHtml = itemHtml.replace(/__time__/g, "");
      } else {
        itemHtml = itemHtml.replace(/__time__/g, time);
        self.data.lastTime = time;
      }
      if (chat.fromOwn) {
        chat.HeadImgUrl = "";
        chat.fromNickName = "";
        //item.fromRemarkName = myself.remarkName;
      } else {
        chat.fromNickName = chat.senderName;
      }
      var name = chat.fromNickName;

      itemHtml = itemHtml.replace(/__name__/g, name);
      let v = "";
      if (chat.verified == Common.VerifiedSucc) {
        v = "bg-lock";
      } else if (chat.verified == Common.VerifiedFail) {
        v = "bg-warning";
      }

      itemHtml = itemHtml.replace(/__verified__/g, v);
      var publicKey = share.getPublicKey__(chat.content.publicKey);
      itemHtml = itemHtml.replace(/#publicKey#/g, publicKey);

      itemHtml = itemHtml.replace(/#header#/g, share.getSeal(chat.senderName));

      itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(chat.senderEmail));
      return itemHtml;
    },

    getMessageStatus__: function (item) {
      let status = "";
      let now = new Date().getTime();
      if (item.status == "sending") {
        status = "sending";
        if (now - item.createTime > 20 * 1000) {
          status = "error";
        }
      } else if (item.status == "") {
      } else if (item.status == "cancelled") {
        status = item.status;
      } else if (item.status == "sent") {
        status = "";
      } else {
        status = item.status;
      }

      return status;
    },

    getHtmlInner: function (item, itemHtml) {
      let templateMessageSys = $("#templateMessageSys").html();
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
      var templateLinkPage = $("#templateLinkPage").html();
      var templateMail = $("#templateMail").html();

      try {
        item.content = JSON.parse(item.content);
      } catch (e) {
        item.content = { type: "decodeError", data: "error" }
      }

      if (item.content == null) {
        item.content = {};
        return "";
      }

      let content = item.content;

      let data = item.content.data;
      if (item.type == null || item.type == "" || item.type == "j") {
        if (item.content.type == null) {
          message = templateText.replace(/#text#/g, share.getString__("unsupportedMessageType", item.type));
        } else if (item.content.type.charAt(0) == "T") {
          item.type = "Text";
        } else if (item.content.type == "memberNotExist") {
          item.type = item.content.type;
        } else if (item.content.type.charAt(0) == "m") {
          item.type = "Mail";
        } else if (item.content.type.charAt(0) == "v") {
          item.type = "Voice";
        } else if (item.content.type.charAt(0) == "V") {
          item.type = "Video";
        } else if (item.content.type.charAt(0) == "i") {
          item.type = "Image";
          item.name = item.content.type.substring(1, item.content.type.length);
        } else if (item.content.type.charAt(0) == 'f') {
          item.type = "File";
          item.name = item.content.name;
          if (item.name == null || item.name == "") {
            item.name = item.content.type.substring(1, item.content.type.length);
          }
        } else if (item.content.type == share.TypeJson) {
          if (typeof (data) == 'string') {
          } else {
            item.type = data.type;
          }
        } else if (item.content.type != null) {
          item.type = item.content.type;
        }
      }

      var message = "";
      if (item.type == "login") {
        message = templateLogin.replace(/#id#/g, item.htmlIndex);
        var info = share.getString__("loginInfo", item.content.os);
        var did = item.content.deviceId;
        var didl = share.accounts__.deviceId;
        message = message.replace(/#info#/g, info);
        info = share.getString__("accountsNum", item.content.accountsCount);
        info += " " + share.getString__("friendsNum", item.content.friendsCount);
        message = message.replace(/#detail#/g, info);
      } else if (item.type == "Image") {

        let webViewPath = data;

        webViewPath = share.getFullFilePath__(data);
        message = templateImage.replace(/#src#/g, webViewPath);
        message = message.replace(/#alt#/g, share.getString__("imageAlt"));
      } else if (item.type == "cancelled") {
        message = templateCancelled.replace(/#content#/g, "...");
        message = message.replace(/#id#/g, item.htmlIndex);
        if (item.fromOwn == 1) {
          message = message.replace(/__button__/g, "");
        } else {
          message = message.replace(/__button__/g, "hide");
        }
      } else if (item.type == "decodeError") {
        message = templateSystem.replace(/#info#/g, share.getString__("decodeError"));
        message = message.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/__hide__/g, "");
      } else if (item.type == "decodeGroupError") {
        message = templateSystem.replace(/#info#/g, share.getString__("decodeGroupError"));
        message = message.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/__hide__/g, "hide");
      } else if (item.type == "memberNotExist") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        message = share.getString__("memberNotExist", item.senderEmail);
      } else if (item.type == "acceptKey") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        message = share.getString__("sendResetKey", item.senderName, share.getPublicKey__(item.content.publicKey));
      } else if (item.type == "resetFriend") {
        let greeting = item.content.greeting;
        let info = share.getString__("resetFriend", greeting, "<hr>", share.getPublicKey__(item.content.publicKey));
        message = templateResetFriend.replace(/#info#/g, info);
        message = message.replace(/#id#/g, item.htmlIndex);
      } else if (item.type == "Voice") {
        message = templateVoice.replace(/#id#/g, item.htmlIndex);
        item.duration = item.content.duration;
        if (item.duration == null) {
          item.duration = 1;
        }
        message = message.replace(/ _width_/g, self.getVoiceWidth__(item.duration));
        message = message.replace(/#duration#/g, share.getDurationText__(item.duration));
      } else if (item.type == "Video") {
        let webviewPath = share.getFullFilePath__(data);
        message = templateVideo.replace(/#src#/g, webviewPath);
        message = message.replace(/#id#/g, item.htmlIndex);
        item.duration = item.content.duration;
        if (item.duration == null) {
          item.duration = 1;
        }
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
        message = message.replace(/#time#/g, share.getTime__(data.message.createTime));
        message = message.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(data.message.senderEmail));
        data.message.htmlIndex = item.htmlIndex;
        let res = self.getHtmlInner(data.message, itemHtml);
        message = message.replace(/#content#/g, res.message);
      } else if (item.type == "exportFriends") {
        message = templateExportFriend.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#info#/g, share.getString__("importContact", data.fromOs));
      } else if (item.type == "confirmFriend") {
        if (item.status == "sending") {
          self.toConfirmFriend = item;
        } else {
          self.toConfirmFriend = null;
        }

        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        if (item.status == "") {
          message = share.getString__("friendAccepted");
        } else {
          message = share.getString__("youAcceptFriend");
        }
      } else if (item.type == "resetKey") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        if (item.status == "") {
          message = share.getString__("youSentResetKey");
        } else {
          message = share.getString__("youSendingResetKey");
        }
      } else if (item.type == "inviteToGroup") {
        if (item.status == "sending") {
          self.creatingGroup = item;
        } else {
          self.creatingGroup = null;
        }

        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        if (item.senderEmail == share.user__.email) {
          if (item.status == "") {
            message = share.getString__("youCreatedGroup");
          } else {
            message = share.getString__("youCreatingGroup");
          }
        } else {
          message = share.getString__("youJoinedGroup", item.senderName);
        }
      } else if (item.type == "setOwner") {
        if (item.status == "sending") {
          self.settingOwner = item;
        } else {
          self.settingOwner = null;
        }

        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        let comment = content.data.newOwner.comment;
        if (comment == "" || comment == null) {
          comment = content.data.newOwner.name;
        }

        if (item.senderEmail == share.user__.email) {
          if (item.status == "") {
            message = share.getString__("youSetOwner", comment);
          } else {
            message = share.getString__("youSettingOwner", comment);
          }
        } else {
          message = share.getString__("setAsOwner", item.senderName, comment);
        }
      } else if (item.type == "shareGroup") {
        message = templateShareGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("clickToAcceptInvitation"));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        message = message.replace(/#group#/g, share.getString__("inviteYouToGroup", roomName));
      } else if (item.type == "joinGroup") {
        message = templateJoinGroup.replace(/#id#/g, item.htmlIndex);
        message = message.replace(/#title#/g, share.getString__("clickToAcceptJoin"));
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        var senderName = "";
        if (data && data.sender) {
          senderName = data.sender.comment;
        }

        message = message.replace(/#group#/g, share.getString__("inviteMemberToJoinGroup", senderName, item.senderName, item.senderEmail));
      } else if (item.type == "updateGroup") {
        if (item.status == "sending") {
          self.updatingGroup = item;
        } else {
          self.updatingGroup = null;
        }

        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        if (item.senderEmail == share.user__.email) {
          message = share.getString__("youChangeGroupName", item.content.data.value);
        } else {
          message = share.getString__("changeGroupName", item.senderName, item.content.data.value);
        }
      } else if (item.type == "deleteMember") {
        if (item.status == "sending") {
          self.deletingMember = item;
        } else {
          self.deletingMember = null;
        }

        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        let roomName = "";

        let data = content.data;
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

        message = share.getString__("deleteFromGroup", senderName, memberNames);
        if (data.error == "managerNeeded") {
          message += "<br>非管理员操作，忽略";
        }
        if (data.error == "fired") {
          message = share.getString__("deleteYou", senderName);
        }
      } else if (item.type == "acceptMember") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);

        let data = content.data;
        var senderName = item.senderName;

        if (data && data.sender) {
          senderName = data.sender.comment;
        }

        var members = data.members;
        let newMembers = data.newMembers;
        if (newMembers != null) {
          members = newMembers;
        }

        var memberNames = "";
        for (var i = 0; i < members.length; ++i) {
          if (members[i].memail != share.user__.email.toLowerCase()) {
            if (memberNames != "") {
              memberNames += ",";
            }

            memberNames += members[i].name;
          }
        }

        if (newMembers == null) {
          message = share.getString__("ownerInviteYouToGroup", senderName, memberNames);
        } else {
          message = share.getString__("inviteMembersToGroup", senderName, memberNames);
        }
        if (data.error == "groupNotFound") {
          message += "<br>错误的群，忽略";
        }
      } else if (item.type == "confirmFriend") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        message = share.getString__("friendInvitationAccepted");
      } else if (item.type == "toJoinGroup") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);

        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        var senderName = "";
        if (data && data.sender) {
          senderName = data.sender.comment;
        }

        message = share.getString__("wait4Owner2Approve", senderName, roomName);
      } else if (item.type == "acceptJoinGroup") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        let roomName = "";
        if (data && data.owner) {
          roomName = data.owner.roomName;
        }

        var senderName = "";
        if (data && data.sender) {
          senderName = data.sender.comment;
        }

        let title = share.getString__("approved");
        let desc = share.getString__("inviteMemberToJoinGroup", senderName, data.mname, data.memail);
        message = `${title}: ${desc}`;
      } else if (item.type == "leaveGroup") {
        itemHtml = templateMessageSys.replace(/#id#/g, item.htmlIndex);
        if (item.senderEmail == share.user__.email) {
          message = share.getString__("youLeavingGroup");
          if (item.status == "") {
            message = share.getString__("youLeavedGroup");
          }
        } else {
          message = share.getString__("leavedGroup", item.senderName);
        }
      } else if (item.type == "File") {
        let e = $("#templateFile");
        let fileName = share.htmlEncode__(item.name);
        e.find(".toDownloadFile").attr("filename", fileName);
        let webviewPath = share.getFullFilePath__(data, true);
        e.find(".toDownloadFile").attr("path", "file://" + webviewPath);
        e.find(".fileName").html(fileName);
        e.find(".fileIcon").attr("src", "img/" + share.getFileIcon__(item.name));
        message = e.html();
      } else if (item.type == "LinkPage") {
        message = templateLinkPage.replace(/#url#/g, data.url);
        message = message.replace(/#title#/g, share.htmlEncode__(data.title));
        message = message.replace(/#desc#/g, share.htmlEncode__(data.desc));
        message = message.replace(/#favicon#/g, data.favicon ? data.favicon : "img/link1.png");
        message = message.replace(/#onError#/g, "this.onerror=null;this.src='./img/link.png'");
      } else if (item.type == "Mail") {
        message = templateMail.replace(/#body#/g, data);
        message = message.replace(/#id#/g, item.htmlIndex);
      } else if (item.type == "Text") {
        message = templateText.replace(/#text#/g, share.htmlEncode__(data == null ? "" : data));
      } else {
        message = templateText.replace(/#text#/g, share.getString__("unsupportedMessageType", item.type));
      }

      return { itemHtml, message };
    },

    showMessages__: function (json) {
      var messages = json;
      self.data.messages = messages;
      page.update(json.pageIndex, json.pageSize, json.totalRows);
      $("#emptyList").css("display", "none");
      if ($(".prevPage").length < 2) {
        var prevPage = $("#templatePrevPage").html();
        $("#messages").prepend($(prevPage));
        share.onClick__($(".prevPage"), function () {
          self.prevPageClicked__(this);
        });
      }

      last = $("#messages").children(".prevPageContainer");
      var lastItem = last;
      var startIndex = 0;
      if (json.queryType == "current") {
        self.data.newMessages = [];
        last.nextAll().remove();
        for (var i = messages.list.length - 1; i >= 0; --i) {
          self.data.newMessages.push(messages.list[i]);
        }
        if (messages.list.length == messages.totalRows) {
          $(".prevPage").addClass("hide");
          $(".prevPageContainer").addClass("hide");
        } else {
          $(".prevPage").removeClass("hide");
          $(".prevPageContainer").removeClass("hide");
        }

        $("#pagination").addClass("hide");
        $("#messageInput").removeClass("hide");
      } else if (json.queryType == "old") {
        self.data.newMessages = [];
        last.nextAll().remove();
        for (var i = messages.list.length - 1; i >= 0; --i) {
          self.data.newMessages.push(messages.list[i]);
        }
        if (messages.pageSize * messages.pageIndex >= messages.totalRows) {
          $(".prevPage").addClass("hide");
          $(".prevPageContainer").addClass("hide");
        } else {
          $(".prevPage").removeClass("hide");
          $(".prevPageContainer").removeClass("hide");
        }

        if (messages.pageIndex < 2) {
          $("#pagination").addClass("hide");
          $("#messageInput").removeClass("hide");
        } else {
          $("#pagination").removeClass("hide");
          $("#messageInput").addClass("hide");
        }
      } else if (json.queryType == "new") {
        if (self.data.newMessages.length > 0) {
          lastItem = $("#message_" + (self.data.newMessages.length - 1));
        }

        $("#pagination").addClass("hide");
        $("#messageInput").removeClass("hide");
        startIndex = self.data.newMessages.length;
        self.data.newMessages = self.data.newMessages.concat(messages.list);
      }

      if (self.data.room.address == "System") {
        $("#messageInput").addClass("hide");
      }

      var html = [];
      var items = messages.list;
      if (json.queryType == "current" || json.queryType == "old") {
        items = self.data.newMessages;
      }
      var last = null;

      for (var j = 0; j < items.length; ++j) {
        var item = items[j];
        var index = j + startIndex;
        item.htmlIndex = index;
        var itemHtml = self.getHtml(item);
        var newItem = $(itemHtml);

        newItem.insertAfter(lastItem);
        lastItem = newItem;
      };

      if (items.length == 1 && self.creatingGroup) {
        setTimeout(() => {
          self.sendCreatingGroupMessage();
        }, 100);
      }

      if (items.length == 1 && self.toConfirmFriend) {
        setTimeout(() => {
          self.sendConfirmFriendMessage();
        }, 100);
      }

      if (self.updatingGroup) {
        setTimeout(() => {
          self.sendUpdateGroupMessage();
        }, 100);
      }
      if (self.settingOwner) {
        setTimeout(() => {
          self.sendSetOwnerMessage();
        }, 100);
      }
      if (self.deletingMember) {
        setTimeout(() => {
          self.sendDeleteMemberMessage();
        }, 100);
      }

      self.data.newMessages.forEach(function (item, i) {
        if (item.type == "Voice") {
          if (item.duration == null || item.duration == 0) {
            item.duration = 1.0 * item.voiceLength / 1000;
          }
        }
      });

      self.data.maxVoiceDuration = 60;
      self.data.lastTime = "";


      share.onClick__($(".messageImage"), self.imageClicked__);

      share.onClick__($(".toDownloadFile"), self.toConfirmDownloadFile__);

      share.onClick__($(".mailMessageMask"), self.mailMessageMaskClicked__);
      share.onClick__($(".linkPageClicked"), self.linkPageClicked__);
      share.onClick__($(".buttonSync"), self.buttonSyncClicked__);
      share.onClick__($(".inviteToGroupMessage"), self.inviteToGroupMessageClicked__);
      share.onClick__($(".joinGroupMessage"), self.joinGroupMessageClicked__);
      share.onClick__($(".shareGroupMessage"), self.shareGroupMessageClicked__);

      share.onClick__($(".buttonResetKey"), self.toResetKey__);
      share.onClick__($(".buttonResetFriend"), self.toResetFriend__);
      share.onClick__($(".buttonReEdit"), self.toReEdit__);

      share.onClick__($(".messageAction"), function () {
        self.messageActionClicked__(this);
      });

      share.onClick__($(".maxHeightMessage"), function () {
        self.maxHeightMessageClicked__(this);
      });
      share.onClick__($(".wechatVideo"), function (e) {
        self.videoClicked__(e);
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
      share.onClick__($(".resizableMessage"), self.messageStatusClicked__);
      share.onClick__($(".sysMessageDelete"), self.sysMessageDeleteClicked__);

      $('.voiceDuration').disableSelection();

      if (json.lastReadTime > 0) {
        self.data.lastReadTime = json.lastReadTime;
      }

      self.updateLastReadTime();
      setTimeout(self.updateAllVoiceWidth__, 100);
      setTimeout(self.showMailMessage__, 200);

      $('.messageImage').each(function () {
        var maxHeight = $(this).css('max-height');
        $(this).height(maxHeight);
      });

      $('.wechatVideo').each(function () {
        var maxHeight = $(this).css('max-height');
        $(this).height(maxHeight);
      });


      $('.messageImage').each(function () {
        var maxHeight = $(this).css('max-height');
        $(this).height(maxHeight);
      });


      $("#body").removeClass("hide");
      $("#loading").addClass("hide");

      //share.preloadVideo__($("video"));

      // var H = parseInt(share.getWindowHeight(window))+parseInt(share.getWindowScrollTop(window)) - 40;//此处的40是class为bottom的div元素高
      // $("#body").css("height", H + "px");
    },
    sendCreatingGroupMessage: function () {
      let chat = self.creatingGroup;
      if (chat.status != "") {
        let room = self.data.room;
        share.sendMessage__(room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        });
      }
    },
    sendConfirmFriendMessage: function () {
      let chat = self.toConfirmFriend;
      if (chat.status != "") {
        let room = self.data.room;
        share.sendMessage__(room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        });
      }
    },
    sendUpdateGroupMessage: function () {
      let chat = self.updatingGroup;
      if (chat.status != "") {
        let room = self.data.room;
        share.sendMessage__(room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        });
      }
    },
    sendSetOwnerMessage: function () {
      let chat = self.settingOwner;
      if (chat.status != "") {
        let room = self.data.room;
        share.sendMessage__(room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        });
      }
    },
    sendDeleteMemberMessage: function () {
      let chat = self.deletingMember;
      if (chat.status != "") {
        let room = self.data.room;
        share.sendMessage__(room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        });
      }
    },
    mailMessageMaskClicked__: function (e) {
      e.stopPropagation();
      let html = $(e.currentTarget).parent().find(".mailMessage").html();
      share.popHtml__(html);
    },
    sysMessageDeleteClicked__: async function (e) {
      this.isSys = 1;
      self.messageActionClicked__(this);
    },
    toLeaveGroup__: function () {
      let room = self.data.room;

      share.leaveGroup__(room, async function () {
        self.data.params.pageIndex = 1;
        await self.getMessages__("current");
      }, async function () {
        self.data.params.pageIndex = 1;
        await self.getMessages__("current");
      });
    },
    toResetKey__: function () {
      let room = self.data.room;

      let fail = function (e) {
        share.toastError__(e);
      };

      let succ = async function (res) {
        share.debug__("resetKey ok");
        share.closeDialog__();
        let room = res.room;
        let chat = res.chat;
        self.data.room = room;
        await self.getMessages__("current");
        share.sendMessage__(room, chat, function () {
          self.getMessages__("current");
        }, fail);
      };

      share.resetKey__(room, "", succ, fail);
    },
    toReEdit__: function (e) {
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      if (si.content.type == "T") {
        $("#input_message").val(si.content.data);
      }
    },
    toResetFriend__: function (e) {
      let room = self.data.room;
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      let chat = self.data.newMessages[index];


      let fail = function (e) {
        if (e == "obsolete") {
          let err = share.getString__("alreadyAccepted");
          share.toastError__(err);
          return;
        }

        share.toastError__(e);
      };

      let succ = async function (res) {
        share.debug__("resetFriend ok");
        share.closeDialog__();
        let room = res.room;
        let chat = res.chat;
        self.data.room = room;
        await self.getMessages__("current");
        share.sendMessage__(room, chat, function () {
          self.getMessages__("current");
        }, fail);
      };

      share.resetFriend__(room, chat, succ, fail);
    },

    vote__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var item = self.data.newMessages[index];
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
          params: { important: important, chat: item }
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

      share.openLink__(path);
    },

    buttonSyncClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      if (share.user__.publicKey == si.content.key) {
        var message = "确定要同步'" + si.content.os + "'上的通讯录到本机吗?";
        share.confirm__(message, function () {
          share.importFriends__(si.content, function () {
            share.toastSuccess__(share.getString__("importContactSuccess", si.content.os));
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
    inviteToGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      if (si.type == "shareGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__("这是您发起的邀请，请耐心等待对方加入群聊");
        } else {
          var message = share.getString__("confirmToJoinGroup", si.content.data.owner.roomName);
          share.confirm__(message, function () {
            self.joinGroup__(self.data.room, si, self.refreshMessages__);
          });
        }
      }
    },
    joinGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      if (si.type == "joinGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__("这是您发起的申请，请耐心等待群主审批");
        } else {
          var message = share.getString__("approveToJoinGroup", si.senderName);
          share.confirmed__(message, function () {
            self.acceptJoinGroup__(si, self.refreshMessages__);
          });
        }
      }
    },
    acceptJoinGroup__: function (msg, s, f) {
      let room = self.data.room;
      let nmsg =
      {
        type: share.TypeJson,
        data: {
          type: "acceptJoinGroup",
          owner: msg.content.data.owner,
          sender: msg.content.data.sender,
          publicKey: msg.content.data.publicKey,
          memail: msg.senderEmail,
          mname: msg.senderName
        }
      };
      share.saveOwnMessage__(room, nmsg,
        async function (res) {
          s && s();
          self.data.params.pageIndex = 1;
          await self.getMessages__("current");

          share.sendMessage__(room, res, function (json) {
            //chat status updated
            if (self.data.params.pageIndex == 1) {
              self.getMessages__("current");
            }
          });
        },
        f ? f : share.toastError__);
    },

    shareGroupMessageClicked__: function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = e.currentTarget.id;
      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      if (si.type == "shareGroup") {
        if (si.fromOwn == 1) {
          share.toastInfo__(share.getString__("waitForApprove"));
        } else {
          let roomName = "";
          let data = si.content.data;
          if (data && data.owner) {
            roomName = data.owner.roomName;
          }
          var message = share.getString__("acceptInvitationToGroup", roomName);
          share.confirmed__(message, function () {
            self.joinGroup__(self.data.room, si, self.refreshMessages__);
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
      var item = self.data.newMessages[self.data.playingIndex];
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
      self.data.newMessages.forEach(function (item, i) {
        if (item.type == "Voice") {
          $("#voiceBody_" + i).css("width", self.getVoiceWidth__(item.duration));
        }
      });
    },
    showMailMessage__: function () {
      let total = $(".mailMessage").size();
      let shown = 0;
      $(".mailMessage").each(function (i, ele) {
        let body = $(ele).html();
        body = share.filterXss__(body);
        $(ele).on('load', function () {
          try {
            var iframe = $(this)[0];
            let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(body);
            iframeDoc.close();
          } catch (e) {

          }

          setTimeout(function () {
            var iframeWin = ele.contentWindow || ele.contentDocument.parentWindow;
            share.changeLinkTarget__(iframeWin.document);
            const contentWidth = iframeWin.document.body.scrollWidth;
            const contentHeight = iframeWin.document.body.scrollHeight;
            const scale = 200 / contentWidth;
            if (scale < 1) {
              ele.style.transform = `scale(${scale})`;
              ele.width = `${contentWidth}px`; // 保持原始宽度
              ele.height = `${contentHeight}px`; // 根据内容高度调整
              $(ele).parent().width(200);
              let height = contentHeight * scale;
              if (height > 200) {
                height = 200;
              }
              $(ele).parent().height(height);
            } else {
              $(ele).parent().height(contentHeight > 200 ? 200 : contentHeight);
              $(ele).parent().width(contentWidth);
            }

            shown++;
          }, 100);
        });

        $(ele).attr("src", "./empty.html");
      });
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

    getVoiceWidth__: function (duration) {
      return self.data.minVoiceWidth + 1.0 * duration / self.data.maxVoiceDuration * (self.data.maxVoiceWidth - self.data.minVoiceWidth);
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
    messageStatusClicked__: function (e) {
      var id = e.currentTarget.id;
      share.debug__("message status clicked:" + id);

      var index = id.split("_")[1];
      var si = self.data.newMessages[index];
      var status = self.getMessageStatus__(si);
      let error = null;
      let jStatus = share.jsonParse__(si.status);
      var buttons = [];
      if (jStatus) {
        let count = jStatus.count;
        let total = jStatus.total;
        let msg = jStatus.msg;
        if (jStatus.websocket) {
          if (jStatus.error == "mail.sending") {
            error = share.getString__(`websocket.sending`);
            if (count != null && total != null) {
              let info = share.getString__("messageStatus", count, total, msg);
              error = `${error}<br>${info}`;
            }

            self.addSendByMailButton(buttons, si);
          } else {
            error = share.getString__(jStatus.error);
            self.addSendByMyWebsocketButton(buttons, si);
            self.addSendByMailButton(buttons, si);
          }
        } else {
          error = share.getString__("messageStatus", count, total, msg);
          self.addSendByMailButton(buttons, si);
        }
      } else if (status && status.indexOf("sending") == 0) {
        share.toastInfo__(share.getString__("sending"));
      } else if (status != "") {
        error = share.getString__(status, `${si.status}`);
        self.addReSendButton(buttons, si);
      }

      if (error) {
        share.popupAction__(`${error}`, buttons, e.currentTarget);
      }
    },
    reSend__: function (chat, sendType) {
      if (chat.type == "cancelled") {
        share.cancelMessage__(self.data.room, chat, function () {
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        }, null, sendType);
      } else {
        share.sendMessage__(self.data.room, chat, function (json) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        }, function (e) {
          //chat status updated
          if (self.data.params.pageIndex == 1) {
            self.getMessages__("current");
          }
        }, sendType);
      }
    },
    onSendMessageProgress__: function (json) {
      let pe = document.getElementById(`progress_${json.chatId}`);

      if (json.count > json.total) {
        $(pe).parents(".resizableMessage").addClass("hide");
        return;
      }

      let progressDegree = json.progressDegree ? json.progressDegree : 0;
      let degrees = progressDegree + (json.count / json.total) * (360 - progressDegree);
      if (degrees < 10) {
        degrees = 10;
      }

      const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;

      pe.style.background = style;
      $(pe).removeClass("hide");
      $(pe).parents(".resizableMessage").children().removeClass("hide");
      if (json.websocket) {
        $(pe).parent().prev().attr("src", "./img/proxyOn2.svg");
      } else {
        $(pe).parent().prev().removeClass("rotate");
        $(pe).parent().prev().attr("src", "./img/loading6.gif");
      }

      if (json.count == json.total) {
        $(pe).parents(".resizableMessage").addClass("hide");
      }

      let id = $(pe).parents(".resizableMessage")[0].id.split("_")[1];
      let si = self.data.newMessages[id];
      try {
        let jStatus = JSON.parse(si.status);
        jStatus.count = json.count;
        jStatus.total = json.total;
        si.status = JSON.stringify(jStatus);
      } catch (e) {

      }
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
    getAudio__: function () {
      return $("#audio");
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

      if (item.type == "Forward") {
        item = item.content.data.message;
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
      let webViewPath = share.getFullFilePath__(item.content.data);
      audio[0].src = webViewPath;

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

      share.showImageFullScreen__(e.currentTarget.src);

      return false;
    },
    videoClicked__: function (e) {
      /*
      e.preventDefault();
      e.stopPropagation();

      var buttons = [];

      buttons.push({
        text: share.getString__("play"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toChooseMore__(e)
        }
      });

      share.popupAction__('', buttons, e);
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
      var si = self.data.newMessages[index];
      self.data.selectedMessage = si;
      var buttons = [];

      if (si.fromOwn == 1 && !e.isSys) {
        if (si.type != "cancelled") {
          buttons.push({
            text: share.getString__("withdraw"),
            onTap: function () {
              share.closeDialog__();
              self.toCancel__(e)
            }
          });
        }
      }

      if (si.type != "cancelled" && !e.isSys) {
        if (si.type == "Video") {
          buttons.push({
            text: share.getString__("download"),
            onTap: async function () {
              await share.closePopup__();
              let data = si.content.data;
              let webviewPath = share.getFullFilePath__(data, true);
              self.doDownload__(webviewPath);
            }
          });
        }
      }

      buttons.push({
        text: share.getString__("delete"),
        onTap: async function () {
          await share.closePopup__();
          self.toDelete__(e)
        }
      });

      if (share.isGroup__(self.data.room) && !si.fromOwn && !e.isSys) {
        buttons.push({
          text: share.getString__("ignore"),
          onTap: async function () {
            await share.closePopup__();
            self.toForbid__(e)
          }
        });
      }

      buttons.push({
        text: share.getString__("selectMore"),
        onTap: async function (e) {
          await share.closePopup__();
          self.toChooseMore__(e)
        }
      });

      share.popupAction__('', buttons, e);
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
      var succ = function (res) {
        self.getMessages__("current");
        share.cancelMessage__(self.data.room, self.data.selectedMessage, function () {
          self.getMessages__("current");
        });
      };

      var fail = function (e) {
        share.toastError__(e);
      };
      share.toCancelMessage__(self.data.room, self.data.selectedMessage, succ, fail);
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
        if (item.id == `${share.user__.email}System`) {
          return;
        }
        var itemHtml = groupTemplate.replace(/#desc#/g, item.lastMessage);
        itemHtml = itemHtml.replace(/#id#/g, i);
        itemHtml = itemHtml.replace(/#name#/g, (item.alias == "" || item.alias == null) ? item.name : item.alias);

        itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.name));
        itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.address));

        html.push(itemHtml);
      });

      self.groups = list;
      let content = html.join("").replace(/\n/g, "");
      let title = share.getString__("selectChatTitle");
      let header = $$(".templatePopupHeader").html().replace(/#title#/, title);

      content = header + content;
      //content += content + content + content;

      let popup = await share.popup__(null, content, "right", function () {
        share.onClick__($(".close"), function () {
          popup.close();
        });
        share.onClick__($(".group"), function () {
          popup.close();
          self.groupSelected(this, id);
        });
      });
    },

    forwardMessage__: function (msg, group, succ, fail) {
      var content = JSON.parse(msg.content);
      if (content.type == share.TypeJson) {
        var data = content.data;
        if (data.type == "Forward") {
          msg = data.message;
        }
      }
      var json = {
        type: "Forward",
        message: msg
      };

      self.sendMessage__({ type: share.TypeJson, data: json }, succ, fail, group);
    },

    groupSelected: function (e, messageId) {
      var id = e.id;
      var index = id.split("_")[1];
      var group = self.groups[index];
      var f = async function (confirmed) {
        if (confirmed) {
          let res = await share.getMessageById__(messageId);

          self.forwardMessage__(res, group,
            function (res) {
              $("#groups").addClass("hide");
              $("#messages").removeClass("hide");
              $("#messageInput").removeClass("hide");
            }, function (e) {
              share.toastError__(JSON.stringify(e))
            });

        } else {
          $("#groups").addClass("hide");
          $("#messages").removeClass("hide");
          $("#messageInput").removeClass("hide");
        }
      };
      let name = group.alias;
      if (name == null || name == "") {
        name = group.name;
      }
      share.confirm__(share.getString__("confirmToForwardMessage", name), f);
    },

    toDeleteMore__: function (e) {
      var del = async function (confirmed) {
        if (!confirmed) {
          return;
        }

        var ids = Object.keys(self.checkedIds);
        for (var i = 0; i < ids.length; ++i) {
          ids[i] = self.data.newMessages[ids[i]].id;
        }

        ids = ids.join("','");
        ids = "'" + ids + "'";

        try {
          let json = await share.deleteMoreMessage__(
            { ids: ids }
          );

          if (json && json.message) {
            share.toastInfo__(json.message);
          }

          if (json && json.message) {
            share.toastInfo__(json.message);
          }

          self.closeChooseMore__();
          ids = Object.keys(self.checkedIds);
          for (var i = 0; i < ids.length; ++i) {
            $("#checkbox_" + ids[i]).parents(".listItemNc").remove();
          }
        } catch (e) {
          share.toastError__(e);
        }
      };

      share.confirm__(share.getString__("confirmToDeleteMessage"), del);
    },

    toDelete__: async function (e) {
      var id = $(e).attr("data-id");
      var buttons = [];
      buttons.push({
        text: share.getString__("confirm"),
        onTap: async function () {
          await share.closePopup__();

          try {
            let json = await share.deleteMoreMessage__(
              {
                ids: "'" + id + "'",
                email: share.user__.email,
                roomId: self.data.room.address,
                delBefore: self.delBefore
              }
            );

            if (json && json.message) {
              share.toastInfo__(json.message);
            }

            if (self.delBefore) {
              page.refresh();
            } else {
              $(e).parents(".listItemNc").remove();
            }
          } catch (e) {
            share.toastError__(e);
          }
        }
      });

      buttons.push({
        text: share.getString__("cancel"),
        onTap: async function (e) {
          await share.closePopup__();
        }
      });

      content = $("#templateDelete").html();
      self.delBefore = 0;

      //share.showDialog__('请选择', content, buttons, onHide, onShown);
      share.dialog__ = await share.popupAction__(content, buttons);

      $(".delBefore").on("input", function (e) {
        self.delBefore = $(this).is(':checked');
        if (self.delBefore && self.delAfter) {
          self.delAfter = 0;
        }
      });
    },

    toForbid__: function (e) {
      var succ = function (res) {
        let msg = share.getString__("forbidFriend", self.data.selectedMessage.senderName, res.days);
        if (res.days < 1) {
          msg = share.getString__("unForbidFriend", self.data.selectedMessage.senderName);
        }
        share.toastSuccess__(msg);
      };

      var fail = function (err) {
        share.toastError__("忽略失败:" + err);
      };

      let params = {
        email: share.user__.email,
        roomId: self.data.selectedMessage.roomId,
        senderEmail: self.data.selectedMessage.senderEmail
      };

      share.toForbid__(params, succ, fail);

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
        share.toastSuccess__(share.getString__("autoRefreshOn"), 2000);
        self.refreshMessages__();
      } else {
        $(".autoRefresh").addClass("delete");
        share.toastSuccess__(share.getString__("autoRefreshOff"), 2000);
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
    initInputHeight__: function () {
      let h = $("#buttonSend").outerHeight();
      if (h < 1) {
        setTimeout(self.initInputHeight__, 500);
      } else {
        $("#input_message").css("height", h);
        self.showLastMessage__();
      }
    },
    addResetKeyButton__: function (buttons) {
      if (self.data.room.address.indexOf("@") >= 0) {
        buttons.push({
          text: share.getString__("sendNewKey"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toResetKey__();
          }
        });
      }
    },
    addSendByMyWebsocketButton: function (buttons, si) {
      buttons.push({
        text: share.getString__("resend.websocket"),
        onTap: async function (e) {
          await share.closePopup__();
          self.reSend__(si, "proxy");
        }
      });
    },
    addSendByMailButton: function (buttons, si) {
      buttons.push({
        text: share.getString__("resendByMail"),
        onTap: async function (e) {
          await share.closePopup__();
          self.reSend__(si, "mail");
        }
      });
    },
    addReSendButton: function (buttons, si) {
      buttons.push({
        text: share.getString__("resend"),
        onTap: async function (e) {
          await share.closePopup__();
          self.reSend__(si);
        }
      });
    },
    doDownload__: function (path) {
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
        let guide = share.getString__("openFileWith3rdApp", path);
        share.confirmOk__(`<div class='breakword'>${guide}</div>`, func);
      } else if (parent.parent.cordova.InAppBrowser) {
        var u = "http://127.0.0.1:7902" + path;
        share.closeDialog__();
        parent.parent.cordova.plugins.clipboard.copy(u);
        share.toastInfo__(share.getString__("linkCopied"));
        parent.parent.cordova.InAppBrowser.open(u, "_system");
      } else {

        //parent.parent.cordova.plugins.fileOpener2.open(
        parent.parent.cordova.plugins.fileOpener2.showOpenWithDialog(
          path,
          '',
          {
            error: function (e) {
              share.error__('Error status: ' + e.status + ' - Error message: ' + e.message);
            },
            success: function () {
              share.debug__('file opened successfully');
            }
          }
        );
      }
    },
    updateStatus__: function (chat, itemHtml) {
      let status = self.getMessageStatus__(chat);
      let error = share.jsonParse__(status);
      let jItem = $(itemHtml);
      let container = jItem.find(".progress-container");
      let img = jItem.find(".messageStatus");
      if (status == "sending") {
        img.removeClass("hide");
        container.addClass("hide");
        img.attr("src", "./img/loading6.gif");
        jItem.find(".progress-pointer")[0].style = "";
      } else if (error) {
        if (error.websocket) {
          if (error.error == "mail.sending") {
            img.attr("src", "./img/proxyOn2.svg");
            img.addClass("rotate");
          } else {
            img.attr("src", "./img/proxyError.svg");
          }
          img.removeClass("hide");
          container.addClass("hide");

        } else {
          container.addClass("hide");
          img.attr("src", "./img/error.svg");
          img.removeClass("hide");
        }
      } else if (status != "") {
        img.removeClass("hide");
        container.addClass("hide");
        img.attr("src", "./img/error.svg");
      } else {
        img.addClass("hide");
        container.addClass("hide");
      }

      jItem.find(".progress-pointer").attr("id", `progress_${chat.id}`);
      itemHtml = jItem.prop('outerHTML');
      return itemHtml;
    },
    getMessages__: async function (querytype, pageIndex, pageSize) {
      share.debug__("getMessage started:" + querytype);
      if (querytype == null) {
        querytype = "current";
      }
      if (pageIndex == null) {
        pageIndex = 1;
      }

      var room = self.data.room;

      let params = {
        address: room.address,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize,
        createTimeStart: 0
      }

      if (querytype == "new" && self.data.newMessages.length > 0) {
        pageIndex = 1;
        params.pageIndex = 1;
        params.createTimeStart = self.data.newMessages[self.data.newMessages.length - 1].createTime;
      }

      let json = await share.getMessageList__(params);

      json.queryType = querytype;

      try {
        self.showMessages__(json);
        self.initInputHeight__();
      } catch (e) {
        share.toastError__(`${e.message}:${e.stack}`);
      }

      if (self.autoRefresh) {
        self.setRefreshTimer__();
      }
    },
  };

  $(function () {
    if (share.needInit__(/message\.list\.htm/g))
      self.initialize__();
  });

  var app = share;
  return self;
})();



