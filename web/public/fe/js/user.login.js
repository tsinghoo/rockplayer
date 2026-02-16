window.user_login =
  window.user_login ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var vibrateConfig = [500, 200, 500, 200, 1000];
    var self = {
      inputChanged: 0,
      messages: [],
      currentAccount__: null,
      domains__: {
        "hotmail.com": {
          user: "@login@",
          host: "imap-mail.outlook.com",
          port: 993,
          tls: true,
          userSmtp: "@login@",
          hostSmtp: "smtp-mail.outlook.com",
          portSmtp: 587,
          tlsSmtp: { ciphers: "SSLv3" }
        }
      },
      initialize: function () {
        share.debug__("user_login init...");
        parent.window.document.title = share.getString__("me");;
        if (parent.parent.mhgl_share.accounts__) {
          self.accounts__ = parent.parent.mhgl_share.accounts__;
        }
        navbar.highlight__("me");
        navbar.showCommon__();
        share.onClick__($("#buttonFavorite"), self.toFavorite__);
        share.onClick__($("#addAccount"), self.addAccountClicked__);
        share.onClick__($("#buttonLogin"), self.doLogin__);
        share.onClick__($("#buttonClear"), self.confirmClear__);
        $("#lbddGzhIcon").attr("src", share.getBaseUrl__() + "/fe/img/lbddGzh.jpg");
        $("#lbddAppProfile").attr("src", share.getBaseUrl__() + "/fe/img/profile.jpg");
        share.onClick__($("#buttonKey"), self.toSyncKey__);
        $("#tls").on("input", self.tlsInput__);
        $("#tlsSmtp").on("input", self.tlsSmtpInput__);
        $("input").on("input", self.inputChanged__);

        var login = share.getCache__("login");
        if (login) {
          $("#login").val(login);
        }

        if (share.user__ && share.user__.email) {
        } else {
          parent.mhgl_container.historyCount = -1;
        }

        $("#body").css("display", "");
        $("#loading").addClass("hide");
        //self.initRemind__();
        share.registerDeviceReady__(null, self.onDeviceReady__);
        share.onClick__($("#buttonProxy"), self.buttonProxyClicked__);
        share.onClick__($("#buttonHelp"), self.buttonHelpClicked__);
        self.translate__();
      },
      translate__: function () {
        let ph = {
          "#login": share.string.space,
          "#password": share.string.space,
          "#name": share.string.space,
          "#mailSign": share.string.space,
          "#nickName": share.string.space,
          "#user": share.string.space,
          "#host": share.string.space,
          "#port": share.string.space,
          "#userSmtp": share.string.space,
          "#hostSmtp": share.string.space,
          "#portSmtp": share.string.space,
        };

        Object.entries(ph).forEach(([key, value]) => {
          share.setPlaceholder__(key, value);
        });

        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",
          "#loginHint": "currentAccount",
          ".maxToCountHint": "maxToCount",
          "#mailAddressHint": "mailAddress",
          ".mailBoxPassword": "mailBoxPassword",
          "#nameHint": "nameHint",
          "#nickNameHint": "nickNameHint",
          ".imapServerConfig": "imapServerConfig",
          ".accountConfig": "accountConfig",
          ".imapUserHint": "imapUserHint",
          ".imapHostHint": "imapHostHint",
          "#signHint": "signHint",
          ".tlsHint": "tlsHint",
          ".imapPortHint": "imapPortHint",
          ".smtpServerConfig": "smtpServerConfig",
          ".smtpUserHint": "smtpUserHint",
          ".smtpHostHint": "smtpHostHint",
          ".tlsHint": "tlsHint",
          ".smtpPortHint": "smtpPortHint",
          "#buttonLogin": "buttonLogin",
          "#buttonClear": "clear",
          "#account_add": "account_add",
          ".folderSettingButton": "folderSetting",
        };

        Object.entries(html).forEach(([key, value]) => {
          $(key).html(share.string[value]);
        });

      },
      inputChanged__: function (e) {
        self.inputChanged = 1;
      },
      tlsInput__: function (e) {
        let checked = $(this).is(':checked');
        if (checked) {
          $("#port").val(993);
        } else {
          $("#port").val(143);
        }
      },
      tlsSmtpInput__: function (e) {
        let checked = $(this).is(':checked');
        if (checked) {
          $("#portSmtp").val(465);
        } else {
          $("#portSmtp").val(25);
        }
      },
      addAccountClicked__: function (e) {
        self.hideAll__();
        var buttons = [];
        buttons.push({
          text: share.getString__("newAccount"),
          onTap: self.toAddAccount__
        });

        var account = share.user__ || parent.mhgl_share.user__;
        if (account != null) {
          buttons.push({
            text: share.getString__("myNameCard"),
            onTap: self.toCard__
          });
          buttons.push({
            text: share.getString__("exportData"),
            onTap: self.importClicked__
          });
        }

        buttons.push({
          text: share.getString__("scan"),
          onTap: self.toScan__
        });

        buttons.push({
          text: share.getString__("language"),
          onTap: self.toLanguage__
        });

        buttons.push({
          text: share.getString__("proxy"),
          onTap: self.toProxy__
        });

        buttons.push({
          text: share.getString__("helpAndFeedback"),
          onTap: self.toHelp__
        });

        share.popupAction__('', buttons);
      },
      toLanguage__: async function () {
        self.hideAll__();
        await share.closePopup__();

        share.toLanguage__();
      },
      toProxy__: async function () {
        await share.closePopup__();

        share.toProxy__();
      },
      toHelp__: async function () {
        await share.closePopup__();

        share.toHelp__();
      },
      hideAll__: function () {
        $("#qrcode").addClass("hide");
        $("#qrcodeTips").addClass("hide");
        $("#imapLogin").addClass("hide");
        $("#downloadLink").addClass("hide");
        $("#buttons").addClass("hide");
        $("#space").addClass("hide");
        $("#reader").addClass("hide");
        self.scanner && self.scanner.stop().then(() => {
          self.scanner.clear();
          share.debug__("扫描停止");
        }).catch(err => {
          console.error(`无法停止扫描: ${err}`);
        });

        self.scanner = null;
      },
      importClicked__: async function () {
        self.hideAll__();
        $("#qrcode").removeClass("hide");
        $("#qrcode").html("");
        share.closeDialog__();
        if (self.accounts__ == null || self.accounts__.accounts == null || self.accounts__.accounts.length == 0) {
          share.toastWarning__(share.getString__("loginFirstToExportData"));
        } else {
          let res = await share.getDeviceInfo__();

          if (!res.serverStarted) {
            share.toastError__("file server not inited");
            return;
          }
          var sc = self.accounts__.selectedAccount;
          if (sc == null) {
            sc = 0;
          }
          var account = self.accounts__.accounts[sc];

          let info = {
            ips: res.ips,
            port: res.port,
            token: res.token
          }

          var size = 250;
          var qrcode = new QRCode(document.getElementById("qrcode"), {
            text: JSON.stringify(info),
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });

          share.toastWarning__(share.getString__("warningToShowQrcode"), 10000, function () {
            $("#qrcodeTips").html(share.getString__("warningToShowQrcode"));
            $("#qrcodeTips").removeClass("hide");
            var url = "http://127.0.0.1:" + info.port + "/importDb?token=" + info.token;
            $("#downloadLink").html(share.getString__("downloadLink", url));
            $("#downloadLink").removeClass("hide");

            if (parent.parent.cordova && parent.parent.cordova.InAppBrowser) {
              $("a").on('click', function (e) {
                e.preventDefault();
                var url = $(this).attr('href');
                if (url && url.trim().toLowerCase().indexOf("http") == 0) {
                  parent.parent.cordova.InAppBrowser.open(url, '_system');
                }
              });
            }
          });
        }
      },
      onScanned__: function (text) {
        var vCard = self.getVcard__(text);
        self.vCard = vCard;
        if (vCard != null) {
          let content = "";
          var buttons = [];
          if (vCard.email) {
            content = vCard.email;
            buttons.push({
              text: '添加好友',
              onTap: self.toAddFriend__
            });
          }

          if (vCard.ips && vCard.ips.length > 0 && vCard.port) {
            buttons.push({
              text: share.getString__("importData"),
              onTap: self.toDownloadData__
            });
          }

          if (buttons.length == 0) {
            share.toastInfo__(text);
          } else {
            share.popupAction__(content, buttons);
          }
        } else {
          if (text == "") {

          } else if (text.toLowerCase().indexOf("http") == 0) {
            share.openLink__(text, "_system");
          } else {
            share.toastInfo__(text, null, null, share.getString__("scanResult"));
          }
        }
      },
      toDownloadData__: function () {
        var vc = self.vCard;
        if (vc.port == 0) {
          share.toastError__(share.getString__("downloadServiceRequired"));
          return
        }
        if (vc.ips.length == 0) {
          share.toastError__(share.getString__("serverIpRequired"));
          return;
        }
        var i = 0;
        self.toImportDb__(0);
      },
      toImportDb__: function (i) {
        if (i >= self.vCard.ips.length) {
          share.closeDialog__();
          share.toastError__(share.getString__("importDbFailed"));
          return;
        }

        var func = function () {
          var url = "http://" + self.vCard.ips[i] + ":" + self.vCard.port + "/importDb?token=" + self.vCard.token;

          $("#importDbInfo").html(share.getString__("trying") + " " + url);
          var params = {
            func: "importDb",
            params: { url: url }
          };
          var succ = function (res) {
            share.closeDialog__();
            share.toastSuccess__(share.getString__("dataImportSuccess"));
            share.setCache__("user", null);
          }
          var fail = function (err) {
            $("#importDbInfo").html(share.getString__("downloadFailed", err));
            self.toImportDb__(i + 1);
          }

          var update = function (status) {
            let info = share.getString__("downloading", share.getSize__(status.downloaded), share.getSize__(status.total));
            $("#importDbInfo").html(info);
          }

          share.callNodejs__(params, succ, fail, update);
        }

        if (i == 0) {
          var tml = $("#templateImportDb").html();
          tml = tml.replace(/#id#/g, "importDbInfo");
          share.showDialog__(share.getString__("importing"), tml, null, null, func);
        } else {
          func();
        }

      },
      toAddFriend__: function () {
        var succ = function () {
          share.toastSuccess__(share.getString__("addFriendWait4Confirm"), 3000);
        }
        share.addFriend__(self.vCard.name, self.vCard.email, "", succ, share.toastError__);
      },
      getVcard__: function (text) {
        try {
          var vc = JSON.parse(text);
          return vc;
        } catch (e) {
          return null;
        }
      },
      toScan__: async function () {
        self.hideAll__();
        await share.closePopup__();
        if (share.inElectron) {
          var ipcRenderer = parent.electron.ipcRenderer;
          ipcRenderer.invoke('request-media-access', "camera").then((res) => {
            share.debug__(res)

            $("#reader").removeClass("hide");
            function onScanSuccess(decodedText, decodedResult) {
              // handle the scanned code as you like, for example:
              share.debug__(`Code matched = ${decodedText}`, decodedResult);
              self.scanner.stop().then(() => {
                self.scanner.clear();
                self.scanner = null;
                share.debug__("扫描停止");
              });

              self.onScanned__(decodedText);
            }

            function onScanFailure(error) {
              // handle scan failure, usually better to ignore and keep scanning.
              // for example:
              //console.warn(`Code scan error = ${error}`);
            }

            self.scanner = new Html5Qrcode(
              "reader"
            );
            self.scanner.start(
              { facingMode: "environment" }, // 使用后置摄像头
              {
                fps: 10, // 每秒扫描帧数
                qrbox: { width: 300, height: 300 } // 扫描框大小
              },
              onScanSuccess,
              onScanFailure
            ).catch(err => {
              onScanFailure(share.getString__("scanStartFailed", err));
            });
            //self.scanner.render(onScanSuccess, onScanFailure);
          })
        } else {
          parent.parent.cordova.plugins.barcodeScanner.scan(
            function (result) {
              share.debug__("Result: " + result.text + "\n" +
                "Format: " + result.format + "\n" +
                "Cancelled: " + result.cancelled);
              self.onScanned__(result.text);
            },
            function (error) {
              share.toastError__("Scanning failed: " + error);
            },
            {
              preferFrontCamera: false,  // 设置为 true 使用前置摄像头，false 使用后置摄像头
              showFlipCameraButton: true, // 显示切换摄像头按钮
              //prompt: "Place a barcode inside the scan area", // 可选：扫描提示
              resultDisplayDuration: 500, // 可选：扫描结果显示时长
              //formats: "QR_CODE,PDF_417", // 可选：指定支持的条形码格式
              orientation: "portrait" // 可选：锁定扫描界面方向
            }
          );
        }
      },
      toCard__: async function () {
        self.hideAll__();
        $("#qrcode").removeClass("hide");
        $("#qrcode").html("");
        share.closeDialog__();
        if (self.accounts__ == null || self.accounts__.accounts == null || self.accounts__.accounts.length == 0) {
          share.toastInfo__(share.getString__("loginFirst"));
        } else {
          let res = await share.getDeviceInfo__();

          if (!res.serverStarted) {
            share.toastError__("file server not inited");
            return;
          }

          var sc = self.accounts__.selectedAccount;
          if (sc == null) {
            sc = 0;
          }
          var account = self.accounts__.accounts[sc];

          let info = {
            email: account.email,
            name: encodeURI(account.nickName),
            publicKey: account.publicKey
          }

          $("#qrcodeTips").removeClass("hide").html(share.getString__("scanToAddMe"));
          var size = 250;
          var qrcode = new QRCode(document.getElementById("qrcode"), {
            text: JSON.stringify(info),
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      },
      showAccounts__: function () {
        self.accounts__ = parent.parent.mhgl_share.accounts__;
        if (self.accounts__ == null || self.accounts__.accounts == null || self.accounts__.accounts.length == 0) {

          $("#add").removeClass("hide");

          return;
        }

        var sc = self.accounts__.selectedAccount;
        if (sc == null) {
          sc = 0;
        }

        var account = self.accounts__.accounts[sc];
        if (account == null) {
          share.setCache__("user", null);
        } else {
          $("#selectedAccount").val(account.nickName + "-" + account.email);
          $("#login").val(account.email);
          $("#password").val(account.password);
          $("#name").val(account.name);
          $("#mailSign").val(account.mailSign);
          $("#nickName").val(account.nickName);

          $("#maxToCount").val(account.maxToCount);
          $("#user").val(account.user);
          $("#host").val(account.host);
          $("#port").val(account.port);
          $("#tls")[0].checked = account.tls;

          $("#userSmtp").val(account.userSmtp);
          $("#hostSmtp").val(account.hostSmtp);
          $("#portSmtp").val(account.portSmtp);
          $("#tlsSmtp")[0].checked = account.tlsSmtp;
        }

        share.onClick__($("#selectedAccount"), self.selectedAccountClicked__);
        share.onClick__($("#dropdown"), self.selectedAccountClicked__);

        $("#accounts").removeClass("hide");
        $("#add").removeClass("hide");
        $(".buttonProxy").removeClass("hide");
        $(".buttonHelp").removeClass("hide");
      },
      selectedAccountClicked__: function (e) {
        self.showAccountList__(e);
      },
      showAccountList__: async function (e) {
        var itemHtml = [];
        itemHtml.push($("#templateFolderSetting").html());
        var template = $("#templateAccount").html();
        for (var i = 0; i < self.accounts__.accounts.length; ++i) {
          var account = self.accounts__.accounts[i];
          var item = template.replace(/#id#/g, i);
          item = item.replace(/#text#/g, account.nickName + "-" + account.email);
          itemHtml.push(item);
        }

        share.dialog__ = await share.popup__(e.currentTarget, itemHtml.join(""), "bottom", function () {
          share.onClick__($(".accountDelete"), self.toDeleteAccount__);
          share.onClick__($(".account"), self.toSelectLogin__);
          share.onClick__($(".folderSettingButton"), self.toFolderSetting__);
        });
      },
      toFolderSetting__: async function () {
        await share.closePopup__();
        share.toFolderSetting__();
      },
      toSelectLogin__: function (e) {
        share.closePopup__();
        $("#imapLogin").removeClass("hide");
        $("#buttons").removeClass("hide");
        $("#qrcode").addClass("hide");
        var id = e.target.id;
        id = id.split("_")[1];
        if (id == "add") {
          self.toAddAccount__();
        } else {
          var selectedItem = self.accounts__.accounts[id];
          self.emailSelected__(selectedItem);
        }
      },
      toSyncKey__: function (e) {
      },
      toDeleteAccount__: function (e) {
        e.preventDefault();
        e.stopPropagation();
        share.closeDialog__();
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var account = self.accounts__.accounts[id];
        share.confirm__(share.getString__("confirmToDeleteAccount", account.nickName + "-" + account.email), function (confirmed) {
          if (confirmed) {
            self.accounts__.accounts.splice(id);
            share.accounts__ = self.accounts__;
            share.saveAccountToDb__(function () {
              self.showAccounts__();
            }, function (err) {
              share.toastError__(JSON.stringify(err));
            });
          }
        });
      },
      toFavorite__: function () {
        share.open__("./favorite.list.htm");
      },

      loginSucceeded__: async function () {
        parent.parent.mhgl_container.historyCount = -1;
        parent.parent.navFrame.mhgl_share.initialize__();
        parent.parent.navFrame.mhgl_navbar.initialize();
        parent.parent.mhgl_share.accounts__ = self.accounts__;
        share.saveAccount__(share.user__);
        share.wsClose__();
        share.open__("chat.list.htm");
        //
        //parent.parent.navFrame.document.location.href = "./navbar.htm";
      },
      emailSelected__: function (account) {
        self.hideAll__();
        $("#imapLogin").removeClass("hide");
        $("#buttons").removeClass("hide");
        $("#space").addClass("hide");
        $("#login").val(account.email);
        $("#password").val(account.password);
        $("#name").val(account.name);
        $("#mailSign").val(account.mailSign);
        $("#nickName").val(account.nickName);
        $("#maxToCount").val(account.maxToCount);
        $("#user").val(account.user);
        $("#host").val(account.host);
        $("#port").val(account.port);
        $("#tls")[0].checked = account.tls;

        $("#userSmtp").val(account.userSmtp);
        $("#hostSmtp").val(account.hostSmtp);
        $("#portSmtp").val(account.portSmtp);
        $("#tlsSmtp")[0].checked = account.tlsSmtp;

        self.inputChanged = 0;
        // share.setCache__("user", account);
        // share.user__ = account;
        // parent.mhgl_share.user__ = account;
      },
      confirmClear__: function () {
        var login = $("#login").val().trim();
        if (login == '') {
          return;
        }

        share.confirm__(share.getString__("confirmToDeleteAccount", login), function (confirmed) {
          if (confirmed) {
            self.doClear__();
          } else {
            self.toClearForm__();
          }
        });
      },
      toClearForm__: function () {
        share.confirm__(share.getString__("confirmToClearForm"), function (confirmed) {
          if (confirmed) {
            $("#login").val("");
            $("#password").val("");
            $("#name").val("");
            $("#mailSign").val("");
            $("#nickName").val("");
          }
        });
      },
      doClear__: function () {
        var login = $("#login").val().trim();
        var succ = function () {
          self.toClearForm__();
        };
        var fail = function () {

        };
        share.removeAccount__(login, succ, fail);
      },

      onDeviceReady__: function () {
        share.debug__("device ready start");
        var account = share.user__ || parent.mhgl_share.user__;
        if (account == null) {
          //$("#imapLogin").removeClass("hide");
        } else {
          $("#buttonFavorite").removeClass("hide");
          $("#login").val(account.email);
          $("#password").val(account.password);
          $("#name").val(account.name);
          $("#nickName").val(account.nickName);
          $("#imapLogin").addClass("hide");
          $("#buttons").addClass("hide");
          $("#space").removeClass("hide");
        }

        self.showAccount__();

        share.debug__("device ready end");
        let wsConnected = parent.parent.mhgl_share.wsConnected;
        self.onWsChanged__({ connected: wsConnected });
      },
      buttonProxyClicked__: function (e) {
        share.toProxy__();
      },
      buttonHelpClicked__: function (e) {
        share.toHelp__();
      },
      onWsChanged__: function (json) {
        self.proxyConnected = json.connected;
        let proxy = $("#buttonProxy");
        if (json.connected == 1) {
          proxy.attr("src", "./img/proxyOn1.svg");
          proxy.removeClass("fader");
        } else {
          proxy.attr("src", "./img/proxyOff.svg");
        }
      },
      showAccount__: function () {
        var succ = function (res) {
          self.accounts__ = res;
          self.showAccounts__();
        };

        var fail = function (err) {
          share.error__("query on config error: " + err.message);
        };
        share.getAccounts__(
          succ,
          fail
        );
      },
      initRemind__: function () {
        self.remind__();
        setTimeout(self.remind__, 30000);
      },
      remind__: function () {
        navigator.notification.beep(1);
        var i = 0;
        var ms = vibrateConfig;
        var v = function () {
          var t = ms[i];
          navigator.vibrate(t);
          ++i;
          if (i < ms.length) {
            t += ms[i];
            ++i;
            setTimeout(v, t);
          }
        };
        v();
      },

      toWxApp: function () {
        share.open__(wxUrl);
      },

      getAccount__: function (login) {
        login = login.trim().toLowerCase();
        if (
          share.user__ &&
          share.user__.email &&
          share.user__.email.toLowerCase() == login
        ) {
          return share.user__;
        }

        if (self.accounts__ != null && self.accounts__.accounts != null) {
          for (var i = 0; i < self.accounts__.accounts.length; ++i) {
            if (self.accounts__.accounts[i].email.toLowerCase() == login) {
              return self.accounts__.accounts[i];
            }
          }
        }

        var strs = login.split("@");
        var domain = strs[1];
        var account = self.domains__[domain.toLowerCase()];
        if (account == null) {
          account = {
            user: login,
            host: "imap." + domain,
            port: 993,
            tls: true,
            userSmtp: login,
            hostSmtp: "smtp." + domain,
            portSmtp: 465,
            tlsSmtp: true
          };
        } else {
          account.user = account.user.replace(/@login@/, login);
          account.user = account.user.replace(/@user@/, strs[0]);

          account.userSmtp = account.user;
        }

        account.email = login;

        return account;
      },
      doLogin__: async function () {
        share.wsClose__();
        var login = $("#login")
          .val()
          .trim().toLowerCase();
        if (login == "" || login.indexOf("@") < 0) {
          share.toastError__(share.getString__("mailAddressRequired"));
          return;
        }

        $("#login").val(login);

        var name = $("#name")
          .val()
          .trim();
        let error;
        if (name == "") {
          name = login.split("@")[0];
          $("#name").val(name);
          error = 1;
        }

        var nickName = $("#nickName")
          .val()
          .trim();

        if (nickName == "") {
          nickName = name;
          $("#nickName").val(name);
          error = 1;
        }

        if (error) {
          return;
        }

        var mailSign = $("#mailSign")
          .val()
          .trim();
        var password = $("#password").val();
        var user = $("#user")
          .val()
          .trim();
        var host = $("#host")
          .val()
          .trim();
        var port = $("#port")
          .val()
          .trim();
        var tls = $("#tls")[0].checked;

        var account = self.getAccount__(login);

        account.email = login;

        if (user == "") {
          $("#user").val(account.user);
        } else {
          account.user = user;
        }

        if (host == "") {
          $("#host").val(account.host);
        } else {
          account.host = host;
        }

        if (port == "") {
          $("#port").val(account.port);
          $("#tls")[0].checked = account.tls;
        } else {
          account.port = port;
          account.tls = tls;
        }

        account.name = name;
        account.nickName = nickName;
        account.mailSign = mailSign;
        account.password = password;
        account.passwordSmtp = password;

        var succ = function (res) {
          share.updateToast__("toastInfoLqh", "登录IMAP服务器成功");
          account = res;
          self.currentAccount__ = account;
          share.saveAccount__(account, self.trySmtp__);
        };
        var fail = function (e) {
          self.waitingDialog.close();
          self.waitingDialog = null;
          share.toastError__(share.getString__("loginFailed", e));
        };

        let msg = share.getString__("imapLogining");

        self.waitingDialog = share.toastWaiting__(msg);
        await share.wsClose__({});
        share.callNodejs__(
          {
            func: "imapConnect",
            params: account
          },
          succ,
          fail
        );

        return false;
      },
      toAddAccount__: function () {
        self.hideAll__();
        share.closeDialog__();
        $("#login").val("");
        $("#password").val("");
        $("#name").val("");
        $("#nickName").val("");
        $("#mailSign").val("");

        $("#user").val("");
        $("#host").val("");
        $("#port").val("");
        $("#tls")[0].checked = false;

        $("#userSmtp").val("");
        $("#hostSmtp").val("");
        $("#portSmtp").val("");
        $("#tlsSmtp")[0].checked = false;

        $("#imapLogin").removeClass("hide");
        $("#buttons").removeClass("hide");
      },
      trySmtp__: function () {
        var account = self.currentAccount__;

        if (account.smtpPassed == 1 && self.inputChanged != 1) {
          share.user__ = account;
          share.setCache__("user", share.user__);
          parent.mhgl_share.user__ = account;
          self.loginSucceeded__();
          return;
        }

        share.updateToast__("toastInfoLqh", share.getString__("smtpTesting"));
        var password = $("#password").val();
        var user = $("#userSmtp")
          .val()
          .trim();
        var host = $("#hostSmtp")
          .val()
          .trim();
        var port = $("#portSmtp")
          .val()
          .trim();
        var tlsSmtp = $("#tlsSmtp")[0].checked;



        if (user == "") {
          $("#userSmtp").val(account.userSmtp);
        } else {
          account.userSmtp = user;
        }

        if (host == "") {
          $("#hostSmtp").val(account.hostSmtp);
        } else {
          account.hostSmtp = host;
        }

        if (port == "") {
          $("#portSmtp").val(account.portSmtp);
          $("#tlsSmtp")[0].checked = account.tlsSmtp;
        } else {
          account.portSmtp = port;
          account.tlsSmtp = $("#tlsSmtp")[0].checked;
        }

        let maxToCount = $("#maxToCount")
          .val()
          .trim();

        try {
          maxToCount = parseInt(maxToCount);
        } catch (e) {
          maxToCount = 50;
        }

        if (maxToCount < 1) {
          maxToCount = 1;
        }

        account.maxToCount = maxToCount;

        account.password = password;
        account.passwordSmtp = account.password;

        share.callNodejs__(
          {
            func: "trySmtp",
            params: account
          },
          function (res) {
            share.updateToast__("toastInfoLqh", share.getString__("smtpTestSuccess"));
            account.smtpPassed = 1;
            share.saveAccount__(account, function () {
              share.setCache__("user", account);
              share.user__ = account;
              share.setCache__("user", share.user__);
              parent.mhgl_share.user__ = account;
              self.loginSucceeded__();
            });
          },
          function (e) {
            self.waitingDialog.close();
            self.waitingDialog = null;
            share.toastError__("访问失败，请填写正确的SMTP配置", 2000);
          }
        );
      }
    };

    $(function () {
      if (share.needInit__(/user\.login\.htm/g)) self.initialize();
    });

    function testEncode() {
      //'L23PpjkBQqpAF4vbMHNfTZAb3KFPBSawQ7KinFTzz7dxq6TZX8UA'
      //'0283f56c554d525392a231cbc35f2c5efa51985b114bff69abb26f9743207281ed'
      //WIF: KwrdK79cuVYJ9KhadcHTno9UD9S8LCx8CL3aTUaYCm9mvCTjDbMm
      //HEX: 12fdb1ab70a8216c3b70fd6b2fc633555381f1d4cf799af57c9d6198868fb13d
      //0330ba4341421ef6416bd35a9d8813ec874e35442578299b008cd45baf8149711f

      share.callNodejs__(
        {
          func: "encode",
          params: {
            privateKey: "L23PpjkBQqpAF4vbMHNfTZAb3KFPBSawQ7KinFTzz7dxq6TZX8UA",
            publicKey:
              "0330ba4341421ef6416bd35a9d8813ec874e35442578299b008cd45baf8149711f",
            data: "e我是好人"
          }
        },
        function (res) {
          share.debug__("encoded:" + res);
          //share.updateToast__("toastInfoLqh",res);
          share.callNodejs__(
            {
              func: "decode",
              params: {
                privateKey:
                  "KwrdK79cuVYJ9KhadcHTno9UD9S8LCx8CL3aTUaYCm9mvCTjDbMm",
                publicKey:
                  "0283f56c554d525392a231cbc35f2c5efa51985b114bff69abb26f9743207281ed",
                data: res
              }
            },
            function (res) {
              share.debug__("decoded:" + res);
              share.updateToast__("toastInfoLqh", res);
            },
            function (e) {
              share.error__("decode error:" + JSON.stringify(e));
              //share.toastError__("encode error:" + JSON.stringify(e));
            }
          );
        },
        function (e) {
          share.error__("encode error:" + JSON.stringify(e));
          //share.toastError__("encode error:" + JSON.stringify(e));
        }
      );
    }

    return self;
  })();

