window.mhgl_share =
  window.mhgl_share ||
  (function () {
    let cordova = parent.parent.cordova;
    var navbar = window.mhgl_navbar;
    let page = null;
    var share = {
      string: null,
      TypeJson: "j",
      TypeImage: "i",
      TypeLink: "l",
      TypeVideo: "v",
      lastClick: {},
      tempFilePath: null,
      packageName: "com.lbdd.email",
      mhgl__: "web",
      defaultAnimationInterval: 100,
      maxMailAttachmentSizeInM: 10,
      rockWidth: 10,
      test__: 0,
      timerTodo__: [],
      uiDebug: 0,
      cache__: {},
      onResize__: function () { },
      logData__: [],
      defaultLogLevel__: 0,
      logLevel__: 8,
      logLevelInfo__: 7,
      logLevelDebug__: 8,
      logLevelVerbose__: 9,
      logLevelPage__: 10,
      fileIcons__: {
        'txt': 'txt.png',
        'pdf': 'pdf.png',
        'mp4': 'video.png',
        'webm': 'video.png',
        'flv': 'video.png',
        'rmvb': 'video.png',
        'rm': 'video.png',
        'mkv': 'video.png',
        'wmv': 'video.png',
        'wma': 'video.png',
        'mp3': 'wav.png',
        'amr': 'wav.png',
        'aac': 'wav.png',
        'm4a': 'wav.png',
        'mid': 'wav.png',
        'wav': 'wav.png',
        'doc': 'word.png',
        'docx': 'word.png',
        'ppt': 'ppt.png',
        'pptx': 'ppt.png',
        'xls': 'xls.png',
        'xlsx': 'xls.png',
        'csv': 'xls.png'
      },
      accounts__: { accounts: [], selectedAccount: 0 },
      version__: "v1.51",
      currentNotification__: null,
      currentClass__: null,
      inElectron: /electron/i.test(navigator.userAgent),
      containerUrl__: "/fe/container.htm",
      containerUrlRegEx__: /\/fe\/container\.htm.*#/g,
      user__: null,
      dictr__: null,
      sampleCount__: 3,
      code__: {
        duplicated: 1,
        unAuthorized: 401,
        forbidden: 404,
        needCharge: 4041
      },
      ajaxTimeout__: 15000,
      removePrefix__: function (str, prefix) {
        if (str.indexOf(prefix) == 0) {
          str = str.substring(prefix.length);
        }

        return str;
      },
      getSize__: function (size) {
        var b = Math.floor(size % (1024));
        var k = Math.floor((size % (1024 * 1024)) / (1024));
        var m = Math.floor((size % (1024 * 1024 * 1024)) / (1024 * 1024));
        var g = Math.floor(size / (1024 * 1024 * 1024));

        var res = "";
        if (g > 0) {
          res += g + "G";
        }
        if (m > 0) {
          res += m + "M";
        }
        if (k > 0) {
          res += k + "K";
        }

        if (res != "") {
          return res;
        }

        res += b + "B";
        return res;
      },
      getWechatHeadImageUrl__: function (
        selfNickName,
        nickName,
        remarkName,
        path,
        uid
      ) {
        if (path == null) {
          return "";
        }
        if (path.charAt(0) != "@") {
          path = encodeURIComponent(path);
        }
        path = share.getBaseUrl__() + "/mvc/wx/robot/image?url=" + path;
        path = path + "&selfNickName=" + selfNickName;
        path = path + "&nickName=" + nickName;
        path = path + "&remarkName=" + remarkName;
        path =
          path + "&domainUrl=" + encodeURIComponent(share.getDomainUrl__());
        uid && (path = path + "&uid=" + uid);
        return path;
      },
      removeEmptyChars__: function (str) {
        return str.replace(/\s/g, "");
      },
      getDomainUrl__: function () {
        var url = window.location.href;
        var strArray = url.split("/");
        url = strArray[0] + "//" + strArray[2];
        return url;
      },
      hideBottomInfo__: function () {
        var doc = share.getDocument__();
        $("#bottomInfo", doc).addClass("hide");
      },
      toFolderSetting__: async function (succ) {
        let template = $$("#templateFolderSetting").html();
        share.dialog__ = await share.popup__(null, template, "bottom");
        let inbox = share.getString__("inbox");
        let junk = share.getString__("junk");
        $(".inboxMappingLabel").html(inbox);
        $(".junkMappingLabel").html(junk);
        $(".folderSettingGuide").html(share.getString__("folderSettingGuide"));
        let mailBoxes = await share.getMailboxes__(share.user__.email, "");
        let autoSet = 0;
        for (let mb of mailBoxes.list) {
          let options = {
            value: mb.path,
            text: mb.name
          };

          $(".inboxMapping").append($("<option>", options));
          $(".junkMapping").append($("<option>", options));

          if (`inbox,${inbox}`.indexOf(mb.name.toLowerCase()) >= 0) {
            inbox = mb.path;
          }

          if (`junk,spam,trash,${junk}`.indexOf(mb.name.toLowerCase()) >= 0) {
            junk = mb.path;
          }
        }

        if (share.user__.inbox) {
          $(".inboxMapping").val(share.user__.inbox);
        } else {
          $(".inboxMapping").val(inbox);
          autoSet = 1;
        }

        if (share.user__.junk) {
          $(".junkMapping").val(share.user__.junk);
        } else {
          $(".junkMapping").val(junk);
          autoSet = 1;
        }

        $(".folderSettingSubmitButton").html(share.getString__("confirm"));
        share.onClick__($(".folderSettingSubmitButton"), function () { share.folderSettingSubmitClicked__(succ) });

        inbox = $(".inboxMapping").val();
        junk = $(".junkMapping").val();

        if (autoSet && (inbox != "" || junk != "")) {
          share.user__.inbox = $(".inboxMapping").val();
          share.user__.junk = $(".junkMapping").val();
          share.saveAccount__(share.user__, function () { share.setCache__("user", share.user__) });
        }
      },
      folderSettingSubmitClicked__: async function (succ) {
        share.user__.inbox = $(".inboxMapping").val();
        share.user__.junk = $(".junkMapping").val();
        share.saveAccount__(share.user__, function () { share.setCache__("user", share.user__) });
        await share.closePopup__();
        succ && succ();
      },
      loadTimer__: function () {
        share.debug__("loadTimer");
        if (share.timerInterval__ != null) {
          clearInterval(share.timerInterval__);
        }

        share.timers__ = [];
        if (share.user__ && share.user__.timer != null) {
          share.timers__ = share.user__.timer.split(",");
        }

        for (var i = 0; i < share.timers__.length; ++i) {
          var str = share.timers__[i].split(":");
          var m = str[0] * 3600 + str[1] * 60;
          if (str.length == 3) {
            m = m + str[2];
          }

          share.timers__[i] = m;
        }

        share.lastFiredTimer__ = 0;

        share.timerInterval__ = setInterval(share.scheduleTimer__, 1000);
      },

      back__: function () {
        window.history.back(-1);
      },
      scheduleTimer__: function () {
        for (var i = 0; i < share.timers__.length; ++i) {
          var now = new Date();
          now = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000 + now.getMilliseconds();
          var gap = now - share.timers__[i] * 1000;
          if (gap >= 0 && gap < 1000) {
            share.timerTodo__.push(share.timers__[i]);
          }
        }

        setTimeout(share.doTimer__, 1);
      },

      deleteMoreMessage__: async function (opt) {
        await share.callNodejs__(
          {
            func: "deleteMoreMessage",
            params: opt
          }
        );

        await share.callNodejs__(
          {
            func: "updateLastMessage",
            params: opt
          }
        );
      },

      doTimer__: function () {
        for (var i = 0; i < share.timerTodo__.length; ++i) {
          share.vibrate__(500);
        }

        share.timerTodo__ = [];
      },

      nodejscalls__: {},

      onImapUpdate__: function (result) {
        share.debug__(JSON.stringify(result));
        var type = result.type;
        share.toastInfo__(
          "onImapUpdate:" + result.path + "/" + result.type + "/" + result.value
        );
      },

      updateToast__: function (tid, msg) {
        $(`#${tid}`).html(msg);
      },

      getNewChats__: function (fail) {
        var succ = function (res) {
        };

        var f = fail || function () { };

        share.callNodejs__(
          {
            func: "getNewChats",
            params: { email: share.user__.email }
          },
          succ,
          f
        );
      },
      error__: function (msg) {
        share.log__(msg);
      },
      info__: function (info) {
        if (share.logLevel__ >= share.logLevelInfo__) {
          share.log__(info);
        }
      },
      debug__: function (info) {
        if (share.logLevel__ >= share.logLevelDebug__) {
          share.log__(info);
        }
      },
      verbose__: function (info) {
        if (share.logLevel__ < share.logLevelVerbose__) {
          return;
        }

        share.log__(info);
      },
      log__: function (info) {
        let start = 3;

        var stack = new Error().stack;
        var caller = "";

        if (stack != null) {
          caller = stack.split("\n");
          if (caller && caller.length > start) {
            caller = caller[start];
            caller = caller.split("/");
            caller = caller[caller.length - 1];
            caller = caller.split("\\");
            caller = caller[caller.length - 1];
            caller = caller.split(")")[0];
          } else {
            caller = stack;
          }
        }

        var now = share.timeFormat__(new Date(), "hh:mm:ss:");
        console.log(now + caller + ":" + info);
      },
      getFileIcon__: function (name) {
        var pos = name.lastIndexOf(".");
        var ext = "";
        if (pos >= 0) {
          ext = name.substring(pos + 1);
        }

        var res = share.fileIcons__[ext];
        if (res == null) {
          res = "file.png";
        }

        return res;

      },

      onNextUidUpdate__: function (res) {
        share.user__.nextUid = res.nextUid;
        share.saveAccount__(share.user__);
      },

      onErrorFromNodeJs__: function (json) {
        if (json.error && json.error.toLowerCase().indexOf("socket timed out")) {
          share.reconnect__(json.email);
        } else {
          share.defaultFail__(json);
        }
      },
      reconnect__: function (email) {
        share.callNodejs__(
          {
            func: "reconnect",
            params: {
              email: email
            }
          },
          null,
          function (e) {
            share.toastError__(e);
          }
        );
      },
      onMemberCountChanged__: function (json) {
        if (mainFrame.mhgl_chat_list) {
          mainFrame.mhgl_chat_list.onMemberCountChanged__(json);
        }
      },
      onDecodingChat__: function (json) {
        if (mainFrame.mhgl_mail_list) {
          mainFrame.mhgl_mail_list.onDecodingChat(json);
        }
      },
      onMoreMessageFromNodeJs__: function (json) {
        if (mainFrame.mhgl_mail_list) {
          mainFrame.mhgl_page.refresh();
        } else if (mainFrame.message_list) {
          share.getNewChats__();
        } else if (mainFrame.mhgl_chat_list) {
          mainFrame.mhgl_chat_list.onMoreMessage__();
        } else if (mainFrame.mhgl_folder_list) {
          mainFrame.mhgl_folder_list.onMoreMessage__();
        }
      },

      onTotalExistsChanged__: function (json) {
        if (mainFrame.mhgl_folder_list) {
          mainFrame.mhgl_folder_list.onTotalExistsChanged__(json);
        }
      },

      onLogFromNodeJs__: function (json) {
        share.debug__("NodeJs->" + json.caller + ":" + json.info);
      },

      onNoMoreMessageFromNodeJs__: function (json) {

      },
      onShowStatusFromNodeJs__: function (json) {
        share.showStatus__(json.status);
      },
      onNewFeed__: function () {
        navFrame.mhgl_navbar.showRedpoint__("feed", 1);
      },
      onNewFeedComment__: function () {
        share.onNewFeed__();
      },
      nodejsChannelListener__: function (msg) {
        share.verbose__(msg);
        var json = JSON.parse(msg);
        if (json.id == "Error") {
          share.onErrorFromNodeJs__(json);
        } else if (json.id == "toLogin") {
          share.toLogin__();
        } else if (json.id == "Log") {
          share.onLogFromNodeJs__(json);
        } else if (json.id == "MoreMessage") {
          share.onMoreMessageFromNodeJs__(json);
        } else if (json.id == "decodingChat") {
          share.onDecodingChat__(json);
        } else if (json.id == "memberCountChanged") {
          share.onMemberCountChanged__(json);
        } else if (json.id == "showStatus") {
          share.onShowStatusFromNodeJs__(json);
        } else if (json.id == "NoMoreMessage") {
          share.onNoMoreMessageFromNodeJs__(json);
        } else if (json.id == "onNewFeed") {
          share.onNewFeed__(json);
        } else if (json.id == "onNewFeedComment") {
          share.onNewFeedComment__(json);
        } else if (json.id == "totalExistsChanged") {
          share.onTotalExistsChanged__(json);
        } else if (json.id == "wsChanged") {
          share.wsConnected = json.connected;
          share.onWsChanged__(json);
        } else if (json.id == "sendMessageProgress") {
          share.onSendMessageProgress__(json);
        } else if (json.id == "sendFeedProgress") {
          share.onSendFeedProgress__(json);
        } else if (json.id == "sendFeedCommentProgress") {
          share.onSendFeedCommentProgress__(json);
        } else if (json.id == "onNewFriends") {
          parent.mhgl_container.onNewFriends__(json.result);
        }

        var call = share.nodejscalls__[json.id];
        if (call == null) {
          if (json.id == "onImapUpdate") {
            share.onImapUpdate__(json.result);
          } else if (json.id == "onNewChats") {
            parent.mhgl_container.onNewChats__(json.result);
          } else if (json.id == "onNextUidUpdate") {
            share.onNextUidUpdate__(json.result);
          }
        } else {
          if (json.status == "success") {
            call.succ && call.succ(json.result);
            delete share.nodejscalls__[json.id];
          } else if (json.status == "fail") {
            call.fail && call.fail(json.error);
            delete share.nodejscalls__[json.id];
          } else if (json.status == "update") {
            call.update && call.update(json.info);
          } else {
            share.debug__("unkown status:" + json.status);
            delete share.nodejscalls__[json.id];
          }
        }
      },
      frameCalls__: {},
      onSendMessageProgress__: function (json) {
        let ml = mainFrame.message_list;
        if (ml == null) {
          ml = mainFrame.rightFrame ? mainFrame.rightFrame.message_list : null;
        }

        if (ml) {
          ml.onSendMessageProgress__(json);
        }
      },
      onSendFeedProgress__: function (json) {
        let ml = mainFrame.feed_list;
        if (ml == null) {
          ml = mainFrame.rightFrame ? mainFrame.rightFrame.feed_list : null;
        }

        if (ml) {
          ml.onSendFeedProgress__(json);
        }
      },
      onSendFeedCommentProgress__: function (json) {
        let ml = mainFrame.feed_list;
        if (ml == null) {
          ml = mainFrame.rightFrame ? mainFrame.rightFrame.feed_list : null;
        }

        if (ml) {
          ml.onSendFeedCommentProgress__(json);
        }
      },
      callFrame__: function (msg) {
        share.debug__("callFrame__");
        var json = JSON.parse(msg);
        var call = share.frameCalls__[json.id];
        if (call == null) {
          share.debug__("call is null");
        } else {
          if (json.status == "success") {
            call.succ && call.succ(json.result);
            delete share.frameCalls__[json.id];
          } else if (json.status == "fail") {
            call.fail && call.fail(json.error);
            delete share.frameCalls__[json.id];
          } else if (json.status == "update") {
            call.update && call.update(json.info);
          } else {
            share.debug__("unkown status:" + json.status);
            delete share.frameCalls__[json.id];
          }

        }
      },
      callContainer__: function (msg, fromFrame) {
        //share.debug__("callContainer__");
        var json = JSON.parse(msg);

        try {
          var succ = function (res) {
            var data = {
              status: "success",
              id: json.id,
              result: res
            };
            fromFrame.contentWindow.mhgl_share.callFrame__(JSON.stringify(data));
          };

          var fail = function (e) {
            var data = {
              id: json.id,
              status: "fail",
              error: e
            };

            fromFrame.contentWindow.mhgl_share.callFrame__(JSON.stringify(data));
          };

          var update = function (info) {
            var data = {
              id: json.id,
              status: "update",
              info: info
            };

            fromFrame.contentWindow.mhgl_share.callFrame__(JSON.stringify(data));
          };

          share[json.func](json.params, succ, fail, update);
          //var res = eval("share." + json.func + "(json.params,succ,fail)");
        } catch (e) {
          var data = {
            id: json.id,
            status: "fail",
            e: e,
            error: e.message
          };
          var msg = JSON.stringify(data);
          fromFrame.contentWindow.mhgl_share.callFrame__(msg);
        }
      },
      vibrate__: function (time) {
        share.debug__("vibrate:" + time);
        navigator && navigator.vibrate(time);
      },
      registerDeviceReady__: function (options, succ, fail) {
        if (parent.parent != window) {
          return parent.parent.mhgl_share.registerDeviceReady__(options, succ, fail);
        }


        if (share.deviceReadyFunc__ != null) {
          share.debug__("device not ready");
          share.deviceReadyFunc__.push(succ);
          return;
        }

        succ();
      },
      getWindowScrollTop: function (win) {
        var scrollTop = 0;
        if (win.document.documentElement && win.document.documentElement.scrollTop) {
          scrollTop = win.document.documentElement.scrollTop;
        } else if (win.document.body) {
          scrollTop = win.document.body.scrollTop;
        } return scrollTop;
      },
      getWindowHeight: function (win) {
        var clientHeight = 0;
        if (win.document.body.clientHeight && win.document.documentElement.clientHeight) {
          clientHeight = (win.document.body.clientHeight < win.document.documentElement.clientHeight) ? win.document.body.clientHeight : win.document.documentElement.clientHeight;
        } else {
          clientHeight = (win.document.body.clientHeight > win.document.documentElement.clientHeight) ? win.document.body.clientHeight : win.document.documentElement.clientHeight;
        }
        return clientHeight;
      },
      defaultFail__: function (err) {
        share.toastError__(share.getString__("internalError") + JSON.stringify(err));
      },
      getFriendByEmail__: async function (femail, succ, fail) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFriendByEmail",
              params: {
                femail: femail,
                email: share.user__.email
              }
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      confirmFriend__: function (friend, succ, fail) {
        var now = new Date().getTime();
        if (!friend.createTime || now - friend.createTime > 7 * 24 * 3600 * 1000) {
          fail(share.getString__("confirmTimePassed"));
          return;
        }

        var params = friend;
        params.email = share.user__.email;
        share.callNodejs__(
          {
            func: "confirmFriend",
            params: params
          },
          succ,
          fail
        );
      },
      isIos__: function () {
        let platform = parent.parent.cordova.platformId;
        if (platform == "ios") {
          return true;
        }

        return false;
      },
      isAndroid__: function () {
        let platform = parent.parent.cordova.platformId;
        if (platform == "android") {
          return true;
        }

        return false;
      },
      removeAccount__: function (email, succ, fail) {
        if (share.isInFrame__()) {
          share.accounts__ = parent.parent.mhgl_share.accounts__;
        }

        var i = 0;
        var found = -1;
        for (; i < share.accounts__.accounts.length; ++i) {
          var ele = share.accounts__.accounts[i];
          if (ele.email.toLowerCase() == email.toLowerCase()) {
            found = i;
            break;
          }
        }

        if (found > -1 && found < share.accounts__.accounts.length) {
          share.accounts__.accounts.splice(found, 1);
          share.saveAccountToDb__(succ, fail);
        } else {
          succ && succ();
        }
      },
      saveAccountToDb__: async function (succ, fail) {
        if (share.accounts__.deviceId == null) {
          share.accounts__.deviceId = share.uuid__();
        }

        await share.callNodejs__(
          {
            func: "saveAccount",
            params: { accounts: share.accounts__ }
          },
          null,
          function (e) {
            share.debug__("save accounts failed:" + e.message);
            fail && fail();
          }
        );

        share.debug__("save accounts success");
        parent.parent.mhgl_share.accounts__ = share.accounts__;
        succ && succ();
      },
      saveAccount__: function (account, succ, fail) {
        if (share.isInFrame__()) {
          share.accounts__ = parent.parent.mhgl_share.accounts__;
        }

        if (share.accounts__ == null) {
          share.accounts__ = {};
        }

        if (share.accounts__.accounts == null) {
          share.accounts__.accounts = [];
        }

        var index = -1;
        for (var i = 0; i < share.accounts__.accounts.length; ++i) {
          var element = share.accounts__.accounts[i];
          if (element.email == account.email) {
            Object.assign(element, account);
            account = element;
            index = i;
          }
        }

        if (index < 0) {
          share.accounts__.accounts.push(account);
          index = share.accounts__.accounts.length - 1;
        }

        share.accounts__.selectedAccount = index;

        share.saveAccountToDb__(succ, fail);
      },
      getFeedIcon__: function (feed) {
        let media = JSON.parse(feed.media);
        if (media && media.length > 0) {
          let fm = media[0];
          if (fm.type == "i") {
            return `<img style="max-width:100%; height:100%;" src="${fm.path}">`;
          } else {
            return `<video style="max-width:100%; height:100%;" src="${fm.path}"></video>`;
          }
        } else if (media && (media.title || media.desc)) {
          let favicon = media.favicon;
          if (!favicon) {
            favicon = "img/link1.png"
          }

          return `<img src="${favicon}" style="max-height:50px;">
                  `;

        } else {
          return `<span class="breakword font10 overflow-hidden"><pre>${feed.feedContent}</pre></span>`;
        }
      },
      triggerClick__: function (eles) {
        eles.trigger("click");
      },
      onClick__: function (eles, fn, noUpdateLastClick) {
        let event = "click";

        eles.off(event);
        eles.on(event, function (e) {
          share.debug__('event phase:' + e.eventPhase); // 1:捕获, 2:目标, 3:冒泡
          if (e.originalEvent && e.originalEvent._handled) {
            share.debug__("handled");
            return;
          }
          if (e.originalEvent) {
            share.debug__("to handle");
            e.originalEvent._handled = true;
          }

          if (!noUpdateLastClick) {
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (clientX == null && e.originalEvent) {
              clientX = e.originalEvent.pageX;
              clientY = e.originalEvent.pageY;
            }

            if (clientX != null) {
              share.lastClick = { clientX, clientY };
              share.debug__(`lastClickEvent: x=${share.lastClick.clientX}, y=${share.lastClick.clientY}, ${document.location.href}`);
            }

          }

          fn.call(this, e);
        });
      },
      getSeal: function (name, size) {
        if (size == null) {
          size = 32;
        }

        if (name == null) {
          name = "";
        }

        name = name.trim();

        if (name.length > 0) {
          var re = /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g;
          name = name.replace(re, "");
          if (name.length > 7) {
            name = name.substring(0, 7).toUpperCase();
          } else {
            name = name.toUpperCase();
          }
        }
        name = name.replace(/['"]/g, "").trim();
        name = name.split(/[@,\. _\*\+\?\{\}\[\]]/)[0];

        const sealText = document.createElement('div');
        sealText.classList.add('seal-text');

        const companyDiv = document.createElement('div');
        companyDiv.classList.add('company');
        sealText.appendChild(companyDiv);

        const chars = name.split('');
        let len = chars.length;

        let angleStep = 0;
        if (len > 1) {
          angleStep = len * 32 / (chars.length - 1);
        }

        let startAngle = 0;
        if (len > 1) {
          startAngle = -(len * 16);
        }

        chars.forEach((char, index) => {
          const span = document.createElement('span');
          span.textContent = char;

          const angle = startAngle + angleStep * index;
          const radius = size / 3;
          span.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;

          companyDiv.appendChild(span);
        });

        return sealText.outerHTML;
      },

      initNodejs__: function (handler) {
        share.debug__("initNodejs start");

        share.registerDeviceReady__(null, async function () {
          share.debug__("do initNodejs");
          nodejs.channel.setListener(share.nodejsChannelListener__);
          if (nodejs.inited) {
            let res = await share.setNodejsEnv__();
            handler && handler(res);
          } else {
            nodejs.start("main.js", async function () {
              share.debug__("nodejs started");
              nodejs.inited = true;
              let res = await share.setNodejsEnv__();
              handler && handler(res);
            });
          }
        });
      },

      startFileServer__: async function () {
        let params = {
          tid: new Date().getTime()
        };

        try {
          let res = await share.callNodejs__(
            {
              func: "startFileServer",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      copyFile__: async function (srcFullPath, dstDir, name) {

        let res = await share.callNodejs__(
          {
            func: "copyFile",
            params: {
              srcFullPath,
              dstDir,
              name
            }
          }
        );

        return res;
      },
      checkMicrophonePermission: async function () {
        if (cordova.platformId === 'ios') {
          return await share.checkIOSMicrophonePermission();
        } else {
          share.checkAndroidMicrophonePermission();
        }
      },
      showIOSPermissionGuide: function () {
        cordova.plugins.diagnostic.switchToSettings();
      },
      checkIOSMicrophonePermission: function () {
        return new Promise((resolve, reject) => {
          cordova.plugins.diagnostic.getMicrophoneAuthorizationStatus(
            function (status) {
              switch (status) {
                case cordova.plugins.diagnostic.permissionStatus.GRANTED:
                  resolve({ result: true });
                  break;

                case cordova.plugins.diagnostic.permissionStatus.DENIED:
                  share.showIOSPermissionGuide();
                  resolve({ result: false });
                  break;

                case cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED:
                  (async function () {
                    let res = await share.requestIOSMicrophonePermission();
                    resolve(res);
                  })();
                  break;

                case cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS:
                  share.showIOSPermissionGuide();
                  resolve({ result: false });
                  break;
              }
            },
            function (error) {
              resolve({ error });
            }
          );
        });
      },

      requestIOSMicrophonePermission: function () {
        return new Promise((resolve, reject) => {
          cordova.plugins.diagnostic.requestMicrophoneAuthorization(
            function (status) {
              if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
                resolve({ result: true });
              } else {
                resolve({ result: false });
              }
            },
            function (error) {
              resolve(error);
            }
          );
        });
      },

      // Android 权限处理
      checkAndroidMicrophonePermission: function () {
        cordova.plugins.diagnostic.getPermissionAuthorizationStatus(
          function (status) {
            if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
              console.log("麦克风权限已授权");
              startRecording();
            } else {
              requestAndroidMicrophonePermission();
            }
          },
          function (error) {
            console.error("获取权限状态失败: " + error);
          },
          cordova.plugins.diagnostic.permission.RECORD_AUDIO
        );
      },

      requestAndroidMicrophonePermission: function () {
        cordova.plugins.diagnostic.requestRuntimePermission(
          function (status) {
            if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
              console.log("用户授权了麦克风权限");
              startRecording();
            } else {
              showAndroidPermissionGuide();
            }
          },
          function (error) {
            console.error("请求权限失败: " + error);
          },
          cordova.plugins.diagnostic.permission.RECORD_AUDIO
        );
      },


      setNodejsEnv__: async function () {
        var env = {
          tempPath: ""
        };

        share.getTempFilePath__(env);
        let res = await share.callNodejs__(
          {
            func: "setNodejsEnv",
            params: env
          }
        );

        return res;
      },
      wsConnect__: async function (options, succ, fail) {
        parent.parent.navFrame.mhgl_navbar.beforeWsConnect__();
        try {
          await share.callNodejs__(
            {
              func: "wsConnect",
              params: options
            }
          );
          succ && succ();
          return {};
        } catch (e) {
          if (fail) {
            fail(e);
          } else {
          }
          return { error: e };
        }
      },
      wsClose__: async function (options, succ, fail) {
        var s = function () {
          if (share.accounts__ && share.accounts__.proxy) {
            share.accounts__.proxy.on = 0;
            share.saveAccountToDb__(null, fail);
          }
          succ && succ();
        }

        await share.callNodejs__(
          {
            func: "wsClose",
            params: options
          },
          s,
          fail
        );
      },
      deleteComment__: async function (commentId) {
        return await share.callNodejs__(
          {
            func: "deleteComment",
            params: { commentId: commentId, email: share.user__.email }
          }
        );
      },
      toDeleteComment__: async function (feedId, commentId, fromEmail) {
        return new Promise(async (resolve, reject) => {
          let buttons = [];
          let popup;
          buttons.push({
            text: share.getString__("block"),
            onTap: async function () {
              popup.close();
              let res = await share.toBlockCommentOwner__(commentId, fromEmail);
              resolve(res);
            }
          });

          buttons.push({
            text: share.getString__("delete"),
            onTap: async function () {
              let res = await share.deleteComment__(commentId);
              popup.close();
              resolve(res);
            }
          });

          popup = await share.popupAction__(null, buttons);
          popup.onClosed = function () {
            resolve(null);
          }
        });
      },
      callNodejs__: async function (options, succ, fail, update) {
        return new Promise((resolve, reject) => {
          let s = function (res) {
            succ && succ(res);
            resolve(res);
          };

          let f = function (e) {
            fail && fail(e);
            reject(e);
          }

          if (parent.parent != window) {
            return parent.parent.mhgl_share.callNodejs__(options, s, f, update);
          }

          share.debug__("calling nodejs:" + options.func);
          var func = options.func;
          var p = options.params;
          var id = func + share.uuid__();
          share.nodejscalls__[id] = {
            succ: s,
            fail: f,
            update: update
          };
          nodejs.channel.send(
            JSON.stringify({
              id: id,
              func: func,
              params: p
            })
          );
        });
      },
      add0: function (str, length) {
        if (length == null) {
          length = 2;
        }
        var len = length - ("" + str).length;
        var zero = "000000";
        if (len > 0) {
          str = zero.substring(0, len) + str;
        }

        return str;
      },
      getFullFilePath__: function (rPath, noConvert) {
        if (share.isIos__() && !noConvert) {
          return parent.parent.WkWebView.convertFilePath(share.tempFilePath + "/" + rPath);
        } else {
          return share.tempFilePath + "/" + rPath;
        }
      },
      getDurationText__: function (seconds) {
        seconds = parseInt(seconds);
        var h = parseInt(seconds / 3600);
        var m = parseInt((seconds % 3600) / 60);
        var s = seconds % 60;
        var text = h > 0 ? h + ":" : "";
        text = text + share.add0(m, 2) + ":";
        text = text + share.add0(s, 2);
        return text;
      },

      needInit__: function (reg) {
        var href = document.location.href;

        var val = reg.test(href);
        return val;
      },
      isAdmin__: function () {
        if (share.user__ && share.user__.admin == true) {
          return true;
        }
        return false;
      },
      useFrame__: function () {
        var pUrl = parent.window.location.href;
        if (pUrl.indexOf(share.containerUrl__) >= 0) {
          return true;
        }

        return false;
      },

      decode__: function (str) {
        var newStr = "";
        for (var i = 0; i < str.length; ++i) {
          var src = str.charAt(i);
          var dst = share.dictr__[src];

          if (dst == null) {
            dst = src;
          }
          newStr += dst;
        }

        return newStr;
      },

      toForbid__: function (params, succ, fail) {
        var days = [7, 14, 30, 90, 180, 365, 0];
        var captions = share.getString__("forbiddenTimes", ["7天", "14天", "1个月", "3个月", "6个月", "1年", "不忽略"]);

        var buttons = [];

        for (var i = 0; i < days.length; ++i) {
          let d = days[i];
          buttons.push(
            {
              text: captions[i],
              onTap: async function (e) {
                await share.closePopup__();
                params.days = d;
                share.forbid__(params, succ, fail);
              }
            }
          );
        }

        share.popupAction__(share.getString__("ignoreMessageFromMember"), buttons);
      },

      blockCommentOwner__: async function (params) {
        params.email = share.user__.email;
        return await share.callNodejs__(
          {
            func: "blockCommentOwner",
            params: params
          }
        )
      },

      toBlockCommentOwner__: async function (commentId, fromEmail) {
        return new Promise(async (resolve, reject) => {

          var days = [7, 14, 30, 90, 180, 365, 0];
          var captions = share.getString__("blockTimes", ["7天", "14天", "1个月", "3个月", "6个月", "1年", "不拉黑"]);

          var buttons = [];
          let popup;
          for (var i = 0; i < days.length; ++i) {
            let d = days[i];
            buttons.push(
              {
                text: captions[i],
                onTap: async function (e) {
                  let params = {
                    commentId: commentId,
                    fromEmail: fromEmail
                  };
                  params.days = d;
                  let res = await share.blockCommentOwner__(params);
                  await popup.close();
                  resolve(res);
                }
              }
            );
          }

          popup = await share.popupAction__(share.getString__("block"), buttons);
          popup.onClosed = function () {
            resolve(null);
          }
        });
      },

      addTag__: function (params, succ, fail) {
        share.callNodejs__(
          {
            func: "addTag",
            params
          },
          succ,
          fail
        );
      },

      untag__: function (params, succ, fail) {
        share.callNodejs__(
          {
            func: "untag",
            params
          },
          succ,
          fail
        );
      },

      tag__: function (params, succ, fail) {
        share.callNodejs__(
          {
            func: "tag",
            params
          },
          succ,
          fail
        );
      },

      toBlock__: function (params, succ, fail) {
        var days = [7, 14, 30, 90, 180, 365, 0];
        var captions = share.getString__("blockTimes", ["7天", "14天", "1个月", "3个月", "6个月", "1年", "不拉黑"]);

        var buttons = [];

        for (var i = 0; i < days.length; ++i) {
          let d = days[i];
          buttons.push(
            {
              text: captions[i],
              onTap: async function (e) {
                await share.closePopup__();
                params.days = d;
                share.block__(params, succ, fail);
              }
            }
          );
        }

        share.popupAction__(share.getString__("block"), buttons);
      },

      deleteTag__: function (params, succ, fail) {
        share.callNodejs__(
          {
            func: "deleteTag",
            params
          },
          succ,
          fail
        );
      },

      exceededAttachmentSize: async function (size) {
        return new Promise(async (resolve, reject) => {
          if (size > share.maxMailAttachmentSizeInM * 1024 * 1024) {
            let buttons = [
              {
                text: share.getString__("send"),
                onTap: async function (e) {
                  await share.closePopup__();
                  resolve(false);
                }
              },
              {
                text: share.getString__("cancel"),
                onTap: async function (e) {
                  await share.closePopup__();
                  resolve(true);
                }
              }
            ];

            let popup = share.popupAction__(share.getString__("exceededAttachmentSize"), buttons);
          } else {
            resolve(false);
          }
        });
      },

      toTagFollower__: async function (follower, succ, fail) {
        let c = $(`
            <div class="flexcolumn col-12 col-sm-10 col-lg-8">
              <div class="guide center ">
              </div>
              <div class="tags font12 flexrow wrap center width100p">
              </div>
            </div>
          `);
        $(".guide", c).html(share.getString__("tagGuide"));

        let tagC = $(".tags", c);
        let all = await share.getTags__("follower");
        let tags = await share.getFollowerTags__(follower);
        tags = tags.map(row => {
          let strs = row.tagId.split("\t");
          return strs[strs.length - 1];
        });

        all.forEach(function (row) {
          let tag = row.tag;
          let selected = tags.findIndex(item => item == tag) >= 0 ? "selectedTag" : "";
          let t = $(`
            <div class='tag marginlr2 ${selected}' tagId="${row.id}">
              ${tag}
            </div>
            `);
          tagC.append(t);
        });
        let ph = share.getString__("newTag");
        let add = $(`
          <div class="addTagContainer flexrow center">
            <input style="height:20px; width:60px;font-size:10px;padding:1px;" id="newTag" name="newTag" class="form-control" placeholder="${ph}">
            <button class="addTag btn btn-sm">+</button>
          </div>`);
        tagC.append(add);

        let popup = await share.popup__(null, c.html());

        let dialog = $(`#${popup.id}`);
        let tagClicked = async function () {
          let me = $(this);
          if (me.hasClass("selectedTag")) {
            let params = {
              tagged: follower.femail,
              tagId: me.attr("tagId"),
            }
            share.untag__(params, function (res) {
              me.removeClass("selectedTag");
            });
          } else {
            let popup2;
            let buttons = [
              {
                text: share.getString__("select"),
                onTap: function () {
                  popup2.close();
                  let params = {
                    tagged: follower.femail,
                    tagId: me.attr("tagId"),
                  }

                  share.tag__(params, function (res) {
                    me.addClass("selectedTag");
                  });
                }
              },
              {
                text: share.getString__("delete"),
                onTap: async function () {
                  popup2.close();
                  let confirmed = await share.isConfirmed__(share.getString__("deleteTagGuide"));
                  if (confirmed) {
                    let params = {
                      email: follower.email,
                      type: "follower",
                      tagId: me.attr("tagId"),
                    }

                    share.deleteTag__(params, function (res) {
                      me.remove();
                    });
                  }
                }
              }
            ];

            popup2 = await share.popupAction__("", buttons, me[0]);
          }
        };

        share.onClick__(dialog.find(".tag"), tagClicked);

        share.onClick__(dialog.find(".addTag"), function () {
          let me = $(this);
          let newTag = $(`#newTag`, dialog).val().trim();
          if (newTag == "") {
            share.toastError__(share.getString__("tagRequired"));
          } else {
            let params = {
              email: follower.email,
              type: "follower",
              tag: newTag,
              tagged: follower.femail
            };

            share.addTag__(params, function (res) {
              let t = $(`<div class='tag marginlr2'>${newTag}</div>`);
              t.insertBefore($(`.addTagContainer`, dialog));
              $(`#newTag`, dialog).val("");
              share.onClick__(dialog.find(".tag"), tagClicked);
            });
          }
        });
      },
      getTagKey: function (tag) {
        let tags = {};
        tags[share.getString__("myUpdates")] = "feed";
        tags[share.getString__("feedback")] = "feedback";

        let realTag = tags[tag];
        if (realTag == null) {
          realTag = tag;
        }

        return realTag;
      },

      httpGet__: function (
        url,
        params,
        success,
        fail,
        headers,
        notNeedLogin,
        notHandleCodes,
        showDialog
      ) {
        if (showDialog == null) {
          showDialog = share.getString__("querying");
        }
        var openId = share.getParameter__("openId");
        var otp = share.getParameter__("otp");
        var browser = "browser";
        if (share.isFromWechatBrowser__()) {
          browser = "wechat";
        }
        $.extend(params, {
          mhgl: share.mhgl__,
          openId: openId,
          otp: otp,
          browser: browser
        });
        if (!notNeedLogin && share.user__ != null) {
          $.extend(params, {
            JSESSIONID: share.user__.token,
            userId: share.user__.id,
            v: share.version__
          });
        }

        var dialog = showDialog == "" ? null : share.toastWaiting__(showDialog);
        share.debug__("GET " + url);
        share.debug__("Request:" + JSON.stringify(params, null, 2));

        $.ajax({
          type: "GET",
          async: true,
          url: url,
          data: params,
          headers: headers,
          dataType: "jsonp",
          jsonp: "js",
          success: function (json) {
            // share.debug__("Response:" + JSON.stringify(json, null, 2));
            dialog && dialog.close();
            if (json.d) {
              var str = share.decode__(json.d);
              json = JSON.parse(str);
            }

            share.debug__(function () {
              return "Response:" + JSON.stringify(json, null, 2);
            });
            var error = share.errorProcessed__(json, notHandleCodes);
            if (error == 401) {
              if (fail != null) fail(json);
            } else if (error == share.code__.needCharge) {
              // share.toCharge__();
              var charge = null;
              try {
                charge = JSON.parse(json.message);
              } catch (e) { }

              if (charge == null) {
                share.debug__("error:need charge");
              } else {
                var message = $("#templatePayQr").html();
                if (charge.comment) {
                  message = $("#templatePayQrWithComment").html();
                  message = message.replace(/#comment#/g, charge.comment);
                }
                message = message.replace(/#qrUrl#/g, charge.qrUrl);
                message = message.replace(/#amount#/g, charge.amount / 100);
                share.toastInfo__(message);
              }
            } else if (error != 0) {
              if (fail != null) fail(json);
            } else {
              if (success != null) success(json);
              share.setParentLocation__();
            }
          },
          error: function (e) {
            share.debug__("Response:" + JSON.stringify(e, null, 2));
            dialog && dialog.close();
            if (fail) {
              fail(e);
            } else {
              share.handleAjaxError__(e);
            }
          }
        });
      },
      setPagination__: function (pagination) {
        page = pagination;
      },
      getPage__: function () {
        return share.getCache__("page");
      },
      setPage__: function (url) {
        if (url == null) {
          share.setCache__("page", null);
        } else {
          share.setCache__("page", url, {
            expires: 365
          });
        }
      },
      getDocument__: function () {
        var doc = document;
        if (share.isInFrame__()) {
          doc = parent.document;
        }

        return doc;
      },
      formatFileSize__: function (size) {
        if (size < 1024) {
          return size + "B";
        }

        if (size < 1024 * 1000) {
          return Number.parseInt(size / 1024) + "K";
        }

        return (size / 1024 / 1024).toFixed(2) + "M";

      },
      toChat__: async function (name, email) {
        let friend = await share.getFriendByEmail__(email);
        if (friend == null) {
          share.toAddFriend__(name, email);
        } else {
          let options = {
            address: friend.femail,
            name: friend.comment,
            publicKey: friend.publicKey
          };

          share.getRoomByEmail__(options, function (res) {
            if (res == null) {
              share.toAddFriend__(name, email);
            } else {
              document.location.href = "./message.list.htm?id=" + res.id;
            }
          });
        }
      },
      ensureImapConnected__: function (succ, fail) {
        var account = share.user__;
        if (account != null) {
          share.callNodejs__(
            {
              func: "ensureImapConnected",
              params: account
            },
            succ,
            fail
          );
        }
      },
      updateDuration__: function (chat, succ, fail) {
        var account = share.user__;
        if (account != null) {
          share.callNodejs__(
            {
              func: "updateDuration",
              params: chat
            },
            succ,
            fail
          );
        }
      },
      getScreenHeight__: function () {
        var height =
          parent.window.innerHeight ||
          parent.document.documentElement.clientHeight ||
          parent.document.body.clientHeight;
        return height;
      },
      setParentLocation__: function () {
        return;
        var pUrl = parent.window.location.href;
        var href = document.location.href;
        if (pUrl != href) {
          var pstrs = pUrl.split(share.containerUrlRegEx__);
          var strs = href.split("/fe/");
          strs[1] = encodeURIComponent(strs[1]);
          var newUrl = pstrs[0] + share.containerUrl__ + "#" + strs[1];
          if (newUrl != pUrl) {
            parent.window.location = newUrl;
          }
        }
      },

      getMapKeys__: function (map) {
        var keys = [];
        for (var key in map) {
          keys.push(key);
        }

        return keys;
      },
      disablePullDown__: function () {
        var lastX, lastY; // 最后一次y坐标点

        $(document.body).on("touchstart", function (event) {
          lastY = event.originalEvent.changedTouches[0].clientY; // 点击屏幕时记录最后一次Y度坐标。
          lastX = event.originalEvent.changedTouches[0].clientX;
        });
        $(document.body).on("touchmove", function (event) {
          var x = event.originalEvent.changedTouches[0].clientX;
          var y = event.originalEvent.changedTouches[0].clientY;
          var st = $(this).scrollTop(); // 滚动条高度
          if (x != lastX) {
            // lastX = x;
            // event.preventDefault();
          }
          if (y >= lastY && st <= 10) {
            // 如果滚动条高度小于0，可以理解为到顶了，且是下拉情况下，阻止touchmove事件。
            lastY = y;
            event.preventDefault();
          }
          lastX = x;
          lastY = y;
        });
      },
      setPlaceholder__: function (selector, value) {
        $(selector).attr("placeholder", value);
      },

      getSystemLang__: function () {
        let lang = navigator.language || navigator.userLanguage;
        let mapping = {
          "zh-CN": "hans",
          "zh-Hans": "hans",
          "zh-TW": "hans",
          "zh-HK": "hans",
          "zh-Hant": "hans"
        };

        if (mapping[lang]) {
          lang = mapping[lang];
        } else {
          lang = navigator.language.split("-")[0];
        }

        return lang;
      },

      getLang__: function () {
        let lang = share.getCache__("lang");
        share.debug__(`lang=${lang}`);
        if (lang == null) {
          lang = share.getSystemLang__();
        }

        if (lang == null) {
          lang = "en";
        }

        return lang;
      },
      isInAllinEmail: function () {
        function showWarning() {
          $("body").append(`This page can only work in <a href="http://www.labadida.com/download/AllinEmail">AllinEmail</a> APP`);
        }

        if (share.isInFrame__()) {
          let pp = parent.parent;
          if (pp.mhgl_container == null) {
            showWarning();
            return false;
          }
        } else {
          let pos = document.location.href.indexOf("container.htm");
          if (pos < 0) {
            pos = document.location.href.indexOf("start.htm");
          }

          if (pos < 0) {
            showWarning();
            return false;
          }

          if (window.electron) {
            return true;
          }

        }

        return true;
      },
      initialize__: function () {
        window.$$ = function (selector) {
          return $(selector, parent.parent.document);
        }

        if (!share.isInAllinEmail()) {
          return;
        }

        share.bindSwipe();
        if (!share.isInFrame__()) {
          share.loadCordova__();
        }

        share.tempFilePath = parent.parent.mhgl_share.tempFilePath;

        if (parent.parent.mhgl_share.string) {
          share.string = parent.parent.mhgl_share.string;
        } else {
          let lang = share.getLang__();

          share.string = window.AllinEmail.string[lang];
          if (share.string == null) {
            lang = "en";
            share.string = window.AllinEmail.string[lang];
          }
        }

        share.defaultScanOptions__ = {
          start: 0,
          labelWidth: 55,
          labelHeight: 35,
          rectSize: 240.0,
          rectAlpha: 0.4,
          crossLength: 10,
          scanning: share.getString__("scanning"),
          scanPaused: share.getString__("scanPaused"),
          waitingForScan: share.getString__("waitingForScan"),
          cancelButton: share.getString__("cancel"),
          finishButton: share.getString__("finish"),
          formats: "QR_CODE,PDF_417",
          preferFrontCamera: false, // iOS and Android
          showFlipCameraButton: false, // iOS and Android
          guide: share.getString__("scanGuide"),
          prompt: share.getString__("scanPrompt")
        };

        var page = document.location.href;
        share.test__ = parent.parent.mhgl_share.test__;
        share.accounts__ = parent.parent.mhgl_share.accounts__;
        //share.debug__ = share.debug__;
        share.debug__("share.init__:" + page);
        //share.debug__("window.inElectron=" + (window.env != undefined) ? window.env.inElectron:false);
        if (share.inElectron) {
          share.deviceReadyFunc__ = null;
        }
        var pUrl = parent.window.document.location.href;
        share.debug__("pUrl:" + pUrl);
        share.loadCookie__();
        share.setConsts__();

        if (parent.parent.mhgl_container) {
          parent.parent.mhgl_container.historyCount++;
        }
        // share.disablePullDown__();
        share.hideBottomInfo__();
        parent.window.scrollTo(0, 0);
        share.setParentLocation__();
        if (
          page.indexOf("user.login.htm") > 0 ||
          page.indexOf("user.reg.htm") > 0 ||
          page.indexOf("user.logout.htm") > 0 ||
          page.indexOf("user.password") > 0
        ) {
        } else {
          share.setPage__(page);
        }

        /*
      var logdiv = $('#log');
      if (logdiv.length > 0) {
        logdiv.parent()[0].removeChild(logdiv[0]);
        $('body')[0].appendChild(logdiv[0]);
      }
      */

        if (!share.isInFrame__()) {
          share.loadTimer__();
        }

        $.ajaxSetup({
          timeout: share.ajaxTimeout__
        });
        share.extendJquery__();
        share.hrefClicked__();

        try {
          share.computePosition = window.FloatingUIDOM.computePosition;
          share.flip = window.FloatingUIDOM.flip;
          share.shift = window.FloatingUIDOM.shift;
          share.offset = window.FloatingUIDOM.offset;
          share.arrow = window.FloatingUIDOM.arrow;
        } catch (e) {

        }
      },
      hrefClicked__: function () {
        $(document).on('click', 'a', function (e) {
          let path = $(this).attr('href');
          let target = $(this).attr('target');

          if (target == "_system") {
            e.preventDefault();
            share.openLink__(path);
          }
        });
      },
      toLanguage__: function () {
        var buttons = [];
        window.AllinEmail.languages.forEach(ele => {
          buttons.push({
            text: share.getString__(ele.name, ele.name),
            onTap: function () {
              share.closePopup__();
              parent.parent.mhgl_share.setLang__(ele.key,
                function () {
                  parent.parent.parent.location.reload();
                });
            }
          });
        });

        share.popupAction__('', buttons);
      },
      toProxy__: async function () {
        if (share.user__ == null) {
          share.toastError__(share.getString__("loginFirst"));
          return;
        }

        let res = await share.getDeviceInfo__();

        let localProxy = null;

        if (res.serverStarted && res.ips && res.ips.length > 0) {
          localProxy = `ws://${res.ips[0]}:${res.port}`;
        }

        let proxies = await share.getProxyHtml();
        let proxyPage = share.getString__("proxyListGuide", localProxy, proxies);

        share.dialog__ = await share.popup__(null, proxyPage, "bottom");
        share.onProxyShown__();
      },
      toHelp__: async function () {
        let c = $$("#templateHelp");
        c.find(".helpGuide").html(share.getString__("helpGuide"));

        share.dialog__ = await share.popup__(null, c.html(), "bottom");
        let popup = $("#" + share.dialog__.id);
        share.onClick__($(".followAuthor", popup), share.toFollowAuthor__);
      },
      toFollowAuthor__: function () {
        share.toFollow__(share.getString__("authorName"), "tsinghoo@gmail.com");
      },
      onProxyShown__: function () {
        share.onClick__($(".proxyName"), share.onProxyClicked__, true);
        share.onClick__($(".proxyDelete"), share.toDeleteProxy__, true);
        $(".newProxy").html(`<span class="glyphicon glyphicon-plus-sign"></span> ${share.getString__("newProxy")}`);

        share.onClick__($(".newProxy"), function () { share.toAddProxy__() }, true);
        share.onClick__($(".localProxy"), share.localProxyClicked__, true);
      },
      localProxyClicked__: async function () {
        let me = $(this);
        let localProxy = me.html();
        share.toAddProxy__(localProxy);
      },
      onAddProxyShown__: function (proxyUrl) {
        $(".addProxyGuide").html(share.getString__("addProxyGuide"));
        $(".addProxyNameLabel").html(share.getString__("addProxyNameLabel"));
        $(".addProxyUrlLabel").html(share.getString__("addProxyUrlLabel"));
        $(".addProxyUrl").attr("placeholder", "ws://proxy.com:7902");
        proxyUrl && $(".addProxyUrl").val(proxyUrl);
        $(".addProxyButton").html(share.getString__("confirm"));
        share.onClick__($(".addProxyButton"), share.onAddProxyButtonClicked__, true);
      },
      onAddProxyButtonClicked__: function () {
        let name = $(".addProxyName").val();
        let url = $(".addProxyUrl").val().trim();

        if (url.toLowerCase().indexOf("ws://") < 0 && url.toLowerCase().indexOf("wss://") < 0) {
          share.toastError__(share.getString__("proxyUrlError"));
          return;
        }

        if (name == "") {
          name = url;
        }

        share.addProxy__(name, url, async function () {
          await share.closePopup__();
          share.toProxy__();
        });
      },
      toAddProxy__: async function (proxyUrl) {
        //await share.closePopup__();
        let html = $$("#templateAddProxy").html();
        await share.closePopup__();
        share.dialog__ = await share.popup__(null, html);
        share.onAddProxyShown__(proxyUrl);
      },
      onProxyClicked__: async function (e) {
        let id = e.currentTarget.id.split("_")[1];

        let proxy = share.proxys[id];

        if (proxy.name == share.accounts__.proxy.name) {
          if (parent.parent.mhgl_share.wsConnected) {
            share.closePopup__();
            return;
          }
        }

        let res = await share.toConnectWs__(proxy);
        if (res.error) {
          share.toastError__(res.error);
        } else {
          share.accounts__.proxy = proxy;
          share.accounts__.proxy.on = 1;
          await share.saveAccountToDb__();
          share.selectProxy__(share.proxys[id].name);
          await share.closePopup__();
        }
      },
      toConnectWs__: async function (proxy) {
        if (proxy.url != "") {
          let res = await share.wsConnect__(
            {
              url: proxy.url,
              email: share.user__.email
            }
          );

          return res;
        } else {
          share.wsClose__({});
          return {};
        }
      },
      showGroupDetail: async function (selectedItem, toSendMessage, doDelete) {
        let message = $$("#templateDetailGroup").html();
        message = message.replace(/\r/g, "");
        message = message.replace(/\n/g, "");

        let dialog = await share.popup__(null, message, "bottom");

        $(".detailName").val(selectedItem.name);
        $(".detailGroupAlias").val(selectedItem.alias);

        share.onClick__($(".detailConfirmName"), function (e) {
          var target = $(this).closest(".input-group").find(".detailName");
          var value = target.val().trim();
          if (value == selectedItem.name) {
            return;
          }
          if (value == "") {
            target.val(selectedItem.name);
            return;
          }

          var succ = function (res) {
            selectedItem.name = value;
            let loc = "message.list.htm?id=" + res.room.id;
            if (window.rightFrame) {
              rightFrame.document.location = loc;
              page.refresh();
              dialog.close();
            } else {
              share.open__(loc);
            }
          };
          var fail = function (e) {
            share.toastError__(e);
          };

          var group = selectedItem;
          share.updateGroup__("name", value, group, succ, fail);
        });

        share.onClick__($(".detailConfirmAlias"), function (e) {
          var target = $(this).closest(".input-group").find(".detailGroupAlias");
          var value = target.val().trim();

          var succ = function () {
            selectedItem.alias = value;
            page.refresh();
          };

          var fail = function (e) {
            share.toastError__(e);
          };

          var group = { email: selectedItem.email, address: selectedItem.address };
          share.updateGroup__("alias", value, group, succ, fail);
        });

        share.onClick__($(".detailSend"), function () {
          dialog.close();
          toSendMessage();
        });

        share.onClick__($(".detailMembers"), function () {
          dialog.close();
          share.toViewMembers();
        });

        let alias = selectedItem.alias;
        if (selectedItem.alias == "") {
          alias = selectedItem.name;
        }
        if (doDelete) {
          share.onClick__($(".detailDelete"), doDelete);
        } else {
          $(".detailDelete").addClass("hide");
        }

        return dialog;
      },

      setOwner__: async function (member, room) {
        let comment = member.comment;
        if (comment == null || comment == "") {
          comment = member.name;
        }

        let msg = share.getString__("setOwnerGuide", comment);
        let confirmed = await share.isConfirmed__(msg);
        if (confirmed) {
          let chat = {
            type: share.TypeJson,
            data: {
              type: "setOwner",
              newOwner: member
            }
          };

          let res = await share.savedOwnMessage__(room, chat);
          if (res.error) {
            share.toastError__(res.error);
          } else {
            var target = share.getOpenTarget__(640, "rightFrame");
            share.open__("message.list.htm?id=" + room.id, target);
          }
        }
      },
      toViewMembers: function () {
        var target = share.getOpenTarget__(640, "rightFrame");
        share.open__("member.list.htm", target);
        share.onResize__();
      },
      updateDialog__: function () {
        //todo;
      },
      toDeleteProxy__: function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        if (id == 0) {
          share.toastWarning__(share.getString__("canNotDelete"));
          return;
        }

        var proxy = share.proxys[id];
        share.confirm__(share.getString__("confirmToDeleteProxy", proxy.name, proxy.url), function (confirmed) {
          if (confirmed) {
            share.deleteProxy__(proxy.name, async function (res) {
              await share.closePopup__();
              share.toProxy__();
            }, function (err) {
              share.toastError__(JSON.stringify(err));
            });
          }
        });
      },
      setLang__: function (lang, succ, fail) {
        share.string = window.AllinEmail.string[lang];
        share.setCache__("lang", lang);
        share.callNodejs__(
          {
            func: "setLang",
            params: { lang: lang }
          },
          succ,
          fail
        );
      },
      beforeExit__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "beforeExit",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      extendJquery__: function () {
        (function ($) {
          $.fn.serializeJson = function () {
            var serializeObj = {};
            var array = this.serializeArray();
            var str = this.serialize();
            $(array).each(function () {
              if (serializeObj[this.name]) {
                if ($.isArray(serializeObj[this.name])) {
                  serializeObj[this.name].push(this.value);
                } else {
                  serializeObj[this.name] = [
                    serializeObj[this.name],
                    this.value
                  ];
                }
              } else {
                serializeObj[this.name] = this.value;
              }
            });
            return serializeObj;
          };

          $.fn.disableSelection = function () {
            this.each(function () {
              this.onselectstart = function () {
                return false;
              };
              this.unselectable = "on";
              $(this).css("-moz-user-select", "none");
              $(this).css("-webkit-user-select", "none");
            });
          };
        })(jQuery);

        jQuery.fn.extend({
          offAndOn: function (types, selector, data, fn) {
            return this.each(function () {
              jQuery.event.remove(this, types, fn, selector);
              $(this).on(types, selector, data, fn);
            });
          }
        });
      },

      getChatList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getChatList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getAllFriendList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getAllFriendList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      showLink__: function (feed, i, toSend) {
        var tmpl = $$("#templateLink").html();
        let itemHtml = tmpl.replace(/#header#/, share.getSeal(feed.senderName));
        itemHtml = itemHtml.replace(/#name#/g, feed.senderName);
        itemHtml = itemHtml.replace(/#id#/g, i);
        itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(feed.senderEmail));
        itemHtml = itemHtml.replace(/#title#/, share.getTextWithOnlyLink__(feed.media.title));
        itemHtml = itemHtml.replace(/#desc#/, share.getTextWithOnlyLink__(feed.media.desc));
        itemHtml = itemHtml.replace(/#url#/, feed.media.url);
        let c = $(itemHtml);
        c.attr("feedId", feed.feedId);
        if (feed.senderEmail == share.user__.email) {

        } else {
          c.find(".followingName").html(feed.followingName);
          c.find(".followingName").attr("followingEmail", feed.followingEmail);
          c.find(".toFollowing").removeClass("hide");
        }

        favicon = feed.media.favicon;
        if (!favicon) {
          favicon = "img/link1.png"
        }
        c.find("img").attr("src", favicon);
        let voteImg = "./img/vote.png";
        if (feed.liked == 1) {
          voteImg = "./img/unvote.png";
        }

        $(".vote", c).attr("src", voteImg);

        share.onClick__($(".vote", c), function () {
          share.onLikeClicked__(feed);
        });

        share.updateStatus__(feed, c, toSend);

        share.onClick__($(".messageStatus", c), function () {
          share.onMessageStatusClicked__(feed);
        });

        $(".vote", c).after(`<div class="vote-count">${feed.likeCount || 0}</div>`);
        $(".createTime", c).html(share.getTime__(feed.createTime));
        $(".seal-img", c).addClass(`seal-${feed.senderType}`);


        return c;
      },
      addSendByMyWebsocketButton: function (buttons, si) {
        buttons.push({
          text: share.getString__("resend.websocket"),
          onTap: async function (e) {
            await share.closePopup__();
            share.sendFeed__(si, "proxy");
          }
        });
      },
      onMessageStatusClicked__: function (si) {
        var status = share.getMessageStatus__(si);
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
                let info = share.getString__("feedStatus", count, total, msg);
                error = `${error}<br>${info}`;
              }

              buttons.push({
                text: share.getString__("resendByMail"),
                onTap: async function (e) {
                  await share.closePopup__();

                  share.sendFeed__(si, "mail");
                }
              });
            } else {
              error = share.getString__(jStatus.error);
              if (error == null) {
                error = " ";
              }
              share.addSendByMyWebsocketButton(buttons, si);

              buttons.push({
                text: share.getString__("resendByMail"),
                onTap: async function (e) {
                  await share.closePopup__();
                  share.sendFeed__(si, "mail");
                }
              });
            }
          } else {
            error = share.getString__("feedStatus", count, total, msg);

            buttons.push({
              text: share.getString__("resendByMail"),
              onTap: async function (e) {
                await share.closePopup__();
                share.sendFeed__(si, "mail");
              }
            });
          }
        } else if (status && status.indexOf("sending") == 0) {
          share.toastInfo__(share.getString__("sending"));
        } else if (status != "") {
          error = share.getString__(status, `${si.status}`);
          share.addReSendButton(buttons, si);
        }

        if (error) {
          if (share.isObject__(error)) {
            error = JSON.stringify(error);
          }

          share.popupAction__(`${error}`, buttons);
        }
      },
      addReSendButton: function (buttons, si) {
        buttons.push({
          text: share.getString__("resend"),
          onTap: async function (e) {
            await share.closePopup__();
            share.sendFeed__(si);
          }
        });
      },
      getMessageStatus__: function (item) {
        let status = "";
        let now = new Date().getTime();
        if (item.status == "sending") {
          status = "sending";
          if (now - item.createTime > 20 * 1000) {
            status = "timeout";
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

      updateStatus__: function (item, jItem, toSend) {
        let status = share.getMessageStatus__(item);
        let error = share.jsonParse__(status);
        let container = jItem.find(".progress-container");
        let img = jItem.find(".messageStatusImage");
        if (status == "sending") {
          img.removeClass("hide");
          container.removeClass("hide");
          img.attr("src", "./img/loading6.gif");
          let degrees = 3;
          const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;
          jItem.find(".progress-pointer").css({
            background: style
          });
          if (toSend != null)
            toSend.push(item);

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
      },

      updateCommentStatus__: function (comment, c) {
        let status = share.getMessageStatus__(comment);
        let error = share.jsonParse__(status);
        let container = c.find(".progress-container");
        let img = c.find(".messageStatusImage");
        if (status == "sending") {
          img.removeClass("hide");
          container.removeClass("hide");
          img.attr("src", "./img/loading6.gif");
          let degrees = 3;
          const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;
          c.find(".progress-pointer").css({
            background: style
          });

          //self.toSend.push(comment);

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
      },
      likeFeed__: function (item) {
        let c = $(`[feedid="${item.feedId}"]`);
        let img = "./img/unvote.png";
        let liked = 1;
        if (item.liked == 1) {
          img = "./img/vote.png";
          liked = 0;
        } else {
          img = "./img/unvote.png";
          liked = 1;
        }

        let waiting = share.toastWaiting__(share.getString__("sendLikeFeedInfo"));
        var succ = function (json) {
          waiting.close();
          if (json && json.message) {
            share.toastInfo__(json.message);
          } else {
            item.liked = liked;
            item.likeCount = json.feed.likeCount;
            $(".vote", c).attr('src', img);
            $(".vote-count", c).text(item.likeCount);
          }
        };

        var fail = function (e) {
          waiting.close();
          share.toastError__(e);
        };

        share.callNodejs__(
          {
            func: "likeFeed",
            params: {
              email: share.user__.email,
              liked: liked,
              feed: item
            }
          },
          succ,
          fail
        );
      },

      onLikeClicked__: async function (feed) {
        let buttons = [];
        let popup;

        let likeBtn = {
          text: share.getString__("unlike"),
          onTap: async function () {
            popup.close();
            share.likeFeed__(feed);
          }
        };

        if (feed.liked != 1) {
          likeBtn.text = share.getString__("like");
        }

        buttons.push(likeBtn);

        buttons.push({
          text: share.getString__("comment"),
          onTap: async function () {
            await popup.close();
            share.toComment__(feed);
          }
        });

        popup = await share.popupAction__(null, buttons);
      },
      feedHeaderClicked: async function (item) {
        page = window.mhgl_page;
        var message = $$("#templateDetail").html();
        message = message.replace(/\r/g, "");
        message = message.replace(/\n/g, "");
        let dialog = await share.popup__(null, message, "bottom", function (popupId) {
          let c = $(`#${popupId}`);
          $(".detailAlias", c).val(item.senderName);

          share.onClick__($(".detailConfirmAlias", c), function (e) {

            if (item.senderType == "me") {
              $(".detailAlias", c).val(item.senderName);
              return;
            }

            var target = $(this).closest(".input-group").find(".detailAlias");
            var comment = target.val().trim();

            var succ = function () {
              item.comment = comment;
              page.refresh();
            };

            var fail = function (e) {
              share.toastError__(e);
            };

            var friend = { email: item.email, femail: item.senderEmail };
            share.updateFollowing__(comment, friend, succ, fail);
          }, true);

          if (item.senderType == "me") {
            $(".detailConfirmAlias", c).addClass("hide");
            $(".detailAlias", c).prop("readonly", true);
            $(".buttonSend", c).addClass("hide");
            $(".buttonUnfollow", c).addClass("hide");
          }

          share.onClick__($(".buttonSend"), function () {
            if (item.status == "0stranger" || item.publicKey == "") {
              share.toastError__(share.getString__("friendNotConfirmed"));
            } else {
              share.toChat__(item.senderName, item.senderEmail);
            }
          }, true);

          share.onClick__($(".buttonComment"), async function () {
            await dialog.close();
            share.toComment__(item);
          }, true);

          share.onClick__($(".buttonDelete"), async function () {
            await dialog.close();
            share.toDeleteFeed__(item);
          }, true);

          share.onClick__($(".buttonUnfollow"), function () {
            share.confirm__(share.getString__("unfollowGuide", item.name), function (confirmed) {
              if (confirmed) {
                share.doUnfollow__(item, dialog);
              }
            }, share.getString__("confirm"), share.getString__("cancel"));
          }, true);
        });
      },
      showFeedItem__: function (item, i, toSend) {
        item.media = JSON.parse(item.media);
        let c;
        if (item.type == share.TypeLink) {
          c = share.showLink__(item, i, toSend);
        } else {
          c = share.showMedia(item, i, toSend);
        }

        share.onClick__(c.find(".header"), function (e) {
          e.stopPropagation();
          share.feedHeaderClicked(item);
        });

        share.onClick__(c.find(".senderName"), function (e) {
          e.stopPropagation();
          share.senderNameClicked(item);
        });

        share.onClick__(c.find(".pageLink"), function (e) {
          share.debug__("pageLinkClicked");
          e.preventDefault();
          e.stopPropagation();
          const url = e.currentTarget.getAttribute('url');
          var path = url;

          share.openLink__(path);
        });

        share.onClick__(c.find(".feedContent"), function (e) {
          e.stopPropagation();
          if ($(this).hasClass("maxHeight4rem")) {
            $(this).removeClass("maxHeight4rem");
          } else {
            $(this).addClass("maxHeight4rem");
          }
        });
        share.onClick__(c.find(".followingName"), function (e) {
          e.stopPropagation();
          share.followingNameClicked(e);
        });

        let json;
        try {
          json = JSON.parse(item.status);
        } catch (e) {
        }

        if (json && json.status == "sending") {
          if (toSend) {
            toSend.push(item);
          }

          let progressDegree = json.progressDegree ? json.progressDegree : 0;
          let degrees = progressDegree + (json.count / json.total) * (360 - progressDegree);
          if (degrees < 10) {
            degrees = 10;
          }

          const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;

          $(".progress-pointer", c).css({
            background: style
          });

        }

        return c;
      },
      senderNameClicked: async function (item) {
        share.toFollowing__(item.senderName, item.senderEmail);
      },
      doUnfollow__: function (item, detailDialog) {
        let waiting = share.toastWaiting__(share.getString__("sending"));
        var succ = function (json) {
          waiting.close();
          detailDialog.close();
          page.refresh();
        };

        var fail = function (e) {
          waiting.close();
          share.toastError__(e);
        };

        share.unfollow__(item, succ, fail);
      },
      followingNameClicked: function (e) {
        let followingEmail = $(e.currentTarget).attr("followingEmail");
        let followingName = $(e.currentTarget).html();
        share.toFollowing__(followingName, followingEmail, "feedback");
      },

      postComment__: async function (feed, reply, commentText) {
        if (!commentText || commentText.trim() === '') {
          share.toastError__(share.getString__("commentEmpty"));
          return;
        }

        let waiting = share.toastWaiting__(share.getString__("sending"));

        try {
          await share.callNodejs__({
            func: "commentFeed",
            params: {
              email: share.user__.email,
              feedId: feed.feedId,
              reply: reply,
              content: commentText,
              senderType: feed.senderType,
              feedOwnerEmail: feed.senderEmail
            }
          });
        } catch (e) {

        }

        waiting.close();

        share.getFeedComments__(feed);
      },


      getFeedComments__: function (feed, pageIndex, pageSize) {
        let feedId = feed.feedId;
        var succ = function (json) {
          if (json && json.result) {

            json.result.totalPages = Math.floor(json.result.totalRows / json.result.pageSize);
            if (json.result.totalRows % json.result.pageSize > 0) {
              json.result.totalPages++;
            }

            let html;
            let c = $(`[feedid="${feedId}"]`);
            let lc = $(`[feedid="${feedId}"] .comments-list`);
            lc.html("");
            json.result.list.sort(((a, b) => a.createTime - b.createTime)).forEach(comment => {
              if (comment.replyFromName) {
                html = $(`
              <div class="comment-item font14 flexrow" fromEmail="${comment.fromEmail}" commentId='${comment.id}' commentStatus='${comment.status}'>
                <span class="comment-author blue">${comment.fromName}</span>
                <div class="gray font10"> <label class="glyphicon glyphicon-share-alt"></label>${comment.replyFromName}</div>
                <span class="comment-text forceWrap"></span>
                <div class="flexrow messageStatus clickable">
                    <img src="" class="messageStatusImage" style="width:16px;height:16px;">
                    <div class="progress-container hide">
                        <div class="progress-background"></div>
                        <div class="progress-pointer"></div>
                    </div>
                </div>
              </div>`);
              } else {
                html = $(`
              <div class="comment-item font14 flexrow" fromEmail="${comment.fromEmail}" commentId='${comment.id}' commentStatus='${comment.status}'>
                <span class="comment-author blue">${comment.fromName}</span>
                <span class="comment-text maxHeight55 forceWrap"></span>
                <div class="flexrow messageStatus clickable">
                    <img src="" class="messageStatusImage" style="width:16px;height:16px;">
                    <div class="progress-container hide">
                        <div class="progress-background"></div>
                        <div class="progress-pointer"></div>
                    </div>
                </div> 
              </div>`);
              }
              html.find(".comment-text").text(": " + comment.content);
              share.updateCommentStatus__(comment, html);
              lc.append(html);
            });

            share.onClick__($(".messageStatus", lc), function (e) {
              share.onCommentStatusClicked__(this, feed, pageIndex, pageSize);
            });

            html = $(`
            <div class="comment-item flexrow">
                <span class="moreComment blue glyphicon glyphicon-option-vertical"></span>
            </div>`);

            lc.append(html);


            share.onClick__($(".comment-author", c), function () {
              const commentId = $(this).closest(".comment-item").attr("commentId");
              const fromName = $(this).html();
              const fromEmail = $(this).closest(".comment-item").attr("fromEmail");
              share.toOperateComment__(feed, commentId, fromName, fromEmail);
            });
            share.onClick__($(".comment-text", lc), function () {
              if ($(this).hasClass("maxHeight55")) {
                $(this).removeClass("maxHeight55");
              } else {
                $(this).addClass("maxHeight55");
              }
            });

            share.onClick__($(".moreComment", c), function () {
              share.onMoreCommentClicked(feed, json.result);
            });
          }
        };


        var fail = function (e) {
          share.toastError__(e);
        };

        share.callNodejs__({
          func: "getFeedComments",
          params: {
            email: share.user__.email,
            feedId: feedId,
            type: 2,
            pageIndex: pageIndex,
            pageSize: pageSize
          }
        }, succ, fail);
      },


      onMoreCommentClicked: async function (feed, comments) {
        let buttons = [];
        let popup;

        buttons.push({
          text: share.getString__("comment"),
          onTap: async function () {
            await popup.close();
            share.toComment__(feed);
          }
        });

        let likeBtn = {
          text: share.getString__("unlike"),
          onTap: async function () {
            await popup.close();
            share.likeFeed__(feed);
          }
        };

        if (feed.liked != 1) {
          likeBtn.text = share.getString__("like");
        }

        buttons.push(likeBtn);

        if (comments.totalPages > 1) {
          buttons.push({
            text: share.getString__("moreComments"),
            onTap: async function () {
              await popup.close();
              share.toMoreComment__(feed);
            }
          })
        }

        popup = await share.popupAction__(null, buttons);
      },

      toMoreComment__: function (feed) {
        share.open__("./feed.htm?id=" + feed.id, "_self");
      },

      toOperateComment__: function (feed, commentId, fromName, fromEmail) {
        let buttons = [];
        let popup;
        let feedId = feed.feedId;
        let onShown = function (popupId) {

        }

        buttons.push({
          text: share.getString__("delete"),
          onTap: async function () {
            share.closePopup__();
            let res = await share.toDeleteComment__(feedId, commentId, fromEmail);
            if (res != null) {
              share.getFeedComments__(feed);
            }
          }
        });

        buttons.push({
          text: share.getString__("reply"),
          onTap: async function () {
            share.closePopup__();
            share.toComment__(feed, {
              commentId,
              fromName,
              fromEmail
            });
          }
        });

        share.popupAction__(null, buttons, null, "bottom", onShown);
      },
      reSendComment__: async function (cid, feed, pageIndex, pageSize, sendType) {
        try {
          let res = await share.sendFeedComment__(cid, sendType);
        } catch (e) {

        }

        share.getFeedComments__(feed, pageIndex, pageSize);

      },
      onCommentStatusClicked__: function (clicked, feed, pageIndex, pageSize) {
        let ci = $(clicked).closest(".comment-item");
        let cid = ci.attr("commentId");
        let status = ci.attr("commentStatus");
        let error = null;
        let jStatus = share.jsonParse__(status);
        var buttons = [];

        function addSendByMailButton() {
          buttons.push({
            text: share.getString__("resendByMail"),
            onTap: async function (e) {
              await share.closePopup__();
              share.reSendComment__(cid, feed, pageIndex, pageSize, "mail");
            }
          });
        }

        function addSendByMyWebsocketButton() {
          buttons.push({
            text: share.getString__("resend.websocket"),
            onTap: async function (e) {
              await share.closePopup__();
              share.reSendComment__(cid, feed, pageIndex, pageSize, "proxy");
            }
          });
        }

        function addReSendButton() {
          buttons.push({
            text: share.getString__("resend"),
            onTap: async function (e) {
              await share.closePopup__();
              share.reSendComment__(cid, feed, pageIndex, pageSize,);
            }
          });
        }

        if (jStatus) {
          let count = jStatus.count;
          let total = jStatus.total;
          let msg = jStatus.msg;
          if (jStatus.websocket) {
            if (jStatus.error == "mail.sending") {
              error = share.getString__(`websocket.sending`);
              if (count != null && total != null) {
                let info = share.getString__("feedStatus", count, total, msg);
                error = `${error}<br>${info}`;
              }

              addSendByMailButton();
            } else {
              error = share.getString__(jStatus.error);
              if (error == null) {
                error = " ";
              }

              addSendByMyWebsocketButton();
              addSendByMailButton();
            }
          } else {
            error = share.getString__("feedStatus", count, total, msg);
            addSendByMailButton();
          }
        } else if (status && status.indexOf("sending") == 0) {
          error = share.getString__("sending");
          addReSendButton();
        } else if (status != "") {
          error = `${status}`;
          addReSendButton();
        }

        if (error) {
          if (share.isObject__(error)) {
            error = JSON.stringify(error);
          }

          share.popupAction__(`${error}`, buttons, null);
        }

      },
      toComment__: async function (feed, reply) {
        let html = $$("#templateComment").html();
        let popup;
        let onShown = function (popupId) {
          let c = $(`#${popupId}`);
          $(".commentInput", c).focus();
          let label = share.getString__("comment");
          if (reply) {
            label = share.getString__("replyTo", reply.fromName);
          }

          $(".comment-label", c).html(label);
          $(".comment-text", c).on("keypress", async function (e) {
            if (e.which === 13) {
              const commentText = $(this).val().trim();
              await share.postComment__(feed, reply, commentText);
              popup.close();
              return false; // Prevent form submission
            }
          });

          share.onClick__($(".post-comment", c), async function () {
            let val = $(".comment-text", c).val().trim();
            await share.postComment__(feed, reply, val);
            popup.close();
          });
        }

        popup = await share.popup__(null, html, "bottom", onShown);
      },
      toDeleteFeed__: async function (feed) {
        var buttons = [];
        let dialog;
        buttons.push({
          text: share.getString__("confirm"),
          onTap: async function () {
            await dialog.close();

            try {
              let json = await share.deleteFeed__(
                {
                  feed,
                  delBefore: self.delBefore
                }
              );

              if (json && json.message) {
                share.toastInfo__(json.message);
              }

              page.refresh();
            } catch (e) {
              share.toastError__(e);
            }
          }
        });

        buttons.push({
          text: share.getString__("cancel"),
          onTap: async function (e) {
            await dialog.close();
          }
        });

        content = $$("#templateDelete").html();
        self.delBefore = 0;
        let onShown = function (popupId) {
          let c = $(`#${popupId}`);
          $(".delBefore", c).on("input", function (e) {
            self.delBefore = $(this).is(':checked');
          });
        }

        dialog = await share.popupAction__(content, buttons, null, null, onShown);
      },

      showMedia: function (feed, i, toSend) {
        var tImage = $$("#templateImage").html();
        let itemHtml = tImage.replace(/#header#/, share.getSeal(feed.senderName));
        itemHtml = itemHtml.replace(/#name#/g, feed.senderName);
        itemHtml = itemHtml.replace(/#id#/g, i);
        itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(feed.senderEmail));
        itemHtml = itemHtml.replace(/#content#/, share.getTextWithOnlyLink__(feed.content));
        let c = $(itemHtml);
        c.attr("feedId", feed.feedId);
        if (feed.senderEmail != feed.followingEmail) {
          c.find(".followingName").html(feed.followingName);
          c.find(".followingName").attr("followingEmail", feed.followingEmail);
          c.find(".toFollowing").removeClass("hide");
        }

        let voteImg = "./img/vote.png";
        if (feed.liked == 1) {
          voteImg = "./img/unvote.png";
        }

        $(".vote", c).attr("src", voteImg);


        share.onClick__($(".vote", c), function () {
          share.onLikeClicked__(feed);
        });

        share.updateStatus__(feed, c, toSend);

        share.onClick__($(".messageStatus", c), function () {
          share.onMessageStatusClicked__(feed);
        });

        $(".vote", c).after(`<div class="vote-count">${feed.likeCount || 0}</div>`);
        $(".createTime", c).html(share.getTime__(feed.createTime));
        $(".seal-img", c).addClass(`seal-${feed.senderType}`);

        feed.media && feed.media.forEach(ele => {
          if (feed.type == share.TypeImage) {
            const imageItem = $('<div class="image-item center">');
            const img = $('<img>').attr('src', share.encodeFilePath(ele.path));
            imageItem.append(img);
            $(".mediaGrid", c).append(imageItem);

            img.on('click', function () {
              share.showImageFullScreen__(share.encodeFilePath(ele.path));
            });

          } else if (feed.type = share.TypeVideo) {
            const videoItem = $('<div class="video-item">');
            const video = $('<video>').attr('src', share.encodeFilePath(ele.path));
            videoItem.append(video);
            $(".mediaGrid", c).append(videoItem);

            video.on('click', function (event) {
              event.stopPropagation();

              share.showVideoFullScreen__(share.encodeFilePath(ele.path));
            });
          }
        });

        return c;
      },

      getFollowingList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFollowingList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      toFollowing__: async function (name, femail, tag) {
        let following = null;
        if (femail == share.user__.email) {
          following = {
            comment: share.user__.nickName,
            femail: femail
          }
        } else {
          following = await share.getFollowingByEmail__(femail);
        }

        if (following == null) {
          share.toFollow__(name, femail, function () {
            share.toFollowing__(name, femail, tag);
          });
          return;
        }

        if (tag == null) {
          tag = "feed";
        }

        following.selectedTag = tag;

        share.setCache__("selectedFollowing", following);

        share.open__(`./feed.list.htm`);
      },

      getFollowingByEmail__: async function (femail) {
        let following = await share.callNodejs__(
          {
            func: "getFollowingByEmail",
            params: {
              femail: femail,
              email: share.user__.email
            }
          }
        );

        return following;
      },

      getFeedList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFeedList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getFeedById__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFeedById",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getFollowerList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFollowerList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getFriendList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFriendList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getGroupList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getGroupList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getMemberList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getMemberList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getMessageList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getMessageList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getProxyList__: async function (params) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getProxyList",
              params: params
            }
          );

          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },

      getMailboxes__: async function (email, key, succ, fail) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getMailboxes",
              params: {
                email: email,
                key: key
              }
            }
          );

          succ && succ(res);
          return res;
        } catch (e) {
          fail && fail(e);
        }


      },

      getDrafts__: function (
        email,
        pageIndex,
        pageSize,
        succ,
        fail
      ) {
        var options = {
          email: email,
          pageIndex: pageIndex,
          pageSize: pageSize
        };

        share.callNodejs__(
          {
            func: "getDrafts",
            params: options
          },
          succ,
          fail
        );
      },

      getMails__: function (
        email,
        mailBoxId,
        mailBoxPath,
        mailBoxName,
        key,
        keyType,
        pageIndex,
        pageSize,
        succ,
        fail
      ) {
        var options = {
          email: email,
          mailBoxPath: mailBoxPath,
          mailBoxId: mailBoxId,
          mailBoxName: mailBoxName,
          key: key,
          keyType: keyType,
          pageIndex: pageIndex,
          pageSize: pageSize
        };

        var func = function () {
          share.callNodejs__(
            {
              func: "getMails",
              params: options
            },
            succ,
            fail
          );
        };

        share.registerDeviceReady__(null, func);
      },
      bindSwipe: function () {
        var touchStartX = 0;
        var touchStartY = 0;
        var startTime;
        var swipeFromRight = false;
        var swipeFromLeft = false;

        document.body.addEventListener('touchstart', function (e) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          var screenWidth = window.innerWidth;

          swipeFromRight = false;
          swipeFromLeft = false;
          var minDistance = 20;
          startTime = Date.now();
          if (touchStartX > screenWidth - minDistance) {
            swipeFromRight = true;
          }

          if (touchStartX < minDistance) {
            swipeFromLeft = true;
          }
        }, false);

        document.body.addEventListener('touchend', function (e) {
          if (!swipeFromLeft && !swipeFromRight) {
            return;
          }

          var now = Date.now();
          if (now - startTime > 500) {
            return;
          }

          var touchEndX = e.changedTouches[0].clientX;
          var touchEndY = e.changedTouches[0].clientY;

          // 计算水平滑动距离
          var deltaX = touchEndX - touchStartX;
          var deltaY = touchEndY - touchStartY;

          if (deltaX < 200 && Math.abs(deltaY) < 80 && swipeFromLeft) {
            parent.parent.mhgl_container.back__();
          }

          if (deltaX > -200 && Math.abs(deltaY) < 80 && swipeFromRight) {
            parent.parent.mhgl_container.back__();
          }
        }, false);
      },
      setActionSheetButtonText__: function (id, text) {
        $("#actionSheetButton" + id).html(text);
      },
      setConsts__: function () {
        if (typeof BootstrapDialog != "undefined") {
          BootstrapDialog.DEFAULT_TEXTS.CANCEL = share.getString__("cancel");
          BootstrapDialog.DEFAULT_TEXTS.OK = share.getString__("confirm");
        }
      },
      isBarcode__: function (string) {
        if (string.length == 31) {
          return true;
        }

        return false;
      },
      isFromWechatBrowser__: function () {
        // return true;
        var ua = window.navigator.userAgent.toLowerCase();
        if (ua.indexOf("micromessenger") >= 0) {
          return true;
        } else {
          return false;
        }
      },

      todo__: function (info) {
        share.toastWarning__(info ? info : share.getString__("underConstruction"));
      },

      isUrl__: function (string) {
        if (
          string.lastIndexOf("http://", 0) === 0 ||
          string.lastIndexOf("https://", 0) === 0
        ) {
          return true;
        }

        return false;
      },
      getProperties__: function (template, keys, values) {
        var result = [];
        for (var i = 0; i < keys.length; ++i) {
          var html = template;
          html = html.replace(/#key#/g, keys[i]);
          html = html.replace(/#value#/g, values[i]);
          result.push(html);
        }

        return result.join("");
      },
      selectGroup__: async function (onGroupSelected) {
        let params = {
          keyName: self.keyName,
          email: share.user__.email,
          pageIndex: 1,
          pageSize: 1024000
        }

        let data = await share.getChatList__(params);

        var list = data.list;
        var groupTemplate = $$("#templateGroup").html();
        var html = [];
        list.forEach(function (item, i) {
          var itemHtml = groupTemplate.replace(/#email#/g, item.address);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#name#/g, item.name);

          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.name));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.address));

          html.push(itemHtml);
        });

        let guide = share.getString__("forward2GroupGuide");

        html = html.join("");
        html = `<div class="left scrollY">
              <button class="close closeButton" aria-label="close">×</button>
              <div class="center bold margintb2">${guide}</div>
                ${html}
              </div>
      `;
        $$("#topWin").html(html).removeClass("hide");
        $$("#topWinBackdrop").removeClass("hide");
        share.onClick__($$(".group"), function (e) {
          $$("#topWin").addClass("hide");
          $$("#topWinBackdrop").addClass("hide");
          let index = e.currentTarget.id.split("_")[1];
          let item = list[index];
          share.closeDialog__();
          onGroupSelected(item);
        });
        share.onClick__($$(".closeButton"), function (e) {
          $$("#topWin").addClass("hide");
          $$("#topWinBackdrop").addClass("hide");
          share.closeDialog__();
        });
      },
      acceptJoinGroup__: function (msg, succ, fail) {
        fail = fail || share.toastError__;
        share.callNodejs__(
          {
            func: "acceptJoinGroup",
            params: {
              email: share.user__.email,
              owner: msg.content.data.owner,
              sender: msg.content.data.sender,
              publicKey: msg.content.data.publicKey,
              memail: msg.senderEmail,
              mname: msg.senderName
            }
          },
          succ,
          fail
        );
      },
      getGroupMember__: function (room, memail, succ, fail) {
        var account = share.user__;
        var options = {};
        options.email = account.email;
        options.room = room;
        options.memail = memail;

        share.callNodejs__(
          {
            func: "getGroupMember",
            params: options
          },
          succ,
          fail
        );
      },
      getRoomById__: async function (roomId, succ) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getRoomById",
              params: { roomId: roomId }
            }
          );
          succ && succ(res);
          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      getMessageById__: async function (id, succ) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getMessageById",
              params: { id: id }
            }
          );
          succ && succ(res);
          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      getFavoriteById__: async function (id, succ) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFavoriteById",
              params: { id: id }
            }
          );
          succ && succ(res);
          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      getFavoriteList__: async function (params, succ) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getFavoriteList",
              params: params
            }
          );
          succ && succ(res);
          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      searchEmail__: async function (key, succ, fail) {
        let params = {
          email: share.user__.email,
          key: key,
          pageIndex: 1,
          pageSize: 10
        };

        try {
          let data = await share.callNodejs__(
            {
              func: "searchEmail",
              params: params
            }
          );

          var list = data.list;
          var res = [];
          list.forEach((item) => {
            let value = item.contact;
            res.push({ label: value, value: value });
          });

          succ(res);
          return res;
        } catch (e) {
          share.toastError__(e);
        }
      },
      toAddFriend__: async function (name, email, succ, fail) {
        let friend = await share.getFriendByEmail__(email);
        if (friend != null) {
          share.toastWarning__(share.getString__("friendExists"));
          return;
        }

        var message = $$("#templateAddFriend", parent.parent.document).html();
        let popupContainer = null;
        var onSubmit = function () {
          var name = popupContainer.find(".addFriendName").val().trim();
          var email = popupContainer.find(".addFriendEmail").val().trim().toLowerCase();
          var greeting = popupContainer.find(".addFriendGreeting").val().trim();
          if (name == "" || email == "") {
            share.toastError__(share.getString__("nameAndEmailCanNotBeNull"));
            return;
          }

          let waiting = share.toastWaiting__(share.getString__("sending"));

          var roomId = "";
          share.addFriend__(name, email, greeting,
            function () {
              waiting.close();
              share.closePopup__();
              succ && succ();
            }, function (e) {
              waiting.close();
              if (e == "friendExists") {
                share.toastError__(share.getString__("friendExists"));
              } else {
                share.toastError__(e);
              }
            });
        };

        share.dialog__ = await share.popup__(null, message, "bottom");
        popupContainer = $(`#${share.dialog__.id}`);
        popupContainer.find(".sendInviteButton").on("click", onSubmit);
        popupContainer.find(".addFriendName").val(name);
        popupContainer.find(".addFriendEmail").val(email);
      },
      unfollow__: function (item, succ, fail) {
        share.callNodejs__(
          {
            func: "unfollow",
            params: item
          },
          succ,
          fail
        );
      },
      toFollow__: async function (name, email, succ, fail) {
        var message = $$("#templateFollow", parent.parent.document).html();
        let popupContainer = null;
        var onSubmit = function () {
          var name = popupContainer.find(".addFriendName").val().trim();
          var email = popupContainer.find(".addFriendEmail").val().trim().toLowerCase();
          if (name == "" || email == "") {
            share.toastError__(share.getString__("nameAndEmailCanNotBeNull"));
            return;
          }

          let waiting = share.toastWaiting__(share.getString__("sending"));

          share.follow__(name, email,
            function () {
              waiting.close();
              share.closePopup__();
              succ && succ();
            }, function (e) {
              waiting.close();
              if (e == "friendExists") {
                share.toastError__(share.getString__("friendExists"));
              } else {
                share.toastError__(e);
              }
            });
        };

        share.dialog__ = await share.popup__(null, message, "bottom");
        popupContainer = $(`#${share.dialog__.id}`);
        popupContainer.find(".sendButton").on("click", onSubmit);
        popupContainer.find(".addFriendName").val(name);
        popupContainer.find(".addFriendEmail").val(email);
      },
      dataURLtoFile: function (dataURL, filename) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
      },
      postPageLinkFeed__: async function (following, content, pageLink) {
        await share.callNodejs__(
          {
            func: "postMediaFeed",
            params: {
              email: share.user__.email,
              type: share.TypeLink,
              following,
              content,
              pageLink
            }
          }
        );
      },
      postImageFeed__: async function (following, content, images) {
        await share.callNodejs__(
          {
            func: "postMediaFeed",
            params: {
              email: share.user__.email,
              type: share.TypeImage,
              following,
              content,
              images
            }
          }
        );
      },
      postVideoFeed__: async function (following, content, videos) {
        await share.callNodejs__(
          {
            func: "postMediaFeed",
            params: {
              email: share.user__.email,
              type: share.TypeVideo,
              following,
              content,
              images: videos
            }
          }
        );
      },

      toScanQrInImage: function (img) {
        let code = share.scanQrInImage(img);
        share.onQrInImageScanned(code);
      },
      scanQrInImage: function (img) {
        if (parent.parent != window) {
          return parent.parent.mhgl_share.scanQrInImage(img);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        return code;
      },

      onQrInImageScanned: function (code) {
        if (code) {
          let js = null;
          try {
            js = JSON.parse(code.data);
          } catch (e) {

          }

          if (js && js.email && js.name) {
            let buttons = [];
            buttons.push({
              text: share.getString__("follow"),
              onTap: function () {
                share.closePopup__();
                share.toFollow__(js.name, js.email);
              }
            });
            buttons.push({
              text: share.getString__("addFriend"),
              onTap: function () {
                share.closePopup__();
                share.toAddFriend__(js.name, js.email);
              }
            });

            share.popupAction__("", buttons);
          } else if (code.data != null) {
            if (code.data.startsWith("http://") || code.data.startsWith("https://")) {
              let path = code.data;
              share.openLink__(path);
            }
          }
        } else {
          share.toastError__(share.getString__("noQrCode"));
        }
      },
      //deprecated
      newProgressBar__: function (pageIndex, totalPages) {
        let currentPageIndex = pageIndex;
        let c = $(`
        <div class="scrollbar-container">
            <div class="gray arrow-left">
              <span class="glyphicon glyphicon-chevron-left"/>
            </div>
            <div class="scrollbar-track">
                <div class="gray scrollbar-thumb" id="scrollbar-thumb">
                    <span class="glyphicon glyphicon-option-vertical"></span>
                    <div class="temp-page" id="temp-page" style="display: none;"></div>
                </div>
            </div>
            <div class="gray arrow-right">
              <span class="glyphicon glyphicon-chevron-right"/>
            </div>
            <div class="page-info">
                <span class="current-page">${pageIndex}</span> /
                <span class="total-pages">${totalPages}</span>
            </div>
        </div>         
          `);

        c.css("width", (100 + 20 * totalPages) + "px");
        // 创建轨道
        const track = c.find('.scrollbar-track')[0];

        // 创建滑块
        const thumb = c.find('.scrollbar-thumb')[0];

        // 创建临时页码提示
        const tempPage = c.find('.temp-page')[0];

        // 初始化变量
        const currentPage = $('.current-page', c)[0];
        const arrowRight = $(".arrow-right", c)[0];
        const arrowLeft = $(".arrow-left", c)[0];

        // 翻页函数
        const moveToPage = (newPage) => {
          if (newPage < 1 || newPage > totalPages) return; // 超出范围则不翻页
          currentPageIndex = newPage;
          currentPage.textContent = currentPageIndex;

          // 更新滑块位置
          const trackRect = track.getBoundingClientRect();
          const newLeft = ((currentPageIndex - 1) / (totalPages - 1)) * trackRect.width;
          thumb.style.left = `${newLeft}px`;

        };

        arrowRight.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          moveToPage(currentPageIndex + 1); // 向右翻页
        });

        arrowLeft.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          moveToPage(currentPageIndex - 1); // 向左翻页
        });

        let isDragging = false;

        // 计算滑块的初始位置
        const trackRect = track.getBoundingClientRect();
        const initialLeft = ((pageIndex - 1) / (totalPages - 1)) * trackRect.width;
        thumb.style.left = `${initialLeft}px`;

        // 滑块点击事件
        thumb.addEventListener('click', function (e) {
          e.stopPropagation(); // 阻止事件冒泡

        });

        // 滑块拖动逻辑
        thumb.addEventListener('mousedown', function (e) {
          isDragging = true;
          share.debug__("mousedown");
          tempPage.textContent = currentPageIndex;
          tempPage.style.display = 'block'; // 显示临时页码
          share.currentFeedCommentsPager = {
            track,
            arrowLeft,
            arrowRight,
            tempPage,
            thumb,
            currentPage
          }
        });

        $(document).on('mousemove', function (e) {
          if (isDragging) {
            share.debug__("mousemove");
            const trackRect = track.getBoundingClientRect();
            let newLeft = e.clientX - trackRect.left;
            newLeft = Math.max(0, Math.min(newLeft, trackRect.width));
            const percent = newLeft / trackRect.width;
            const page = Math.round(percent * (totalPages - 1)) + 1;

            // 更新临时页码
            tempPage.textContent = page;
            thumb.style.left = `${newLeft}px`;
          }
        });

        $(document).on('mouseup', function () {
          if (isDragging) {
            isDragging = false;
            tempPage.style.display = 'none'; // 隐藏临时页码

            // 更新当前页码
            const trackRect = track.getBoundingClientRect();
            const thumbLeft = parseFloat(thumb.style.left);
            const percent = thumbLeft / trackRect.width;
            const page = Math.round(percent * (totalPages - 1)) + 1;
            currentPage.textContent = page;
            currentPageIndex = page;
          }
        });

        // 轨道点击逻辑
        track.addEventListener('click', function (e) {
          const trackRect = track.getBoundingClientRect();
          let newLeft = e.clientX - trackRect.left;
          newLeft = Math.max(0, Math.min(newLeft, trackRect.width));
          const percent = newLeft / trackRect.width;
          const page = Math.round(percent * (totalPages - 1)) + 1;

          // 更新当前页码和滑块位置
          currentPage.textContent = page;
          thumb.style.left = `${newLeft}px`;
        });

        setTimeout(function () {
          moveToPage(currentPageIndex);
        }, 100);

        return c;
      },
      sendFeed__: function (feed, sendType) {

        share.callNodejs__(
          {
            func: "sendFeed",
            params: {
              email: share.user__.email,
              feed: feed,
              sendType
            }
          }
        );
      },
      sendFeedComment__: async function (cid, sendType) {
        return await share.callNodejs__(
          {
            func: "sendFeedComment",
            params: {
              email: share.user__.email,
              commentId: cid,
              sendType
            }
          }
        );
      },
      encodeFilePath: function (filePath) {
        if (filePath == null) {
          return null;
        }
        if (filePath.toLowerCase().startsWith('http://') || filePath.toLowerCase().startsWith('https://')) {
          return filePath;
        }

        const normalizedPath = filePath.replace(/\\/g, '/');

        const parts = normalizedPath.split('/').map(part => {
          if (!part) return part;

          return encodeURIComponent(part);
        });

        return parts.join('/');
      },
      decodeFilePath: function (filePath) {
        if (filePath.toLowerCase().startsWith('http://') || filePath.toLowerCase().startsWith('https://')) {
          return filePath;
        }

        const parts = filePath.split('/').map(part => {
          if (!part) return part;
          return decodeURIComponent(part);
        });

        return parts.join('/');
      },
      getDataURLFromFile__: async function (file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = function (event) {
            const data = event.target.result;
            resolve({ data });
          };
          reader.onerror = function (error) {
            resolve({ error });
          };
          reader.readAsDataURL(file);
        });
      },
      preloadVideo__: function ($videos) {
        $videos.each(function () {
          let video = $(this);

          video.on('loadedmetadata', function () {
            if (video[0].readyState >= 1) {
              video[0].currentTime = 0.1;
            }
          });

          video.on('error', function () {
            share.debug__('视频加载错误');
          });
        });
      },
      inputPageLink__: async function (succ, fail) {
        var template = $$("#templateLinkPageForm").html();
        var id = share.uuid__();
        var content = template.replace(/#id#/g, id);
        content = content.replace(/#title#/, share.getString__("pageLink"));
        let dialog;
        let c;
        var buttons = [{
          text: share.getString__("confirm"),
          onTap: async function () {
            if ($(".inputLinkContainer", c).hasClass("hide")) {
              var lt = $(".linkTitle", c).html();
              var ld = $(".linkDesc", c).html().trim();
              var url = $(".inputLink", c).val().trim();
              var favicon = $("img", c).attr("src");

              if (url == "") {
                share.toastError__(share.getString__("linkNeeded"));
                return;
              }

              if (ld == "") {
                ld = url;
              }

              var link = {
                type: "LinkPage",
                title: lt,
                desc: ld,
                favicon,
                url,
              };

              succ(link, dialog)
            } else if ($(".inputTitleContainer", c).hasClass("hide")) {
              var url = $(".inputLink").val().trim();
              if (url == "") {
                share.toastError__(share.getString__("linkNeeded"));
                return;
              }

              let res = await share.getPageInfo__(url);
              if (res.error) {
                share.toastError__(res.error);
              }
              $(".linkTitle", c).html(res.title);
              $(".linkDesc", c).html(res.description);
              let favicon = res.favicon;
              $("img", c).attr("src", favicon);
              $(".pageLink", c).removeClass("hide");
              $(".inputLinkContainer", c).addClass("hide");
              dialog.update();
            } else {
              let url = $(".inputLink", c).val().trim();
              let title = c.find(".inputTitle").val().trim();
              let description = c.find(".inputDesc").val().trim();
              $(".linkTitle", c).html(title);
              if (description == "") {
                description = url;
              }
              $(".linkDesc", c).html(description);
              $(".inputTitleContainer", c).addClass("hide");
              $(".inputDescContainer", c).addClass("hide");
              $(".inputLinkContainer", c).addClass("hide");
              $(".pageLink", c).removeClass("hide");
              dialog.update();
            }
          }
        }, {
          text: share.getString__("cancel"),
          onTap: function () {
            dialog && dialog.close();
          }
        }
        ];
        dialog = await share.popupAction__(content, buttons);
        c = $(`#${dialog.id}`)
        share.onClick__(c.find(".pageLink"), function () {
          c.find(".inputLinkContainer").removeClass("hide");
          c.find(".inputTitleContainer").removeClass("hide");
          c.find(".inputDescContainer").removeClass("hide");
          c.find(".pageLink").addClass("hide");

          c.find(".inputTitle").val(c.find(".linkTitle").html())
          c.find(".inputDesc").val(c.find(".linkDesc").html())
          dialog.update();
        });
      },
      showVideoFullScreen__: function (src) {
        const modal = $$("#fullscreenModal");
        const modalVideo = $$(".feedVideo");
        modalVideo.attr('src', src);
        modal.removeClass("hide");
        modalVideo.removeClass("hide");
        modalVideo[0].play();
      },
      showImageFullScreen__: function (src) {
        $$("#imageFullScreen").attr("src", src);
        $$("#imageFullScreenContainer").removeClass("hide");
      },
      getPageInfo__: async function (url) {
        let r = await share.callNodejs__(
          {
            func: "getPageInfo",
            params: {
              url: url
            }
          }
        )

        return r;
      },
      toCreatePageLinkFeed__: async function (following, succ) {
        await share.closePopup__();
        share.inputPageLink__(async function (link, dialog) {
          let content = "";
          let feed = await share.postPageLinkFeed__(following, content, link);
          dialog.close();
          succ && succ(feed);
        })
      },
      toCreateImageFeed__: async function (following, succ) {
        await share.closePopup__();
        let html = $$("#templateCreateImageFeed").html();
        let popup;
        let maxImages = 3;
        let totalSize = 0;
        let onShown = function (popupId) {
          let container = $(`#${popupId}`);
          let addBtn = $(".add-media-button", container);
          let fileInput = $("#fileInput", container);
          const mediaGrid = $(".mediaGrid", container);
          async function addImage(file) {
            let src = "./img/loading5.gif";
            const imageItem = $('<div class="image-item center">');
            const img = $('<img>').attr('src', src);
            const closeButton = $('<div class="close-button">×</div>');

            closeButton.on('click', function () {
              imageItem.remove();
              if ($(".mediaGrid", container).children('.image-item').length < maxImages) {
                $(".add-media-button", container).show();
              }

              let size = imageItem.find('img').attr('size');
              totalSize -= size;
              popup.update();
            });

            img.on('click', function () {
              share.showImageFullScreen__(src);
            });

            imageItem.append(img);
            imageItem.append(closeButton);
            addBtn.before(imageItem);

            if (mediaGrid.children('.image-item').length >= maxImages) {
              $(".add-media-button", container).hide();
            }

            popup.update();
            let result = await share.getFilePath(file);
            if (result.error) {
              share.toastError__(result.error);
            } else {
              src = share.encodeFilePath(result.path);
            }
            img.attr('src', src);
            img.attr('size', file.size);
            totalSize += file.size;
            if (totalSize > share.maxMailAttachmentSizeInM * 1024 * 1024) {
              share.toastWarning__(share.getString__("exceededAttachmentSize"));
            }
          }

          addBtn.on('click', async function () {
            let linkHtml = $$("#templateLinkOrFile").html();

            let lp = await share.popup__(addBtn[0], linkHtml, "bottom");

            let lpe = $(`#${lp.id}`);
            lpe.find(".btnLoadFile").on('click', function () {
              lp.close();
              fileInput.click();
            });
            lpe.find(".buttonConfirm").on('click', async function () {
              let link = lpe.find(".weblinkInput").val();
              if (link.trim() == "") {
                share.toastError__(share.getString__("webLinkRequired"));
              } else {
                await lp.close();
                addImage({ path: link, size: 0 });
              }
            });
          });
          fileInput.on('click', function (event) {
            event.target.value = "";
          });
          // 图片上传预览
          fileInput.on('change', async function (event) {
            const files = event.target.files;
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              addImage(file);
            }

          });

          // 发布按钮点击事件
          share.onClick__($(".postButton", container), async function () {
            const content = $("#content", container).val();
            let imgs = $(".mediaGrid .image-item", container);
            if (content.trim() === '' && imgs.length === 0) {
              share.toastError__(share.getString__("contentOrImage"));
              return;
            }

            let exceeded = await share.exceededAttachmentSize(totalSize);
            if (exceeded) {
              return;
            }

            let medias = [];
            imgs.each(function () {
              const imgSrc = $(this).find('img').attr('src');
              medias.push({ type: share.TypeImage, path: share.decodeFilePath(imgSrc) });
            });

            let feed = await share.postImageFeed__(following, content, medias);

            popup.close();
            succ && succ(feed);
          });
        }

        popup = await share.popup__(null, html, "bottom", onShown);
      },
      getFilePath: async function (file) {
        if (file.path) {
          return file;
        }

        const stream = file.stream(); // 获取ReadableStream
        const reader = stream.getReader();
        let res = {};
        let fileName = `${file.size}.${file.name}`;
        try {
          let append = 0;
          while (true) {
            const { done, value } = await reader.read(); // value是Uint8Array类型的chunk
            if (value && value.length > 0) {
              let r = await share.callNodejs__(
                {
                  func: "saveFile",
                  params: {
                    data: Array.from(value),
                    fileName,
                    append
                  }
                }
              )
              append = 1;
              if (r.error) {
                return r;
              }
            }

            if (done) {
              let r = await share.callNodejs__(
                {
                  func: "saveFile",
                  params: {
                    fileName
                  }
                }
              )

              return r;
            }
          }
        } finally {
          reader.releaseLock(); // 释放锁
        }
      },
      toCreateVideoFeed__: async function (following, succ) {
        share.closePopup__();
        let html = $$("#templateCreateVideoFeed").html();
        let popup;
        let maxVideos = 1;
        let totalSize = 0;
        let onShown = function (popupId) {
          let container = $(`#${popupId}`);
          let addBtn = $(".add-media-button", container);
          let fileInput = $("#fileInput", container);
          const mediaGrid = $(".mediaGrid", container);

          async function addVideo(file) {
            let src = "./img/loading5.gif";
            const img = $('<img>').attr('src', src);
            img.css({
              width: "auto",
              height: "auto"
            });

            const mediaItem = $('<div class="video-item">');
            const closeButton = $('<div class="close-button">×</div>');

            closeButton.on('click', function () {
              mediaItem.remove();
              if ($(".mediaGrid", container).children('.video-item').length < maxVideos) {
                $(".add-media-button", container).show();
              }

              let size = imageItem.find('video').attr('size');
              totalSize -= size;

              popup.update();
            });

            mediaItem.append(img);
            mediaItem.append(closeButton);
            addBtn.before(mediaItem);
            if (mediaGrid.children('.video-item').length >= maxVideos) {
              $(".add-media-button", container).hide();
            }

            popup.update();

            let result = await share.getFilePath(file);
            if (result.error) {
              share.toastError__(result.error);
            } else {
              src = share.encodeFilePath(result.path);
            }
            img.remove();

            const media = $('<video>').attr('src', src);
            media.attr('size', file.size);
            totalSize += file.size;
            if (totalSize > share.maxMailAttachmentSizeInM * 1024 * 1024) {
              share.toastWarning__(share.getString__("exceededAttachmentSize"));
            }

            media.on('click', function () {
              share.showVideoFullScreen__(src);
            });

            mediaItem.append(media);
            popup.update();
            share.preloadVideo__(media);
          }


          addBtn.on('click', async function () {
            let linkHtml = $$("#templateLinkOrFile").html();

            let lp = await share.popup__(addBtn[0], linkHtml, "bottom");

            let lpe = $(`#${lp.id}`);
            lpe.find(".btnLoadFile").on('click', function () {
              lp.close();
              fileInput.click();
            });
            lpe.find(".buttonConfirm").on('click', async function () {
              let link = lpe.find(".weblinkInput").val();
              if (link.trim() == "") {
                share.toastError__(share.getString__("webLinkRequired"));
              } else {
                await lp.close();
                addVideo({ path: link, size: 0 });
              }
            });
          });


          fileInput.on('click', function (event) {
            event.target.value = "";
          });

          fileInput.on('change', async function (event) {
            const files = event.target.files;
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              addVideo(file);
            }
          });

          // 发布按钮点击事件
          share.onClick__($(".postButton", container), async function () {
            const content = $("#content", container).val();
            let videos = $(".mediaGrid .video-item", container);
            if (content.trim() === '' && videos.length === 0) {
              share.toastError__(share.getString__("contentOrVideo"));
              return;
            }

            let exceeded = await share.exceededAttachmentSize(totalSize);
            if (exceeded) {
              return;
            }

            let medias = [];
            videos.each(function () {
              const src = $(this).find('video').attr('src');
              medias.push({ type: share.TypeVideo, path: share.decodeFilePath(src) });
            });

            let feed = await share.postVideoFeed__(following, content, medias);

            popup.close();
            succ && succ(feed);
          });
        }

        popup = await share.popup__(null, html, "bottom", onShown);
      },

      getTags__: async function (type) {
        return await share.callNodejs__(
          {
            func: "getTags",
            params: {
              email: share.user__.email,
              type
            }
          }
        );
      },

      getFollowerTags__: async function (follower) {
        return await share.callNodejs__(
          {
            func: "getFollowerTags",
            params: {
              email: follower.email,
              type: "follower",
              tagged: follower.femail
            }
          }
        );
      },

      toCreateArticleFeed__: function () {
        share.closePopup__();

      },
      deleteFeed__: async function (opt) {
        return await share.callNodejs__(
          {
            func: "deleteFeed",
            params: opt
          }
        );
      },
      toCreateFeed__: async function (following, succ) {
        let buttons = [];
        buttons.push({
          text: share.getString__("imageFeed"),
          onTap: function () {
            share.toCreateImageFeed__(following, succ);
          }
        });
        buttons.push({
          text: share.getString__("videoFeed"),
          onTap: function () {
            share.toCreateVideoFeed__(following, succ);
          }
        });
        buttons.push({
          text: share.getString__("pageLink"),
          onTap: function () {
            share.toCreatePageLinkFeed__(following, succ);
          }
        });
        /*
        buttons.push({
          text: share.getString__("storyFeed"),
          onTap: function () {
            share.toCreateArticleFeed__(succ);
          }
        });
        */

        share.popupAction__(share.getString__("newFeed"), buttons);
      },
      getNewFeedNotification__: function (succ) {
        share.callNodejs__(
          {
            func: "getNewFeedNotification",
            params: {
              email: share.user__.email,
              lastListFeedCommentTime: share.user__.lastListFeedCommentTime
            }
          },
          succ,
          null
        );
      },
      toAddMember__: function (roomId) {
        share.open__(`./group.add.htm?id=${roomId}`);
      },
      toAddGroup__: function () {
        share.open__("./group.add.htm");
      },
      toCreateMailFolder__: async function (succ, fail) {
        var title = share.getString__("newMailBox");
        var message = $$("#templateCreateMailFolder").html();
        message = message.replace(/#nameId#/g, 'nameId');
        message = message.replace(/#buttonSubmitId#/g, 'buttonAdd');
        message = message.replace(/\n/g, '');

        share.dialog__ = await share.popup__(null, message, "bottom");
        var account = share.user__;
        var onSubmit = function () {
          var name = $("#nameId").val().trim();
          if (name == "") {
            share.toastError__(share.getString__("mailBoxNameCanNotBeEmpty"));
            return;
          }

          share.callNodejs__(
            {
              func: "createMailFolder",
              params: { name: name, email: account.email }
            },
            function (res) {
              share.closeDialog__();
              succ && succ(res);
            },
            fail ? fail : share.toastError__
          );
        };

        share.onClick__($("#buttonAdd"), onSubmit);
      },
      getRoomByEmail__: function (options, succ, fail) {

        var account = share.user__;
        options.email = account.email;

        share.callNodejs__(
          {
            func: "getRoom",
            params: options
          },
          succ,
          fail
        );
      },
      toDeleteMember__: async function (room, member) {
        let msg = share.getString__("deleteMemberGuide", member.name);
        let confirmed = await share.isConfirmed__(msg);
        if (confirmed) {
          let chat = {
            type: share.TypeJson,
            data: {
              type: "deleteMember",
              members: [member]
            }
          };

          let res = await share.savedOwnMessage__(room, chat);
          if (res.error) {
            share.toastError__(res.error);
          } else {
            var target = share.getOpenTarget__(640, "rightFrame");
            share.open__("message.list.htm?id=" + room.id, target);
          }
        }
      },

      confirm__: function (message, callback, okLabel, cancelLabel) {
        let result = false;
        var dialog = BootstrapDialog.confirm({
          type: BootstrapDialog.TYPE_PRIMARY,
          title: share.getString__("confirm"),
          message: message,
          closable: true,
          draggable: true,
          btnCancelLabel: cancelLabel ? cancelLabel : BootstrapDialog.DEFAULT_TEXTS.CANCEL,
          btnCancelClass: null,
          btnCancelHotkey: null,
          btnOKLabel: okLabel ? okLabel : BootstrapDialog.DEFAULT_TEXTS.OK,
          btnOKClass: null,
          btnOKHotkey: null,
          onhide: function () {
            callback && callback(result);
          },
          btnsOrder: BootstrapDialog.defaultOptions.btnsOrder,
          callback: function (confirmed) {
            result = confirmed;
            dialog.close();
          }
        });

        return dialog;
      },

      confirmed__: function (message, callback, okLabel, cancelLabel) {
        let result = false;
        var dialog = BootstrapDialog.confirm({
          type: BootstrapDialog.TYPE_PRIMARY,
          title: share.getString__("confirm"),
          message: message,
          closable: true,
          draggable: true,
          btnCancelLabel: cancelLabel ? cancelLabel : BootstrapDialog.DEFAULT_TEXTS.CANCEL,
          btnCancelClass: null,
          btnCancelHotkey: null,
          btnOKLabel: okLabel ? okLabel : BootstrapDialog.DEFAULT_TEXTS.OK,
          btnOKClass: null,
          btnOKHotkey: null,
          onhide: function () {
            result && callback && callback();
          },
          btnsOrder: BootstrapDialog.defaultOptions.btnsOrder,
          callback: function (confirmed) {
            result = confirmed;
            dialog.close();
          }
        });

        return dialog;
      },
      isConfirmed__: async function (message, okLabel, cancelLabel) {
        return new Promise((resolve, reject) => {
          let result = false;
          var dialog = BootstrapDialog.confirm({
            type: BootstrapDialog.TYPE_PRIMARY,
            title: share.getString__("confirm"),
            message: message,
            closable: true,
            draggable: true,
            btnCancelLabel: cancelLabel ? cancelLabel : BootstrapDialog.DEFAULT_TEXTS.CANCEL,
            btnCancelClass: null,
            btnCancelHotkey: null,
            btnOKLabel: okLabel ? okLabel : BootstrapDialog.DEFAULT_TEXTS.OK,
            btnOKClass: null,
            btnOKHotkey: null,
            onhide: null,
            btnsOrder: BootstrapDialog.defaultOptions.btnsOrder,
            callback: function (confirmed) {
              dialog.close();
              resolve(confirmed);
            }
          });
        });
      },

      confirmOk__: function (message, okFunc) {
        var dialog = BootstrapDialog.confirm({
          type: BootstrapDialog.TYPE_PRIMARY,
          title: share.getString__("confirm"),
          message: message,
          closable: false,
          draggable: false,
          btnCancelLabel: BootstrapDialog.DEFAULT_TEXTS.CANCEL,
          btnCancelClass: null,
          btnCancelHotkey: null,
          btnOKLabel: BootstrapDialog.DEFAULT_TEXTS.OK,
          btnOKClass: null,
          btnOKHotkey: null,
          btnsOrder: BootstrapDialog.defaultOptions.btnsOrder,
          callback: function (ok) { if (ok) { okFunc && okFunc() } }
        });

        return dialog;
      },
      canScan__: function () {
        return jQuery.browser.mobile || jQuery.browser.iPad;
      },
      isFromDevice__: function () {
        return jQuery.browser.mobile || jQuery.browser.iPad;
      },
      scan__: function (successFunc, errorFunc, options) {
        if (share.isFromWechatBrowser__()) {
          var index = options.inputs.length == 1 ? 0 : options.start;
          var variable = options.inputs[index]["var"];
          var result = {};
          result[variable] = "http://www.bing.com";

          wx.scanQRCode({
            needResult: 1, // 默认为0，扫描结果由微信处理，1则直接返回扫描结果，
            scanType: ["qrCode", "barCode"], // 可以指定扫二维码还是一维码，默认二者都有
            success: function (res) {
              result[variable] = res.resultStr; // 当needResult 为 1 时，扫码返回的结果
              successFunc(result);
            }
          });
        } else if (share.needCordova__() && share.canScan__()) {
          options = $.extend(share.defaultScanOptions__, options);
          cordova.plugins.barcodeScanner.scan(successFunc, errorFunc, options);
        } else {
          successFunc({
            barcode: "http://www.baidu.com/"
          });
        }
      },
      getString__: function (key, ...args) {
        let value = null;
        if (share.string) {
          value = share.string[key];
        }
        if (value) {
          if (typeof value === "function") {
            return value(...args);
          } else {
            return value;
          }
        } else {
          let defaultVal = window.AllinEmail == null ? null : window.AllinEmail.string.en[key];

          return defaultVal ? defaultVal : key;
        }
      },
      isObject__: function (obj) {
        return obj !== null && typeof obj === 'object';
      },
      timeFormat__: function (time, fmt) {
        if (time == null) {
          return "";
        }
        if (time.time) {
          time = new Date(time.time);
        } else {
          time = new Date(time);
        }
        if (fmt == null) {
          var ms = time.getTime();
          var now = new Date();
          now.setHours(0);
          now.setMinutes(0);
          now.setSeconds(0);
          if (time.getTime() > now.getTime()) {
            fmt = "hh:mm";
          } else if (now.getYear() == time.getYear()) {
            fmt = "MM-dd";
          } else {
            fmt = "yyyy-MM";
          }
        }
        var qua = Math.floor((time.getMonth() + 3) / 3);
        var o = {
          "M+": time.getMonth() + 1, // 月份
          "d+": time.getDate(), // 日
          "h+": time.getHours(), // 小时
          "m+": time.getMinutes(), // 分
          "s+": time.getSeconds(), // 秒
          "q+": qua, // 季度
          S: time.getMilliseconds()
          // 毫秒
        };
        if (/(y+)/.test(fmt))
          fmt = fmt.replace(
            RegExp.$1,
            (time.getYear() + 1900 + "").substr(4 - RegExp.$1.length)
          );
        for (var k in o)
          if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(
              RegExp.$1,
              RegExp.$1.length == 1
                ? o[k]
                : ("00" + o[k]).substr(("" + o[k]).length)
            );
        return fmt;
      },
      getTime__: function (time, fmt) {
        if (time == null) {
          time = new Date();
        }
        if (time.time) {
          time = new Date(time.time);
        } else {
          time = new Date(time);
        }
        if (fmt == null) {
          var ms = time.getTime();
          var now = new Date();
          now.setHours(0);
          now.setMinutes(0);
          now.setSeconds(0);
          if (time.getTime() > now.getTime()) {
            fmt = "hh:mm";
          } else if (now.getYear() == time.getYear()) {
            fmt = "MM-dd hh:mm";
          } else {
            fmt = "yyyy-MM-dd hh:mm";
          }
        }
        var qua = Math.floor((time.getMonth() + 3) / 3);
        var o = {
          "M+": time.getMonth() + 1, // 月份
          "d+": time.getDate(), // 日
          "h+": time.getHours(), // 小时
          "m+": time.getMinutes(), // 分
          "s+": time.getSeconds(), // 秒
          "q+": qua, // 季度
          S: time.getMilliseconds()
          // 毫秒
        };
        if (/(y+)/.test(fmt))
          fmt = fmt.replace(
            RegExp.$1,
            (time.getYear() + 1900 + "").substr(4 - RegExp.$1.length)
          );
        for (var k in o)
          if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(
              RegExp.$1,
              RegExp.$1.length == 1
                ? o[k]
                : ("00" + o[k]).substr(("" + o[k]).length)
            );
        return fmt;
      },
      hasSafeArea__: function () {
        const hasSafeArea = window.getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-top');

        return hasSafeArea;
      },
      needCordova__: function () {
        let href = document.location.href;
        share.debug__("current page:" + href);
        if (href.lastIndexOf("file://", 0) === 0 || href.lastIndexOf("app://", 0) === 0) {
          return true;
        }
        let pos = href.indexOf("://local.labadida.com/", 0);
        if (pos >= 4 && pos <= 5) {
          return true;
        }

        return false;
      },

      loadCordova__: function () {
        if (!share.needCordova__()) {
          return;
        }
        if (jQuery.browser.mobile || jQuery.browser.iPad) {
          var jsUrl = "../../cordova.js";
          if (document.location.href.lastIndexOf("http", 0) === 0) {
            jsUrl = "./vendor/cordova/cordova.js";
          }

          share.debug__("loading cordova:" + jsUrl);
          document.addEventListener("deviceready", share.onDeviceReady__, false);
          share.loadJs__("cordova", jsUrl, share.onCordovaLoaded__);
        }
      },
      onCordovaLoaded__: function () {
        share.debug__("on cordova loaded");
      },

      updateFriend__: function (comment, friend, succ, fail) {
        share.callNodejs__(
          {
            func: "updateFriend",
            params: { comment: comment, friend: friend }
          },
          succ,
          fail
        );
      },

      updateFollowing__: function (comment, friend, succ, fail) {
        share.callNodejs__(
          {
            func: "updateFollowing",
            params: { comment: comment, friend: friend }
          },
          succ,
          fail
        );
      },

      updateGroup__: function (field, value, group, succ, fail) {
        share.callNodejs__(
          {
            func: "updateGroup",
            params: { field: field, value: value, group: group }
          },
          succ,
          fail
        );
      },

      updateGroupMember__: function (member, succ, fail) {
        share.callNodejs__(
          {
            func: "updateGroupMember",
            params: { member: member }
          },
          succ,
          fail
        );
      },
      deviceReadyFunc__: [],
      onDeviceReady__: function () {
        share.debug__("on device ready start");


        //share.initBackgroundMode__();
        var funcs = share.deviceReadyFunc__;
        share.deviceReadyFunc__ = null;
        for (var i = 0; i < funcs.length; ++i) {
          funcs[i]();
        }

        share.debug__("on device ready end");
      },
      initBackgroundMode__: function () {
        share.debug__("initBackgroundMode");
        var bgm = cordova.plugins.backgroundMode;
        if (bgm && bgm.inited != 1) {
          bgm.inited = 1;
          bgm.setDefaults({
            title: "Reminder",
            text: share.getString__("inBackground"),
            //icon: 'icon' // this will look for icon.png in platforms/android/res/drawable|mipmap
            //color: String // hex format like 'F14F4D'
            resume: true,
            hidden: false,
            silent: false,
            bigText: "big text"
          });
          bgm.on("activate", function () {
            bgm.disableWebViewOptimizations();
          });

          bgm.enable();
          share.debug__("bgm enabled");
          //bgm.overrideBackButton();
          bgm.isActive(function (bool) {
            share.debug__("screen off");
            //bgm.unlock();
          });
        }
      },
      getGroupSelected__: function () {
        var c = share.getCache__("groupSelected");
        if (c != null) {
          return JSON.parse(c);
        }

        return null;
      },
      isInFrame__: function () {
        try {
          return window.self !== window.top;
        } catch (e) {
          return true;
        }
      },
      getCurrentShow__: function (classId, showId, success) {
        var item = share.getSelectedItem__();
        if (item != null) {
          success && success(item);
          return;
        }

        if (classId != null && showId != null) {
          share.getShow__(classId, showId, function (json) {
            share.setSelectedItem__(json);
            success && success(json);
          });
        }

        return null;
      },
      setSelectedItem__: function (item, key) {
        if (parent && share.isInFrame__()) {
          parent.mhgl_share.setSelectedItem__(item, key);
          return;
        }

        if (key == null) {
          key = "selectedItem";
        }

        if (item == null) {
          if (key == "selectedItem") {
            share.selectedItem__ = null;
          }
          share.removeCache__(key);
        } else {
          if (key == "selectedItem") {
            share.selectedItem__ = item;
          }
          share.setCache__(key, JSON.stringify(item));
        }
      },

      isImage__: function (fileName) {
        var exts = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'tiff'];
        return share.withinExt__(fileName, exts);
      },

      isVideo__: function (fileName) {
        var exts = ["avi", "wmv", "mpg", "mpeg", "mp4", "webm", "mov"];
        return share.withinExt__(fileName, exts);
      },

      isAudio__: function (fileName) {
        var exts = ["mp3", "wma", "wav", "ogg"];
        return share.withinExt__(fileName, exts);
      },

      withinExt__: function (fileName, exts) {
        var lf = fileName.toLowerCase();
        var pos = lf.lastIndexOf(".");
        var ext = lf.substr(pos + 1);
        for (var str of exts) {
          if (ext == str) {
            return true;
          }
        }

        return false;
      },

      getSelectedItem__: function (key) {
        if (share.isInFrame__()) {
          return parent.mhgl_share.getSelectedItem__(key);
        }

        if (key == null) {
          key = "selectedItem";

          if (share.selectedItem__ != null) {
            return share.selectedItem__;
          }
        }

        var c = share.getCache__(key);
        if (c != null) {
          return JSON.parse(c);
        }

        return null;
      },

      setCurrentNotification__: function (item) {
        if (share.isInFrame__()) {
          parent.mhgl_share.setCurrentNotification__(item);
          return;
        }

        share.currentNotification__ = item;
        share.setSelectedItem__(item);
      },

      getCurrentNotification__: function () {
        if (share.isInFrame__()) {
          return parent.mhgl_share.getCurrentNotification__();
        }

        if (share.currentNotification__ == null) {
          share.currentNotification__ = share.getSelectedItem__();
        }

        return share.currentNotification__;
      },

      setCurrentCheckIn__: function (item) {
        if (share.isInFrame__()) {
          parent.mhgl_share.setCurrentCheckIn__(item);
          return;
        }

        share.currentCheckIn__ = item;
        share.setSelectedItem__(item);
      },

      getCurrentCheckIn__: function () {
        if (share.isInFrame__()) {
          return parent.mhgl_share.getCurrentCheckIn__();
        }
        if (share.currentCheckIn__ == null) {
          share.currentCheckIn__ = share.getSelectedItem__();
        }

        return share.currentCheckIn__;
      },

      removeCache__: function (key) {
        delete parent.mhgl_share.cache__[key];

        try {
          store.set(key, null);
        } catch (e) {

        }
      },

      setCurrentClass__: function (item) {
        if (share.isInFrame__()) {
          parent.mhgl_share.setCurrentClass__(item);
          return;
        }

        share.removeCache__("CurrentClass");
        if (item == null) {
          share.currentClass__ = null;
        } else {
          share.currentClass__ = item;
          if (!share.useFrame__()) {
            var json = JSON.stringify(item);
            var ci = JSON.parse(json);
            ci.notifications = null;
            ci.qas = null;
            ci.members = null;
            json = JSON.stringify(ci);
            share.setCache__("CurrentClass", json);
          }
        }
      },
      getNewFriend__: function (succ, fail) {
        var p = {
          email: share.user__.email
        };

        var succ = function (count) {
          parent.parent.mhgl_container.onNewFriends__(count);
        };
        share.callNodejs__(
          {
            func: "getNewFriend",
            params: p
          },
          succ
        );
      },

      getClass__: function (classId, success, fail, notHandleCodes) {
        var url = share.getBaseUrl__() + "/mvc/fe/class";
        var params = {
          classId: classId
        };

        share.httpGet__(url, params, success, fail, null, null, notHandleCodes);
      },

      getShow__: function (classId, showId, success, fail) {
        var url = share.getBaseUrl__() + "/mvc/fe/show/detail";
        var params = {
          classId: classId,
          id: showId
        };

        share.httpGet__(url, params, success, fail);
      },

      setGroupSelected__: function (item) {
        if (item == null) {
          share.setCache__("groupSelected", null);
        } else {
          share.setCache__("groupSelected", JSON.stringify(item));
        }
      },

      needOpenInParent__: function (url) {
        if (url.indexOf("charge.htm") > 0) {
          return true;
        }

        return false;
      },
      getOpenTarget__: function (width, target) {
        var res = "_self";
        var win = parent.window;
        var doc = parent.document;
        var ww = win.innerWidth || doc.documentElement.clientWidth || doc.body.clientWidth;
        if (ww > width) {
          res = target;
        }

        return res;
      },

      isWideScreen__: function () {
        var win = parent.window;
        var doc = parent.document;
        var ww = win.innerWidth || doc.documentElement.clientWidth || doc.body.clientWidth;
        if (ww > 640) {
          return true;
        }

        return false;
      },

      initProxy__: function (succ, fail) {
        if (!parent.parent.mhgl_share.wsConnected && share.accounts__ && share.accounts__.proxy) {
          share.proxyOn__(succ, fail);
        }
      },

      wsPing__: function () {
        share.callNodejs__(
          {
            func: "wsPing",
            params: {
            }
          }
        );
      },

      proxyOn__: function (succ, fail) {
        if (share.accounts__.proxy) {
          var s = async function (res) {
            share.accounts__.proxy.on = 1;
            await share.saveAccountToDb__();
            share.selectProxy__(share.accounts__.proxy.name);
            succ && succ(res);
          }
          var f = function (err) {
            fail && fail(err);
          }
          share.wsConnect__(
            {
              url: share.accounts__.proxy.url,
              email: share.user__.email
            }, s, f);
        } else {
          share.toProxy__();
        }
      },

      proxyOff__: function (succ, fail) {
        var dialog = share.toastWaiting__(share.getString__("proxyOff"));
        var s = function (res) {
          dialog.close();
          succ && succ(res);
        }
        var f = function (err) {
          dialog.close();
          fail && fail(err);
        }

        share.wsClose__({}, s, f);
      },

      addProxy__: function (name, url, succ, fail) {
        share.callNodejs__(
          {
            func: "addProxy",
            params: {
              name: name,
              url: url
            }
          },
          succ,
          fail
        );
      },
      selectProxy__: function (name, succ, fail) {
        share.callNodejs__(
          {
            func: "selectProxy",
            params: {
              name: name
            }
          },
          succ,
          fail
        );
      },
      deleteProxy__: function (name, succ, fail) {
        share.callNodejs__(
          {
            func: "deleteProxy",
            params: {
              name: name
            }
          },
          succ,
          fail
        );
      },
      openLink__: function (path) {
        let text = share.getString__("toOpenLinkWithBrowser", path);
        share.confirmOk__(text, function () {
          if (parent.parent.electron) {
            var shell = parent.parent.electron.shell;
            if (shell.openExternal != null) {
              shell.openExternal(path);
            } else if (shell.openItem != null) {
              shell.openItem(path);
            } else {
              shell.openPath(path);
            }

          } else if (parent.parent.cordova.InAppBrowser) {
            parent.cordova.InAppBrowser.open(path, "_system");
          }
        });

      },
      open__: function (url, target, options) {
        var win;
        if (!target) {
          target = "_self";
        }

        if (
          share.needCordova__() &&
          window.cordova != null &&
          window.cordova.InAppBrowser != null
        ) {
          share.debug__("open " + url + " in appBrowser");
          win = cordova.InAppBrowser.open(url, target, options);
        } else if (share.isInFrame__()) {
          if (url.indexOf("http") == 0) {
            if (
              url.indexOf(share.getBaseUrl__()) < 0 ||
              share.needOpenInParent__(url)
            ) {
              win = parent.open(url, target);
            } else {
              win = window.open(url, target);
            }
          } else {
            let open = function (win, url) {
              win.location = url;
            }
            if (target == "_self") {
              open(window, url);
            } else if (target == "_parent") {
              open(parent.window, url);
            } else {
              var iFrame = document.getElementById(target);
              if (iFrame == null) {
                open(window, url);
              } else {
                open(iFrame.contentWindow, url);
              }
            }
            //
          }
        } else {
          win = window.open(url, target);
          //document.location.href = url;
        }

        return win;
      },
      saveDraft__: async function (draft) {
        await share.callNodejs__(
          {
            func: "saveDraft",
            params: {
              draft: draft
            }
          }
        );
      },
      getDraft__: async function (id, succ, fail) {
        return await share.callNodejs__(
          {
            func: "getDraft",
            params: {
              id: id
            }
          },
          succ,
          fail ? fail : share.toastError__
        );
      },
      getParameter__: function (name) {
        var search = document.location.search;
        var pattern = new RegExp("[?&]" + name + "=([^&]+)", "g");
        var matcher = pattern.exec(search);
        var items = null;
        if (null != matcher) {
          try {
            items = decodeURIComponent(decodeURIComponent(matcher[1]));
          } catch (e) {
            try {
              items = decodeURIComponent(matcher[1]);
            } catch (e) {
              items = matcher[1];
            }
          }
        }
        return items;
      },
      getStackTrace__: function () {
        var callstack = [];
        var isCallstackPopulated = false;
        var i = null;
        try {
          i.dont.exist += 0; // doesn't exist
        } catch (e) {
          if (e.stack) {
            // Firefox
            var lines1 = e.stack.split("\n");
            for (i = 0, len = lines1.length; i < len; i++) {
              var fmt = lines1[i];
              if (
                /at .*\.(\w+) \(.*\/([^\/]+\.js.*)\)/.test(fmt) ||
                /(\w+)@.*\/([^\/]+\.js.*)/.test(fmt)
              ) {
                // fmt = fmt.replace(RegExp.$1, ((time.year + 1900) + "").substr(4
                // - RegExp.$1.length));
                fmt = RegExp.$1 + " at " + RegExp.$2;
                callstack.push(fmt);
              }
            }
            // Remove call to printStackTrace()
            callstack.shift();
            isCallstackPopulated = true;
          } else if (window.opera && e.message) {
            // Opera
            var lines = e.message.split("\n");
            for (i = 0, len = lines.length; i < len; i++) {
              if (lines[i].match(/^\s*[A-Za-z0-9\-_\$]+\(/)) {
                var entry = lines[i];
                // Append next line also since it has the file info
                if (lines[i + 1]) {
                  entry += " at " + lines[i + 1];
                  i++;
                }
                callstack.push(entry);
              }
            }
            // Remove call to printStackTrace()
            callstack.shift();
            isCallstackPopulated = true;
          }
        }
        if (!isCallstackPopulated) {
          // IE and Safari
          var currentFunction = arguments.callee.caller;
          while (currentFunction) {
            var fn = currentFunction.toString();
            var fname =
              fn.substring(fn.indexOf("function") + 8, fn.indexOf("")) ||
              "anonymous";
            callstack.push(fname);
            currentFunction = currentFunction.caller;
          }
        }

        return callstack;
      },
      formatNumber__: function (num, size) {
        if (size == null) {
          size = 3;
        }
        return num.toString().padStart(size, '0');
      },
      getSelf: function () {
        if (share.isInFrame__()) {
          return parent.mhgl_share;
        }

        return share;
      },
      getBaseUrl__: function () {
        var url = window.location.href;
        var strArray = url.split("/fe/");
        url = strArray[0];
        return url;
      },
      needContainer__: function () {
        var name = store.storage.name;
        if (name == "cookieStorage" || name == "memoryStorage") {
          return true;
        }
        return false;
      },
      getCache__: function (key, value, options) {
        //return store.get(share.packageName + key, value);
        if (share.isInFrame__()) {
          return parent.mhgl_share.getCache__(key, value, options);
        }

        var val = share.cache__[key];

        if (val == null) {
          val = store.get(key);
        }

        if (val == null) {
          val = value;
        }

        return val;
      },
      encodeTag__: function (tag) {
        var res = tag.replace(/&/g, "&amp;");
        res = res.replace(/</g, "&lt;");
        res = res.replace(/>/g, "&gt;");

        return res;
      },
      detectLink__: function (text) {
        //自动识别文本text里的链接并加上<a>标签
        var res = text.replace(/(https?:\/\/[^\s]+)/g, function (match, p1) {
          return '<a href="' + p1 + '" target="_blank">' + p1 + "</a>";
        });

        return res;
      },
      getTextWithOnlyLink__: function (text) {
        return share.detectLink__(share.encodeTag__(text));
      },
      getMailAddress__: function (arr) {
        var res = "";
        if (arr == null || arr == "") {
          return res;
        }
        arr = JSON.parse(arr);
        for (var i = 0; i < arr.length; ++i) {
          if (i > 0) {
            res += ";";
          }
          if (arr[i].name == null || arr[i].name == "") {
            res += arr[i].address;
          } else {
            res += '"' + arr[i].name + '"<' + arr[i].address + '>';
          }
        }

        return res;
      },
      getMailAddressEncoded__: function (arr) {
        return share.encodeTag__(share.getMailAddress__(arr));
      },
      setCache__: function (key, value, options) {
        if (share.isInFrame__()) {
          return parent.mhgl_share.setCache__(key, value);
        }

        if (typeof value != "string") {
          value = JSON.stringify(value);
        }

        share.cache__[key] = value;

        try {
          store.set(key, value);
        } catch (e) {

        }
      },
      ensureNotEmpty__: function (trim, id, errorMessage) {
        var value = $("#" + id).val();
        if (trim) {
          value = value.trim();
          $("#" + id).val(value);
        }
        if (value === "") {
          throw errorMessage;
        }
      },
      ensureNumber__: function (trim, id, errorMessage) {
        share.ensureNotEmpty__(trim, id, errorMessage);
        var value = $("#" + id).val();
        if (trim) {
          value = value.trim();
          $("#" + id).val(value);
        }
        if (isNaN(value)) {
          throw errorMessage;
        }
      },

      toLogin__: function () {
        share.debug__("share.toLogin__ start");
        share.debug__(share.getString__("toLogin"));
        if (window.mainFrame) {
          mainFrame.document.location = "./user.login.htm";
        } else {
          document.location = "./user.login.htm";
        }
      },

      isInArray__: function (item, arr) {
        if (arr == null) {
          return false;
        }

        var res = false;
        arr.forEach(function (ai, i) {
          if (ai == item) {
            res = true;
          }
        });

        return res;
      },
      errorProcessed__: function (json, notHandleCodes) {
        if (json == null) {
          share.toastError__(share.getString__("internalError"), 3000);
          return 500;
        }

        var code = 0;
        if (json.code == null) {
          json.code = 0;
        }

        if (!share.isInArray__(json.code, notHandleCodes)) {
          if (json.code == share.code__.unAuthorized) {
            share.setCache__("user", null, {
              // path : '/'
            });

            share.toLogin__();
          } else if (json.code == share.code__.forbidden) {
            share.toastError__(share.getString__("forbidden"), 3000);
          } else if (json.code == 0) {
            if (json.message != null && "" != json.message) {
              share.toastSuccess__(json.message, 3000);
            }
          } else if (json.code == share.code__.needCharge) {
          } else if (json.code != 302) {
            if (json.message != null && "" != json.message) {
              share.toastError__(
                json.message + "<br>(" + json.errorId + ")",
                10000
              );
            }
          }
        }

        code = json.code;

        if (json.loginedUser != null) {
          var newUser = JSON.stringify(json.loginedUser);
          if (share.getCache__("user") != newUser) {
            share.debug__("user changed");
            share.setCache__("user", newUser);
            share.loadCookie__();
            if (navbar) {
              share.debug__("reinit navbar");
              navbar.initialize();
            }
          }
        }

        return code;
      },
      toastError__: function (message, showTime, onHide) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          if (typeof message === "string") {

          } else if (message.message) {
            message = message.message;
          } else if (share.isObject__(message)) {
            message = JSON.stringify(message);
          }

          return share.toast__(
            share.getString__("errorOccured"),
            message,
            showTime,
            BootstrapDialog.TYPE_DANGER,
            onHide
          );
        }
      },
      toastWarning__: function (message, showTime, onHide) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            share.getString__("tips"),
            message,
            showTime,
            BootstrapDialog.TYPE_WARNING,
            onHide
          );
        }
      },
      toastInfo__: function (message, showTime, onHide, title) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            title ? title : share.getString__("tips"),
            message,
            showTime,
            BootstrapDialog.TYPE_PRIMARY,
            onHide
          );
        }
      },
      toastDetail__: function (title, message, onShown) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            title,
            message,
            0,
            BootstrapDialog.TYPE_PRIMARY,
            null,
            onShown
          );
        }
      },

      isAsync: function (fn) {
        return fn && fn instanceof Function && fn.toString().startsWith('async');
      },

      popup__: async function (target, content, placement, onShown, document) {
        if (document == null) {
          document = window.document;
        }

        let point;
        let centerMode = (target == null && share.currentTarget == null);
        if (target == null && share.currentTarget != null) {
          target = share.currentTarget;
        }

        let popupId = share.uuid__();

        $("body", document).append(`<div id="bg${popupId}" class="modal-backdrop init"/>`);
        $("body", document).append(`<div id="${popupId}" class="popup" role="tooltip" />`);
        $(`#${popupId}`, document).html(content);
        if (!centerMode) {
          $(`#${popupId}`, document).append(`<div id="arrow${popupId}" class="arrow" ></div>`);
        }

        async function setPosition() {

          let tooltip = $(`#${popupId}`, document)[0];
          let arrow = $(`#arrow${popupId}`, document)[0];
          if (centerMode || target == null) {
            let left = Math.max((window.innerWidth - tooltip.offsetWidth) / 2, 8);
            let top = Math.max((window.innerHeight - tooltip.offsetHeight) / 2, 8);
            Object.assign(tooltip.style, {
              left: `${left}px`,
              top: `${top}px`,
            });
            if (arrow) {
              arrow.style.display = "none";
            }
            return;
          }

          let res = await share.computePosition(target, tooltip, {
            placement: placement ? placement : "bottom",
            middleware: [
              share.offset(6),
              share.flip(),
              share.shift({ padding: 5 }),
              share.arrow({ element: arrow }),
            ],
          });

          Object.assign(tooltip.style, {
            left: `${res.x}px`,
            top: `${res.y}px`,
            //opacity: 0
          });

          if (arrow) {
            arrow.style.display = "";
            const staticSide = {
              top: 'bottom',
              right: 'left',
              bottom: 'top',
              left: 'right',
            }[res.middlewareData.offset.placement.split('-')[0]];

            let x = res.middlewareData.arrow.x;
            let y = res.middlewareData.arrow.y;
            Object.assign(arrow.style, {
              left: x != null ? `${x}px` : '',
              top: y != null ? `${y}px` : '',
              right: '',
              bottom: '',
              [staticSide]: '-4px',
            });
          }
        }

        await setPosition();

        share.rocktb__($(`#${popupId}`, document));
        if (!centerMode) {
          // share.rocktb__($(`#arrow${popupId}`, document));
        }
        $(`#bg${popupId}`, document).animate({ opacity: .2 }, 100);
        onShown && onShown(popupId);

        let popup = {
          id: popupId,
          update: async function (newContent) {
            if (newContent != null) {
              $(`#${popupId}`, document).html(newContent);
              if (!centerMode) {
                $(`#${popupId}`, document).append(`<div id="arrow${popupId}" class="arrow" ></div>`);
              }
              onShown && onShown();
            }

            await setPosition();
          },
          close: async function () {
            point && point.remove();
            let p = [];
            p.push(share.fadeOut__($(`#bg${popupId}`, document)));
            p.push(share.fadeOut__($(`#${popupId}`, document)));
            await Promise.allSettled(p);
          }
        }

        share.onClick__($(`#bg${popupId}`, document), async function () {
          await popup.close();
          popup.onClosed && popup.onClosed();
        });

        return popup;
      },
      rock__: function (selector) {
        let ol = $(selector)[0].style.left;
        let olp = ol.split("px");

        if (olp.length > 1) {
          $(selector).animate({ left: `${+olp[0] - 2}px` }, 200)
            .animate({ left: `${+olp[0] + 2}px` }, 200)
            .animate({ left: `${olp[0]}px` }, 200);
        }
      },
      rocktb__: function (selector) {
        if (typeof selector === 'string') {
          selector = $(selector);
        }
        let ol = selector[0].style.top;
        let olp = ol.split("px");

        if (olp.length > 1) {
          selector.animate({ top: `${+olp[0] - 2}px` }, 200).animate({ top: `${+olp[0] + 2}px` }, 200).animate({ top: `${olp[0]}px` }, 200);
        }
      },
      fadeOut__: async function (selector, interval) {
        if (typeof selector === 'string') {
          selector = $(selector);
        }

        let job = (resolve, reject) => {

          selector.fadeOut(interval ? interval : share.defaultAnimationInterval, function () {
            $(this).remove();
            resolve();
          });
        };

        return new Promise(job);
      },
      toastSuccess__: function (message, showTime, onHide) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            share.getString__("congratulations"),
            message,
            showTime,
            BootstrapDialog.TYPE_SUCCESS,
            onHide
          );
        }
      },
      toastQuerying__: function () {
        var dialog = share.toastWaiting__(share.getString__("querying"));
        return dialog;
      },
      toastWaiting__: function (message, showTime, onHide, title) {
        var dialog;
        if (showTime == null) {
          showTime = -1;
        }
        dialog = share.toastInfo__(
          message + " <span class='loading4'></span>",
          showTime,
          onHide,
          title
        );

        return dialog;
      },
      handleAjaxError__: function (e, preHandle, postHandle) {
        if (preHandle != null) {
          preHandle();
        }

        share.toastError__(
          share.getString__("connectError", e.statusText),
          3000
        );
        if (e.responseText) {
          share.debug__(e.responseText);
        } else {
          share.debug__("no responseText");
        }
        if (postHandle != null) {
          postHandle();
        }
      },

      toast__: function (title, message, showTime, type, onHide, onShown) {
        var closable = true;
        if (showTime < 0) {
          closable = false;
        }
        if (message instanceof Object) {
          message = JSON.stringify(message);
        }

        var dialog = new BootstrapDialog({
          type: type ? type : BootstrapDialog.TYPE_PRIMARY,
          size: BootstrapDialog.SIZE_SMALL,
          title: title,
          message: message,
          closable: closable,
          draggable: true,
          closeByBackdrop: closable,
          closeByKeyboard: closable,
          onshow: onshow,
          onshown: onDialogShown,
          onhide: onHide
        });



        function onshow(d) {
          var $this = d.$modal;
          // share.debug__($share.html__());
          var $modal_dialog = $this.find(".modal-dialog");
          $modal_dialog.css("display", "none");
        }

        function onDialogShown(dialog) {
          /*
           */
          var $this = dialog.$modal;
          // share.debug__($share.html__());
          var $modal_dialog = $this.find(".modal-dialog");
          var sh = document.body.scrollHeight;
          var wh = window.innerHeight;
          var yo = window.pageYOffset;
          /*
          if (share.isInFrame__()) {
            yo = parent.document.documentElement.scrollTop;

            var ybo = parent.document.body.scrollTop;
            if (yo < ybo) {
              yo = ybo;
            }
          } else {
            yo = 0;
          }
            */

          var mh = $modal_dialog.height();
          // var m_top = yo + wh - mh - 80;
          var m_top = yo + (wh - mh) / 2 - 80;
          // $modal_dialog.css('display', '');
          $modal_dialog.css(
            {
              "margin-top": m_top + "px",
              display: ""
            },
            500
          );
          onShown && onShown(dialog);
        }

        dialog.realize();
        if (title == null) {
          dialog.getModalHeader().hide();
        }
        // dialog.getModalFooter().hide();
        // dialog.getModalBody().css('background-color', '#0088cc');
        // dialog.getModalBody().css('color', '#fff');
        dialog.open();

        if (showTime > 0) {
          setTimeout(function () {
            dialog.close();
          }, showTime);
        } else {
          if (showTime < 0) {
            dialog.canClose = false;
          }
          dialog.doClose = dialog.close;
          dialog.onClosed = [];
          dialog.close = function (onClosed) {
            dialog.onClosed.push(onClosed);
            if (dialog.canClose) {
              share.debug__("dialog do close:" + dialog.options.message);
              dialog.doClose();
              setTimeout(function () {
                dialog.onClosed.forEach(function (item, i) {
                  if (typeof item === "function") {
                    item();
                  }
                });
              }, 200);
            } else {
              // share.debug__("set canClose=true");
              dialog.canClose = true;
            }
          };
          setTimeout(function () {
            dialog.close();
          }, 1000);
        }

        return dialog;
      },

      setTitle__: function (title) {
        parent.window.document.title = title;
        window.document.title = title;
      },

      closePopup__: async function () {
        try {
          if (share.dialog__) {
            await share.dialog__.close();
            share.dialog__ = null;
          }
        } catch (e) {

        }
      },

      closeDialog__: async function (onClosed) {
        share.debug__("closeDialog");
        let cd = async function () {
          if (share.isAsync(share.dialog__.close)) {
            await share.dialog__.close();
          } else {
            share.dialog__.close();
          }
        }
        if (share.dialog__) {
          if (typeof onClosed === "function") {
            if (share.dialog__.onClosed == null) {
              await cd();
              share.dialog__ = null;
              onClosed();
            } else {
              share.dialog__.onClosed.push(onClosed);
              await cd();
              share.dialog__ = null;
            }
          } else {
            await cd();
          }
        } else {
          if (typeof onClosed === "function") onClosed();
        }
      },

      showDialog__: function (title, content, buttons, onHide, onShown) {
        var now = Date.now();
        var template = $("#templateDialog", parent.parent.parent.document).html();
        template = template.replace(/#content#/g, content);
        template = template.replace(/#properties#/g, "");
        var buttonTemplate = $("#templateDialogButton", parent.parent.parent.document).html();
        var html = [];

        if (buttons)
          buttons.forEach(function (item, i) {
            var itemHtml = buttonTemplate.replace(/#id#/g, i + "_" + now);
            itemHtml = itemHtml.replace(/#name#/g, item.text);
            html.push(itemHtml);
          });

        template = template.replace(/#buttons#/g, html.join(""));
        template = template.replace(/[\r\n]/g, "");
        var shown = function () {
          if (buttons)
            buttons.forEach(function (item, i) {
              share.onClick__($("#dialogButton" + i + "_" + now), item.onTap);
            });

          if (onShown) onShown();
        };

        share.dialog__ = share.toast__(
          title,
          template,
          0,
          BootstrapDialog.TYPE_PRIMARY,
          onHide,
          shown
        );

        return share.dialog__;
      },

      popupAction__: async function (content, buttons, target, placement, onShown, document) {
        var buttonTemplate = $("#templateActionSheetButton", parent.parent.document).html();
        var labelTemplate = $("#templateActionSheetLabel", parent.parent.document).html();
        var html = [];

        if (document == null) {
          document = window.document;
        }

        if (buttons)
          buttons.forEach(function (item, i) {
            var itemHtml = buttonTemplate.replace(
              /#id#/g,
              item.id ? item.id : i
            );

            if (item.labelFor) {
              itemHtml = labelTemplate.replace(
                /#id#/g,
                item.id ? item.id : i
              );

              itemHtml = itemHtml.replace(/#for#/g, item.labelFor);
            }


            itemHtml = itemHtml.replace(/#name#/g, item.text);
            itemHtml = itemHtml.replace(/#icon#/g, item.icon ? item.icon : "");
            itemHtml = itemHtml.replace(/#class#/g, `${item.clazz ? item.clazz.join(" ") : ""}`);

            html.push(itemHtml);
          });

        let buttonHtml = html.join("");
        if (content == null || content == "") {
          html = `<div class="flexcolumn hcenter">
                  ${buttonHtml}
                  </div>`;
        } else {
          html = `<div class="flexcolumn hcenter">
                    <div style="max-width:300px; max-height:600px;" class="breakword scrollX scrollY">${content}</div>
                    ${buttonHtml}
                  </div>`;
        }

        var shown = function (popupId) {
          if (buttons)
            buttons.forEach(function (item, i) {
              share.onClick__($("#actionSheetButton" + (item.id ? item.id : i), $(`#${popupId}`, document)), function (e) {
                item.onTap(e);
              }, true);
            });

          if (onShown) onShown(popupId);
        };

        share.dialog__ = await share.popup__(target, html, placement, shown, document);
        return share.dialog__;
      },

      showActionSheet__: function (content, buttons, onHide, onShown, title) {
        share.dialog__ = share.showSelfActionSheet__(
          content,
          buttons,
          onHide,
          onShown,
          title
        );
      },

      showSelfActionSheet__: function (content, buttons, onHide, onShown, title) {
        var template = $("#templateActionSheet", parent.parent.document).html();
        template = template.replace(/#content#/g, content);
        template = template.replace(/#properties#/g, "");
        var buttonTemplate = $("#templateActionSheetButton", parent.parent.document).html();
        var html = [];
        if (buttons)
          buttons.forEach(function (item, i) {
            var itemHtml = buttonTemplate.replace(
              /#id#/g,
              item.id ? item.id : i
            );
            itemHtml = itemHtml.replace(/#name#/g, item.text);
            html.push(itemHtml);
          });

        template = template.replace(/#buttons#/g, html.join(""));
        template = template.replace(/[\r\n]/g, "");
        var shown = function () {
          if (buttons)
            buttons.forEach(function (item, i) {
              $("#actionSheetButton" + (item.id ? item.id : i)).on(
                "click",
                item.onTap
              );
            });

          if (onShown) onShown();
        };
        var dialog = share.toast__(
          title ? title : share.getString__("options"),
          template,
          0,
          BootstrapDialog.TYPE_PRIMARY,
          onHide,
          shown
        );
        return dialog;
      },
      getWarehouseSelected__: function () {
        var c = share.getCache__("warehouseSelected");
        if (c != null) {
          return JSON.parse(c);
        }

        return null;
      },
      setWarehouseSelected__: function (warehouse) {
        if (warehouse == null) {
          share.setCache__("warehouseSelected", null);
        } else {
          share.setCache__("warehouseSelected", JSON.stringify(warehouse));
        }
      },
      getWarehouseCaller__: function () {
        var c = share.getCache__("warehouse.caller");
        if (c == null || c === "null") {
          return null;
        }

        return c;
      },
      isEmail__: function (str) {
        var reg = /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/;
        return reg.test(str);
      },
      getDeviceInfo__: async function () {
        return await share.callNodejs__(
          {
            func: "getDeviceInfo"
          }
        );
      },
      mailDelete__: function (mailItem, succ, fail) {

        share.callNodejs__(
          {
            func: "mailDelete",
            params: mailItem
          },
          succ,
          fail
        );
      },
      draftsDelete__: function (options, succ, fail) {
        share.callNodejs__(
          {
            func: "draftsDelete",
            params: options
          },
          succ,
          fail
        );
      },
      mailsDelete__: function (options, succ, fail) {
        share.callNodejs__(
          {
            func: "mailsDelete",
            params: options
          },
          succ,
          fail
        );
      },
      mailsMove__: function (options, succ, fail) {
        share.callNodejs__(
          {
            func: "mailsMove",
            params: options
          },
          succ,
          fail
        );
      },
      countdown__: function (time) {
        if (time == null) {
          time = 0;
        }
        let now = new Date().getTime();
        let res = (time - now) / 1000 / 3600 / 24;
        if (res < 0) {
          res = 0;
        }

        res = Math.ceil(res);

        return res;
      },
      deleteFolder__: function (item, succ, fail) {
        share.callNodejs__(
          {
            func: "deleteFolder",
            params: item
          },
          succ,
          fail
        );
      },
      forbid__: function (opt, succ, fail) {
        share.callNodejs__(
          {
            func: "forbid",
            params: opt
          },
          succ,
          fail
        );
      },
      block__: function (opt, succ, fail) {
        share.callNodejs__(
          {
            func: "blockFollower",
            params: opt
          },
          succ,
          fail
        );
      },
      reloadAccounts__: async function () {
        await share.getAccounts__();
      },
      getAccounts__: async function (succ, fail) {
        try {
          let res = await share.callNodejs__(
            {
              func: "getAccounts",
              params: {}
            }
          );

          var val = {};
          if (res != null) {
            val = JSON.parse(res.value);
          }
          share.accounts__ = val;
          parent.parent.mhgl_share.accounts__ = val;
          succ && succ(val);
        } catch (e) {
          share.toastError__(e);
        }

      },
      getAttachments__: function (item, attaches) {
        if (attaches == null) {
          attaches = [];
        }

        if (item.bodyStructure) {
          try {
            item.bodyStructure = JSON.parse(item.bodyStructure);
          } catch (e) {
          };

          return share.getAttachments__(item.bodyStructure, attaches);
        }

        if (item.disposition != null) {
          if (item.parameters == null) {
            item.parameters = {
              name: "attachments"
            };
          }
          attaches.push(item);
          return attaches;
        }

        if (item.childNodes) {
          for (var i = 0; i < item.childNodes.length; ++i) {
            share.getAttachments__(item.childNodes[i], attaches);
          }
        }

        return attaches;
      },
      toUtf8: function (s) {
        return unescape(encodeURIComponent(s));
      },
      htmlEncode__: function (str) {
        if (str == null) {
          return "null";
        }
        var s = "";
        if (str.length == 0) return "";
        s = str.replace(/&/g, "&amp;");
        s = s.replace(/</g, "&lt;");
        s = s.replace(/>/g, "&gt;");
        s = s.replace(/ /g, "&nbsp;");
        s = s.replace(/\'/g, "&#39;");
        s = s.replace(/\"/g, "&quot;");
        return s;
      },
      getStringCode__: function (name) {
        var code = 0;
        if (name != null) {
          for (var i = 0; i < name.length; ++i) {
            code += name.charCodeAt(i);
          }
        }

        return code;
      },
      getHeaderBackgroundColor__: function (name) {
        var total = 22;
        var code = share.getStringCode__(name);
        var pos = code % total;
        return "headerBg" + (pos + 1);
      },
      getSenderName__: function (item) {
        var senderName = "";
        try {
          var sender = JSON.parse(item.sender);
          senderName = sender[0].name;
          if (sender[0].address == share.user__.email) {
            let to = share.getEmailName__(item.mailTo);
            if (to == "") {
              to = share.getEmailName__(item.cc);
            }
            if (to != "" && to != null) {
              senderName = to;
            }
          }

          if (senderName == null || senderName == "") {
            senderName = sender[0].address;
          }
        } catch (e) {

        }

        return senderName;
      },
      getEmailName__: function (to) {
        var name = "";
        try {
          var arr = JSON.parse(to);
          name = arr[0].name;
          if (name == null || name == "") {
            name = arr[0].address;
          }
        } catch (e) {

        }

        return name;
      },
      getMailToName__: function (item) {
        var name = item.mailto || item.mailTo;
        if (name == "") {
          name = item.cc;
        }

        if (name == null) {
          name = "";
        }

        return name;
      },
      getSenderEmail__: function (item) {
        var res = "";
        try {
          var sender = JSON.parse(item.sender);
          res = sender[0].address;
        } catch (e) {

        }

        return res;
      },
      getEmails__: function (emails, template) {
        var res = [];
        try {
          var sender = JSON.parse(emails);
          for (var i = 0; i < sender.length; ++i) {
            var name = sender[i].name;
            if (name == null || name == "") {
              name = sender[i].address;
            }

            var html = template.replace("#name#", name).replace("#address#", sender[i].address);
            res.push(html);
          }
        } catch (e) {

        }

        return res;
      },
      mailRead__: function (mailItem, succ, fail) {
        var account = share.user__;
        var params = {
          id: mailItem.id,
          uid: mailItem.uid,
          email: mailItem.email,
          readAll: mailItem.readAll,
          mailPath: mailItem.mailPath
        };

        share.callNodejs__(
          {
            func: "mailRead",
            params: params
          },
          succ,
          fail
        );
      },
      parseMail__: function (mail, succ, fail) {
        var account = share.user__;
        var params = {
          mail: mail,
          logLevel: parent.mhgl_share.logLevel__,
        };

        share.callNodejs__(
          {
            func: "parseMail",
            params: params
          },
          succ,
          fail
        );
      },
      getHtmlPlainPart__: function (part, res) {
        if (part.type == "text/plain") {
          res.plain = part;
        } else if (part.type == "text/html") {
          res.html = part;
        }

        if (res.plain != null && res.html != null) {
          return true;
        }

        if (part.childNodes && part.childNodes.length > 0) {
          for (var i = 0; i < part.childNodes.length; ++i) {
            var child = part.childNodes[i];
            if (share.getHtmlPlainPart__(child, res)) {
              return true;
            }
          }
        }

        return false;
      },
      filterXss__: function (html) {

        html = parent.parent.parent.DOMPurify.sanitize(html);

        return html;
      },
      changeLinkTarget__: function (doc) {
        $("a", doc).each(function (i, ele) {
          let href = $(ele).attr("href");
          if (href && href.startsWith("#")) {
            $(ele).attr("target", "_self");
          } else {
            $(ele).attr("target", "_system");
          }
        });
      },
      popHtml__: function (content) {

        let html = `<iframe id="contentFrame" class="left scrollY width100p"/>`;

        $$("#topWin").html(html).removeClass("hide");
        let iframe = $$("#contentFrame")[0];

        let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        iframeDoc.open();
        content = share.filterXss__(content);
        iframeDoc.write(content);
        iframeDoc.close();

        $$("#topWinBackdrop").removeClass("hide");
        $$(".closeButton").removeClass("hide");
        share.changeLinkTarget__(iframeDoc);
      },
      saveOwnMessage__: function (room, message, succ, fail) {
        var account = share.user__;
        var id = share.uuid__();
        var groupId = "";
        var params = {
          email: share.user__.email,
          nickName: share.user__.nickName,
          room: room,
          content: message
        };
        share.callNodejs__(
          {
            func: "saveOwnMessage",
            params: params
          },
          function (res) {
            var roomId = room.address;
            var chat = res.chat;
            succ && succ(chat);
          },
          fail
        );
      },
      savedOwnMessage__: async function (room, message, succ, fail) {
        var account = share.user__;
        var id = share.uuid__();
        var groupId = "";
        var params = {
          email: share.user__.email,
          nickName: share.user__.nickName,
          room: room,
          //subject: "AllinEmail:" + id + ":" + groupId, 
          content: message
        };

        share.debug__(message);
        let res = await share.callNodejs__(
          {
            func: "saveOwnMessage",
            params: params
          }
        );

        return res;
      },
      toCancelMessage__: function (room, chat, succ, fail) {
        share.callNodejs__(
          {
            func: "toCancelMessage",
            params: {
              room: room,
              id: chat.id,
              email: share.user__.email
            }
          },
          succ, fail
        );
      },
      cancelMessage__: function (room, chat, succ, fail, sendType) {
        share.callNodejs__(
          {
            func: "cancelMessage",
            params: {
              room: room,
              id: chat.id,
              sendType: sendType,
              email: share.user__.email
            }
          },
          function (res) {
            chat.status = "";
            share.onChatSent__(chat, succ, succ);
          },
          function (e) {
            chat.status = e;
            share.onChatSent__(chat, succ, succ);
          }
        );
      },
      leaveGroup__: function (room, succ, fail) {
        let msg = share.getString__("leaveGroupGuide");
        share.confirmed__(msg, function () {

          let chat = {
            type: share.TypeJson,
            data: {
              type: "leaveGroup"
            }
          };

          share.saveOwnMessage__(room, chat,
            async function (res) {
              //chat saved
              await succ();

              share.sendMessage__(room, res, succ, fail);
            },
            fail ? fail : share.toastError__);
        });
      },
      sendMessage__: function (room, chat, succ, fail, sendType) {
        var params = {
          email: share.user__.email,
          room: room,
          sendType: sendType,
          nickName: share.user__.nickName,
          chat: chat
        };

        share.callNodejs__(
          {
            func: "sendMessage",
            params: params
          },
          function (res) {
            chat.status = "";
            share.onChatSent__(chat, succ, succ);
          },
          function (e) {
            chat.status = e;
            share.onChatSent__(chat, succ, succ);
          }
        );
      },
      jsonParse__: function (str) {
        try {
          return JSON.parse(str);
        } catch (e) {
          return null;
        }
      },
      onChatSent__: function (chat, succ, fail) {
        share.callNodejs__(
          {
            func: "onChatSent",
            params: chat
          },
          succ,
          fail
        );
      },
      addFriend__: function (name, email, greeting, succ, fail) {
        share.debug__("add friend:name=" + name + ",email=" + email);

        var account = share.user__;
        var id = share.uuid__();
        var params = {
          email: share.user__.email,
          name,
          greeting,
          to: email
        };

        share.callNodejs__(
          {
            func: "addFriend",
            params: params
          },
          succ,
          fail
        );
      },
      follow__: function (name, email, succ, fail) {
        share.debug__("follow:name=" + name + ",email=" + email);

        var account = share.user__;
        var id = share.uuid__();
        var params = {
          email: share.user__.email,
          name,
          to: email
        };

        share.callNodejs__(
          {
            func: "follow",
            params: params
          },
          succ,
          fail
        );
      },
      getPublicKey__: function (publicKey) {
        if (publicKey == null) {
          publicKey = "";
        } else {
          var arr = publicKey.split(";");
          publicKey = arr[0].substring(0, 6);
          if (arr.length > 1) {
            publicKey += ":" + arr[1].substring(0, 6);
          }
        }
        return publicKey;
      },
      resetKey__: function (room, groupId, succ, fail) {
        share.debug__("resetKey:email=" + share.user__.email);

        var params = {
          email: share.user__.email,
          room: room
        };

        share.callNodejs__(
          {
            func: "resetKey",
            params: params
          },
          succ,
          fail
        );
      },
      resetFriend__: function (room, chat, succ, fail) {
        share.debug__("resetFriend:email=" + share.user__.email);

        var params = {
          email: share.user__.email,
          chat: chat,
          room: room,
        };

        share.callNodejs__(
          {
            func: "resetFriend",
            params: params
          },
          succ,
          fail
        );
      },
      importFriends__: function (content, succ, fail) {
        var account = share.user__;
        account.publicKey = content.publicKey;
        account.privateKey = content.privateKey;
        share.saveAccount__(account, function (res) {
          share.callNodejs__(
            {
              func: "importFriends",
              params: content
            },
            succ,
            fail ? fail : share.toastError__
          );
        }, fail ? fail : share.toastError__);

      },
      exportFriends__: function (content, succ, fail) {
        var account = share.user__;
        share.callNodejs__(
          {
            func: "exportFriends",
            params: content
          },
          succ,
          fail ? fail : share.toastError__
        );
      },
      setWarehouseCaller__: function (caller) {
        share.setCache__("warehouse.caller", caller);
      },

      showStatus__: function (status) {
        parent.parent.mhgl_container.showStatus__(status);
      },

      loadCookie__: function () {
        if (share.isInFrame__()) {
          share.user__ = parent.mhgl_share.user__;
          share.logLevel__ = parent.mhgl_share.logLevel__;
        } else {

          var userStr = share.getCache__("user");
          share.debug__("user=" + userStr);
          if (userStr != null) {
            try {
              share.user__ = JSON.parse(userStr);
              share.setCache__("user", userStr, {
                // path : "/",
                expires: 365
              });
            } catch (e) {
              share.setCache__("user", "", {
                // path : "/"
              });
            }
          }
        }
      },
      shrinkString__: function (str, length) {
        var len = str.length;
        var subLen = (length - 3) / 2;
        if (str.length > length) {
          str =
            str.substring(0, subLen) + "…" + str.substring(len - subLen, len);
        }

        return str;
      },
      clearUserInfo__: function () {
        share.setCache__("user", "", {
          // path : "/"
        });

        share.setCache__("page", "");

        share.user__ = null;
        parent.window.mhgl_share.user__ = null;
      },
      logout__: function () {
        share.debug__("logout");
        share.clearUserInfo__();

        var dialog = share.toastWaiting__(share.getString__("exiting"));
        $.ajax({
          type: "GET",
          async: true,
          url: share.getBaseUrl__() + "/mvc/fe/user/logout",
          dataType: "jsonp",
          jsonp: "js",
          success: function (json) {
            dialog && dialog.close();
            if (share.errorProcessed__(json) != 0) {
              return;
            }

            share.toastSuccess__(share.getString__("exited"), 1500, function () {
              document.location = "./user.login.htm";
            });
          },
          error: function (e) {
            dialog.close();
            share.toastSuccess__(share.getString__("exited"), 1500, function () {
              document.location = "./user.login.htm";
            });
          }
        });
      },
      uuid__: function () {
        return Math.uuidFast();
      },
      showBottomInfo__: function (html) {
        var doc = share.getDocument__();
        $("#bottomInfo", doc).html(html);
        $("#bottomInfo", doc).removeClass("hide");
      },
      isGroup__: function (room) {
        if (room && room.address != null && room.address != '' && room.address != "System" && room.address.indexOf("@") < 0) {
          return true;
        }
      },
      createGroup__: function (name, friends, succ, fail) {
        let dialog = share.toastWaiting__(share.getString__("creatingGroup"));
        let f = function (e) {
          dialog.close();
          fail ? fail(e) : share.toastError__(e);
        };

        let s = function (res) {
          let chat = res.chat;
          let room = res.room;
          dialog.close();
          var target = share.getOpenTarget__(640, "rightFrame");
          share.open__("message.list.htm?id=" + room.address, target);
        };

        share.callNodejs__(
          {
            func: "createGroup",
            params: {
              email: share.user__.email,
              name: name,
              members: friends
            }
          },
          s,
          f
        );
      },
      shareGroup__: function (roomId, friends, succ, fail) {
        let dialog = share.toastWaiting__(share.getString__("sendingGroupInvitation"));
        succ = succ || function (res) {
          dialog.close();
          var target = share.getOpenTarget__(640, "rightFrame");
          share.open__("message.list.htm?id=" + roomId, target);
        };

        let f = function (e) {
          dialog.close();
          let js = null;
          try {
            js = JSON.parse(e);
          } catch (ex) {

          }

          if (js && js.error == "mail.sending") {
            var target = share.getOpenTarget__(640, "rightFrame");
            share.open__("message.list.htm?id=" + roomId, target);
          } else {
            fail ? fail(e) : share.toastError__(e);
          }
        };

        share.callNodejs__(
          {
            func: "shareGroup",
            params: {
              email: share.user__.email,
              roomId: roomId,
              friends: friends
            }
          },
          succ,
          f
        );
      },
      onWsChanged__: function (json) {
        navFrame.mhgl_navbar.onWsChanged__(json);
        if (mainFrame.user_login) {
          mainFrame.user_login.onWsChanged__(json);
        }
      },
      getTempFilePath__: function (env) {
        let tempPath = "";
        if (share.inElectron) {
        } else if (parent.cordova.platformId == "android") {
          tempPath = parent.cordova.file.dataDirectory.replace("file://", "").replace('/data/user/0/', '/data/data/');
          tempPath = tempPath + "www/AllinEmail";
          var device = parent.parent.device;
          env.hostName = device.manufacturer + " " + device.model;
        } else {
          tempPath = parent.cordova.file.dataDirectory.replace("file://", "").replace('/NoCloud', '');
        }

        env.tempPath = tempPath;
      },
      getProxyHtml: async function () {
        let params = {
          email: share.user__.email,
          pageIndex: 1,
          pageSize: 12400
        };

        let data = await share.getProxyList__(params);
        share.proxys = data.list;
        data.list.splice(0, 0, { name: share.getString__("noProxy"), url: "" });
        let proxyTemplate = $$("#templateProxy").html();

        let htmls = [];
        if (share.accounts__.proxy == null) {
          share.accounts__.proxy = share.proxys[0];
          share.saveAccountToDb__();
        }
        for (let i = 0; i < share.proxys.length; ++i) {
          let proxy = share.proxys[i];
          let selected = 0;
          if (proxy.name == share.accounts__.proxy.name) {
            selected = 1;
          }

          let proxyName = `${proxy.name}-${proxy.url}`;
          if (proxy.url == "" || proxy.url == proxy.name) {
            proxyName = proxy.name;
          }

          html = proxyTemplate.replace(/#proxyName#/g, proxyName);
          html = html.replace(/#id#/g, i);
          if (selected) {
            html = html.replace(/#selected#/, "");
            html = html.replace(/#hideDelete#/, "hide");
            html = html.replace(/#hideBan#/, "hide");
            html = html.replace(/#proxyNameColor#/, "green1");
          } else {
            html = html.replace(/#selected#/, "hide");
            if (i == 0) {
              html = html.replace(/#hideDelete#/, "hide");
              html = html.replace(/#hideBan#/, "");
            } else {
              html = html.replace(/#hideDelete#/, "");
              html = html.replace(/#hideBan#/, "hide");
            }
            html = html.replace(/#proxyNameColor#/, "gray");
          }

          htmls.push(html);
        }

        return htmls.join("");
      },
      loadJs__: function (sid, jsurl, success, error) {
        var nodeHead = document.getElementsByTagName("head")[0];
        var nodeScript = null;
        if (document.getElementById(sid) == null) {
          nodeScript = document.createElement("script");
          nodeScript.setAttribute("type", "text/javascript");
          nodeScript.setAttribute("src", jsurl);
          nodeScript.setAttribute("id", sid);
          nodeScript.onerror = error;
          if (success != null || error != null) {
            nodeScript.onload = nodeScript.onreadystatechange = function (a) {
              share.debug__("readyState of " + sid + ":" + nodeScript.readyState);
              if (nodeScript.ready) {
                share.debug__(sid + " ready");
                success && success();
                return false;
              }
              if (
                !nodeScript.readyState ||
                nodeScript.readyState == "loaded" ||
                nodeScript.readyState == "complete"
              ) {
                nodeScript.ready = true;
                success && success();
              }
            };
          }
          nodeHead.appendChild(nodeScript);
        } else {
          if (error != null) {
            error();
          }
        }
      },
      isShowEnabled__: function () {
        var config = share.user__.config;
        if (config == null) {
          return false;
        }

        if (
          config.enableShowWeb ||
          (config.isDeveloper && !config.disableDeveloper)
        ) {
          return true;
        }

        return false;
      }
    };

    $(function () {
      try {
        share.initialize__();
      } catch (e) {
        share.debug__(e);
      }
    });

    return share;
  })();

