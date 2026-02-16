window.mhgl_chat_list = window.mhgl_chat_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var timerSet = 0;
  var self = {
    items: null,
    spliterLeft: 300,
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_chat_list.init");
      this.bindEvents();
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }

      parent.window.document.title = share.getString__("secretMail");
      share.initProxy__(null, function () {
        parent.parent.navFrame && parent.parent.navFrame.mhgl_navbar.onWsChanged__({ connected: false });
        parent.parent.mhgl_container.wsPing__();
      });

      $("#loading").removeClass("hide");
      navbar.highlight__("group");
      navbar.showCommon__();

      //vibrateConfig = share.user__.config.reminder.vibrate;
      page.setDoQuery(self.doQuery__);
      share.onResize__ = self.onResize__;
      share.back__ = self.back__;

      share.registerDeviceReady__(null, self.onDeviceReady__);
      self.onResize__();
      self.translate__();
    },
    translate__: function () {

      let ph = {
        ".detailAlias": "placeholderOfAlias",
        ".detailGroupAlias": "placeholderOfGroupAlias",
        ".detailName": "name",
      };

      Object.entries(ph).forEach(([key, value]) => {
        $(key).attr("placeholder", share.string[value]);
      });


      let html = {
        "#loading": "loading",
        ".emptyList": "emptyList",
        ".detailSend": "sendMessage",
        ".detailDelete": "delete",
        "#nameHint": "nameHint",
        "#commentHint": "commentHint",
        "#emailHint": "emailHint",
        "#searchNameHint": "searchChat"
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
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
    onMemberCountChanged__: function (json) {
      let div = $(`[address="${json.roomId}"]`).find(".memberCount");
      div.html(share.formatNumber__(json.count, 3));
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
    onNewChats__: function (redRooms, chats) {
      for (var i = 0; i < self.items.length; ++i) {
        var item = self.items[i];
        if (redRooms[item.address] > 0) {
          if (i == self.selectedIndex__) {
            rightFrame.message_list && rightFrame.message_list.onNewChats__(chats);
          }
        } else {
          $("#header_" + i).removeClass("redpoint");
        }
      }

      self.reloadGroups__();
    },
    onDeviceReady__: function () {
      share.debug__("device ready start");
      var account = share.user__;
      if (account != null) {
        var succ = function (res) {
          $("#connecting").addClass("hide");
          if (res && res.nextUid) {
            account.nextUid = res.nextUid;
            if (account.maxUid > account.nextUid) {
              account.maxUid = account.nextUid - 1;
            }
          }
          self.currentAccount__ = account;
          parent.parent.mhgl_container.startSyncMails__();
          self.doSearch__();
        };
        var fail = function (e) {
          share.toastError__(account.user + share.getString__("loginFailed"), 1000, function () {
            share.toLogin__();
          });
        };
        share.ensureImapConnected__(succ, fail);
      }

      share.debug__("device ready end");
    },
    // Bind Event Listeners
    //
    // Bind any events self are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
      $("#searchName").on("input", self.onSearchChanged__);
      share.onClick__($("#buttonAdd"), self.toAdd__);

      $("#spliter").on('mousedown', function (e) {
        share.debug__("start dragging");
        $("#mask").removeClass("hide");
        $("#mask")[0].style.width = $(".rightFrame")[0].style.width;
        $("#mask")[0].style.height = $(".rightFrame")[0].style.height;
        $("#mask")[0].style.left = $("#spliter")[0].style.left;
        self.isDragging = true;
      });

      document.addEventListener('mouseup', function (e) {
        share.debug__("end dragging");
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
    toAdd__: function (e) {
      var buttons = [];
      buttons.push({
        text: share.getString__("startGroupChat"),
        onTap: async function (e) {
          await share.closePopup__();
          share.toAddGroup__(e)
        }
      });

      share.popupAction__('', buttons, e.currentTarget);
    },
    spliterMoved: function () {
      var spliter = $("#spliter")[0];
      var parent = $("#spliter").parent()[0];
      var containerWidth = parent.clientWidth;
      var spliterWidth = spliter.clientWidth;
      var mouseX = self.spliterLeft;
      if (mouseX > spliterWidth / 2 && mouseX < containerWidth - spliterWidth / 2) {
        let lpw = mouseX - spliterWidth / 2 + 'px';
        $(".leftPanel")[0].style.width = lpw;
        $("#pagination")[0].style.width = lpw;
        $(".rightFrame")[0].style.width = containerWidth - mouseX - spliterWidth / 2 + 'px';
        $("#spliter")[0].style.left = mouseX - spliterWidth / 2 + 'px';
      }


    },
    onSearchChanged__: function (e) {
      if (self.toSearch__ == null) {
        self.toSearch__ = setTimeout(self.doSearch__, 1000);
      } else {
        clearTimeout(self.toSearch__);
        self.toSearch__ = setTimeout(self.doSearch__, 1000);
      }
    },
    doSearch__: function () {
      share.debug__(" chat.list.doSearch");
      self.keyName = $("#searchName").val();
      page.gotoPage(1);
    },
    todo: function () {
      alert("todo");
    },
    reloadGroups__: function () {
      self.doQuery__(page.pageIndex, page.pageSize, function () { });
    },
    showResult__: function (data) {
      var html = [];
      var template = $("#template").html();
      page.update(data.pageIndex, data.pageSize, data.totalRows);
      var list = data.list;
      self.items = list;
      self.selectedIndex__ = -1;
      self.hasRedpoint = 0;
      $("#list").html("");
      if (list.length > 0) {
        list.forEach(function (item, i) {
          if (item.id == self.selectedId__) {
            self.selectedIndex__ = i;
          }
          var itemHtml = template.replace(/#desc#/g, item.lastMessage);
          itemHtml = itemHtml.replace(/#id#/g, i);
          var name = item.alias;
          if (name == null || name.trim() == "") {
            name = item.name;
          }

          if (name == null) {
            if (item.address == share.user__.email) {
              name = share.getString__("myself");
            } else {
              name = share.getString__("unknown");
            }
          }

          itemHtml = itemHtml.replace(/#name#/g, name);
          if (share.isGroup__(item)) {
            itemHtml = itemHtml.replace(/#totalMembers#/g, share.formatNumber__(item.totalMembers, 3));
            itemHtml = itemHtml.replace(/#totalMembersHide#/g, "");
          } else {
            itemHtml = itemHtml.replace(/#totalMembers#/g, "");
            itemHtml = itemHtml.replace(/#totalMembersHide#/g, "hide");
          }
          var redpoint = "";
          if (item.lastMessageTime > item.lastReadTime) {
            self.hasRedpoint = 1;
            redpoint = "bg-red";
          }
          itemHtml = itemHtml.replace(/#redpoint#/g, redpoint);

          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(name));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.address));

          let ele = $(itemHtml);
          ele.attr("address", item.address);
          $("#list").append(ele);
        });


        share.onClick__($(".header"), function (e) {
          e.stopPropagation();
          self.headerClicked(this);
        });
        share.onClick__($(".listItem"), function (e) {
          e.stopPropagation();
          self.onItemClicked(this);
        });
      }

      $("#loading").css("display", "none");
      $("#body").css("display", "");
      if (self.selectedIndex__ > -1) {
        $("#item_" + self.selectedIndex__).addClass("selected");
      }

      parent.parent.navFrame.mhgl_navbar.showRedpoint__("group", self.hasRedpoint);
    },
    onItemClicked: function (item) {
      var id = item.id;
      self.toViewItem(id);
    },
    headerClicked: async function (item) {
      var id = item.id;
      
      id = id.split("_")[1];
      var selectedItem = self.items[id];
      share.setCache__("room", selectedItem);

      let alias = selectedItem.alias;
      if (selectedItem.alias == "") {
        alias = selectedItem.name;
      }

      if (share.isGroup__(selectedItem)) {
        let dialog = await share.showGroupDetail(selectedItem, function () { self.toViewItem(item.id); },
          async function () {
            let confirmed = await share.isConfirmed__(share.getString__("toDeleteChat", alias));
            if (confirmed) {
              self.doDelete__(selectedItem, dialog);
            }
          });
      } else {
        let message = $("#templateDetailFriend").html();
        message = message.replace(/\r/g, "");
        message = message.replace(/\n/g, "");

        let dialog = await share.popup__(null, message, "bottom");

        $(".detailName").val(selectedItem.name);
        $(".detailAlias").val(selectedItem.alias);

        share.onClick__($(".detailConfirmAlias"), function (e) {
          var target = $(this).closest(".input-group").find(".detailAlias");
          var comment = target.val().trim();

          var succ = function () {
            selectedItem.name = comment;
            page.refresh();
          };
          var fail = function (e) {
            share.toastError__(e);
          };

          var friend = { email: selectedItem.email, femail: selectedItem.address };
          share.updateFriend__(comment, friend, succ, fail);
        });

        $(".detailEmail").val(selectedItem.address);
        share.onClick__($(".detailSend"), function () {
          dialog.close();
          self.toViewItem(item.id);
        });

        share.onClick__($(".detailDelete"), function () {
          share.confirm__(share.getString__("toDeleteChat", alias), function (confirmed) {
            if (confirmed) {
              self.doDelete__(selectedItem, dialog);
            }
          }, share.getString__("delete"), share.getString__("cancel"));
        });
      }
    },
    onMoreMessage__: function () {

    },
    autoClick: function () {
      if (share.isWideScreen__()) {
        if (self.inboxIndex >= 0) {
          share.triggerClick__($("#item_" + self.inboxIndex));
        } else {
          share.triggerClick__($("#item_0"));
        }
      }
    },

    doQuery__: async function (pageIndex, pageSize, cb) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let data = await share.getChatList__(params);
      self.showResult__(data);
      cb ? cb() : self.autoClick();
    },
    toViewItem: function (id) {
      id = id.split("_")[1];
      if (self.selectedIndex__ != null) {
        $("#item_" + self.selectedIndex__).removeClass("selected");
      }
      self.selectedIndex__ = id;
      $("#item_" + self.selectedIndex__).addClass("selected");
      var si = self.items[id];
      self.selectedId__ = si.id;
      var target = share.getOpenTarget__(640, "rightFrame");
      share.open__("message.list.htm?id=" + si.id, target);
      self.onResize__();
      return id;
    },
    doDelete__: function (item, detailDialog) {
      var succ = function (json) {
        detailDialog.close();
        page.refresh();

        share.callNodejs__(
          {
            func: "deleteMessage",
            params: { email: share.user__.email, roomId: item.address }
          }
        );
      };

      var fail = function (e) {
        detailDialog.close();
        share.toastError__(e);
      };

      share.callNodejs__(
        {
          func: "deleteGroup",
          params: { id: item.id }
        },
        succ,
        fail
      );
    }
  };

  $(function () {
    if (share.needInit__(/chat\.list\.htm/g))
      self.initialize();
  });

  return self;
})();




