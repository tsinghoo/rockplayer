window.feed_comments_list = window.feed_comments_list || (function () {
  var share = window.mhgl_share;
  var page = window.mhgl_page;
  var navbar = parent.parent.navFrame ? parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
  var self = {
    keyName: "",
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_feed_comments_list.init");
      this.bindEvents();
      var account = share.user__;
      if (share.user__ == null) {
        share.toLogin__();
        return;
      }

      parent.window.document.title = share.getString__("feed");
      navbar.highlight__("feed");
      page.setDoQuery(self.doQuery__);
      self.translate__();

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
    },
    doSearch__: function () {
      //self.keyName = $("#searchName").val().trim();
      page.gotoPage(1);
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
    toComment__: async function (feed, reply) {
      let html = $("#templateComment").html();
      let popup;
      let onShown = function (popupId) {
        let c = $(`#${popupId}`);
        $(".commentInput", c).focus();
        let label = share.getString__("comment");
        if (reply) {
          label = share.getString__("replyTo", reply.fromName);
        }

        $(".comment-label", c).html(label);
        $(".comment-text", c).on("keypress", async function (e) {
          if (e.which === 13) {
            const commentText = $(this).val().trim();
            await self.postComment__(feed, reply, commentText);
            popup.close();
            return false; // Prevent form submission
          }
        });

        share.onClick__($(".post-comment", c), async function () {
          let val = $(".comment-text", c).val().trim();
          await self.postComment__(feed, reply, val);
          popup.close();
        });
      }

      popup = await share.popup__(null, html, "bottom", onShown);
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
    doUnfollow__: function (item, detailDialog) {
      let waiting = share.toastWaiting__(share.getString__("sending"));
      var succ = function (json) {
        waiting.close();
        detailDialog.close();
        page.refresh();
      };

      var fail = function (e) {
        waiting.close();
        share.toastError__(e);
      };

      share.unfollow__(item, succ, fail);
    },

    postComment__: async function (feed, reply, commentText) {
      if (!commentText || commentText.trim() === '') {
        share.toastError__(share.getString__("commentEmpty"));
        return;
      }

      let waiting = share.toastWaiting__(share.getString__("sending"));

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

      waiting.close();

      self.doQuery__();
    },
    showResult__: function (json) {
      if (json && json.result) {
        let pageIndex = json.result.pageIndex;
        page.update(pageIndex, json.result.pageSize, json.result.totalRows);
        json.result.totalPages = Math.floor(json.result.totalRows / json.result.pageSize);
        if (json.result.totalRows % json.result.pageSize > 0) {
          json.result.totalPages++;
        }

        let html;
        let lc = $(`.feedComments`);
        lc.html("");
        json.result.list.forEach(comment => {
          html = $(`
                  <div class="flexrow commentItem clickable margin2">
                      <div class="flexcolumn">
                          <div class="header margin4 ">
                              <div class="seal-img"></div>
                          </div>
                      </div>
                      <div class="flexcolumn widthauto">
                          <div class="flexrow justify">
                            <div class="flexrow">
                              <span class="comment-author blue" fromEmail="${comment.fromEmail}" commentId="${comment.id}">${comment.fromName}</span>
                              <div class="gray replyTo font10"> <label class="glyphicon glyphicon-share-alt"></label>${comment.replyFromName}</div>
                            </div>
        
                            <div class="flexrow">
                              <div class="progress-container hide">
                                  <div class="progress-background"></div>
                                  <div class="progress-pointer"></div>
                              </div>
                              <div class="gray createTime font12">${share.getTime__(comment.createTime)}</div>
                            </div>
                          </div>
                          <div class="comment-text left forceWrap"></div>
                      </div>
                      <div class="flexcolumn marginlr4">
                          <div class="feed">
                              <div class="feedIcon center"></div>
                          </div>
                      </div>
                  </div>
                  `);

          html.find(".comment-text").text(comment.content);
          if (comment.type == 1) {
            html.find(".comment-text").html(`<img style="width:24px;" src='./img/unvote.png'>`);
          }
          html.find(".header").append($(share.getSeal(comment.fromName)))
            .addClass(share.getHeaderBackgroundColor__(comment.fromEmail));
          if (comment.fromEmail == share.user__.email) {
            $(".seal-img", html).addClass(`seal-me`);
          } else {
            $(".seal-img", html).addClass(`seal-fans`);
          }
          html.find(".feedIcon").append($(share.getFeedIcon__(comment)));
          if (comment.replyFromName) {
          } else {
            html.find(".replyTo").addClass("hide");
          }

          html.attr("commentId", comment.id);
          html.attr("fid", comment.fid);

          lc.append(html);
        });

        share.onClick__($(".commentItem", lc), function () {

          const fid = $(this).attr("fid");
          share.open__("./feed.htm?id=" + fid, "_self");
        });

        share.preloadVideo__($("video"));

        if (json.result.list.length > 0 && pageIndex == 1) {
          share.user__.lastListFeedCommentTime = json.result.list[0].createTime;
          share.saveAccount__(share.user__);
        }
      }
    },
    doQuery__: function (pageIndex, pageSize) {
      pageIndex = pageIndex ? pageIndex : 1;
      pageSize = pageSize ? pageSize : 10;
      var succ = function (json) {
        self.showResult__(json);
      };


      var fail = function (e) {
        share.toastError__(e);
      };

      share.callNodejs__({
        func: "getFeedComments",
        params: {
          email: share.user__.email,
          withFeed: 1,
          pageIndex: pageIndex,
          pageSize: pageSize
        }
      }, succ, fail);
    },
  };

  $(function () {
    if (share.needInit__(/feed\.comment\.list\.htm/g))
      self.initialize();
  });

  return self;
})();

