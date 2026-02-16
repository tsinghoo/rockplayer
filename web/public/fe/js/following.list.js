window.mhgl_following_list = window.mhgl_following_list || (function () {
  var share = window.mhgl_share;
  var mhgl_page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    items: null,
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_following_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }
      parent.window.document.title = share.getString__("following");;

      navbar.highlight__("contact_following");
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
        ".buttonConfirm": "confirm",
        ".buttonSend": "sendMessage",
        ".buttonUnfollow": "unfollow",
        "#groupNameHint": "groupName",
        "#groupCommentHint": "commentHint",
        "#searchNameHint": "searchFollowing",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    toAdd__: function (e) {
      share.toFollow__("", "", mhgl_page.refresh);
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
    },
    itemSelected: function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];
      share.toFollowing__(selectedItem.comment, selectedItem.femail);
    },
    headerClicked: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];

      var message = $("#templateDetail").html();
      message = message.replace(/\r/g, "");
      message = message.replace(/\n/g, "");
      let dialog = await share.popup__(null, message, "bottom", function () {
        $(".detailName").val(selectedItem.name);
        $(".detailAlias").val(selectedItem.comment);
        $(".detailEmail").val(selectedItem.femail);

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
          share.updateFollowing__(comment, friend, succ, fail);
        });

        share.onClick__($(".buttonSend"), function () {
          share.toChat__(selectedItem.comment, selectedItem.femail);
        });

        share.onClick__($(".buttonUnfollow"), function () {
          share.confirm__(share.getString__("unfollowGuide", selectedItem.name), function (confirmed) {
            if (confirmed) {
              self.doUnfollow__(selectedItem, dialog);
            }
          }, share.getString__("confirm"), share.getString__("cancel"));
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

      let data = await share.getFollowingList__(params);
      self.showResult__(data);
    },
    doUnfollow__: function (item, detailDialog) {
      let waiting = share.toastWaiting__(share.getString__("sending"));
      var succ = function (json) {
        waiting.close();
        detailDialog.close();
        mhgl_page.refresh();
      };

      var fail = function (e) {
        waiting.close();
        share.toastError__(e);
      };

      share.unfollow__(item, succ, fail);
    }
  };

  $(function () {
    if (share.needInit__(/following\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

