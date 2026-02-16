window.mhgl_member_list = window.mhgl_member_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var storage = window.localStorage;
  var key = "toRemind";
  var vibrateConfig = [500, 200, 500, 200, 1000];
  var self = {
    items: null,
    keyName: "",
    room: null,
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_member_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }
      parent.window.document.title = share.getString__("groupMembers");
      self.room = JSON.parse(share.getCache__("room"));
      navbar.highlight__("member");
      //vibrateConfig = share.user__.config.reminder.vibrate;
      mhgl_page.setDoQuery(self.doQuery__);

      $("#connecting").addClass("hide");
      share.getGroupMember__(self.room, share.user__.email, function (res) {
        self.member = res.member;
      });
      self.doSearch__();
      self.translate__();
    },
    translate__: function () {
      let ph = {
        "#searchName": share.string.searchGroupMember,
        ".detailGroupNick": share.string.groupNickName,
      };

      Object.entries(ph).forEach(([key, value]) => {
        share.setPlaceholder__(key, value);
      });

      let html = {
        "#loading": "loading",
        ".emptyList": "emptyList",

        ".buttonSetOwner": "setAsNewOwner",
        ".buttonDelete": "delete",
        ".buttonAddFriend": "addAsFriend",
        "#groupNameHint": "groupNameHint",
        "#aliasHint": "aliasHint",
        "#emailHint": "emailHint",
        "#forbidHint": "forbidHint",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });

    },
    toAdd__: function () {
      share.toAddMember__(self.room.id);
    },
    toAddFriend__: async function () {
      let name = self.clickedItem.comment;
      if (name == "") {
        name = self.clickedItem.name;
      }

      await share.closePopup__();
      share.toAddFriend__(name, self.clickedItem.memail, mhgl_page.refresh);
    },
    toSetOwner__: async function () {
      if (self.clickedItem.role == "owner" || self.member == null || self.member.role != "owner") {
        share.toastError__(share.getString__("OnlyOwnerCanSetOthersOwner"));
      } else {
        await share.closePopup__();
        await share.setOwner__(self.clickedItem, self.room);
      }
    },
    toDelete__: function () {
      if (self.member.role != "owner") {
        share.toastError__(share.getString__("OnlyManagerCanDeleteMember"));
        return;
      }

      if (self.clickedItem.role == "owner") {
        share.toastError__(share.getString__("newOwnerNeededBeforeLeave"));
        return;
      }

      share.toDeleteMember__(self.room, self.clickedItem);
    },
    bindEvents: function () {
      share.onClick__($("#buttonAddMember"), self.toAdd__);
      share.onClick__($("#buttonDelete"), self.toDelete__);
      $("#searchName").on("input", self.onSearchChanged__);
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
      self.keyName = $("#searchName").val().trim();
      mhgl_page.gotoPage(1);
    },
    todo: function () {
      alert("todo");
    },
    showResult__: function (data) {
      $("#loading").addClass("hide");
      var html = [];
      var template = $("#template").html();
      mhgl_page.update(data.pageIndex, data.pageSize, data.totalRows);
      var list = data.list;
      self.items = list;

      if (list.length > 0) {
        list.forEach(function (item, i) {
          var c = item.comment;
          var itemHtml = template.replace(/#comment#/g, c);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(c));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.memail));
          itemHtml = itemHtml.replace(/#email#/g, item.memail);
          let status = share.countdown__(item.forbiddenTime);
          if (status > 0) {
            status = share.getString__("forbiddenDays", status);
          } else {
            status = "";
          }
          itemHtml = itemHtml.replace(/#status#/g, status);
          let role = "";
          if (item.role == "owner") {
            role = share.getString__("groupOwner");;
          }
          itemHtml = itemHtml.replace(/#role#/g, role);
          html.push(itemHtml);
        });
        $("#list").html(html.join(''));

        share.onClick__($(".listItem"), function () {
          self.itemSelected(this);
        });

        share.onClick__($(".header"), function (e) {
          e.stopPropagation();
          self.headerClicked(this);
        });
      } else {
        $("#list").html("");
      }

      $("#body").css("display", "");
      try {
        self.remind__();
      } catch (e) {
      }

    },
    remind__: function () {
      if (storage == null) {
        share.debug__("remind skipped");
        return;
      }

      var value = storage.getItem(key);
      if (value == "1") {
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
      }
    },
    itemSelected: function (item) {
      self.headerClicked(item);
    },
    toForbid__: async function () {
      await share.closePopup__();
      var succ = function (res) {
        self.clickedItem.forbiddenTime = res.time;
        $(".detailForbiddenTime").html(self.countdown__(self.clickedItem.forbiddenTime));
        page.refresh();
      };

      let params = {
        email: share.user__.email,
        roomId: self.clickedItem.roomId,
        senderEmail: self.clickedItem.memail
      };

      share.toForbid__(params, succ, share.toastError__);
    },
    countdown__: function (time) {
      let res = share.countdown__(time);
      if (res > 0) {
        return share.getString__("nDays", res);
      } else {
        return "";
      }
    },
    headerClicked: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      self.clickedItem = self.items[id];
      var message = $("#templateDetail").html();
      message = message.replace(/\r/g, "");
      message = message.replace(/\n/g, "");
      share.dialog__ = await share.popup__(null, message, "bottom", function () {
        $(".detailNick").val(self.clickedItem.name);
        $(".detailGroupNick").val(self.clickedItem.comment);
        $(".detailEmail").val(self.clickedItem.memail);
        $(".detailForbiddenTime").val(self.countdown__(self.clickedItem.forbiddenTime));
        share.onClick__($(".detailForbiddenTime"), self.toForbid__);
        share.onClick__($(".detailConfirm"), function (e) {
          var target = $(this).closest(".input-group").find(".detailGroupNick");
          var comment = target.val().trim();
          if (comment == self.clickedItem.comment) {
            return;
          }
          if (comment == "") {
            target.val(self.clickedItem.comment);
            return;
          }

          var succ = function () {
            self.clickedItem.comment = comment;
            page.refresh();
          };
          var fail = function (e) {
            share.toastError__(e);
          };

          var member = { id: self.clickedItem.id, comment: comment };
          share.updateGroupMember__(member, succ, fail);
        });

        share.onClick__($(".buttonConfirm"), function () {
          var friend = self.clickedItem;
          var succ = function () {
            dialog.close();
            share.toastSuccess__(share.getString__("confirmed"), 2000);
            mhgl_page.refresh();
          };
          var fail = function (e) {
            share.toastError__(e);
          };

          share.confirmFriend__(friend, succ, fail);
        });

        if (self.member == null || self.member.role != "owner") {
          $(".buttonSetOwner").addClass("hide");
        }

        share.onClick__($(".buttonAddFriend"), self.toAddFriend__);
        share.onClick__($(".buttonSetOwner"), self.toSetOwner__);
        share.onClick__($(".buttonDelete"), self.toDelete__);
      });

    },
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        address: self.room.address,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let data = await share.getMemberList__(params);
      self.showResult__(data);
    }
  };

  $(function () {
    if (share.needInit__(/member\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

