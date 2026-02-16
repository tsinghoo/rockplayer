window.mhgl_page = window.mhgl_page || (function () {
	var share = window.mhgl_share;
	var self = {
		defaultPageSize: 6,
		pageIndex: 0,
		pageSize: 20,
		totalCount: 0,
		totalPages: 0,
		doQuery: function (pageIndex, pageSize) {
			alert("mhgl_page.doQuery should be set when init the page");
		},
		getSelf: function () {
			if (1 == 0 && share.isInFrame__()) {
				return parent.mhgl_page;
			}

			return self;
		},
		setDoQuery: function (func) {
			self.getSelf().doQuery = func;
		},
		initialize__: function () {
			share.debug__("pagination.init");
			share.setPagination__(self);
			var system = parent.parent.mhgl_share.system;
			var defaultPageSize = system ? system.pageSize : self.defaultPageSize;
			if (!defaultPageSize) {
				defaultPageSize = self.defaultPageSize;
			}

			self.defaultPageSize = defaultPageSize;
			self.pageSize = self.defaultPageSize;
			$("body").append($$("#pagination")[0].outerHTML);

			$("#pagination").addClass("hide");
			$("#paginationAdd").addClass("hide");
			$("#paginationMore").addClass("hide");
			this.bindEvents();
		},

		update: function (pageIndex, pageSize, totalCount) {
			var that = self.getSelf();
			that.totalCount = parseInt(totalCount);
			that.pageIndex = parseInt(pageIndex);
			if (totalCount == 0) {
				that.pageIndex = 0;
			}
			that.pageSize = parseInt(pageSize);
			that.totalPages = Math.floor(totalCount / pageSize);
			if (totalCount % pageSize > 0) {
				that.totalPages++;
			}

			$("#paginationCurrentPage").html(that.pageIndex + "/" + that.totalPages);
			$("#pagination").removeClass("hide");
			$(".paginationButton").removeClass("hide");
			if (totalCount == 0) {
				if ($("#empty").length > 0) {
					$("#empty").css("display", "block");
				} else {
					$("#emptyList").css("display", "block");
				}
			} else {
				$("#empty").css("display", "none");
				$("#emptyList").css("display", "none");
			}
		},
		refresh: function (cb) {
			var that = self.getSelf();
			that.doQuery(that.pageIndex, that.pageSize, cb);
		},
		gotoPage: function (pageIndex) {
			self.getSelf().previousPageIndex = self.getSelf().pageIndex;
			self.getSelf().doQuery(pageIndex, self.pageSize);
		},
		gotoFirstPage: function () {
			self.getSelf().gotoPage(1);
		},
		gotoPrevPage: function () {
			self.getSelf().gotoPage(self.pageIndex - 1);
		},
		gotoNextPage: function () {
			self.getSelf().gotoPage(self.pageIndex + 1);
		},
		gotoLastPage: function () {
			self.getSelf().gotoPage(self.totalPages);
		},

		showPaginationInfo: async function (e) {
			var message = $$("#templatePaginationInfo").html();
			message = message.replace(/#message#/g, share.getString__("totalPagesAndCount", self.totalPages, self.totalCount));
			message = message.replace(/#pageIndexId#/g, 'pageIndex');
			message = message.replace(/#pageSizeId#/g, 'pageSize');
			message = message.replace(/#pageIndex#/g, self.pageIndex);
			message = message.replace(/#pageSize#/g, self.pageSize);
			message = message.replace(/#buttonSubmitId#/g, 'buttonSubmit');
			var onSubmit = async function () {
				var pageIndex = $("#pageIndex").val();
				var pageSize = $("#pageSize").val();
				pageIndex = parseInt(pageIndex);
				pageSize = parseInt(pageSize);
				if (pageSize > 0) {
					parent.parent.mhgl_share.system.pageSize = pageSize;
					share.callNodejs__(
						{
							func: "setPageSize",
							params: { pageSize: pageSize }
						}
					);
				}
				await share.closePopup__();
				self.doQuery(pageIndex, pageSize);
			};

			var onShown = function () {
				let html = {
					".currentPageNumber": "currentPageNumber",
					".go": "go",
					".pageSize": "pageSize",
					"#buttonLang": "language"
				};

				Object.entries(html).forEach(([key, value]) => {
					$(key).html(share.string[value]);
				});

				share.onClick__($("#buttonSubmit"), onSubmit);
			};

			share.dialog__ = await share.popup__(e.currentTarget, message, "top", onShown);
		},
		hidePaginationButtons__: function () {
			$(".paginationButton").addClass("hide");
		},
		showPaginationButtons__: function () {
			$(".paginationButton").removeClass("hide");
		},
		hidePagination__: function () {
			$("#pagination").addClass("hide");
		},
		showAddIcon: function (handler) {
			var that = self.getSelf();
			$("#paginationAdd").removeClass("hide");
			that.addIconClickedHandler = handler;
		},
		showMoreIcon: function (handler) {
			var that = self.getSelf();
			$("#paginationMore").removeClass("hide");
			that.moreIconClickedHandler = handler;
		},
		addIconClickedHandler: null,
		addIconClicked: function () {
			var that = self.getSelf();
			that.addIconClickedHandler();
		},
		moreIconClicked: function () {
			var that = self.getSelf();
			that.moreIconClickedHandler();
		},
		bindEvents: function () {
			share.onClick__($("#paginationFirstLink"), self.gotoFirstPage);
			share.onClick__($("#paginationLastLink"), self.gotoLastPage);
			share.onClick__($("#paginationPrevLink"), self.gotoPrevPage);
			share.onClick__($("#paginationNextLink"), self.gotoNextPage);
			share.onClick__($("#paginationCurrentLink"), self.showPaginationInfo);
			share.onClick__($("#paginationAddLink"), self.addIconClicked);
			share.onClick__($("#paginationMoreLink"), self.moreIconClicked);
		},

		todo: function () {
			alert("todo");
		}
	};

	$(function () {
		if (share.useFrame__() && !share.isInFrame__()) {
			self.initialize__();
			return;
		}

		if (share.needInit__(/.*/g))
			self.initialize__();
	});

	return self;

})();