window.mhgl_draft_list =
  window.mhgl_draft_list ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var navbar = parent.parent.parent.navFrame ? parent.parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var storage = window.localStorage;
    var cacheKey__ = "mhgl_draft_list_cache";
    var timerSet = 0;
    var self = {
      items: null,
      lastSuccessTime__: 0,
      initialize: function () {
        share.debug__("mhgl_draft_list.init");
        this.bindEvents();
        if (share.user__ == null) {
          share.toLogin__();
          return;
        }

        navbar.highlight__("folder");
        mhgl_page.setDoQuery(self.doQuery__);
        navbar.backwardClicked = function () {
          share.setSelectedItem__(null, cacheKey__);
        };
        share.registerDeviceReady__(null, self.onDeviceReady__);
        self.translate__();
      },
      translate__: function () {
        let ph = {
        };

        Object.entries(ph).forEach(([key, value]) => {
          $(key).attr("placeholder", share.string[value]);
        });


        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",
          
          ".buttonDelete": "delete",
          ".buttonCancel": "cancel"

        };

        Object.entries(html).forEach(([key, value]) => {
          $(key).html(share.string[value]);
        });
      },
      onDeviceReady__: function () {
        share.debug__("device ready start");
        var account = share.user__;
        if (account != null) {
          var succ = function (res) {
            $("#connecting").addClass("hide");
            if (res && res.nextUid) {
              account.nextUid = res.nextUid;
            }
            self.currentAccount__ = account;
            mhgl_page.gotoPage(1);
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
      bindEvents: function () {
        share.onClick__($("#buttonCancel"), self.buttonCancelClicked__);
        share.onClick__($("#buttonDelete"), self.buttonDeleteClicked__);
      },
      buttonCancelClicked__: function (e) {
        self.closeChooseMore__();
      },
      buttonDeleteClicked__: function (e) {
        var ids = Object.keys(self.checkedIds);
        if (ids.length == 0) {
          share.toastWarning__(share.getString__("chooseMailsToDelete"));
          return;
        }

        self.toDeleteMore__();
      },
      toDeleteMore__: function (e) {
        var del = function (confirmed) {
          if (!confirmed) {
            return;
          }

          var ids = Object.keys(self.checkedIds);
          var uids = [];
          for (var i = 0; i < ids.length; ++i) {
            var item = self.items[ids[i]];
            ids[i] = item.id;
            uids.push(item.uid);
          }

          ids = ids.join("','");
          ids = "('" + ids + "')";
          uids = uids.join(",");
          var succ = function (json) {
            if (json && json.message) {
              share.toastInfo__(json.message);
            } else {

            }
            self.closeChooseMore__();
            mhgl_page.refresh();
          };

          var fail = function (e) {
            share.toastError__(e);
          };

          var si = share.getSelectedItem__();
          var account = share.user__;
          share.draftsDelete__({
            email: account.email,
            ids: ids
          }, succ, fail);
        };

        share.confirm__(share.getString__("confirmToDeleteMail"), del);
      },
      closeChooseMore__: function () {
        self.choosingMore = false;
        $("#moreOptions").addClass("hide");
        $("#pagination").removeClass("hide");
        $(".chooseMore").addClass("hide");
      },
      todo: function () {
        alert("todo");
      },
      showResult__: function (data) {
        self.data = data;
        share.debug__("mail.list.showResult start");
        parent.parent.window.document.title = share.getString__("draftBox");;
        var html = [];
        var template = $("#template").html();
        mhgl_page.update(data.pageIndex, data.pageSize, data.totalRows);
        var list = data.list;
        self.items = list;

        if (list.length > 0) {
          share.debug__(list.length + " drafts");
          list.forEach(function (item, i) {
            var itemHtml = template.replace(/#subject#/g, item.subject);
            itemHtml = itemHtml.replace(/#id#/g, i);
            var name = share.getMailToName__(item);
            itemHtml = itemHtml.replace(/#sender#/g, name);
            itemHtml = itemHtml.replace(/#header#/g, share.getSeal(name));

            var senderEmail = share.getSenderEmail__(item);
            itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(senderEmail));
            itemHtml = itemHtml.replace(
              /#sentTime#/g,
              share.timeFormat__(item.updateTime)
            );
            var attach = share.getAttachments__(item);
            itemHtml = itemHtml.replace(
              /#hide#/g,
              attach.length > 0 ? "" : "hide"
            );
            html.push(itemHtml);
          });
          $("#list").html(html.join(""));

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

        $("#loading").css("display", "none");
        $("#body").css("display", "");
      },
      itemClicked__: function (item) {
        var id = item.id;
        id = id.split("_")[1];
        if (self.choosingMore) {
          var checked = $("#checkbox_" + id).prop('checked');
          $("#checkbox_" + id).prop('checked', !checked).trigger("change");
          return;
        }
        var selectedItem = self.items[id];
        share.open__(`mail.send.htm?id=${selectedItem.id}`);
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
      toChooseMore__: function (e) {
        self.choosingMore = true;
        self.checkedIds = {};
        $("#moreOptions").removeClass("hide");
        $("#messageInput").addClass("hide");
        $("#pagination").addClass("hide");
        $(".chooseMore").removeClass("hide");
        $(".form-check-input").off("change").on("change", self.checkBoxChanged__);
        share.onClick__($(".form-check-input"), self.checkBoxClicked__);

        $(".form-check-input").prop('checked', false);
        self.checkedIds = {};
      },
      doRead__: function (selectedItem, all) {
        var succ = function () {
          share.closeDialog__();
          mhgl_page.refresh();
        };
        var fail = function (e) {
          share.toastError__(e);
        };
        selectedItem.readAll = all;
        share.mailRead__(selectedItem, succ, fail);
      },
      toDelete__: function (selectedItem) {
        var buttons = [];
        buttons.push({
          text: share.getString__("confirm"),
          onTap: function () {
            self.doDelete__(selectedItem);
          }
        });

        buttons.push({
          text: share.getString__("cancel"),
          onTap: async function (e) {
            await share.closePopup__();
          }
        });

        share.popupAction__(share.getString__("confirmToDelete"), buttons);
      },
      headerClicked__: async function (item) {
        
        var id = item.id;
        id = id.split("_")[1];
        var selectedItem = self.items[id];

        var buttons = [];
        buttons.push({
          text: share.getString__("view"),
          onTap: function () {
            share.open__(`email.send.htm?id=${selectedItem.id}`);
          }
        });
        buttons.push({
          text: share.getString__("delete"),
          onTap: async function (e) {
            await share.closePopup__();
            self.toDelete__(selectedItem);
          }
        });
        buttons.push({
          text: share.getString__("selectMore"),
          onTap: function (e) {
            share.closeDialog__();
            self.toChooseMore__(e)
          }
        });

        share.dialog__ = share.popupAction__('', buttons);
      },
      itemChoosed__: function (index) {
        var checked = $("#checkbox_" + index).prop('checked');

        if (checked) {
          self.checkedIds[index] = 1;
        } else {
          delete self.checkedIds[index];
        }
      },
      doQuery__: function (pageIndex, pageSize) {
        var backward = share.getSelectedItem__("backwardClicked");
        if (backward == 1) {
          share.setSelectedItem__(null, "backwardClicked");
          var data = share.getSelectedItem__(cacheKey__);
          if (data != null) {
            share.setSelectedItem__(data.selectedFolder);
            self.showResult__(data);
            return;
          }
        }

        var account = share.user__;

        var succ = function (data) {
          self.showResult__(data);
        };
        var fail = function (err) {
          share.toastError__(err);
        };

        share.getDrafts__(account.email, pageIndex, pageSize, succ, fail);
      },

      doDelete__: function (selectedItem) {
        var account = share.user__;
        share.closeDialog__();
        var waiting = share.toastWaiting__(share.getString__("deleting"));

        var succ = function () {
          waiting.close();
          mhgl_page.refresh();
        };
        var fail = function (e) {
          waiting.close();
          share.toastError__(e);
        };

        var account = share.user__;
        share.draftsDelete__({
          email: account.email,
          ids: `('${selectedItem.id}')`
        }, succ, fail);
      }
    };

    $(function () {
      if (share.needInit__(/draft\.list\.htm/g)) self.initialize();
    });

    return self;
  })();

