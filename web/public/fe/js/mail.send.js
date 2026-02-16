window.mhgl_mail_send =
  window.mhgl_mail_send ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      items: null,
      needSaveDraft: 1,
      draft: null,
      lastSuccessTime__: 0,
      confirmTime__: 0,
      attachments__: [],
      initialize: async function () {
        share.debug__("mhgl_mail.init");
        this.bindEvents();
        if (share.uiDebug == 0 && share.user__ == null) {
          share.toLogin__();
          return;
        }

        $("#loading").addClass("hide");
        let id = share.getParameter__("id");
        if (id != null) {
          self.draft = await share.getDraft__(id);
        }

        self.initEditor__();
        self.translate__();
      },
      translate__: function () {
        let ph = {
          "#mailTo": share.string.toEmails,
          "#cc": share.string.ccEmails,
          "#bcc": share.string.bccEmails,
          "#subject": share.string.subject
        };

        Object.entries(ph).forEach(([key, value]) => {
          share.setPlaceholder__(key, value);
        });

        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",
          
          "#fromHint": "from",
          "#loginHint": "toEmail",
          ".ccLabel": "ccEmail",
          "#subjectHint": "subjectHint",
          "#buttonSend": "send",
          ".bccLabel": "bccLabel",

        };

        Object.entries(html).forEach(([key, value]) => {
          $(key).html(share.string[value]);
        });
      },
      editorInited__: function () {
        share.onClick__($("#buttonSend"), self.doSend__);
        share.onClick__($("#buttonSave"), self.doSave__);
        share.onClick__($("#buttonClose"), self.closePreview__);
        share.onClick__($("#addAttachment"), self.toAddAttachment__);
        share.onClick__($("#file"), function () {
          $(this).val("");
        });
        $("#file").on('change', self.fileSelected__);
        $("#from").val(share.user__.email);
        if (self.draft) {
          $("#subject").val(self.draft.subject);
          $("#mailTo").val(self.draft.mailto);
          $("#cc").val(self.draft.cc);
          $("#bcc").val(self.draft.bcc);
          try {
            self.attachments__ = JSON.parse(self.draft.attachment);
          } catch (e) {

          }

          if (self.attachments__ == null) {
            self.attachments__ = [];
          }


          $("#mailText").val(self.draft.body);
        } else {

          var body = "";

          var si = share.getCache__("mail.send");
          if (si == null) {

          } else {
            si = JSON.parse(si);
            var action = si.action;
            var to = "";
            var cc = "";
            var title = "";
            if (action == "reply") {
              if (si.replyTo) {
                to = share.getMailAddress__(si.replyTo);
              } else {
                to = share.getMailAddress__(si.sender);
              }
              title = "Re:" + si.subject;
              body = 1;
            } else if (action == "replyAll") {
              if (si.replyTo) {
                to = share.getMailAddress__(si.replyTo);
              } else {
                to = share.getMailAddress__(si.sender);
              }

              to = to + ";" + share.getMailAddress__(si.mailTo);

              cc = share.getMailAddress__(si.cc);

              title = "Re:" + si.subject;
              body = 1;
            } else if (action == "forward") {
              title = "Fw:" + si.subject;
              body = 2;
              if (si.files && si.files.length > 0) {
                self.attachments__ = si.files;
              }
            } else if (action == "new") {
              to = share.getMailAddress__(si.mailTo);
            }

            if (body != "") {
              body = " <br>--<br>";
              body += "<br>发件人:" + share.getMailAddressEncoded__(si.sender);
              body += "<br>收件人:" + share.getMailAddressEncoded__(si.mailTo);
              var ccin = share.getMailAddressEncoded__(si.cc);
              if (ccin != "") {
                body = body + "<br>抄送:" + ccin;
              }

              body += "<br>发送时间:" + share.timeFormat__(si.createTime, "yyyy-MM-dd hh:mm:ss");
              body += "<br>主题:" + si.subject;
              body += "<br>" + si.bodyStructure.body;
            }

            $("#mailTo").val(to);
            $("#cc").val(cc);
            $("#subject").val(title);
          }


          var account = share.user__;
          body = "<br>" + account.mailSign + body;
          $("#mailText").val(body);
        }
        self.showAttachments__();
        $(".mailContainer").removeClass("hide");
        self.origMail = self.getMail();
      },

      fileSelected__: function (e) {
        for (let entry of e.target.files) {
          self.attachments__.push(entry);
          //share.debug__(entry.name, entry.webkitRelativePath);
        }

        self.showAttachments__();
      },
      showAttachments__: function () {
        var html = "";
        var template = $("#templateAttachment").html();
        for (var i = 0; i < self.attachments__.length; ++i) {
          var item = self.attachments__[i];
          
          let name = item.name;
          if (item.size) {
            name = item.name + "(" + share.formatFileSize__(item.size) + ")";
          }

          var str = template.replace(/#name#/g, name);
          str = str.replace(/#id#/g, i);
          html = html + str;
        }

        $("#listAttachments").html(html);
        if (html == "") {
          $("#listAttachments").addClass("hide");
        } else {
          $("#listAttachments").removeClass("hide");
          share.onClick__($(".removeAttachment"), function () {
            self.toRemoveAttachment__(this);
          });
        }
      },
      initEditor__: function () {
        CKEDITOR.env.isCompatible = true;
        $("#mailText").ckeditor(
          self.editorInited__,
          {
            extraPlugins: 'colorbutton,imageupload',
            skin: 'moono',
            uiColor: '#CCEAEE',
            language: 'zh-cn',
            height: 280,
            toolbarGroups:
              [
                //{ name: 'editing',     groups: [ 'find', 'selection', 'spellchecker' ] },
                { name: 'basicstyles', groups: ['basicstyles', 'cleanup'] },
                { name: 'paragraph', groups: ['list', 'indent', 'blocks', 'align', 'bidi'] },
                { name: 'forms' },
                { name: 'styles' },
                { name: 'colors' },
                '/',
                { name: 'links' },
                { name: 'insert' },
                { name: 'clipboard', groups: ['clipboard', 'undo'] },
                { name: 'document', groups: ['mode', 'document', 'doctools'] },
                { name: 'tools' },
                { name: 'others' }

              ],
            toolbarLocation: 'top',
            removeButtons: 'Copy,Cut'
          }
        );
      },

      toRemoveAttachment__: function (e) {
        var id = e.id;
        id = id.split("_")[1];
        var item = self.attachments__[id];

        share.confirm__(share.getString__("confirmToDeleteItem", item.name), function () {
          self.attachments__.splice(id, 1);
          self.showAttachments__();
        });
      },

      toAddAttachment__: function (e) {
        $("#file").click();
      },
      getText__: function () {
        var html = $("#mailText").val();
        return html;
      },
      closePreview__: function (e) {
      },
      doSave__: async function (e) {
        await self.saveDraft__();
        share.toastSuccess__(share.getString__("saved"));
      },
      doSend__: function (e) {
        var mail = self.getMail();

        if (mail.to == "" && mail.cc == "" && mail.bcc == "") {
          share.toastError__(share.getString__("toCcBccRequired"));
          return;
        }

        var succ = function (res) {
          share.toastSuccess__(share.getString__("sendSuccess"), 3000, function () {
            self.needSaveDraft = 0;
            window.history.back(-1);
          });
        };

        var fail = function (err) {
          share.toastError__("发送失败:" + JSON.stringify(err), 30000, function () {

          });
        };

        share.callNodejs__({
          func: "sendMail",
          params: mail
        }, succ, fail);
      },

      toDownload__: function (index) {
        var params = self.item;
        params.indexClicked = index;
        share.confirm__(share.getString__("confirmToDownloadAndOpen"), function (confirmed) {
          if (confirmed) {
            var fail = function (err) {
              share.toastError__(err);
            };

            var succ = function (att) {
              if (att.filePath) {
                if (parent.electron) {
                  var shell = parent.electron.shell;
                  if (shell.openItem != null) {
                    shell.openItem(att.filePath);
                  } else {
                    shell.openPath(att.filePath);
                  }
                }
              } else {
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

      attachmentClicked__: function (item) {
        var index = item.id.split("_")[1];
        var si = self.item;
        share.debug__(index + " clicked");

        var succ = function (att) {
          if (att.filePath) {
            if (parent.electron) {
              var shell = parent.electron.shell;
              if (shell.openItem != null) {
                shell.openItem(att.filePath);
              } else {
                shell.openPath(att.filePath);
              }
            }
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
      onAutoEmail__: function (request, response) {
        var pos = $("#" + self.typingInputId)[0].selectionStart;
        var key = $("#" + self.typingInputId).val();
        var start = key.lastIndexOf(";", pos - 1);

        var end = key.indexOf(";", pos - 1);
        if (end < 0) {
          end = key.length;
        }

        key = key.substring(start + 1, end);
        self.typingStart = start;
        self.typingEnd = end;
        share.searchEmail__(key, function (res) {
          response(res);
        });
      },
      beforeUnload__: async function (e) {
        if (self.needSaveDraft == 0) {
          return;
        }
      },
      saveDraft__: async function () {
        let now = new Date().getTime();
        var draft = {
          id: share.uuid__(),
          createTime: now,
          updateTime: now
        };

        if (self.draft) {
          draft = self.draft;
          draft.updateTime = now;
        }

        var account = share.user__;
        draft.email = account.email;

        draft.subject = $("#subject").val();
        draft.body = self.getText__();
        draft.mailTo = $("#mailTo").val();
        draft.cc = $("#cc").val();
        draft.bcc = $("#bcc").val();
        draft.attachment = [];

        for (var i = 0; i < self.attachments__.length; ++i) {
          var att = self.attachments__[i];
          draft.attachment.push({
            name: att.name,
            path: att.path
          });
        }

        await share.saveDraft__(draft);
        self.draft = draft;
      },
      getMail: function () {
        var mail = {};
        var account = share.user__;

        mail.email = account.email;

        mail.html = self.getText__();
        mail.subject = $("#subject").val();
        mail.to = $("#mailTo").val();
        mail.cc = $("#cc").val();
        mail.bcc = $("#bcc").val();
        mail.replyTo = "";
        mail.attachments = [];


        for (var i = 0; i < self.attachments__.length; ++i) {
          var att = self.attachments__[i];
          mail.attachments.push({
            name: att.name,
            path: att.path
          });
        }
        return mail;
      },
      bindEvents: function () {
        window.addEventListener('beforeunload', self.beforeUnload__);

        $(".emailInput").on("focus", function (e) {
          self.typingInputId = e.currentTarget.id;
        });
        $(".emailInput").autocomplete({
          source: self.onAutoEmail__,
          select: function (event, ui) {
            event.preventDefault();
            var val = ui.item.value;
            var input = $("#" + self.typingInputId).val();
            share.debug__("old:" + input);
            input = input.substring(0, self.typingStart + 1) + val + ";" + input.substring(self.typingEnd);

            share.debug__("new:" + input);
            $("#" + self.typingInputId).val(input);
          },
          focus: function (event, ui) {
            event.preventDefault();
          },
        });
      }
    };

    $(function () {
      if (share.needInit__(/mail\.send\.htm/g)) self.initialize();
    });

    return self;
  })();

