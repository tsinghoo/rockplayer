window.mhgl_container = window.mhgl_container || (function () {
	var share = window.mhgl_share;
	var self = {
		historyCount: 0,
		wsPingInterval: null,
		redRooms: {},
		syncInterval__: null,
		initialize__: function () {
			share.debug__("container.init");
			//var height = share.getScreenHeight__();
			//document.all("mainFrame").style.height = height + "px";

			window.addEventListener("resize", self.onResize__);

			self.bindEvents__();
			share.registerDeviceReady__(null, self.onDeviceReady__);
			self.translate__();
		},
		translate__: function () {
			let ph = {
				".detailAlias": "placeholderOfAlias",
				".detailGroupAlias": "placeholderOfGroupAlias",
				".detailName": "name",
				".paginationCurrentPage": "pleaseInputPageNo",
				".paginationPageSize": "pleaseInputPageSize",
				".mailFolderName": "pleaseInputMailFolderName",
			};

			Object.entries(ph).forEach(([key, value]) => {
				$(key).attr("placeholder", share.string[value]);
			});

			let html = {
				".emptyList": "emptyList",
				".detailSend": "sendMessage",
				".detailDelete": "delete",
				".addFriendGuide": "addFriendGuide",
				".addFriendNameLabel": "addFriendNameLabel",
				".addFriendEmailLabel": "addFriendEmailLabel",
				".addFriendGreetingLabel": "addFriendGreetingLabel",
				".sendInviteButton": "sendInviteButton",
				".sendButton": "send",
				".postButton": "post",
				"#nameHint": "nameHint",
				"#commentHint": "commentHint",
				"#emailHint": "emailHint",
				".post-comment": "send",
				".createMailFolderSubmitButton": "create",
				".currentPageNumber": "currentPageNumber",
				".passcodeHint": "passcodeHint",
				".passwordRetype": "passwordRetype",
				"#buttonConfirm": "confirm",
				".buttonConfirm": "confirm",
				".buttonSend": "sendMessage",
				".buttonDelete": "delete",
				".buttonComment": "comment",
				".buttonUnfollow": "unfollow",
				".btnLoadFile": "loadFile",
				".webLinkLabel": "link",
				".go": "go",
				".pageSize": "pageSize",
				"#groupNameHint": "groupName",
				"#groupCommentHint": "commentHint",
				".detailMembers": "groupMemebers",
				".detailSend": "sendMessage",
				".detailDelete": "delete",
				"#buttonLang": "language",
				".createMailFolderSubmitButton": "create",
				".proxySubmitButton": "confirm",
				".deleteButton": "delete",
				".contentLabel": "feedContent",
				".junkMappingLabel": "junk",
				".followGuide": "followGuide",
				".abstractHint": "abstract",
				".titleHint": "title",
				".linkHint": "link",
				".confirmDeleteFeed": "confirmDeleteFeed",
				".delBefore": "delFeedBefore",
				"#searchNameHint": "searchFeed",
				".followAuthor": "followAuthor",
			};

			Object.entries(html).forEach(([key, value]) => {
				$(key).html(share.string[value]);
			});
		},
		wsPing__: function () {
			if (self.wsPingInterval) {
				return;
			}

			self.wsPingInterval = setInterval(() => {
				if (parent.parent.mhgl_share.wsConnected) {
					share.wsPing__();
				} else if (share.accounts__ && share.accounts__.proxy) {
					if (share.accounts__.proxy.url == "") {
						share.onWsChanged__({ wsConnected: 0 });
					} else {
						share.proxyOn__();
					}
				}
			}, 10000);
		},
		connectWs__: function () {
			// 创建WebSocket连接
			if (self.ws == null) {
				self.ws = new WebSocket('ws://127.0.0.1:7902');

				// 当连接打开时执行
				self.ws.onopen = function (event) {
					share.debug__('WebSocket connected');
					var msg = {
						func: "register",
						params: {
							email: share.user__.email
						}
					}

					self.ws.send(JSON.stringify(msg));
				};

				// 当收到消息时执行
				self.ws.onmessage = function (event) {
					share.debug__("ws:${event.data}");
				};

				// 当收到消息时执行
				self.ws.onclose = function (event) {
					share.debug__("ws:${event.data}");
					self.ws = null;
				};
			}
		},

		showStatus__: function (status) {
			$("#status").html(status);
			$("#status").removeClass("hide");
			if (self.statusTimeout__ != null) {
				clearTimeout(self.statusTimeout__);
			}
			self.statusTimeout__ = setTimeout(function () {
				$("#status").addClass("hide");
			}, 1500);
		},
		imageFullScreenClicked__: function (e) {
			let img = $("#imageFullScreen")[0];
			var buttons = [];

			buttons.push({
				text: share.getString__("close"),
				onTap: async function () {
					await share.closePopup__();
					self.closeImageFullscreen__();
				}
			});
			buttons.push({
				text: share.getString__("scanQrInImage"),
				onTap: async function (e) {
					await share.closePopup__();
					share.toScanQrInImage(img);
				}
			});

			share.currentTarget = null;
			share.popupAction__('', buttons);
		},
		imageFullScreenContainerClicked__: function (e) {
			self.closeImageFullscreen__();
		},
		closeImageFullscreen__: function () {
			$("#imageFullScreenContainer").addClass("hide");
			$("#imageFullScreen").attr("src", "");
		},
		onNewChats__: function (chats) {
			share.debug__("onNewChats__");
			for (var i = 0; i < chats.length; ++i) {
				var c = self.redRooms[chats[i].roomId];
				if (!c) {
					c = 0;
				}

				self.redRooms[chats[i].roomId] = ++c;
			}
			navFrame.mhgl_navbar.onNewChats__(chats);

			if (mainFrame.message_list) {
				mainFrame.message_list.onNewChats__(chats);
			} else if (mainFrame.mhgl_chat_list) {
				mainFrame.mhgl_chat_list.onNewChats__(self.redRooms, chats);
			}
		},
		onNewFriends__: function (count) {
			parent.parent.navFrame.mhgl_navbar.showRedpoint__("contact", count);
			parent.parent.navFrame.mhgl_navbar.showRedpoint__("contact_friend", count);
		},
		onResize__: function () {
			let ms = mainFrame.window.mhgl_share;
			if (ms) {
				ms.onResize__();
				ms.updateDialog__();
			}
		},
		bindEvents__: function () {
			share.onClick__($$(".closeButton"), function (e) {
				$$("#topWin").html("").addClass("hide");
				$$("#topWinBackdrop").addClass("hide");
				$$(".closeButton").addClass("hide");
			});
			share.onClick__($("#buttonConfirm"), self.buttonConfirmClicked);
			share.onClick__($("#buttonLang"), self.buttonLangClicked);
			$("#password").off('keydown').on('keydown', function (e) {
				if (e.key == "Enter") {
					self.buttonConfirmClicked(e);
				}
			});

			share.onClick__($("#imageFullScreenContainer"), function () {
				self.imageFullScreenContainerClicked__(this);
			});

			share.onClick__($("#imageFullScreen"), function (e) {
				e.stopPropagation();
				self.imageFullScreenClicked__(this);
			});


			share.onClick__($("#modalClose"), function (event) {
				event.stopPropagation();
				self.closeVideoFullscreen__();
			});


			share.onClick__($("#fullscreenModal"), function (event) {
				event.stopPropagation();
				self.closeVideoFullscreen__();
			});

			share.onClick__($(".feedVideo"), function (event) {
				event.stopPropagation();
			});
		},
		closeVideoFullscreen__: function () {
			$(".feedVideo")[0].pause();
			$(".feedVideo").attr('src', "");
			$("#fullscreenModal").addClass("hide");
			$(".feedVideo").addClass("hide");
		},
		onNavbarInited: function () {
			document.getElementById('mainFrame').setAttribute('src', './chat.list.htm');
			// mainFrame.window.document.location = "./chat.list.htm";
		},
		passwordPassed__: async function (res) {
			$("#protect").addClass("hide");
			window.addEventListener('beforeunload', self.beforeUnload__);
			await share.reloadAccounts__();

			if (share.accounts__ == null || share.accounts__.accounts == null || share.accounts__.accounts.length == 0) {
				share.setCache__("user", null);
				share.user__ = null;
			}

			document.getElementById('navFrame').setAttribute('src', './navbar.htm');
			// $("body").addClass("bg_deepblue");
			// navFrame.window.document.location = "./navbar.htm";
		},
		beforeUnload__: function (e) {
			share.beforeExit__();
		},
		buttonConfirmClicked: function (e) {
			e.preventDefault();
			let pwd = $("#password").val();
			let pwd1 = $("#password1").val();

			if (!self.dbExists) {
				if (pwd.length < 6) {
					share.toastError__(share.getString__("passwordGuide"));
					return;
				}

				if (pwd != pwd1) {
					share.toastError__(share.getString__("passwordMustBeSame"));
					return;
				}
				self.setPassword__(pwd, self.passwordPassed__, share.toastError__);
			} else {
				self.checkPassword__(pwd, self.passwordPassed__,
					function (err) {
						share.toastError__(share.getString__("passwordOrDbError"));
					});
			}

		},
		buttonLangClicked: function (e) {
			e.preventDefault();

			share.toLanguage__();
		},
		setPassword__: function (pwd, succ, fail) {
			share.callNodejs__({
				func: "setPassword",
				params: {
					password: pwd
				}
			}, succ, fail);
		},
		checkPassword__: function (pwd, succ, fail) {
			share.callNodejs__({
				func: "checkPassword",
				params: {
					password: pwd
				}
			}, succ, fail);
		},
		beforeUnload__: function (e) {
			share.beforeExit__();
		},

		startSyncMails__: async function (asap) {
			if (asap) {
				await self.syncMails__();
			}

			if (self.syncInterval__) {
				return;
			}

			self.syncInterval__ = setInterval(self.syncMails__, 20000);
		},
		syncMails__: async function () {
			let mailboxes = [];
			if (share.user__.inbox) {
				mailboxes.push(share.user__.inbox);
			}
			if (share.user__.junk) {
				mailboxes.push(share.user__.junk);
			}

			if (mailboxes.length == 0) {
				mailboxes.push("INBOX");
			}

			mailboxes.forEach(async ele => {
				await share.callNodejs__({
					func: "getNewChats",
					params: {
						email: share.user__.email,
						mailBoxPath: ele
					}
				});
			});
		},
		onDeviceReady__: function () {
			share.debug__("device ready start");
			try {
				if (cordova.platformId === 'ios') {
					StatusBar.overlaysWebView(true);
					StatusBar.styleLightContent();
					StatusBar.backgroundColorByHexString('#000000');

					// 动态设置安全区域
					const style = document.documentElement.style;
					let top = window.safeAreaInsets ? window.safeAreaInsets.top : 0;
					style.setProperty('--safe-area-inset-top', top + "px");
				}
			} catch (e) {
				share.error__(e.stack);
			}


			share.initNodejs__(function (res) {
				setTimeout(function () {
					self.onNodeReady__(res);
				}, 10);
			});

			//share.debug__("backbutton registered");
			document.addEventListener('backbutton', self.backButtonClicked__, false);
			share.debug__("device ready end");
		},

		backButtonClicked__: function (e) {
			share.debug__("backbutton fired");
			if (!$("#imageFullScreenContainer").hasClass("hide")) {
				return self.closeImageFullscreen__();
			}

			if (!$("#fullscreenModal").hasClass("hide")) {
				return self.closeVideoFullscreen__();
			}

			if (self.historyCount > 0) {
				e.preventDefault();
				e.stopPropagation();
			}
			return self.back__();
		},

		back__: function () {
			if (self.historyCount > 0) {
				self.historyCount--;
				self.historyCount--;
				share.setSelectedItem__(1, "backwardClicked");
				mainFrame.mhgl_share && mainFrame.mhgl_share.back__();
				return false;
			} else {
				window.alert("exit");
				navigator.app.exitApp();

				return true;
				// if (parent.cordova && parent.cordova.plugins) {
				// 	var bgm = parent.cordova.plugins.backgroundMode;
				// 	bgm.moveToBackground()
				// }
			}
		},
		onNodeReady__: async function (res) {
			share.debug__("node ready");
			self.dbExists = res.dbExists;
			share.system = res;
			share.tempFilePath = res.tempFilePath;
			navigator && navigator.splashscreen && navigator.splashscreen.hide();
			$("#loading").addClass("hide");
			$("#protect").removeClass("hide");
			if (self.dbExists) {
				$("#retype").addClass("hide");
			} else {
				$("#retype").removeClass("hide");
			}

			let lang = share.getLang__();
			share.string = window.AllinEmail.string[lang];
			if (share.string == null) {
				lang = "en";
				share.string = window.AllinEmail.string[lang];
			}

			share.setLang__(lang);


			try {
				await share.startFileServer__();
			} catch (e) {
				share.error__(e.stack);
			}
		}
	};

	$(function () {
		if (share.useFrame__() && !share.isInFrame__())
			self.initialize__();
	});

	return self;
})();
