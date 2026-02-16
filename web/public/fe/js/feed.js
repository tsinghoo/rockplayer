window.feed_detail = window.feed_detail || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_feed_detail.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }

      parent.window.document.title = share.getString__("feed");;
      self.id = share.getParameter__("id");
      navbar.highlight__("feed");
      page.setDoQuery(self.doQuery__);
      var succ = function () {
        $("#connecting").addClass("hide");
        self.getItem__();
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
        ".buttonDelete": "delete",
        ".buttonComment": "comment",
        ".post-comment": "send",
        ".buttonUnfollow": "unfollow",
        "#groupNameHint": "groupName",
        ".confirmDeleteFeed": "confirmDeleteFeed",
        ".delBefore": "delFeedBefore",
        "#groupCommentHint": "commentHint",
        "#searchNameHint": "searchFollowing",
      };

      Object.entries(html).forEach(([key, value]) => {
        $(key).html(share.string[value]);
      });
    },
    toAdd__: function (e) {

      share.toCreateFeed__(function () {
        page.refresh();
      });
    },
    onSendFeedProgress__: function (json) {
      let c = $(`[feedid="${json.feedId}"`);
      let pe = $(".progress-pointer", c);

      if (json.count >= json.total) {
        pe.parents(".progress-container").addClass("hide");
        return;
      }

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

      if (json.count >= json.total) {
        $(".progress-container", c).addClass("hide");
        self.toSend.shift();
        if (self.toSend.length > 0) {
          share.sendFeed__(self.toSend[0]);
        }
      } else {
        share.sendFeed__(self.toSend[0]);
      }
    },
    // Bind Event Listeners
    //
    // Bind any events self are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
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
    todo: function () {
      alert("todo");
    },
    getItem__: async function () {
      let params = {
        email: share.user__.email,
        id: self.id,
      }

      let data = await share.getFeedById__(params);
      self.item = data.feed;

      self.showItem__(data.feed);
    },
    like__: function (item) {
      let c = $(`[feedid="${item.feedId}"]`);
      let img = "./img/unvote.png";
      let liked = 1;
      if (item.liked == 1) {
        img = "./img/vote.png";
        liked = 0;
      } else {
        img = "./img/unvote.png";
        liked = 1;
      }

      var succ = function (json) {
        if (json && json.message) {
          share.toastInfo__(json.message);
        } else {
          item.liked = liked;
          item.likeCount = json.feed.likeCount;
          $(".vote", c).attr('src', img);
          $(".vote-count", c).text(item.likeCount);
        }
      };

      var fail = function (e) {
        share.toastError__(e);
      };

      share.callNodejs__(
        {
          func: "likeFeed",
          params: {
            email: share.user__.email,
            liked: liked,
            feed: item
          }
        },
        succ,
        fail
      );
    },
    showItem__: function (item) {
      let c = share.showFeedItem__(item, 0);
      $("#list").append(c);
      self.doQuery__();
    },

    postComment__: async function (feed, reply, commentText) {
      if (!commentText || commentText.trim() === '') {
        share.toastError__(share.getString__("commentEmpty"));
        return;
      }

      let waiting = share.toastWaiting__(share.getString__("sending"));

      try {
        await share.callNodejs__({
          func: "commentFeed",
          params: {
            email: share.user__.email,
            feedId: feed.feedId,
            reply: reply,
            content: commentText,
            senderType: feed.senderType,
            feedOwnerEmail: feed.senderEmail
          }
        });
      } catch (e) {

      }

      waiting.close();

      self.doQuery__();
    },

    doQuery__: function (pageIndex, pageSize) {
      let feed = self.item;
      let feedId = feed.feedId;
      pageIndex = pageIndex ? pageIndex : 1;
      pageSize = pageSize ? pageSize : 10;
      var succ = function (json) {
        if (json && json.result) {

          page.update(json.result.pageIndex, json.result.pageSize, json.result.totalRows);
          json.result.totalPages = Math.floor(json.result.totalRows / json.result.pageSize);
          if (json.result.totalRows % json.result.pageSize > 0) {
            json.result.totalPages++;
          }

          let html;
          let c = $(`[feedid="${feedId}"]`);
          let lc = $(`[feedid="${feedId}"] .comments-list`);
          lc.html("");
          json.result.list.sort(((a, b) => a.createTime - b.createTime)).forEach(comment => {
            if (comment.replyFromName) {
              html = $(`
              <div class="comment-item font14 flexrow">
                <div class="flexcolumn widthauto">
                  <div class="flexrow justify">
                    <div class="flexrow">
                      <span class="comment-author blue clickable" fromEmail="${comment.fromEmail}" commentId="${comment.id}">${comment.fromName}</span>
                      <div class="gray font10"> <label class="glyphicon glyphicon-share-alt"></label>${comment.replyFromName}</div>
                    </div>

                    <div class="flexrow">
                      <div class="progress-container hide">
                          <div class="progress-background"></div>
                          <div class="progress-pointer"></div>
                      </div>
                      <div class="gray createTime">${share.getTime__(comment.createTime)}</div>
                    </div>
                  </div>
                    
                  <span class="comment-text left forceWrap"></span>
                </div>
              </div>`);
            } else {
              html = $(`
              <div class="comment-item font14 flexrow">
                <div class="flexcolumn widthauto">
                  <div class="flexrow justify">
                    <span class="comment-author blue clickable" fromEmail="${comment.fromEmail}" commentId="${comment.id}">${comment.fromName}</span>
                    <div class="flexrow">
                      <div class="progress-container hide">
                          <div class="progress-background"></div>
                          <div class="progress-pointer"></div>
                      </div>
                      <div class="gray createTime">${share.getTime__(comment.createTime)}</div>
                    </div>
                  </div>
                  <span class="comment-text left forceWrap"></span>
                </div>
              </div>`);
            }
            html.find(".comment-text").text(comment.content);
            lc.append(html);

          });

          share.onClick__($(".comment-author", c), function () {

            const commentId = $(this).attr("commentId");
            const fromName = $(this).html();
            const fromEmail = $(this).attr("fromEmail");
            share.toOperateComment__(feed, commentId, fromName, fromEmail);
          });

          share.onClick__($(".comment-text", lc), function () {
            let ele = $(this);
            if (ele.css("max-height") == "none") {
              $(this).css("max-height", "2.5em");
            } else {
              $(this).css("max-height", "none");
            }
          })
        }

        share.preloadVideo__($("video"));
      };


      var fail = function (e) {
        share.toastError__(e);
      };

      share.callNodejs__({
        func: "getFeedComments",
        params: {
          email: share.user__.email,
          feedId: feedId,
          type: 2,
          pageIndex: pageIndex,
          pageSize: pageSize
        }
      }, succ, fail);
    },
  };

  $(function () {
    if (share.needInit__(/feed\.htm/g))
      self.initialize();
  });

  return self;
})();
