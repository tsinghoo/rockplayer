window.feed_list = window.feed_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    items: null,
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_feed_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }

      parent.window.document.title = share.getString__("feed");

      navbar.highlight__("feed");
      navbar.showCommon__();
      try {
        self.selectedFollowing = JSON.parse(share.getCache__("selectedFollowing"));
      } catch (e) {

      }
      share.removeCache__("selectedFollowing");
      if (self.selectedFollowing) {
        let sf = $(".selectedFollowing");
        sf.find(".selectedFollowingName").html(self.selectedFollowing.comment);
        sf.find(".header").append(share.getSeal(self.selectedFollowing.comment));
        sf.find(".header").addClass(share.getHeaderBackgroundColor__(self.selectedFollowing.femail));
        if (self.selectedFollowing.femail == share.user__.email) {
          sf.find(".seal-img").addClass(`seal-me`);
        } else {
          sf.find(".seal-img").addClass(`seal-following`);
        }

        self.fillAllTags();
        for (let i = 0; i < self.selectedFollowing.tags.length; i++) {
          let tag = self.selectedFollowing.tags[i];
          let div = $(`<div class="tag marginlr2 font12">${tag}</div>`);
          if (self.selectedFollowing.selectedTag == share.getTagKey(tag)) {
            self.selectedFollowing.selectedTagDiv = div;
            div.addClass("selectedTag");
          }

          sf.find(".tags").append(div);
        }

        sf.removeClass("hide");

        share.onClick__(sf.find(".tag"), function (e) {
          let te = $(e.target);
          let clickedTag = te.html();
          clickedTag = share.getTagKey(clickedTag);

          if (self.selectedFollowing.selectedTag != clickedTag) {
            self.selectedFollowing.selectedTag = clickedTag;
            self.selectedFollowing.selectedTagDiv.removeClass("selectedTag");
            self.selectedFollowing.selectedTagDiv = te;
            te.addClass("selectedTag");
            self.doSearch__();
          }
        });
      }
      //vibrateConfig = share.user__.config.reminder.vibrate;
      page.setDoQuery(self.doQuery__);

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


      share.getNewFeedNotification__(self.showNotification__);
      self.translate__();

    },
    fillAllTags: function () {
      if (self.selectedFollowing.tags == null) {
        self.selectedFollowing.tags = [];
      }

      self.selectedFollowing.tags.splice(0, 0, share.getString__("myUpdates"));
      self.selectedFollowing.tags.push(share.getString__("feedback"));
    },
    showNotification__: function (json) {
      let count = json;
      if (count >= 0 && self.selectedFollowing == null) {
        $(".notification").removeClass("hide");
        let text = share.getString__("newNotifications", count);
        $(".notificationText").html(text);
        share.onClick__($(".notification"), function () {
          share.open__("./feed.comment.list.htm");
        })
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
        ".post-comment": "send",
        "#groupNameHint": "groupName",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    toAdd__: function (e) {
      if (self.selectedFollowing && self.selectedFollowing.selectedTag == "feed") {
        if (self.selectedFollowing.femail == share.user__.email) {

        } else {
          share.toastWarning__(share.getString__("onlyOwnerCanPostOnMyUpdates"));
          return;
        }
      }

      share.toCreateFeed__(self.selectedFollowing, function () {
        page.gotoPage(1);
      });
    },
    onSendFeedProgress__: function (json) {
      let c = $(`[feedid="${json.feedId}"`);
      let pe = $(".progress-pointer", c);
      let img = $((".messageStatusImage"), c);
      let container = $(".progress-container", c);
      if (json.websocket == "send.start") {
        img.removeClass("hide");
        container.addClass("hide");
        img.attr("src", "./img/loading6.gif");
      } else if (json.error) {
        page.refresh();
      } else if (json.count >= json.total) {
        container.addClass("hide");
        img.addClass("hide");
        self.toSend.shift();
        if (self.toSend.length > 0) {
          share.sendFeed__(self.toSend[0]);
        }
      } else {
        let progressDegree = json.progressDegree ? json.progressDegree : 0;
        let degrees = progressDegree + (json.count / json.total) * (360 - progressDegree);
        if (degrees < 10) {
          degrees = 10;
        }

        const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;
        pe.css({
          background: style
        });

        pe.removeClass("hide");
        if (json.websocket) {
          pe.parent().prev().attr("src", "./img/proxyOn2.svg");
        } else {
          pe.parent().prev().removeClass("rotate");
          pe.parent().prev().attr("src", "./img/loading6.gif");
        }

        $(".progress-container", c).removeClass("hide");

        if (self.toSend.length > 0) {
          share.sendFeed__(self.toSend[0]);
        }
      }
    },
    onSendFeedCommentProgress__: function (json) {
      let c = $(`[commentId="${json.commentId}"`);
      let pe = $(".progress-pointer", c);
      let img = $((".messageStatusImage"), c);
      let container = $(".progress-container", c);
      if (json.websocket == "send.start") {
        img.removeClass("hide");
        container.addClass("hide");
        img.attr("src", "./img/loading6.gif");
      } else if (json.error) {
        page.refresh();
      } else if (json.count >= json.total) {
        container.addClass("hide");
        img.addClass("hide");
      } else {
        let progressDegree = json.progressDegree ? json.progressDegree : 0;
        let degrees = progressDegree + (json.count / json.total) * (360 - progressDegree);
        if (degrees < 10) {
          degrees = 10;
        }

        const style = `conic-gradient(seagreen ${degrees}deg, yellowgreen ${degrees}deg)`;
        pe.css({
          background: style
        });

        pe.removeClass("hide");
        if (json.websocket) {
          pe.parent().prev().attr("src", "./img/proxyOn2.svg");
        } else {
          pe.parent().prev().removeClass("rotate");
          pe.parent().prev().attr("src", "./img/loading6.gif");
        }

        $(".progress-container", c).removeClass("hide");
      }
    },

    bindEvents: function () {
      share.onClick__($("#buttonAddFeed"), self.toAdd__);
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
      page.gotoPage(1);
    },
    todo: function () {
      alert("todo");
    },
    showResult__: function (data) {
      var html = [];
      page.update(data.pageIndex, data.pageSize, data.totalRows);
      navbar.showRedpoint__("feed", 0);
      var list = data.list;
      self.items = list;
      $("#list").html("");
      self.toSend = [];
      if (list.length > 0) {
        list.forEach(function (item, i) {
          let c = share.showFeedItem__(item, i, self.toSend);
          $("#list").append(c);
        });

        setTimeout(function () {
          list.forEach(function (item, i) {
            share.getFeedComments__(item);
          });

        }, 100);

      } else {
        $("#list").html("");
      }

      $("#body").css("display", "");

      if (self.toSend.length > 0) {
        share.sendFeed__(self.toSend[0]);
      }

      share.preloadVideo__($("video"));
    },
    doQuery__: async function (pageIndex, pageSize) {
      let params = {
        keyName: self.keyName,
        email: share.user__.email,
        pageIndex: pageIndex,
        pageSize: pageSize
      }

      if (self.selectedFollowing) {
        params.followingEmail = self.selectedFollowing.femail;
        params.selectedTag = self.selectedFollowing.selectedTag;
      }

      let data = await share.getFeedList__(params);
      self.showResult__(data);
    },
  };

  $(function () {
    if (share.needInit__(/feed\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

