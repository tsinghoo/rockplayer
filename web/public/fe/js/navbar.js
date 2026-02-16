window.mhgl_navbar = window.mhgl_navbar || (function () {
  var share = window.mhgl_share;
  var mhgl_page = window.mhgl_page;
  var self = {
    initialize: function () {
      share.debug__("navbar.initialize");
      this.initMenu__();
      parent.mhgl_container.onNavbarInited();
      
      $$("#navFrame").removeClass("hide");
      $$("#mainFrame").removeClass("hide");
      $$("#loading").addClass("hide");

      this.attachEvents__();
      var defaults = {
        duration: 1000,
        easing: ''
      };

      $.fn.transition = function (properties, options) {
        options = $.extend({}, defaults, options);
        properties.webkitTransition = 'all ' + options.duration + ' ms ' + options.easing;
        $(this).css(properties);
      };
    },
    logout__: function () {
      share.logout__();
    },
    userInfo: function () {
      share.open__($("#userInfo").attr("href"), "_self");
    },
    status: 0,
    initMenu__: function () {
      share.debug__("initMenu__");

      self.setTitle(document.title);
      self.initNavItems__();
      share.onClick__($(".navItem_logout"), self.logout__);

    },
    setTitle: function (title) {

      document.title = title;
      parent.window.document.title = title;
    },
    onNewChats__: function (chats) {
      if (chats && chats.length > 0) {
        $(".navItem_group").addClass("redpoint");
      } else {
        $(".navItem_group").removeClass("redpoint");
      }
    },
    showRedpoint__: function (type, redpoint) {
      if (redpoint) {
        $(".navItem_" + type).addClass("redpoint");
      } else {
        $(".navItem_" + type).removeClass("redpoint");
      }
    },
    show__: function (items) {
      $(".navItem").addClass("hide");
      $.each(items, function (i, item) {
        $(`.navItem_${item}`).removeClass("hide");
      });
    },
    initNavItems__: function () {
      self.items = self.getData__();
      var navItems = self.items;
      var template = $("#navItemTemplate").html();
      var html = [];
      for (var i = 0; i < navItems.length; ++i) {
        var item = template.replace(/#label#/g, navItems[i].label);
        var image = navItems[i].icon;
        if (share.user__ && share.user__.avatar && navItems[i].id == "me") {
          image = share.user__.avatar;
        }

        item = item.replace(/#icon#/g, image);
        item = item.replace(/#id#/g, i);

        item = item.replace(/#class#/g, `${navItems[i].clazz.join(" ")} navItem_${navItems[i].id}`);
        html.push(item);
      }

      $("#navItems").html(html.join(''));
      share.onClick__($(".navItem"), function () {
        self.itemSelected__(this);
        return false;
      });

      self.showCommon__();

      $("#navItems").removeClass("hide");
      $("#body").removeClass("hide");
    },

    updateMyIcon__: function (html) {
      let container = $(".navItemIconContainer", $(".navItem_me"));
      container.css("width", "32px");
      container.html(html);
    },

    itemSelected__: function (item) {
      var id = item.id;
      id = id.split("_")[1];
      var selectedItem = self.items[id];

      if (selectedItem.clicked) {
        selectedItem.clicked();
      } else {
        parent.mainFrame.document.location.href = selectedItem.url;
      }
    },

    backClicked__: function () {
      share.debug__("backward clicked");
      parent.mhgl_container.back__();
    },

    highlight__: function (id) {
      $(".navItem").removeClass("navItemSelected");
      $(`.navItem_${id}`).addClass("navItemSelected");
    },
    showContact__: function () {
      self.show__(["backward", "contact_friend", "contact_group", "contact_following", "contact_follower", "me"]);
    },
    contactClicked__: function () {
      var buttons = [];
      let friendButton = {
        text: share.getString__("friends"),
        icon: `<img src="./img/friend.svg" class="navItemIcon">`,
        clazz: ["gold"],
        onTap: async function (e) {
          await share.closePopup__();
          self.showContact__();
          parent.parent.mainFrame.document.location = "./friend.list.htm";
        }
      };
      if ($(".navItem_contact").hasClass("redpoint")) {
        friendButton.clazz.push("redpoint");
      }
      buttons.push(friendButton);
      buttons.push({
        text: share.getString__("groupChat"),
        icon: `<img src="./img/group.svg" class="navItemIcon">`,
        clazz: ["gold"],
        onTap: async function (e) {
          await share.closePopup__();
          parent.parent.mainFrame.document.location = "./group.list.htm";
        }
      });
      buttons.push({
        text: share.getString__("following"),
        icon: `<img src="./img/follow.svg" class="navItemIcon">`,
        clazz: ["gold"],
        onTap: async function (e) {
          await share.closePopup__();
          parent.parent.mainFrame.document.location = "./following.list.htm";
        }
      });
      buttons.push({
        text: share.getString__("follower"),
        icon: `<img src="./img/fans.svg" class="navItemIcon">`,
        clazz: ["gold"],
        onTap: async function (e) {
          await share.closePopup__();
          parent.parent.mainFrame.document.location = "./follower.list.htm";
        }
      });

      share.popupAction__('', buttons, null, null, null, parent.parent.document);
    },
    onWsChanged__: function (json) {
      self.proxyConnected = json.connected;
      let meIcon = $(".navItemIcon", ".navItem_me");
      if (json.connected == 1) {
        meIcon.attr("src", "./img/proxyOn1.svg");
      } else {
        meIcon.attr("src", "./img/proxyOff.svg");
      }
      meIcon.removeClass("fader");
    },
    getData__: function () {
      var data = [];

      data.push({
        id: "backward",
        icon: 'img/back.svg',
        label: share.getString__("back"),
        clazz: ["white"],
        clicked: self.backClicked__
      });
      data.push({
        id: "group",
        icon: 'img/message.svg',
        label: share.getString__("secretMail"),
        clazz: ["white"],
        url: './chat.list.htm'
      }, {
        id: "folder",
        icon: 'img/folder.svg',
        label: share.getString__("mailBox"),
        clazz: ["white"],
        url: './folder.list.htm'
      }, {
        id: "feed",
        icon: 'img/feed9.svg',
        label: share.getString__("feed"),
        clazz: ["white"],
        url: './feed.list.htm'
      }, {
        id: "contact",
        icon: 'img/contact.svg',
        label: share.getString__("contacts"),
        clazz: ["white"],
        clicked: self.contactClicked__,
      }, {
        id: "contact_friend",
        icon: 'img/friend.svg',
        label: share.getString__("friends"),
        clazz: ["gold"],
        url: './friend.list.htm'
      }, {
        id: "contact_group",
        icon: 'img/group.svg',
        label: share.getString__("groupChat"),
        clazz: ["gold"],
        url: './group.list.htm'
      }, {
        id: "contact_following",
        icon: 'img/follow.svg',
        label: share.getString__("following"),
        clazz: ["gold"],
        url: './following.list.htm'
      }, {
        id: "contact_follower",
        icon: 'img/fans.svg',
        label: share.getString__("follower"),
        clazz: ["gold"],
        url: './follower.list.htm'
      });

      data.push({
        id: "login",
        icon: 'img/login.png',
        label: share.getString__("login"),
        clazz: ["white"],
        url: './user.login.htm'
      });

      if (share.test__ == 1) {

        data.push({
          id: "test",
          icon: 'img/refresh.png',
          label: share.getString__("test"),
          clazz: ["white"],
          url: './page.test.htm'
        });
      }

      data.push({
        id: "me",
        icon: 'img/proxyOff.svg',
        label: share.getString__("me"),
        clazz: ["white"],
        clicked: self.meClicked__,
        url: './user.login.htm'
      });

      return data;
    },

    beforeWsConnect__: function () {
      let meIcon = $(".navItemIcon", ".navItem_me");
      meIcon.addClass("fader");
      meIcon.attr("src", "./img/proxyOn1.svg");
    },
    showCommon__: function () {
      if (share.user__ != null) {
        self.show__(["backward", "group", "folder", "feed", "contact", "test", "me"]);

        let lc = $(".navItemLabel", $(".navItem_me"));
        lc.html(share.user__.nickName);
        lc.addClass("navItemLabelMy");
        /*
        let seal=share.getSeal(share.user__.nickName);
        let headerBg=share.getHeaderBackgroundColor__(share.user__.nickName);
        let iconHtml=`<div class="header white ${headerBg}">
                        <div class="seal-img seal-me"></div>
                        ${seal}
                      </div>`;
        self.updateMyIcon__(iconHtml);
        */
      } else {
        self.show__(["test", "login"]);
      }
    },

    meClicked__: function () {
      self.showCommon__();
      parent.mainFrame.document.location.href = "./user.login.htm";
    },

    attachEvents__: function () {
    },
    hideAllMenu__: function () {
      $(".navItem").css("display", "none");
    }
  };

  $(function () {
    if (share.needInit__(/.*/g)) {
      self.initialize();
    }
  });

  return self;
})();
