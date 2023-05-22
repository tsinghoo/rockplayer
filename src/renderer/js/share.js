window.mhgl_share =
  window.mhgl_share ||
  (function () {
    var navbar = window.mhgl_navbar;
    var share = {
      packageName: "com.lbdd.email",
      mhgl__: "web",
      uiDebug: 0,
      logData__: [],
      defaultLogLevel__: 0,
      logLevelPage__: 10,
      accounts__: [],
      version__: "v1.51",
      currentNotification__: null,
      currentClass__: null,
      inElectron: /electron/i.test(navigator.userAgent),
      containerUrl__: "/fe/container.htm",
      containerUrlRegEx__: /\/fe\/container\.htm.*#/g,
      user__: null,
      dict__: null,
      dictr__: null,
      string__: {
        src:
          "{abcdefghi jk\"lmno}pqr1s2t3u4v0w'\r\n,;xyz张王李赵我们大家师父一",
        dst:
          "b王1c2d我3们4m0no}pqr一stu大\r家a师父{efghi jk\"lvw',;xyz张\n李赵",
        teacher: "班委",
        classOwner: "班主任"
      },
      sampleCount__: 3,
      code__: {
        duplicated: 1,
        unAuthorized: 401,
        forbidden: 404,
        needCharge: 4041
      },
      links: [
        {
          type: "text",
          name: "文本"
        },
        {
          type: "linkPage",
          name: "网页链接"
        },
        {
          type: "linkImage",
          name: "图片链接"
        },
        {
          type: "linkVoice",
          name: "音频链接"
        },
        {
          type: "linkVideo",
          name: "视频链接"
        }
      ],
      ajaxTimeout__: 15000,
      removePrefix__: function (str, prefix) {
        if (str.indexOf(prefix) == 0) {
          str = str.substring(prefix.length);
        }

        return str;
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
      getTitleFromNotes__: function (notes) {
        notes = share.removePrefix__(notes, "@所有人");
        notes = share.removePrefix__(notes, "@all");
        notes = share.removePrefix__(notes, "@All");
        notes = share.removeEmptyChars__(notes);
        return share.shrinkString__(notes, 30);
      },
      hideBottomInfo__: function () {
        var doc = share.getDocument__();
        $("#bottomInfo", doc).addClass("hide");
      },

      nodejscalls__: {},

      onImapUpdate__: function (result) {
        console.log(JSON.stringify(result));
        var type = result.type;
        share.toastInfo__(
          "onImapUpdate:" + result.path + "/" + result.type + "/" + result.value
        );
      },

      getNewChats__: function (fail) {
        var succ = function (res) {
          share.onNewChats__(res);
          if (res.more) {
            share.getNewChats__();
          }
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

      onNewChats__: function (res) {
        console.log("onNewChats:" + JSON.stringify(res));
        if (res == null) {
          return;
        }
        share.user__.maxUid = res.maxUid;
        share.setCache__("user", share.user__);
        share.saveAccount__(share.user__);

        for (var i = 0; i < res.mails.length; ++i) {
          var mail = res.mails[i];
          if (mail.roomId == self.data.room.id) {
            mainFrame.message_list &&
              mainFrame.message_list.getMessages__();
          }
        }
      },

      onNextUidUpdate__: function (res) {
        share.user__.nextUid = res.nextUid;
        share.saveAccount__(share.user__);
      },

      onErrorFromNodeJs__: function (json) {

      },

      onMoreMessageFromNodeJs__: function (json) {
        mainFrame.mhgl_mail_list && mainFrame.mhgl_page.refresh();
        mainFrame.message_list && mainFrame.message_list.getMessages__();
      },

      onLogFromNodeJs__: function (json) {
        //share.logData__.push(info);
        console.log("NodeJs->" + json.caller + ":" + json.info);
      },

      onNoMoreMessageFromNodeJs__: function (json) {

      },

      nodejsChannelListener__: function (msg) {
        //console.log(msg);
        var json = JSON.parse(msg);
        if (json.id == "Error") {
          share.onErrorFromNodeJs__(json);
        } else if (json.id == "Log") {
          //debugger;
          share.onLogFromNodeJs__(json);
        } else if (json.id == "MoreMessage") {
          share.onMoreMessageFromNodeJs__(json);
        } else if (json.id == "NoMoreMessage") {
          share.onNoMoreMessageFromNodeJs__(json);
        }
        var call = share.nodejscalls__[json.id];
        if (call == null) {
          if (json.id == "onImapUpdate") {
            share.onImapUpdate__(json.result);
          } else if (json.id == "onNewChats") {
            share.onNewChats__(json.result);
          } else if (json.id == "onNextUidUpdate") {
            share.onNextUidUpdate__(json.result);
          }
        } else {
          if (json.status == "success") {
            call.succ && call.succ(json.result);
          } else if (json.status == "fail") {
            call.fail && call.fail(json.error);
          } else {
            console.log("unkown status:" + json.status);
          }

          delete share.nodejscalls__[json.id];
        }
      },

      frameCalls__: {},
      callFrame__: function (msg) {
        console.log("callFrame__");
        var json = JSON.parse(msg);
        var call = share.frameCalls__[json.id];
        if (call == null) {
        } else {
          if (json.status == "success") {
            call.succ && call.succ(json.result);
          } else if (json.status == "fail") {
            call.fail && call.fail(json.error);
          } else {
            console.log("unkown status:" + json.status);
          }

          delete share.frameCalls__[json.id];
        }
      },
      callContainer__: function (msg) {
        console.log("callContainer__");
        var json = JSON.parse(msg);

        try {
          var succ = function (res) {
            var data = {
              status: "success",
              id: json.id,
              result: res
            };
            mainFrame.mhgl_share.callFrame__(JSON.stringify(data));
          };

          var fail = function (e) {
            var data = {
              id: json.id,
              status: "fail",
              error: e
            };

            mainFrame.mhgl_share.callFrame__(JSON.stringify(data));
          };

          var res = eval("share." + json.func + "(json.params,succ,fail)");
        } catch (e) {
          var data = {
            id: json.id,
            status: "fail",
            e: e,
            error: e.message
          };
          var msg = JSON.stringify(data);
          mainFrame.mhgl_share.callFrame__(msg);
        }
      },
      registerDeviceReady__: function (options, succ, fail) {
        if (
          share.containerCalled__("registerDeviceReady__", options, succ, fail)
        ) {
          return;
        }

        if (share.deviceReadyFunc__ != null) {
          console.log("device not ready");
          share.deviceReadyFunc__.push(succ);
          return;
        }

        succ();
      },
      dbDelete__: function (options, succ, fail) {
        if (share.containerCalled__("dbDelete__", options, succ, fail)) {
          return;
        }

        var del = options.delete;
        var where = options.where;
        var params = options.params;

        var sql = del + where;
        share.sqlBatch__(
          [[sql, params]],
          function (tx, res) {
            succ && succ(res);
          },
          function (e) {
            fail && fail(e);
          }
        );
      },
      containerCalled__: function (func, options, succ, fail) {
        if (share.isInFrame__()) {
          var id = func + new Date().getTime();
          share.frameCalls__[id] = {
            succ: succ,
            fail: fail
          };

          var msg = {
            id: id,
            func: func,
            params: options
          };

          parent.mhgl_share.callContainer__(JSON.stringify(msg));
          return true;
        }

        return false;
      },
      dbQueryPaged__: function (options, succ, fail) {
        if (share.containerCalled__("dbQueryPaged__", options, succ, fail)) {
          return;
        }

        var func = function () {
          share.callNodejs__(
            {
              func: "dbQueryPaged",
              params: options
            },
            succ,
            fail
          );
        };

        share.registerDeviceReady__(null, func);
      },
      newEcKey__: function (account, succ, fail) {
        share.callNodejs__(
          {
            func: "newEcKey",
            params: account
          },
          succ,
          fail
        );
      },
      onDbReady__: function (res) {
        console.log("db inited");

        navigator && navigator.splashscreen && navigator.splashscreen.hide();
        if (res != null) {
          share.accounts__ = res;
          mainFrame &&
            mainFrame.user_login &&
            mainFrame.user_login.accountsLoaded__(res);
        }
      },

      confirmFriend__: function (friend, succ, fail) {
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
      removeAccount__: function (email) {
        if (share.isInFrame__()) {
          share.accounts__ = parent.mhgl_share.accounts__;
        }

        var i = 0;
        for (; i < share.accounts__.length; ++i) {
          var ele = share.accounts__[i];
          if (ele.email.toLowerCase() == email.toLowerCase()) {
            break;
          }
        }

        if (i < share.accounts__.length) {
          share.accounts__.splice(i, 1);
          share.saveAccountToDb__();
        }
      },
      saveAccountToDb__: function (succ, fail) {
        share.sqlBatch__(
          [
            [
              "INSERT or replace INTO config VALUES (?,?)",
              ["accounts", JSON.stringify(share.accounts__)]
            ]
          ],
          function (res) {
            console.log("save accounts success");
            parent.mhgl_share.accounts__ = share.accounts__;
            succ && succ();
          },
          function (e) {
            console.log("save accounts failed:" + e.message);
            fail && fail();
          }
        );
      },
      saveAccount__: function (account, succ, fail) {
        if (share.isInFrame__()) {
          share.accounts__ = parent.mhgl_share.accounts__;
        }

        var exists = false;
        var orig = account;
        share.accounts__.forEach(element => {
          if (element.email == account.email) {
            element.host = account.host;
            element.port = account.port;
            element.user = account.user;
            element.password = account.password;
            element.tls = account.tls;
            element.name = account.name;
            element.maxUid = account.maxUid;
            element.nextUid = account.nextUid;
            element.smtpPassed = account.smtpPassed;
            account = element;
            exists = true;
          }
        });

        if (!exists) {
          share.accounts__.push(account);
        }

        var save = share.saveAccountToDb__;

        var keyGened = function (json) {
          console.log("key:" + JSON.stringify(json));
          account.privateKey = json.privateKey;
          account.publicKey = json.publicKey;
          orig.privateKey = account.privateKey;
          orig.publicKey = account.publicKey;
          save(succ, fail);
        };

        if (account.smtpPassed && !account.publicKey) {
          share.newEcKey__(account, keyGened);
        } else {
          save(succ, fail);
        }
      },
      initNodejs__: function (handler) {
        console.log("initNodejs start");
        if (nodejs.inited) {
          console.log("nodejs already inited");
          nodejs.channel.setListener(share.nodejsChannelListener__);
          handler && handler();
          return;
        }

        share.registerDeviceReady__(null, function () {
          nodejs.channel.setListener(share.nodejsChannelListener__);
          nodejs.start("main.js", function () {
            nodejs.inited = true;
            handler && handler();
          });
        });
      },
      callNodejs__: function (options, succ, fail) {
        if (share.containerCalled__("callNodejs__", options, succ, fail)) {
          return;
        }

        console.log("calling nodejs:" + options.func);
        var func = options.func;
        var p = options.params;
        var id = func + new Date().getTime();
        share.nodejscalls__[id] = {
          succ: succ,
          fail: fail
        };
        nodejs.channel.send(
          JSON.stringify({
            id: id,
            func: func,
            params: p
          })
        );
      },

      getDurationText__: function (seconds) {
        seconds = parseInt(seconds);
        var m = parseInt(seconds / 60);
        var s = seconds % 60;
        var text = m > 0 ? m + "'" : "";
        text += s > 0 ? s + '"' : "";
        if (text == "") {
          text = '0"';
        }
        return text;
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
      getDurationText1__: function (seconds) {
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
        var arrs = href.split(share.containerUrl__);
        if (arrs.length > 1) {
          if (!share.isInFrame__()) {
            return false;
          }
          // used frame
          href = arrs[1];
        }

        var val = reg.test(href);
        return val;
      },
      getLinkTypeName: function (type) {
        var name = "";
        share.links.forEach(function (item, i) {
          if (item.type == type) {
            name = item.name;
          }
        });

        return name;
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
      encode__: function (params) {
        var str = JSON.stringify(params);
        var newStr = "";
        for (var i = 0; i < str.length; ++i) {
          var src = str.charAt(i);
          var dst = share.dict__[src];

          if (dst != null) {
            src = dst;
          }
          newStr += src;
        }

        var newParams = {};
        newParams.p = newStr;
        return newParams;
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

      toCharge__: function () {
        var title = "提示";
        var content = "您的账号余额不足，要去充值吗？";
        var buttons = [
          {
            text: "去充值",
            onTap: function () {
              share.open__("./charge.htm");
            }
          },
          {
            text: "取消",
            onTap: function () {
              share.closeDialog__();
            }
          }
        ];
        share.showDialog__(title, content, buttons);
      },

      wxPay__: function (charge, success, fail) {
        var data = charge;
        share.log__("调用WeixinJSBridge");
        // 微信公众号支付

        var fp = function () {
          try {
            WeixinJSBridge.invoke(
              "getBrandWCPayRequest",
              {
                appId: data.appId, // 公众号名称，由商户传入
                timeStamp: data.timeStamp, // 时间戳，自1970年以来的秒数
                nonceStr: data.nonceStr, // 随机串
                package: data["package"],
                signType: data.signType, // 微信签名方式:
                paySign: data.paySign
                // 微信签名
              },
              function (res) {
                share.log__(JSON.stringify(res));
                if (res.err_msg == "get_brand_wcpay_request:ok") {
                  if (success) {
                    success();
                  } else {
                    share.toastSuccess__("付款成功", 2000);
                  }
                } else if (res.err_msg == "get_brand_wcpay_request:cancel") {
                  if (fail) {
                    fail();
                  } else {
                    share.toastWarning__("付款取消", 2000);
                  }
                } else {
                  if (fail) {
                    fail(res);
                  }
                }
              }
            );
          } catch (p) {
            share.toastError__("调用微信异常");
          }
        };

        if (window.WeixinJSBridge == null) {
          share.toastInfo__("启动支付中...", 1000, fp);
        } else {
          fp();
        }
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
          showDialog = "查询中";
        }
        var openId = share.getParameter__("openId");
        var appId = share.getParameter__("appId");
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
        share.log__("GET " + url);
        share.log__("Request:" + JSON.stringify(params, null, 2));

        var baseUrl = share.getBaseUrl__();
        if (url.indexOf(baseUrl) == 0 && params.encode != 0) {
          params.uri = url.substring(baseUrl.length);
          var newParams = share.encode__(params);
          params = newParams;
          url = share.getBaseUrl__() + "/mvc/pe";
        }

        $.ajax({
          type: "GET",
          async: true,
          url: url,
          data: params,
          headers: headers,
          dataType: "jsonp",
          jsonp: "js",
          success: function (json) {
            // share.log__("Response:" + JSON.stringify(json, null, 2));
            dialog && dialog.close();
            if (json.d) {
              var str = share.decode__(json.d);
              json = JSON.parse(str);
            }

            share.log__(function () {
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
                share.log__("error:need charge");
              } else {
                if (share.isFromWechatBrowser__()) {
                  var cred = JSON.parse(charge.credential);
                  if (charge.comment) {
                    var title = "提示";
                    var content = charge.comment;
                    var buttons = [
                      {
                        text: "去支付",
                        onTap: function () {
                          share.closeDialog__(function () {
                            share.wxPay__(cred.c_wx_pub, success, fail);
                          });
                        }
                      },
                      {
                        text: "去充值",
                        onTap: function () {
                          share.open__("./charge.htm");
                        }
                      },
                      {
                        text: "取消",
                        onTap: function () {
                          share.closeDialog__();
                        }
                      }
                    ];
                    share.showDialog__(title, content, buttons);
                  } else {
                    share.wxPay__(cred.c_wx_pub, success, fail);
                  }
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
              }
            } else if (error != 0) {
              if (fail != null) fail(json);
            } else {
              if (success != null) success(json);
              setTimeout(share.autoSetSize__, 1000);
              share.setParentLocation__();
            }
          },
          error: function (e) {
            share.log__("Response:" + JSON.stringify(e, null, 2));
            dialog && dialog.close();
            if (fail) {
              fail(e);
            } else {
              share.handleAjaxError__(e);
            }
          }
        });
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
      getMemberName__: function (item) {
        if (item == null) {
          item = share.getCurrentClass__().myMember;
        }
        return item.childId;
      },
      getMemberRelationship__: function (item) {
        if (item.userType == "0") {
          return "";
        }
        if (item.userType == "1") {
          return "";
        }
        if (item.userType == "本人") {
          return "";
        }
        return "的" + item.userType;
      },
      getMemberRole__: function (item) {
        if (item.memberRole == 100 || share.edu__.isOwner(item.id)) {
          return share.getString__().classOwner;
        }
        if (item.memberRole == 50) {
          return share.getString__().teacher;
        }

        return "";
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
      autoSetSize__: function () {
        return;
        if (share.isInFrame__()) {
          var main = parent.document.all("mainFrame");
          var height = 0;
          // $("#body")[0].scrollHeight;
          // var width = parent.window.innerWidth ||
          // parent.document.documentElement.clientWidth ||
          // parent.document.body.clientWidth;
          // height = parent.window.innerHeight ||
          // parent.document.documentElement.clientHeight ||
          // parent.document.body.clientHeight;
          height = document.body.scrollHeight + 40;
          var sh = window.screen.height;
          if (height < sh) {
            height = sh;
          }
          main.style.height = height + "px";

          parent.document.body.style.height = height + "px";
          share.log__("set main height to " + height);
        } else {
          // document.body.style.height = 200 + "px";
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
      genDict__: function () {
        share.dict__ = {};
        share.dictr__ = {};
        var dict = share.dict__;
        var dictr = share.dictr__;
        var src = share.getString__().src;
        var dst = share.getString__().dst;
        for (var i = 0; i < share.getString__().src.length; ++i) {
          dict[src.charAt(i)] = dst.charAt(i);
          dictr[dst.charAt(i)] = src.charAt(i);
        }

        var keys = share.getMapKeys__(dict);
        if (keys.length != src.length) {
          throw "bad src";
        }

        keys = share.getMapKeys__(dictr);
        if (keys.length != dst.length) {
          throw "bad dst";
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
      beforeUnload__: function () {
        console.log("closing db before unload");
        share.db && share.db.close();
      },
      initialize__: function () {
        var page = document.location.href;
        //share.log__ = console.log;
        console.log("share.init__:" + page);
        //console.log("window.inElectron=" + (window.env != undefined) ? window.env.inElectron:false);
        if (share.inElectron) {
          share.deviceReadyFunc__ = null;
        }
        var pUrl = parent.location.href;
        console.log("pUrl:" + pUrl);
        share.loadCookie__();
        //share.setConsts__();
        if (share.uiDebug == 0 && page == pUrl && page.indexOf("container.htm") < 0) {
          var strs = page.split("/fe/");
          var container = "./container.htm#" + encodeURIComponent(strs[1]);
          console.log("openContainer:" + container);
          parent.window.open(container);
          return;
        }

        $(window).bind("beforeunload", share.beforeUnload__);

        // share.disablePullDown__();
        share.hideBottomInfo__();
        parent.window.scrollTo(0, 0);
        share.genDict__();
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

        if (!share.isFromBrowser__() && !share.isInFrame__()) {
          share.loadCordova__();
        }
        $.ajaxSetup({
          timeout: share.ajaxTimeout__
        });

        $("#loading").addClass("hide");
        if (window.Pace) {
          share.log__("pace loaded");
          Pace.on(
            "hide",
            function () {
              $("#body").css("display", "");
              share.autoSetSize__();
            },
            null,
            true
          );
        } else {
          share.log__("pace not loaded");
          share.autoSetSize__();
        }
        share.initWechat__();
        share.extendJquery__();
        if (window.shareBuffer != null) {
          share.user__ = window.shareBuffer;
          if (share.isInFrame__()) {
            parent.mhgl_share.user__ = share.user__;
          }
          share.setCache__("user", share.user__);
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

      getMailboxes__: function (email, succ, fail) {
        var select = "select *";
        var from = " from tmailbox";
        var where = " where email=?";
        var orderby = " order by name";
        share.dbQueryPaged__(
          {
            select: select,
            from: from,
            where: where,
            orderby: orderby,
            params: [email],
            pageIndex: 1,
            pageSize: 65536
          },
          succ,
          fail
        );
      },

      getMails__: function (
        email,
        mailBoxId,
        mailBoxPath,
        pageIndex,
        pageSize,
        succ,
        fail
      ) {
        var options = {
          email: email,
          mailBoxPath: mailBoxPath,
          mailBoxId: mailBoxId,
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

        return;

        var select = "select *";
        var from = " from tmail";
        var where = " where email=?";
        var orderby = " order by name";
        share.dbQueryPaged__(
          {
            select: select,
            from: from,
            where: where,
            orderby: orderby,
            params: [email],
            pageIndex: 1,
            pageSize: 65536
          },
          succ,
          fail
        );
      },
      goback__: function () {
        if (share.isInFrame__()) {
          parent.document
            .getElementById("mainFrame")
            .contentWindow.history.go(-1);
        } else {
          window.history.go(-1);
        }
      },
      setActionSheetButtonText__: function (id, text) {
        $("#actionSheetButton" + id).html(text);
      },
      startRecord__: function (voiceRecorded) {
        wx.startRecord();
        wx.onVoiceRecordEnd({
          // 录音时间超过一分钟没有停止的时候会执行 complete 回调
          complete: voiceRecorded
        });
      },

      stopRecord__: function (success) {
        wx.stopRecord({
          success: success
        });
      },

      uploadVoice__: function () { },

      initWechat__: function () {
        if (share.isFromWechatBrowser__()) {
          share.log__("getting wx config");
          var url = document.location.href;
          $.ajax({
            type: "GET",
            async: true,
            url:
              share.getBaseUrl__() +
              "/mvc/wx/getConfig?gzhName=lbddService&url=" +
              encodeURIComponent(url),
            dataType: "jsonp",
            jsonp: "js",
            success: function (json) {
              share.wxConfig__(json);
            },
            error: function (e) {
              share.handleAjaxError__(e);
            }
          });
        }
      },

      wxConfig__: function (config) {
        share.log__("calling wx config");
        if (config.appid == null) {
          if (share.getCache__("wxConfigError") == 1) {
          } else {
            share.setCache__("wxConfigError", 1);
            share.toastError__(config.message, 2000);
          }
          return;
        }
        wx.config({
          debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
          appId: config.appid, // 必填，公众号的唯一标识
          timestamp: config.timestamp, // 必填，生成签名的时间戳
          nonceStr: config.noncestr, // 必填，生成签名的随机串
          signature: config.signature, // 必填，签名，见附录1
          jsApiList: [
            "scanQRCode",
            "chooseImage",
            "uploadImage",
            "startRecord",
            "stopRecord",
            "onVoiceRecordEnd",
            "uploadVoice"
          ]
          // config.jsApiList
          // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
        });

        wx.ready(function () {
          share.log__("config succeeded");
        });

        wx.error(function (res) {
          // share.log__("wxconfig error:"+JSON.stringify(res));
          dialog = share.toastError__(
            "wxConfig错误:" + JSON.stringify(res),
            2000
          );
        });
      },
      setConsts__: function () {
        if (BootstrapDialog) {
          BootstrapDialog.DEFAULT_TEXTS.CANCEL = "取消";
          BootstrapDialog.DEFAULT_TEXTS.OK = "确认";
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
      isFromBrowser__: function () {
        share.log__(document.location.href);
        if (document.location.href.lastIndexOf("http", 0) === 0) {
          return true;
        }

        return false;
      },

      todo__: function (info) {
        share.toastWarning__(info);
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
      confirm__: function (message, callback) {
        var dialog = BootstrapDialog.confirm({
          type: BootstrapDialog.TYPE_PRIMARY,
          title: "确认",
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
          callback: callback
        });

        return dialog;
      },
      defaultScanOptions__: {
        start: 0,
        labelWidth: 55,
        labelHeight: 35,
        rectSize: 240.0,
        rectAlpha: 0.4,
        crossLength: 10,
        scanning: "扫描中...",
        scanPaused: "扫描暂停，点这里继续",
        waitingForScan: "等待扫描，可点这里切换",
        cancelButton: "取消",
        finishButton: "完成",
        formats: "QR_CODE,PDF_417",
        preferFrontCamera: false, // iOS and Android
        showFlipCameraButton: false, // iOS and Android
        guide: "放在框中央，扫码爽爽爽",
        prompt: "轻触屏幕任意位置继续扫描\n也可点选输入框"
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
      timeFormat__: function (time, fmt) {
        if (time.time) {
          time = new Date(time.time);
        } else {
          time = new Date(time);
        }
        if (fmt == null) {
          var ms = time.getTime();
          var now = new Date();
          if (now - ms < 24 * 60 * 60 * 1000) {
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
      needCordova__: function () {
        return !share.isFromBrowser__();
      },
      loadCordova__: function () {
        if (!share.needCordova__()) {
          return;
        }
        if (jQuery.browser.mobile || jQuery.browser.iPad) {
          var jsUrl = "../../cordova.js";
          if (document.location.href.lastIndexOf("http", 0) === 0) {
            jsUrl = "../vendor/cordova/cordova.js";
          }

          console.log("loading cordova");
          share.loadJs__("cordova", jsUrl, share.onCordovaLoaded__);
        }
      },
      onCordovaLoaded__: function () {
        console.log("on cordova loaded");
        document.addEventListener("deviceready", share.onDeviceReady__, false);
      },
      connectDb__: function () {
        var db = window.sqlitePlugin.openDatabase({
          name: "chat.db",
          location: "default",
          androidDatabaseProvider: "system"
        });
        share.db = db;
      },
      queryFirst__: function (options, succ, fail) {
        if (share.containerCalled__("queryFirst__", options, succ, fail)) {
          return;
        }

        share.db.readTransaction(
          function (tx) {
            tx.executeSql(
              options.sql,
              options.params,
              function (tx, rs) {
                var res = null;
                if (rs.rows.length > 0) {
                  res = rs.rows.item(0);
                }
                succ && succ(res);
              },
              function (tx, error) {
                fail && fail(error);
              }
            );
          },
          function (error) {
            fail(error);
          }
        );
      },
      sqlBatch__: function (options, succ, fail) {
        if (share.containerCalled__("sqlBatch__", options, succ, fail)) {
          return;
        }

        share.callNodejs__(
          {
            func: "sqlBatch",
            params: options
          },
          succ,
          fail
        );

        //share.db.sqlBatch(options, function (tx, res) { succ && succ(res) }, fail);
      },
      deviceReadyFunc__: [],
      onDeviceReady__: function () {
        console.log("on device ready start");

        //share.connectDb__();

        share.initBackgroundMode__();
        var funcs = share.deviceReadyFunc__;
        share.deviceReadyFunc__ = null;
        for (var i = 0; i < funcs.length; ++i) {
          funcs[i]();
        }

        console.log("on device ready end");
      },
      initSms__: function (handler) {
        if (share.deviceReadyFunc__ != null) {
          console.log("device not ready");

          share.deviceReadyFunc__.push(function () {
            share.initSms__(handler);
          });

          return;
        }

        if (window.SMS == null) {
          console.log("SMS plugin not ready");
          return;
        }

        document.addEventListener("onSMSArrive", handler.onSmsArrive);
        window.SMS.startWatch(
          function () {
            console.log("start watching sms");
          },
          function () {
            console.log("failed to start watching sms");
          }
        );
      },
      initBackgroundMode__: function () {
        var bgm = cordova.plugins.backgroundMode;
        if (bgm && bgm.inited != 1) {
          bgm.inited = 1;
          bgm.setDefaults({
            title: "Reminder",
            text: "in background",
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
          bgm.overrideBackButton();
          bgm.isActive(function (bool) {
            console.log("screen off");
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
        return window.frameElement && window.frameElement.tagName == "IFRAME";
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
        if (share.isInFrame__()) {
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
        store.remove(share.packageName + key);
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

      getCurrentClass__: function (classId, success, fail, notHandleCodes) {
        if (share.isInFrame__()) {
          return parent.mhgl_share.getCurrentClass__(
            classId,
            success,
            fail,
            notHandleCodes
          );
        }

        if (share.currentClass__ != null) {
          if (success != null) {
            success(share.currentClass__);
          }

          return share.currentClass__;
        }

        if (!share.useFrame__()) {
          var c = share.getCache__("CurrentClass");
          if (c != null) {
            share.currentClass__ = JSON.parse(c);
            if (success != null) {
              success(share.currentClass__);
            }

            return share.currentClass__;
          }
        }

        if (classId == null) {
          return null;
        }

        share.getClass__(
          classId,
          function (clazz) {
            share.setCurrentClass__(clazz);
            success && success(clazz);
          },
          fail,
          notHandleCodes
        );

        return false;
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
          console.log("open " + url + " in appBrowser");
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
            //win = window.open(url, target);
            document.location.href = url;
          }
        } else {
          //win = window.open(url, target);
          document.location.href = url;
        }

        return win;
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
          i.dont.exist += 0; // doesn't exist- self's the point
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
      logLevel__: 0,
      log__: function (info) {
        //console.log(info);
        share.logData__.push(info);
      },
      log__old: function (info) {
        var now = new Date();
        now.minutes = now.getMinutes();
        now.seconds = now.getSeconds();
        now.nanos = now.getMilliseconds() * 1000;
        now.time = now.getTime();
        var time = share.timeFormat__(now, "mm:ss.S ");
        var st = share.getStackTrace__();
        var prefix =
          " <p>&nbsp;&nbsp;" +
          st[1] +
          "</p><p>&nbsp;&nbsp;" +
          st[2] +
          "</p><p>&nbsp;&nbsp;" +
          st[3] +
          "</p>";
        if (share.logLevel__ == share.logLevelPage__) {
          if (typeof info === "function") {
            info = info();
          }

          alert(info);
        } else {
          if (typeof info === "function") {
            info = info();
          }

          share.consoleLog__(info);
        }
      },
      consoleLog__: function (info) {
        if (share.logLevel__ > 0) {
          console.log(info);
        }
      },
      getSelf: function () {
        if (share.isInFrame__()) {
          return parent.mhgl_share;
        }

        return share;
      },
      debug__: function (info) {
        share.log__(info);
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
        return null;
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

          res += arr[i].name + '<' + arr[i].address + '>';
        }

        return res;
      },
      setCache__: function (key, value, options) {
        if (typeof value != "string") {
          value = JSON.stringify(value);
        }

        store.set(share.packageName + key, value);
        if (key == "user") {
          console.log("=================================================");
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
        share.log__("share.toLogin__ start");
        if (share.isFromWechatBrowser__()) {
          share.log__("前往微信授权");
          var to = $("#appLbddLoginUrl").text();
          var page = share.getPage__();
          to = to.replace(
            /#PAGE#/g,
            encodeURIComponent(encodeURIComponent(page))
          );
          share.log__(to);
          share.toastInfo__("请授权微信登录", 1500, function () {
            document.location = to;
          });
        } else {
          share.log__("前往登录页");
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
          share.toastError__("内部错误", 3000);
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
            share.toastError__("未被授权", 3000);
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
            share.log__("user changed");
            share.setCache__("user", newUser);
            share.loadCookie__();
            if (navbar) {
              share.log__("reinit navbar");
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
          return share.toast__(
            "出错啦",
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
            "提示",
            message,
            showTime,
            BootstrapDialog.TYPE_WARNING,
            onHide
          );
        }
      },
      toastInfo__: function (message, showTime, onHide) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            "提示",
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
      toastSuccess__: function (message, showTime, onHide) {
        if (BootstrapDialog == null) {
          onHide && onHide();
        } else {
          return share.toast__(
            "恭喜",
            message,
            showTime,
            BootstrapDialog.TYPE_SUCCESS,
            onHide
          );
        }
      },
      toastQuerying__: function () {
        var dialog = share.toastWaiting__("查询中");
        return dialog;
      },
      toastWaiting__: function (message) {
        share.debug__("toastWaiting:" + message);
        var dialog;
        if (window.Pace) {
          share.debug__("pace was loaded");
          Pace.stop();
          var onHide = function () {
            if (window.Pace) {
              Pace.stop();
            }
          };

          dialog = share.toastInfo__(
            message + "<div id='pace_target1'></div>",
            -1,
            onHide
          );
          // Pace.start({target:'#pace_target'});
          Pace.start();
        } else {
          share.debug__("pace not loaded");
          dialog = share.toastInfo__(
            message + " <span class='loading4'></span>",
            -1
          );
        }
        return dialog;
      },
      handleAjaxError__: function (e, preHandle, postHandle) {
        if (preHandle != null) {
          preHandle();
        }

        share.toastError__(
          "错误信息:" + e.statusText + "<br>请检查您的网络连接是否正常",
          3000
        );
        if (e.responseText) {
          share.log__(e.responseText);
        } else {
          share.log__("no responseText");
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
        var dialog = BootstrapDialog.show({
          type: type ? type : BootstrapDialog.TYPE_PRIMARY,
          size: BootstrapDialog.SIZE_SMALL,
          title: title,
          message: message,
          closable: closable,
          onshow: onshow,
          onshown: onDialogShown,
          onhide: onHide
        });

        function onshow(d) {
          var $this = d.$modal;
          // share.log__($share.html__());
          var $modal_dialog = $this.find(".modal-dialog");
          $modal_dialog.css("display", "none");
        }

        function onDialogShown(d) {
          /*
           */
          var $this = d.$modal;
          // share.log__($share.html__());
          var $modal_dialog = $this.find(".modal-dialog");
          var sh = document.body.scrollHeight;
          var wh = window.screen.height;
          var yo = window.pageYOffset;
          if (share.isInFrame__()) {
            yo = parent.document.documentElement.scrollTop;

            var ybo = parent.document.body.scrollTop;
            if (yo < ybo) {
              yo = ybo;
            }
          } else {
            yo = 0;
          }

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
          onShown && onShown();
        }

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
              share.log__("dialog do close:" + dialog.options.message);
              dialog.doClose();
              setTimeout(function () {
                dialog.onClosed.forEach(function (item, i) {
                  if (typeof item === "function") {
                    item();
                  }
                });
              }, 200);
            } else {
              // share.log__("set canClose=true");
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

      closeDialog__: function (onClosed) {
        share.log__("closeDialog");

        if (share.dialog__) {
          if (typeof onClosed === "function") {
            if (share.dialog__.onClosed == null) {
              share.dialog__.close();
              share.dialog__ = null;
              onClosed();
            } else {
              share.dialog__.onClosed.push(onClosed);
              share.dialog__.close();
              share.dialog__ = null;
            }
          } else {
            share.dialog__.close();
          }
        } else {
          if (typeof onClosed === "function") onClosed();
        }
      },

      showDialog__: function (title, content, buttons, onHide, onShown) {
        var now = Date.now();
        var template = $("#templateDialog").html();
        template = template.replace(/#content#/g, content);
        template = template.replace(/#properties#/g, "");
        var buttonTemplate = $("#templateDialogButton").html();
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
              $("#dialogButton" + i + "_" + now).on("click", item.onTap);
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
        var template = $("#templateActionSheet").html();
        template = template.replace(/#content#/g, content);
        template = template.replace(/#properties#/g, "");
        var buttonTemplate = $("#templateActionSheetButton").html();
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
          title ? title:"更多选择",
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
      getAttachments__: function (item) {
        var attaches = [];
        try {
          item.bodyStructure = JSON.parse(item.bodyStructure);
        } catch (e) {

        };

        if (item.bodyStructure && item.bodyStructure.childNodes && item.bodyStructure.childNodes.length > 1) {
          var ch = item.bodyStructure.childNodes;
          for (var i = 0; i < ch.length; ++i) {
            if (ch[i].dispositionParameters && ch[i].dispositionParameters["filename"]) {
              attaches.push(ch[i]);
            }
          }
        }

        return attaches;
      },
      getSenderName__: function (item) {
        var senderName = "";
        try {
          var sender = JSON.parse(item.sender);
          senderName = sender[0].name;
          if (senderName == null || senderName == "") {
            senderName = sender[0].address;
          }
        } catch (e) {

        }

        return senderName;
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
          mail: mail
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
      sendMessage__: function (to, publicKey, message, succ, fail) {
        var account = share.user__;
        var id = share.uuid__();
        var groupId = "";
        var params = {
          email: share.user__.email,
          to: to,
          publicKey: publicKey,
          subject: "freechat:" + id + ":" + groupId, // + ":" + message,
          content: message
        };

        share.dialog__ = share.toastWaiting__("正在发送，请稍候...");

        share.callNodejs__(
          {
            func: "sendMessage",
            params: params
          },
          function (res) {
            share.closeDialog__();
            var sql =
              "insert or replace into tmessage(id,email,roomId,senderName,senderEmail,content,type,sendTime,createTime) values(?,?,?,?,?,?,?,?,?)";
            var roomId = to;
            if (groupId != "") {
              roomId = groupId;
            }

            var now = new Date().getTime();
            share.sqlBatch__(
              [
                [
                  sql,
                  [
                    id,
                    share.user__.email,
                    roomId,
                    share.user__.name,
                    share.user__.email,
                    message,
                    "",
                    now,
                    now
                  ]
                ]
              ],
              succ,
              fail
            );
          },
          function (e) {
            share.closeDialog__();
            fail && fail(e);
          }
        );
      },
      addFriend__: function (name, email, roomId, succ, fail) {
        console.log("add friend:name=" + name + ",email=" + email);

        var account = share.user__;
        var id = share.uuid__();
        var roomId = "";
        var params = {
          email: share.user__.email,
          name: name,
          to: email,
          roomId: roomId
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
      setWarehouseCaller__: function (caller) {
        share.setCache__("warehouse.caller", caller);
      },
      loadCookie__: function () {
        if (share.isInFrame__()) {
          share.user__ = parent.mhgl_share.user__;
          share.logLevel__ = parent.mhgl_share.logLevel__;
        } else {
          var userStr = share.getCache__("user");
          share.log__("user=" + userStr);
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

        share.logLevel__ = share.getCache__("ll");
        if (share.logLevel__ == null) {
          share.logLevel__ = share.defaultLogLevel__;
        }

        if (share.logLevel__ < share.logLevelPage__) {
          $("#log").html("");
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
        share.log__("logout");
        share.clearUserInfo__();

        var dialog = share.toastWaiting__("退出中");
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

            share.toastSuccess__("您已成功退出", 1500, function () {
              document.location = "./user.login.htm";
            });
          },
          error: function (e) {
            dialog.close();
            share.toastSuccess__("您已成功退出", 1500, function () {
              document.location = "./user.login.htm";
            });
          }
        });
      },
      setString__: function (str) {
        share.string__ = str;
        if (share.isInFrame__()) {
          parent.mhgl_share.string__ = str;
        }
      },
      getString__: function () {
        return share.getSelf().string__;
      },
      login__: function (u, p, fail) {
        share.log__("login:u=" + u + "&p=" + p);
        var dialog = share.toastWaiting__("登录中");
        var login = u;
        var password = p;

        $.ajax({
          type: "GET",
          async: true,
          url:
            share.getBaseUrl__() +
            "/mvc/fe/user/login?login=" +
            login +
            "&password=" +
            password,
          dataType: "jsonp",
          jsonp: "js",
          success: function (json) {
            dialog && dialog.close();
            if (fail == null) {
              if (share.errorProcessed__(json) != 0) {
                return;
              }
            } else {
              if (json.code != null && json.code != 0) {
                fail(json);
                return;
              }
            }

            if (json.ll) {
              share.setCache__("ll", json.ll);
              parent.mhgl_share.logLevel__ = json.ll;
              mhgl_share.logLevel__ = json.ll;
              return;
            }

            if (share.isInFrame__()) {
              parent.mhgl_share.user__ = json;
            }

            var res = share.setCache__("user", JSON.stringify(json), {
              // path : "/",
              expires: 365
            });
            share.setCache__("login", json.login, {
              // path : "/",
              expires: 365
            });
            res = share.getCache__("user");
            share.log__("cookie=" + res);

            share.toastSuccess__("登录成功", 1500, function () {
              var page = share.getPage__();
              if (json.config && json.config.string) {
                share.setString__(
                  $.extend(share.getString__(), json.config.string)
                );
              }
              if (json.config && json.config.qrUrl) {
                share.open__(share.getBaseUrl__() + json.config.qrUrl);
              } else if (page == null || page == "null" || page == "") {
                share.open__($("#homepage").attr("href"), "_self");
              } else {
                share.setPage__(null);
                share.open__(page);
              }
            });
          },
          error: function (e) {
            dialog.close();
            share.handleAjaxError__(e);
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
              console.log("readyState of " + sid + ":" + nodeScript.readyState);
              if (nodeScript.ready) {
                console.log(sid + " ready");
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
      },
      /* edu start */
      edu__: {
        isOwner: function (id) {
          var cc = share.getCurrentClass__();
          if (cc == null) {
            return false;
          }
          return cc.ownerId == (id ? id : share.user__.id);
        },
        isManager: function () {
          var cc = share.getCurrentClass__();
          if (cc == null) {
            return false;
          }
          var isTeacher = false;
          if (cc.myMember) {
            isTeacher =
              cc.myMember.userType == "0" ||
              cc.myMember.memberRole == 50 ||
              cc.myMember.memberRole == 100 ||
              cc.myMember.userType == "1";
          }

          return isTeacher || share.edu__.isOwner();
        }
      }
      /* edu end */
    };

    $(function () {
      share.initialize__();
    });

    return share;
  })();

console.log("share.js loaded:" + document.location.href);
