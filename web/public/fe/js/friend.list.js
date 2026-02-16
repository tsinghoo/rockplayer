window.mhgl_friend_list = window.mhgl_friend_list || (function () {
  var share = window.mhgl_share;
  var mhgl_page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    items: null,
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_friend_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }
      parent.window.document.title = share.getString__("friends");;

      navbar.highlight__("contact_friend");
      navbar.showContact__();
      //vibrateConfig = share.user__.config.reminder.vibrate;
      mhgl_page.setDoQuery(self.doQuery__);

      var succ = function () {
        $("#connecting").addClass("hide");
        self.doSearch__();
      };

      var fail = function (e) {
        share.toastError__(account.user + share.getString__("loginFailed"), 1000, function () {
          share.toLogin__();
        });
      };
      $("#loading").addClass("hide");
      share.ensureImapConnected__(succ, fail);
      
      

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
        "#nameHint": "nameHint",
        "#commentHint": "commentHint",
        "#emailHint": "emailHint",
        "#addFriendGreetingLabel": "addFriendGreetingLabel",
        ".buttonConfirm": "confirm",
        ".buttonSend": "sendMessage",
        ".buttonDelete": "delete",
        "#groupNameHint": "groupName",
        "#groupCommentHint": "commentHint",
        "#searchNameHint": "searchFriend",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    toAdd__: function (e) {
      share.toAddFriend__("", "", mhgl_page.refresh);
    },
    // Bind Event Listeners
    //
    // Bind any events self are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
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
      if (data.pageIndex == -1) {
        let group = { id: "groups", comment: share.getString__("groupChat"), femail: share.getString__("clickToView") };
        list.splice(0, 0, group);
      }

      if (list.length > 0) {
        list.forEach(function (item, i) {
          let c = item.comment;
          if (c == null || c == "") {
            c = item.name;
          }
          var itemHtml = template.replace(/#comment#/g, c);
          itemHtml = itemHtml.replace(/#id#/g, i);
          itemHtml = itemHtml.replace(/#header#/g, share.getSeal(c));
          itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(item.femail));
          itemHtml = itemHtml.replace(/#email#/g, item.femail);

          item.type = "";
          if (item.status == "0stranger") {
            item.type = share.getString__("newFriend");;
          }

          if (item.publicKey == "") {
            item.type = share.getString__("toConfirm");;
          }

          itemHtml = itemHtml.replace(/#status#/g, item.type);
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

        if (data.pageIndex == 1) {
          share.user__.lastListFriendTime = list[0].createTime;
          share.saveAccount__(share.user__, function () {
            share.getNewFriend__();
          });
        }
      } else {
        $("#list").html("");
      }

      $("#body").css("display", "");
    },
    itemSelected: function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];

      if (selectedItem.id == "groups") {
        self.headerClicked(item);
      } else if (selectedItem.publicKey == "") {
        self.headerClicked(item);
      } else if (selectedItem.status == "0stranger") {
        self.headerClicked(item);
      } else {
        self.toMessage__(selectedItem);
      }
    },
    toMessage__: function (item) {
      var options = {
        address: item.femail,
        roomName: item.name,
        roomAlias: item.comment,
        publicKey: item.publicKey
      }

      share.getRoomByEmail__(options, function (res) {
        share.open__("./message.list.htm?id=" + res.id, "_self");
      });
    },
    headerClicked: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];
      if (selectedItem.id == "groups") {
        share.open__("./group.list.htm");
        return;
      }

      var message = $("#templateDetail").html();
      message = message.replace(/\r/g, "");
      message = message.replace(/\n/g, "");
      let dialog = await share.popup__(null, message, "bottom", function () {
        $(".detailName").val(selectedItem.name);
        $(".detailAlias").val(selectedItem.comment);
        $(".detailEmail").val(selectedItem.femail);
        $(".detailGreeting").val(selectedItem.greeting);
        if (selectedItem.greeting == "") {

        }

        if (selectedItem.status == "1friend") {
          $(".buttonConfirm").addClass("hide");
          if (selectedItem.publicKey != "") {
            $(".buttonSend").removeClass("hide");
          } else {
            $(".buttonSend").addClass("hide");
          }
        } else if (selectedItem.status == "0stranger") {
          $(".buttonConfirm").removeClass("hide");
          $(".buttonSend").addClass("hide");
        }

        share.onClick__($(".detailConfirmAlias"), function (e) {
          var target = $(this).closest(".input-group").find(".detailAlias");
          var comment = target.val().trim();

          var succ = function () {
            selectedItem.comment = comment;
            mhgl_page.refresh();
          };
          var fail = function (e) {
            share.toastError__(e);
          };

          var friend = { email: selectedItem.email, femail: selectedItem.femail };
          share.updateFriend__(comment, friend, succ, fail);
        });
        share.onClick__($(".buttonSend"), function () {
          if (selectedItem.status == "0stranger" || selectedItem.publicKey == "") {
            share.toastError__(share.getString__("friendNotConfirmed"));
          } else {
            self.toMessage__(selectedItem);
          }
        });

        share.onClick__($(".buttonDelete"), function () {
          share.confirm__(share.getString__("toDeleteFriend", selectedItem.name), function (confirmed) {
            if (confirmed) {
              self.doDelete__(selectedItem, dialog);
            }
          }, share.getString__("delete"), share.getString__("cancel"));
        });

        share.onClick__($(".buttonConfirm"), function () {
          var friend = selectedItem;

          var fail = function (e) {
            share.toastError__(e);
          };

          var succ = function (res) {
            var target = share.getOpenTarget__(640, "rightFrame");
            share.open__("message.list.htm?id=" + res.room.id, target);
          };

          share.confirmFriend__(friend, succ, fail);
        });
      });
    },
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      let data = await share.getAllFriendList__(params);
      self.showResult__(data);
    },
    doDelete__: function (item, detailDialog, createTime) {
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
          params: item
        },
        succ,
        fail
      );
    }
  };

  $(function () {
    if (share.needInit__(/friend\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

