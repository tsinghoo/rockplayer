window.mhgl_mail_list =
  window.mhgl_mail_list ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var navbar = parent.parent.parent.navFrame ? parent.parent.parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var storage = window.localStorage;
    var cacheKey__ = "mhgl_mail_list_cache";
    var timerSet = 0;
    var self = {
      key: "",
      keyType: "",
      items: null,
      lastSuccessTime__: 0,
      initialize: function () {
        share.debug__("mhgl_mail_list.init");
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
          share.setPlaceholder__(key, value);
        });

        let html = {
          "#loading": "loading",
          ".emptyList": "emptyList",

          "#searchCancel": "cancel",
          ".searchLabel": "search",
          ".subjectLabel": "subject",
          ".senderLabel": "senderName",
          ".toLabel": "toEmail",
          "#buttonDelete": "delete",
          "#buttonMove": "move",
          ".toLabel": "toEmail",
          "#buttonCancel": "cancel",
          ".confirmDeleteMail": "confirmDeleteMail",
          ".delServer": "delServer",
          ".delBefore": "delBefore",
          ".delAfter": "delAfter",
        };

        Object.entries(html).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            $(key).html(share.getString__(...value));
          }
          $(key).html(share.getString__(value));
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
            self.toSearch__();
          };
          var fail = function (e) {
            share.toastError__(account.user + share.getString__("loginFailed"), 1000, function () {
              share.toLogin__();
            });
          };
          share.ensureImapConnected__(succ, fail);
        }

        //share.vibrate__(500);

        share.debug__("device ready end");
      },
      bindEvents: function () {
        share.onClick__($("#searchCancel"), function () {
          $("#search").val("");
          $("#searchCancel").addClass("hide");
          $("#searchType").addClass("hide");
          self.key = "";
          self.keyType = "";
          self.toSearch__();
        });

        $("#search").bind("input propertychange", function (event) {
          var key = $("#search").val();
          $("#list").html("");
          $("#pagination").addClass("hide");
          $("#emptyList").css("display", "none");
          if (key.trim() != "") {
            $("#searchType").removeClass("hide");
            $("#searchCancel").removeClass("hide");
          } else {
          }
        });

        share.onClick__($("#searchSender, .senderLabel"), function (event) {
          self.keyType = "Sender";
          self.toSearch__();
        });

        share.onClick__($("#searchSubject, .subjectLabel"), function (event) {
          self.keyType = "Subject";
          self.toSearch__();
        });

        share.onClick__($("#searchCc, .toLabel"), function (event) {
          self.keyType = "Cc";
          self.toSearch__();
        });
        share.onClick__($("#buttonCancel"), self.buttonCancelClicked__);

        share.onClick__($("#buttonDelete"), self.buttonDeleteClicked__);
        share.onClick__($("#buttonMove"), self.buttonMoveClicked__);
      },
      buttonDeleteClicked__: function (e) {
        var ids = Object.keys(self.checkedIds);
        if (ids.length == 0) {
          share.toastWarning__(share.getString__("chooseMailsToDelete"));
          return;
        }

        self.toDeleteMore__();
      },
      buttonMoveClicked__: function (e) {
        var ids = Object.keys(self.checkedIds);
        if (ids.length == 0) {
          share.toastWarning__(share.getString__("chooseMailsToMove"));
          return;
        }
        self.toChooseMoveTarget__();
      },
      buttonCancelClicked__: function (e) {
        self.closeChooseMore__();
      },
      toChooseMoveTarget__: function (e) {
        var account = share.user__;

        var succ = function (data) {
          var html = [];
          var template = $("#templateFolder", parent.parent.document).html();
          var list = data.list;

          if (list.length > 0) {
            list.forEach(function (item, i) {
              var itemHtml = template.replace(/#email#/g, "");
              itemHtml = itemHtml.replace(/#id#/g, i);
              itemHtml = itemHtml.replace(/#name#/g, item.name);
              html.push(itemHtml);
            });
            $("#folderList").html(html.join(""));
            share.dialog__ = share.toast__(
              share.getString__("chooseTargetedMailbox"),
              $("#folders")[0].outerHTML.replace(/\n/g, ""),
              0,
              BootstrapDialog.TYPE_PRIMARY,
              null,
              function () {
                share.onClick__($(".folderItem"), function (e) {
                  var id = e.currentTarget.id;
                  id = id.split("_")[1];
                  var item = list[id];
                  self.toMoveMore__(item);
                });
              });

          } else {
            $("#folderList").html("");
          }
        };
        var fail = function (err) {
          share.toastError__(err);
        };
        share.getMailboxes__(account.email, "", succ, fail);
      },
      toMoveMore__: function (target) {
        var del = function (confirmed) {
          if (!confirmed) {
            return;
          }
          share.closeDialog__();
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
            ids = Object.keys(self.checkedIds);
            for (var i = 0; i < ids.length; ++i) {
              $("#checkbox_" + ids[i]).parents(".listItem").remove();
            }
          };

          var fail = function (e) {
            share.toastError__(e);
          };

          var account = share.user__;
          var si = share.getSelectedItem__();
          share.mailsMove__({
            email: account.email,
            ids: ids,
            uids: uids,
            mailPath: si.path,
            destination: target.path,
          }, succ, fail);
        };

        share.confirm__(share.getString__("confirmToMoveMail", target.name), del);
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
          share.mailsDelete__({
            email: account.email,
            ids: ids,
            uids: uids,
            mailPath: si.path,
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
      toSearch__: function () {
        share.debug__(" mail.list.toSearch(key=" + self.key + ";keyType=" + self.keyType + ";)");

        $(".searchType").addClass("btn-info");
        $("#search" + self.keyType).removeClass("btn-info");

        mhgl_page.gotoPage(1);
      },
      todo: function () {
        alert("todo");
      },
      onDecodingChat: function (json) {
        let item = $(`[chatId="${json.mailId}"]`);
        item.find(".ischat").attr("src", "img/unlock.svg");
      },
      showResult__: function (data) {
        data.selectedFolder = data.selectedFolder || share.getSelectedItem__();
        share.setSelectedItem__(data, cacheKey__);
        self.data = data;
        share.debug__("mail.list.showResult start");
        parent.parent.window.document.title = share.getString__("mailBoxWithName", data.selectedFolder.name);
        $("#searchHint").html(share.getString__("searchMail", data.selectedFolder.name));

        var template = $("#template").html();
        mhgl_page.update(data.pageIndex, data.pageSize, data.totalRows);
        var list = data.list;
        self.items = list;

        $("#list").html("");
        if (list.length > 0) {
          share.debug__(list.length + " mails");
          list.forEach(function (item, i) {
            var itemHtml = template.replace(/#subject#/g, item.subject);
            itemHtml = itemHtml.replace(/#id#/g, i);
            itemHtml = itemHtml.replace(
              /#read#/g,
              item.read == 1 ? "gray" : ""
            );
            var senderName = share.getSenderName__(item);
            itemHtml = itemHtml.replace(/#sender#/g, senderName);
            itemHtml = itemHtml.replace(/#header#/g, share.getSeal(senderName));

            itemHtml = itemHtml.replace(/#headerBackgroundColor#/g, share.getHeaderBackgroundColor__(senderName));
            itemHtml = itemHtml.replace(
              /#sentTime#/g,
              share.timeFormat__(item.createTime)
            );
            let ele = $(itemHtml);
            ele.attr("data-id", item.id);
            var attach = share.getAttachments__(item);
            if (attach.length > 0) {
              ele.find(".attachment").removeClass("hide");
            }

            if (item.ischat == 0) {
              ele.find(".ischat").addClass("hide");
            } else if (item.ischat == 1) {
              ele.find(".ischat").attr("src", "img/key.svg");
            } else if (item.ischat == 2) {
              ele.find(".ischat").attr("src", "img/unlock.gif");
            } else if (item.ischat == 3) {
              ele.find(".ischat").attr("src", "img/keyBad.svg");
            }

            $("#list").append(ele);
          });

          share.onClick__($(".listItem"), function () {
            self.itemClicked__(this);
          });
          share.onClick__($(".header"), function (e) {
            e.stopPropagation();
            self.headerClicked__(this);
          });

          /*
          for (var i = 0; i < html.length; ++i) {
            var bgc = $("#header_" + i).css("background-color");
            var ss = bgc.split("(")[1].split(")")[0].split(",");
            var color = "rgb(";
            for (var j = 0; j < ss.length; ++j) {
              if (j > 0) { 
                color += ", ";
              }
              color += ((128 + parseInt(ss[j]))%256);
            }

            color += ")";

            $("#header_" + i).css("color", color);
          }
          */
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
        share.setSelectedItem__(selectedItem);
        selectedItem.read = 1;
        share.setSelectedItem__(self.data, cacheKey__);
        share.open__("mail.htm");
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
      toRead__: async function (selectedItem) {
        var buttons = [];
        buttons.push({
          text: share.getString__("no"),
          onTap: function () {
            self.doRead__(selectedItem);
          }
        });
        buttons.push({
          text: share.getString__("yes"),
          onTap: function () {
            self.doRead__(selectedItem, "all");
          }
        });
        buttons.push({
          text: share.getString__("cancel"),
          onTap: async function (e) {
            await share.closePopup__();
          }
        });

        share.popupAction__(share.getString__("confirmToSetAllMailRead"), buttons);
      },
      toDelete__: async function (selectedItem) {
        var buttons = [];
        buttons.push({
          text: share.getString__("cancel"),
          onTap: async function (e) {
            await share.closePopup__();
          }
        });

        buttons.push({
          text: share.getString__("confirm"),
          onTap: async function () {
            await share.closePopup__();
            var deleteAllBefore = 0;
            if (self.delBefore) {
              deleteAllBefore = true;
            } else if (self.delAfter) {
              deleteAllBefore = -1;
            }

            self.doDelete__(selectedItem, deleteAllBefore, self.delServer);
          }
        });

        content = $("#templateDelete").html();
        content = content.replace(/#mailTitle#/g, selectedItem.subject);

        self.delAfter = 0;
        self.delBefore = 0;
        self.delServer = 1;
        var onShown = function () {
          $(".delAfter").on("input", function (e) {
            self.delAfter = $(this).is(':checked');
            if (self.delBefore && self.delAfter) {
              $(".delBefore").prop("checked", false);
              self.deBefore = 0;
            }
          });
          $(".delBefore").on("input", function (e) {
            self.delBefore = $(this).is(':checked');
            if (self.delBefore && self.delAfter) {
              $(".delAfter").prop("checked", false);
              self.delAfter = 0;
            }
          });
          $(".delServer").on("input", function (e) {
            self.delServer = $(this).is(':checked');
          });
        };

        //share.showDialog__('请选择', content, buttons, onHide, onShown);
        share.dialog__ = await share.popupAction__(content, buttons, null, null, onShown);
      },
      headerClicked__: async function (item) {
        var id = item.id;
        id = id.split("_")[1];
        var selectedItem = self.items[id];

        var buttons = [];
        buttons.push({
          text: share.getString__("view"),
          onTap: function () {
            share.setSelectedItem__(selectedItem);
            selectedItem.read = 1;
            share.setSelectedItem__(self.data, cacheKey__);
            share.open__("mail.htm");
          }
        });
        buttons.push({
          text: share.getString__("read"),
          onTap: async function () {
            await share.closePopup__();
            self.toRead__(selectedItem);
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
          onTap: async function (e) {
            await share.closePopup__();
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

        self.key = $("#search").val();
        var account = share.user__;
        var si = share.getSelectedItem__();

        var succ = function (data) {
          self.showResult__(data);
        };
        var fail = function (err) {
          share.toastError__(err);
        };

        share.getMails__(account.email, si.id, si.path, si.name, self.key, self.keyType, pageIndex, pageSize, succ, fail);
      },

      doDelete__: function (selectedItem, deleteAllBefore, deleteFromServer) {
        var account = share.user__;
        selectedItem.deleteAllBefore = deleteAllBefore;
        selectedItem.deleteFromServer = deleteFromServer;
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
        share.mailDelete__(selectedItem, succ, fail);
      }
    };

    $(function () {
      if (share.needInit__(/mail\.list\.htm/g)) self.initialize();
    });

    return self;
  })();

