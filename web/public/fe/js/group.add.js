window.mhgl_group_add = window.mhgl_group_add || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var timerSet = 0;
  var self = {
    items: null,
    roomId: null,
    spliterLeft: 300,
    lastSuccessTime__: 0,
    selectedFriends: [],
    initialize: function () {
      share.debug__("mhgl_group_add.init");
      this.bindEvents();
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }
      self.roomId = share.getParameter__("id");
      if (self.roomId != null) {
        $(".groupNameContainer").addClass("hide");
      }
      parent.window.document.title = share.getString__("secretMail");;

      navbar.highlight__("group");

      //vibrateConfig = share.user__.config.reminder.vibrate;
      page.setDoQuery(self.doQuery__);
      share.back__ = self.back__;
      page.pageSize = Number.MAX_SAFE_INTEGER;

      self.doSearch__();
      self.translate__();
    },
    translate__: function () {
      let ph = {
      };

      Object.entries(ph).forEach(([key, value]) => {
        share.setPlaceholder__(key, value);
      });

      let html = {
        "#loading": "loading",
        ".emptyList": "emptyList",
        ".detailDelete": "delete",
        ".buttonFinish": "finish",
        ".nickName": "nickName",
        ".emailAddress": "emailAddress",
        "#searchNameHint": "searchFriend",
        "#groupNameHint": "groupName",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    back__: function () {
      window.history.back(-1);
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

    showSelected__: function () {
      var html = [];
      var template = $("#templateSelected").html();
      var list = self.selectedFriends;

      if (list.length > 0) {
        list.forEach(function (item, i) {
          var itemHtml = template.replace(/#comment#/g, item.comment);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.comment));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.femail));
          itemHtml = itemHtml.replace(/#email#/g, item.femail);

          html.push(itemHtml);
        });

        $("#selectedFriends").html(html.join(''));

        share.onClick__($(".headerSelected"), function (e) {
          e.stopPropagation();
          self.headerSelectedClicked__(this);
        });

      } else {
        $("#selectedFriends").html("");
      }
    },

    itemChoosed__: function (index) {
      var checked = $("#checkbox_" + index).prop('checked');

      if (checked) {
        self.selectedFriends.push(self.items[index]);
        self.showSelected__();
      } else {
        let found = -1;
        for (let i = 0; i < self.selectedFriends.length; ++i) {
          if (self.selectedFriends[i].id == self.items[index].id) {
            found = i;
          }
        }

        if (found > -1) {
          self.selectedFriends.splice(found, 1);
          self.showSelected__();
        }
      }
    },
    bindEvents: function () {
      $("#searchName").on("input", self.onSearchChanged__);
      share.onClick__($("#buttonFinish"), self.toFinish__);
      if (self.roomId == null || self.roomId == "") {
        $(".groupNameContainer").removeClass("hide");
      } else {
        $(".groupNameContainer").addClass("hide");
      }

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
    toFinish__: function (e) {
      let name = $("#groupName").val().trim();
      if (self.selectedFriends.length < 1) {
        share.toastError__(share.getString__("chooseMemberFirst"));
      } else if (self.roomId == null || self.roomId == "") {
        if (name == "") {
          share.toastError__(share.getString__("groupNameRequired"));
        } else {
          self.toCreateGroup__(name);
        }
      } else {
        share.shareGroup__(self.roomId, self.selectedFriends);
      }
    },
    toCreateGroup__: function (name) {
      share.createGroup__(name, self.selectedFriends);
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
    onSearchChanged__: function (e) {
      if (self.toSearch__ == null) {
        self.toSearch__ = setTimeout(self.doSearch__, 1000);
      } else {
        clearTimeout(self.toSearch__);
        self.toSearch__ = setTimeout(self.doSearch__, 1000);
      }
    },
    doSearch__: function () {
      share.debug__(" group.add.doSearch");
      self.keyName = $("#searchName").val();
      page.gotoPage(1);
    },
    todo: function () {
      alert("todo");
    },
    showItems__: function () {
      var html = [];
      var template = $("#template").html();
      if (self.items.length > 0) {
        let selectedIndex = [];
        self.items.forEach(function (item, i) {
          var itemHtml = template.replace(/#comment#/g, item.comment);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(item.comment));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.femail));
          itemHtml = itemHtml.replace(/#email#/g, item.femail);

          let checked = "";
          for (let j = 0; j < self.selectedFriends.length; ++j) {
            if (self.selectedFriends[j].id == item.id) {
              checked = "checked";
            }
          }

          itemHtml = itemHtml.replace(/_checked_/g, checked);
          html.push(itemHtml);
        });
        $("#list").html(html.join(''));

        share.onClick__($(".header"), function (e) {
          e.stopPropagation();
          self.headerClicked(this);
        });
      } else {
        $("#list").html("");
      }

      $("#body").css("display", "");

      $(".form-check-input").off("change").on("change", self.checkBoxChanged__);
      share.onClick__($(".form-check-input"), self.checkBoxClicked__);
    },
    showResult__: function (data) {
      var list = data.list;
      self.items = list;
      self.showItems__();
    },
    headerClicked: function (item) {
      var id = item.id;
      id = id.split("_")[1];
      self.itemChoosed__(id);
    },
    headerSelectedClicked__: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.selectedFriends[id];
      message = $("#templateDetail").html();
      message = message.replace(/#id#/g, id);
      message = message.replace(/#name#/g, selectedItem.comment);
      message = message.replace(/#email#/g, selectedItem.femail);
      message = message.replace(/\r/g, "");
      message = message.replace(/\n/g, "");
      let dialog = await share.popup__(null, message, "bottom", function () {
        share.onClick__($(".detailDelete"), async function () {
          await dialog.close();
          self.doDelete__(id);
        });
      });
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
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let data = await share.getFriendList__(params);
      self.showResult__(data);
    },

    doDelete__: function (index) {
      self.selectedFriends.splice(index, 1);
      self.showSelected__();
      self.showItems__();
    }
  };

  $(function () {
    if (share.needInit__(/group\.add\.htm/g))
      self.initialize();
  });

  return self;
})();


