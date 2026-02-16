window.mhgl_folder_list =
  window.mhgl_folder_list ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var timerSet = 0;
    var self = {
      items: null,
      lastSuccessTime__: 0,
      inboxIndex: -1,
      spliterLeft: 300,
      initialize: function () {
        share.debug__("mghl_folder_list.init");
        this.bindEvents();
        if (share.user__ == null) {
          share.toLogin__();
          return;
        }
        parent.window.document.title = share.getString__("mailbox");;
        navbar.highlight__("folder");
        navbar.showCommon__();
        mhgl_page.setDoQuery(self.doQuery__);
        mhgl_page.hidePagination__();
        share.onResize__ = self.onResize__;
        share.back__ = self.back__;
        $("#loading").addClass("hide");
        share.registerDeviceReady__(null, self.onDeviceReady__);
        self.translate__();
      },
      translate__: function () {
        let ph = {
          //"#searchName": share.string.searchMailBox,
        };

        Object.entries(ph).forEach(([key, value]) => {
          share.setPlaceholder__(key, value);
        });

        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",

          "#searchNameHint": "searchMailBox"
        };

        Object.entries(html).forEach(([key, value]) => {
          $(key).html(share.string[value]);
        });
      },
      refreshMails__: function () {
        rightFrame.mhgl_page.refresh();
      },
      onMoreMessage__: function () {
        self.refreshMails__();
      },

      onDeviceReady__: function () {
        share.debug__("device ready start");
        var account = share.user__;
        if (account != null) {
          var succ = function (res) {
            if (res && res.nextUid) {
              account.nextUid = res.nextUid;
            }
            self.currentAccount__ = account;
            self.doSearch__();
          };
          var fail = function (e) {
            share.toastError__(account.user + share.getString__("loginFailed"), 1000, function () {
              share.toLogin__();
            });
          };
          share.callNodejs__(
            {
              func: "ensureImapConnected",
              params: account
            },
            succ,
            fail
          );
        }

        share.debug__("device ready end");
      },

      back__: function () {
        if (share.isWideScreen__()) {
          if (window.history.length > 0) {
            rightFrame.window.history.back(-1);
          } else {
            window.history.back(-1);
          }
        } else {
          window.history.back(-1);
        }
      },
      toFolderSetting__: async function () {
        await share.closePopup__();
        share.toFolderSetting__();
      },
      toAddFolder__: async function () {
        await share.closeDialog__();
        share.toCreateMailFolder__(function () {
          mhgl_page.refresh();
        });
      },
      bindEvents: function () {
        $("#searchName").on("input", self.onSearchChanged__);
        share.onClick__($("#buttonSend"), function () {
          
          var buttons = [];
          buttons.push({
            text: share.getString__("composeMail"),
            onTap: self.toSend__
          });
          buttons.push({
            text: share.getString__("drafts"),
            onTap: self.toDraft__
          });
          buttons.push({
            text: share.getString__("newMailbox"),
            onTap: self.toAddFolder__
          });
          buttons.push({
            text: share.getString__("folderSetting"),
            onTap: self.toFolderSetting__
          });

          share.popupAction__('', buttons, this);
        });
        $("#spliter").on('mousedown', function (e) {
          $("#mask").removeClass("hide");
          $("#mask")[0].style.width = $(".rightFrame")[0].style.width;
          $("#mask")[0].style.height = $(".rightFrame")[0].style.height;
          $("#mask")[0].style.left = $("#spliter")[0].style.left;
          self.isDragging = true;
        });

        document.addEventListener('mouseup', function (e) {
          $("#mask").addClass("hide");
          self.isDragging = false;
        });

        document.addEventListener('mousemove', function (e) {
          if (!self.isDragging) {
            return;
          }
          var parent = $("#spliter").parent()[0];
          self.spliterLeft = e.pageX - parent.offsetLeft;
          self.spliterMoved();
        });
      },
      onSearchChanged__: function (e) {
        if (self.toSearch__ == null) {
          self.toSearch__ = setTimeout(self.doSearch__, 1000);
        } else {
          clearTimeout(self.toSearch__);
          self.toSearch__ = setTimeout(self.doSearch__, 1000);
        }
      },
      toSend__: function () {
        share.closeDialog__();
        share.removeCache__("mail.send");
        var target = share.getOpenTarget__(640, "rightFrame");
        share.open__("mail.send.htm", target);
      },
      toDraft__: function () {
        share.closeDialog__();
        var target = share.getOpenTarget__(640, "rightFrame");
        share.open__("draft.list.htm", target);
      },
      doSearch__: function () {
        share.debug__(" folder.list.toSearch");
        self.toSearch__ = null;
        self.keyName = $("#searchName").val();
        mhgl_page.gotoPage(1);
      },
      todo: function () {

        alert("todo");
      },
      showResult__: function (data) {
        share.setSelectedItem__(null, "backwardClicked");
        var html = [];
        var template = $("#template").html();
        mhgl_page.update(data.pageIndex, data.pageSize, data.totalRows);
        var list = data.list;
        self.items = list;

        if (list.length > 0) {
          list.forEach(function (item, i) {
            var itemHtml = template.replace(/#email#/g, "");
            itemHtml = itemHtml.replace(/#id#/g, i);
            var name = item.name;
            itemHtml = itemHtml.replace(/#totalExists#/g, item.totalExists);
            itemHtml = itemHtml.replace(/#name#/g, name);

            itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.name));
            itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.name));

            if (item.name.toLowerCase() == "inbox" || item.name.toLowerCase() == share.getString__("inbox")) {
              self.inboxIndex = i;
            }
            html.push(itemHtml);
          });
          $("#list").html(html.join(""));
          self.addEvent__();
        } else {
          $("#list").html("");
        }

        mhgl_page.hidePagination__();
        $("#body").css("display", "");
        if (share.isWideScreen__()) {
          if (self.inboxIndex >= 0) {
            share.triggerClick__($("#item_" + self.inboxIndex));
          } else {
            share.triggerClick__($("#item_0"));
          }
        }
      },
      addEvent__: function () {
        $(".leftItem");
        $(".leftItemIcon");

        share.onClick__($(".leftItem"), function () {
          self.onItemClicked(this);
        });
        share.onClick__($(".leftItemIcon"), function (e) {
          self.onItemIconClicked__(e);
        });
      },
      onTotalExistsChanged__: function (json) {
        var changed = null;
        var j = -1;
        for (var i = 0; i < self.items.length; ++i) {
          var item = self.items[i];
          if (item.path == json.mailBoxPath) {
            changed = item;
            j = i;
            break;
          }
        }

        if (changed != null) {
          var item = changed;
          item.totalExists = json.exists;
          var template = $("#template").html();
          var itemHtml = template.replace(/#email#/g, "");
          itemHtml = itemHtml.replace(/#id#/g, j);
          var name = item.name;
          itemHtml = itemHtml.replace(/#totalExists#/g, item.totalExists);
          itemHtml = itemHtml.replace(/#name#/g, name);

          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.name));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.name));
          $("#item_" + j).replaceWith(itemHtml);
          self.addEvent__();
          if (self.selectedId__ == j) {
            $("#item_" + self.selectedId__).addClass("selected");
          }
        }
      },
      onItemClicked: function (item) {
        var id = item.id;
        id = id.split("_")[1];
        if (self.selectedId__ != null) {
          $("#item_" + self.selectedId__).removeClass("selected");
        }
        self.selectedId__ = id;
        $("#item_" + self.selectedId__).addClass("selected");
        var si = self.items[id];
        share.setSelectedItem__(si);
        var target = share.getOpenTarget__(640, "rightFrame");
        share.open__("mail.list.htm", target);

        self.onResize__();
      },
      onItemIconClicked__: function (e) {
        e.stopPropagation();
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var si = self.items[id];

        var buttons = [];
        buttons.push({
          text: share.getString__("delete"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toDelete(si, id);
          }
        });
        buttons.push({
          text: share.getString__("view"),
          onTap: async function () {
            await share.closePopup__();
            self.onItemClicked(e.currentTarget);
          }
        });

        share.popupAction__(si.name, buttons, e.currentTarget);
      },
      onResize__: function () {
        var target = share.getOpenTarget__(640, "rightFrame");

        if (target == "rightFrame") {
          $('#spliter').removeClass("hide");
          $('#rightFrame').removeClass("hide");
          var iframe = $('#rightFrame')[0];
          setTimeout(function () {
            var wh = parent.window.innerHeight || parent.document.documentElement.clientHeight || parent.document.body.clientHeight;
            iframe.style.height = (wh - 55) + "px";
            $('.leftPanel').css("height", iframe.style.height);
            $('.spliter').css("height", iframe.style.height);
            self.spliterMoved();
          }, 200);
        } else {
          $('#rightFrame').addClass("hide");
          $('#spliter').addClass("hide");
          $('.leftPanel').css("height", "100%");
          $('.leftPanel').css("width", "100%");
          var iframe = $('#rightFrame')[0];
          var wh = parent.window.innerHeight || parent.document.documentElement.clientHeight || parent.document.body.clientHeight;
          iframe.style.height = (wh - 55) + "px";
          $('.leftPanel').css("height", iframe.style.height);
          $('.spliter').css("height", iframe.style.height);
        }
      },
      spliterMoved: function () {
        var spliter = $("#spliter")[0];
        var parent = $("#spliter").parent()[0];
        var containerWidth = parent.clientWidth;
        var spliterWidth = spliter.clientWidth;
        var mouseX = self.spliterLeft;
        if (mouseX > spliterWidth / 2 && mouseX < containerWidth - spliterWidth / 2) {
          $(".leftPanel")[0].style.width = mouseX - spliterWidth / 2 + 'px';
          $(".rightFrame")[0].style.width = containerWidth - mouseX - spliterWidth / 2 + 'px';
          $("#spliter")[0].style.left = mouseX - spliterWidth / 2 + 'px';
        }
      },
      toDelete: function (si, index) {
        share.confirm__(share.getString__("confirmToDelete"), function (confirmed) {
          if (confirmed) {
            var succ = function () {
              $("#item_" + index).remove();
            };
            var fail = function (e) {
              share.toastError__(e);
            };

            share.deleteFolder__(si, succ, fail);
          }
        });
      },
      doQuery__: function (pageIndex, pageSize) {
        var account = share.user__;
        var succ = function (data) {
          self.showResult__(data);
          if (share.user__.inbox == null || share.user__.junk == null) {
            
            share.toFolderSetting__();
          }
        };
        var fail = function (err) {
          share.toastError__(err);
        };

        share.getMailboxes__(account.email, self.keyName, succ, fail);
      }
    };

    $(function () {
      if (share.needInit__(/folder\.list\.htm/g)) self.initialize();
    });

    return self;
  })();

