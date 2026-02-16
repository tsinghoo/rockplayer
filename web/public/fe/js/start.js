window.mhgl_start = window.mhgl_start || (function () {
	var share = window.mhgl_share;
	var self = {
		historyCount: 0,
		dbExists: false,
		wsPingInterval: null,
		redRooms: {},
		syncInterval__: null,
		initialize__: function () {
			share.debug__("start.init");
			//var height = share.getScreenHeight__();
			//document.all("mainFrame").style.height = height + "px";

			window.addEventListener("resize", self.onResize__);

			self.bindEvents__();
			share.registerDeviceReady__(null, self.onDeviceReady__);
		},
		bindEvents__: function () {
		},
		beforeUnload__: function (e) {
			share.beforeExit__();
		},
		onDeviceReady__: function () {
			share.debug__("device ready start");
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
			try {
				await share.startFileServer__();
			} catch (e) {
				share.error__(e.stack);
			}
			// document.location=("http://local.labadida.com/www/mhgl/fe/container.htm");
			document.location = ("./container.htm");
		}
	};

	$(function () {
		self.initialize__();
	});

	return self;
})();
