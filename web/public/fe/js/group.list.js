window.mhgl_group_list = window.mhgl_group_list || (function () {
  var share = window.mhgl_share;
  var mhgl_page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var storage = window.localStorage;
  var key = "toRemind";
  var vibrateConfig = [500, 200, 500, 200, 1000];
  var self = {
    items: null,
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_group_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }
      parent.window.document.title = share.getString__("groupChat");;

      navbar.highlight__("contact_group");
      navbar.showContact__();
      //vibrateConfig = share.user__.config.reminder.vibrate;
      mhgl_page.setDoQuery(self.doQuery__);

      $("#loading").addClass("hide");
      $("#connecting").addClass("hide");
      self.doSearch__();
      self.translate__();
    },
    translate__: function () {
      let ph = {
        //"#searchName": share.string.searchGroup,
      };

      Object.entries(ph).forEach(([key, value]) => {
        share.setPlaceholder__(key, value);
      });

      let html = {
        "#loading": "loading",
        ".emptyList": "emptyList",

        "#searchNameHint": "searchGroup"
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    toAdd__: function () {
      share.toAddFriend__("", "", mhgl_page.refresh);
    },
    bindEvents: function () {
      share.onClick__($("#buttonAddFriend"), self.toAdd__);
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
      var html = [];
      var template = $("#template").html();
      mhgl_page.update(data.pageIndex, data.pageSize, data.totalRows);
      var list = data.list;
      self.items = list;

      if (list.length > 0) {
        list.forEach(function (item, i) {
          let roomAlias = item.roomAlias;
          if (roomAlias == "") {
            roomAlias = item.roomName;
          }
          var itemHtml = template.replace(/#comment#/g, roomAlias);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(roomAlias));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(roomAlias));
          itemHtml = itemHtml.replace(/#owner#/g, item.comment);
          itemHtml = itemHtml.replace(/#totalMembers#/g, share.formatNumber__(item.totalMembers, 3));
          html.push(itemHtml);
        });
        $("#list").html(html.join(''));

        share.onClick__($(".listItem"), function () {
          self.itemClicked__(this);
        });

        share.onClick__($(".header"), function (e) {
          e.stopPropagation();
          self.headerClicked__(this);
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
    toMessage__: function () {
      var options = {
        address: self.selectedItem.roomId,
        roomName: self.selectedItem.roomName,
        roomAlias: self.selectedItem.roomAlias,
        privateKey: self.selectedItem.roomKey
      }

      share.getRoomByEmail__(options, function (res) {
        share.open__("./message.list.htm?id=" + res.id, "_self");
      });
    },
    itemClicked__: function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];
      self.selectedItem = selectedItem;

      self.toMessage__();
    },
    getRoomByEmail__: function (si, succ, fail) {
      var options = {
        address: si.roomId,
        roomName: si.roomName,
        roomAlias: si.roomAlias,
        privateKey: si.roomKey
      }

      share.getRoomByEmail__(options, succ, fail);
    },
    headerClicked__: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var si = self.items[id];
      self.selectedItem = si;
      let room = {
        name: si.roomName,
        alias: si.roomAlias,
        email: si.email,
        address: si.roomId,
        privateKey: si.roomKey
      };
      share.setCache__("room", room);
      share.showGroupDetail(room, self.toMessage__, null);
    },
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let data = await share.getGroupList__(params);
      self.showResult__(data);
    },
    doDelete__: function (itemId, detailDialog, createTime) {
      var succ = function (json) {
        detailDialog.close();
        mhgl_page.refresh();
      };

      var fail = function (e) {
        detailDialog.close();
        share.toastError__(e);
      };

      share.callNodejs__(
        {
          func: "deleteFriend",
          params: { id: itemId }
        },
        succ,
        fail
      );
    }
  };

  $(function () {
    if (share.needInit__(/group.list.htm/g))
      self.initialize();
  });

  return self;
})();

