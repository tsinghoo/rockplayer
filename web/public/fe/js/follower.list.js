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
      parent.window.document.title = share.getString__("follower");;

      navbar.highlight__("contact_follower");
      navbar.showContact__();
      //vibrateConfig = share.user__.config.reminder.vibrate;
      mhgl_page.setDoQuery(self.doQuery__);

      var succ = function () {
        $("#connecting").addClass("hide");
        self.doSearch__();
        self.showTags__();
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
    showTags__: async function () {
      let tags = await share.getTags__("follower");
      let tc = $(".tags");
      tc.html("");
      if (tags.length == 0) {
        tc.addClass("hide");
      } else {
        tags.forEach(function (item) {
          let sc = item.tag == self.selectedTagId ? "selectedTag" : "";
          let t = $(`<span class='tag marginlr2 ${sc}' tagId="${item.id}">${item.tag}</span>`);
          tc.append(t);
        });

        share.onClick__($(".tag", tc), function () {
          let tagId = $(this).attr("tagId");
          if (self.selectedTagId == tagId) {
            self.selectedTagId = null;
            $(this).removeClass("selectedTag");
          } else {
            self.selectedTagId = tagId;
            $(".tag", tc).removeClass("selectedTag");
            $(this).addClass("selectedTag");
          }

          mhgl_page.gotoPage(1);
        })

        tc.removeClass("hide");
      }
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
        ".buttonFollow": "follow",
        ".buttonDelete": "delete",
        "#groupNameHint": "groupName",
        "#blockHint": "block",
        "#tagHint": "tag",
        "#groupCommentHint": "commentHint",
        "#searchNameHint": "searchFollower",
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

          let status = share.countdown__(item.forbiddenTime);
          if (status > 0) {
            status = share.getString__("blockDays", status);
          } else {
            status = "";
          }
          itemHtml = itemHtml.replace(/#status#/g, status);

          html.push(itemHtml);

          share.getFollowerTags__(item).then(
            function (rows) {
              item.tags = rows.map(row => {
                let strs = row.tagId.split("\t");
                return strs[strs.length - 1];
              });
            }
          );
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
      self.headerClicked(item);
    },
    headerClicked: async function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];
      self.clickedItem = self.items[id];

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

        $(".detailForbiddenTime").val(self.countdown__(self.clickedItem.forbiddenTime));

        $(".detailTag").val(self.clickedItem.tags.join(","));

        share.onClick__($(".detailForbiddenTime"), self.toBlock__);
        share.onClick__($(".detailTag"), self.toTag__);

        share.onClick__($(".buttonSend"), function () {
          share.toChat__(selectedItem.comment, selectedItem.femail);
        });

        share.onClick__($(".buttonFollow"), function () {
          let name = selectedItem.name;
          let email = selectedItem.femail;
          let greeting = "";

          let waiting = share.toastWaiting__(share.getString__("sending"));
          share.follow__(name, email, greeting,
            function () {
              waiting.close();
              share.closePopup__();
              succ && succ();
            }, function (e) {
              waiting.close();
              if (e == "friendExists") {
                share.toastError__(share.getString__("friendExists"));
              } else {
                share.toastError__(e);
              }
            });
        });

        share.onClick__($(".buttonDelete"), function () {
          share.confirm__(share.getString__("deleteFollowerGuide", selectedItem.name), function (confirmed) {
            if (confirmed) {
              self.doDelete__(selectedItem, dialog);
            }
          }, share.getString__("delete"), share.getString__("cancel"));
        });
      });

      share.dialog__ = dialog;
    },
    toTag__: async function () {
      await share.closePopup__();
      var succ = function (res) {
        self.clickedItem.tags = res.tags;
      };

      share.toTagFollower__(self.clickedItem, succ, share.toastError__);
    },
    toBlock__: async function () {
      await share.closePopup__();
      var succ = function (res) {
        self.clickedItem.forbiddenTime = res.time;
        $(".detailForbiddenTime").html(self.countdown__(self.clickedItem.forbiddenTime));
        mhgl_page.refresh();
      };

      let params = self.clickedItem;

      share.toBlock__(params, succ, share.toastError__);
    },
    countdown__: function (time) {
      let res = share.countdown__(time);
      if (res > 0) {
        return share.getString__("nDays", res);
      } else {
        return "";
      }
    },
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        tagId: self.selectedTagId,
        pageSize: pageSize
      }

      let data = await share.getFollowerList__(params);
      self.showResult__(data);
    },
    doDelete__: function (item, detailDialog) {
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
          func: "deleteFollower",
          params: item
        },
        succ,
        fail
      );
    },
    doBlock__: function (item, detailDialog) {
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
          func: "blockFollower",
          params: item
        },
        succ,
        fail
      );
    }
  };

  $(function () {
    if (share.needInit__(/follower\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

