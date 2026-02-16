window.mhgl_mail =
  window.mhgl_mail ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var storage = window.localStorage;
    var key = "toRemind";
    var timerSet = 0;
    var item;
    var lastMessageDialog;
    var vibrateConfig = [500, 200, 500, 200, 1000];
    var self = {
      items: null,
      fullscreen: 0,
      lastSuccessTime__: 0,
      initialize: function () {
        share.debug__("mhgl_mail.init");
        self.bindEvents();
        if (share.user__ == null) {
          share.toLogin__();
          return;
        }
        self.load__();
        self.translate__();
      },
      translate__: function () {
        let ph = {
          "#searchName": share.string.searchGroup,
        };

        Object.entries(ph).forEach(([key, value]) => {
          share.setPlaceholder__(key, value);
        });

        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",

          ".senderName": "senderName",
          ".toEmail": "toEmail",
          ".ccEmail": "ccEmail"
        };

        Object.entries(html).forEach(([key, value]) => {
          $(key).html(share.string[value]);
        });
      },
      load__: function () {
        var si = share.getSelectedItem__();
        share.parseMail__(si, self.showItem__, function (e) {
          share.toastError__(e);
        });
      },
      toReply__: function () {
        var buttons = [];
        buttons.push({
          text: share.getString__("reply"),
          onTap: function () {
            self.toMailSend__("reply");
          }
        });
        buttons.push({
          text: share.getString__("replyAll"),
          onTap: function () {
            self.toMailSend__("replyAll");
          }
        });
        buttons.push({
          text: share.getString__("forward"),
          onTap: function () {
            self.toMailSend__("forward");
          }
        });
        buttons.push({
          text: share.getString__("forwardAsChat"),
          onTap: function () {
            self.toSendAsChat__();
          }
        });

        share.popupAction__('', buttons);
      },
      toSendAsChat__: function () {
        share.closeDialog__();
        share.selectGroup__(function (group) {
          let room = group;
          var bs = self.item.bodyStructure;
          var res = {};

          share.getHtmlPlainPart__(bs, res);
          var html = res.html;
          var plain = res.plain;
          let msg = null;
          if (html) {
            msg = { type: "m", data: bs.body };
          } else {
            msg = { type: "T", data: bs.body };
          }

          let dialog = share.toastWaiting__(share.getString__("mailForwarding"), 1000);
          share.saveOwnMessage__(room, msg,
            function (res) {
              share.sendMessage__(room, res, function (json) {
                dialog.close();
                share.toastSuccess__(share.getString__("sendSuccess"));
              }, function (e) {
                dialog.close();
                share.toastError__(e);
              });
            },
            function (e) {
              dialog.close();
              share.toastError__(e);
            });
        });
      },
      doMailSend__: function (action, to) {
        self.item.action = action;
        if (to) {
          self.item.mailTo = to;
        }
        share.setCache__("mail.send", self.item);
        share.open__("./mail.send.htm");
      },
      toMailSend__: function (action, to) {
        if (action == "forward") {
          var succ = function (res) {
            if (res.downloaded < res.files.length) {
              share.toastError__(share.getString__("downloadAttachmentFirst"), 5000);
            } else {
              self.item.files = res.files;
              self.doMailSend__(action, to);
            }
          }

          var params = self.item;
          share.callNodejs__({
            func: "getAttachmentsInfo",
            params: params
          }, succ);
        } else {
          self.doMailSend__(action, to);
        }
      },
      showItem__: function (item) {
        $("#loading").addClass("hide");
        self.item = item;
        var templateEmail = $("#templateEmail").html();
        $("#sender").html($("#sender").html().replace("#sender#", share.getEmails__(item.sender, templateEmail)));
        var mailTo = share.getEmails__(item.mailTo, templateEmail);
        $("#mailTo").html($("#mailTo").html().replace(/#mailTo#/, mailTo.join(";")));
        var cc = share.getEmails__(item.cc, templateEmail);
        if (cc.length == 0) {
          $("#cc").addClass("hide");
        } else {
          $("#cc").html($("#cc").html().replace(/#cc#/, cc.join(";")));
        }

        $("#subject").html(item.subject);
        $("#sentTime").html(share.timeFormat__(item.createTime));

        share.onClick__($("#reply"), self.toReply__);

        var template = $("#templateAttachment").html();
        var html = [];
        var attachments = share.getAttachments__(item);
        item.attachments = attachments;
        if (attachments.length > 0) {
          for (var i = 0; i < attachments.length; ++i) {
            var itemHtml = template.replace(/#id#/g, i);
            var fileName = attachments[i].parameters.name;
            //var fileName = attachments[i].dispositionParameters["filename"];
            if (fileName == null) {
              continue;
            }
            fileName = share.shrinkString__(fileName, 20);
            itemHtml = itemHtml.replace(/#fileName#/g, fileName);
            html.push(itemHtml);
          }
          $("#listAttachments").html(html.join(""));
          $("#listAttachments").removeClass("hide");
          share.onClick__($(".attachmentItem"), function () {
            self.attachmentClicked__(this);
          });
        }


        share.onClick__($(".email"), function (e) {
          var email = $(this).attr("data");
          var name = $(this).html();
          var buttons = [];
          buttons.push({
            text: share.getString__("sendMail"),
            onTap: function () {
              var to = [{ name: name, address: email }];
              self.toMailSend__("new", JSON.stringify(to));
            }
          });

          buttons.push({
            text: share.getString__("sendChat"),
            onTap: async function () {
              await share.closePopup__();
              share.toChat__(name, email);
            }
          });

          share.popupAction__(email, buttons);
        });

        $(".loading").addClass("hide");
        $(".mailContainer").removeClass("hide");
        self.containerWidth = $("#fullscreen").parent().width();

        if (share.isFromDevice__()) {
          $("body").css("width", window.screen.width + "px");
        }
        self.showMailBody__(item, html);
        share.mailRead__(item);
      },

      toDownload__: function (index) {
        var params = self.item;
        params.indexClicked = index;
        share.confirm__(share.getString__("confirmToDownloadAndOpen"), function (confirmed) {
          if (confirmed) {
            var fail = function (err) {
              share.toastError__(err);
            };
            var getProgress = function (att) {
              if (att.downloaded >= att.size) {
                return share.getString__("downloaded", share.getSize__(att.size), share.getSize__(att.size));
              }
              return share.getString__("downloading", share.getSize__(att.downloaded), share.getSize__(att.size));
            };
            var succ = function (att) {
              if (att.filePath) {
                $("#progress_" + index).html(getProgress(att));

                $("#bodyHtml").attr("src", "./empty.html");
                //$("#bodyHtml")[0].contentWindow.location.reload(true);
                self.toOpenAttachment__(att);
              } else {
                $("#progress_" + index).html(getProgress(att));
                share.callNodejs__({
                  func: "downloadAttachment",
                  params: params
                }, succ, fail);
              }
            };

            share.callNodejs__({
              func: "downloadAttachment",
              params: params
            }, succ, fail);
          }
        });
      },
      showMailBody__: function (item, html) {
        var bs = item.bodyStructure;
        var res = {};

        share.getHtmlPlainPart__(bs, res);
        var html = res.html;
        var plain = res.plain;

        if (html) {
          $('#bodyHtml').on('load', function () {
            var iframe = $(this)[0];
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;


            var body = bs.body.replace(/src="cid:(.*?)"/g, `src="http://127.0.0.1:7902/innerImg/$1"`);
            body = body.replace(/src='cid:(.*?)'/g, `src="http://127.0.0.1:7902/innerImg/$1"`);
            body = body.replace(/src=cid:(.*?)([ >])/g, `src="http://127.0.0.1:7902/innerImg/$1"$2`);
            body = share.filterXss__(body);
            try {
              let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              iframeDoc.write(body);
            } catch (e) {
              share.error__(e);
            }
            //$('#bodyHtml').replaceWith(item.body);
            $('#bodyHtml').removeClass("hide");

            var iframe = $('#bodyHtml')[0];
            var iframeWin = iframe.contentWindow || iframe.contentDocument.parentWindow;
            if (iframeWin.document.body) {
              setTimeout(function () {
                // 拦截所有点击事件（包括<a>、按钮等触发的跳转）
                iframeDoc.addEventListener('click', function (e) {
                  const link = e.target.closest('a');
                  // 1. 拦截<a>标签跳转
                  if (link) {
                    e.preventDefault(); // 阻止默认跳转
                    let url = link.href;
                    console.log('link in mail clicked:', url);
                    parent.parent.parent.mhgl_share.openLink__(url);
                  }
                }, true);
                self.fullscreenOff();
              }, 200);
            }
          });
          $("#bodyHtml").attr("src", "./empty.html");

        } else if (plain) {
          $("#bodyText").html(bs.body.replace(/\r\n/, "<br>").replace(/\n/, "<br>"));
          $("#bodyText").removeClass("hide");
          $("#fullscreen").addClass("hide");
        }
      },

      fullscreenOff: function () {
        var iframe = $('#bodyHtml')[0];
        var iframeWin = iframe.contentWindow || iframe.contentDocument.parentWindow;
        const contentWidth = iframeWin.document.body.scrollWidth;
        const contentHeight = iframeWin.document.body.scrollHeight + 50;
        const scale = self.containerWidth / contentWidth;

        iframe.style.transform = `scale(${scale})`;
        iframe.width = `${contentWidth}px`; // 保持原始宽度
        iframe.height = `${contentHeight}px`; // 根据内容高度调整
      },

      fullscreenOn: function () {
        var iframe = $('#bodyHtml')[0];
        var iframeWin = iframe.contentWindow || iframe.contentDocument.parentWindow;

        iframe.style.transform = `scale(${1})`;
        const contentWidth = iframeWin.document.body.scrollWidth;
        const contentHeight = iframeWin.document.body.scrollHeight + 50;

        iframe.height = `${contentHeight}px`; // 根据内容高度调整
        iframe.width = `${self.containerWidth}px`; // 保持原始宽度
      },

      toOpenAttachment__: function (att) {
        var path = att.filePath;
        if (parent.parent.electron) {
          var shell = parent.parent.electron.shell;
          shell.showItemInFolder(att.filePath);
          if (shell.openItem != null) {
            shell.openItem(att.filePath);
          } else {
            shell.openPath(att.filePath);
          }
        } else if (parent.parent.cordova.InAppBrowser) {
          const link = document.createElement('a');
          var path = att.filePath;
          var u = "http://127.0.0.1:7902" + path;

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

      attachmentClicked__: function (item) {
        var index = item.id.split("_")[1];
        var si = self.item;
        share.debug__(index + " clicked");

        var succ = function (att) {
          if (att.filePath) {
            self.toOpenAttachment__(att);
          }
        };

        var fail = function (err) {
          self.toDownload__(index);
        };

        var params = si;
        params.indexClicked = index;

        share.callNodejs__({
          func: "getAttachmentInfo",
          params: params
        }, succ, fail);
      },
      fullScreenClicked__: function (e) {
        share.debug__("fullScreenClicked");
        window.removeEventListener("resize", self.onResize__);
        if (self.fullscreen == 0) {
          self.fullscreen = 1;
          self.fullscreenOn();
        } else {
          self.fullscreenOff();
          self.fullscreen = 0;
        }

        setTimeout(function () {
          window.addEventListener("resize", self.onResize__);
        }, 100);
      },
      onResize__: function () {
        self.fullScreenClicked__();
      },
      bindEvents: function () {
        share.onClick__($("#fullscreen"), self.fullScreenClicked__);
        window.addEventListener("resize", self.onResize__);
        window.addEventListener('message', (event) => {
          //if (event.origin !== window.location.origin) return;
          let js = JSON.parse(event.data);
          if (js.action == "capture") {
            $('body').append(`<img alt="Canvas Image" src=${js.data} />`);
          }
        });
      }
    };

    $(function () {
      if (share.needInit__(/mail\.htm/g)) self.initialize();
    });

    return self;
  })();

