window.stock_list = window.stock_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        showK1d: 0,
        showK1m: 0,
        showingRule: 0,
        statusMapping: {
            "10": "出错",
            "49": "待报",
            "50": "已报",
            "54": "已撤",
            "55": "部成",
            "56": "已成"
        },
        mapping: {
            "toBuy": "待买",
            "toSell": "待卖",
            "todo": "待命",
            "ordered": "已下单"
        },
        autoActionGateInited: false,
        lastBlockedActionCount: 0,
        blockedActionMessageContainer: null,
        blockedActionShownKeys: {},
        maxBlockedActionMessages: 5,
        sql: { name: "" },
        currentPrices: {},
        stockIntros: {},
        stockIntroUpdatedAt: {},
        stockIntroPlaceholder: "点击填写简介",
        init: async function () {
            self.sql.name = decodeURIComponent(window.location.hash.substring(1));
            if (self.sql.name == null || self.sql.name == "") {
                self.sql.name = "all";
            }

            window.name = self.sql.name;
            await self.getSqls();
            Chart.register(ChartDataLabels);
            self.bindEvents();
        },
        getSqls: async function () {
            let res = await share.getSync__("/stock/sqls");
            if (res.error) {
                $("#sqls").html(res.error);
            } else {
                let rows = res.data;
                $("#sqls").html("");
                //将rows里的数据显示在id是sqls的div里，并且每行的内容是rows的第i个元素，点击每行的时候拿对应的sql去调用"/stock/query"接口，并且将返回的数据显示在表格里
                for (let i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    let div = $("<div class='clickable padding4 nowrap'>");
                    div.text(row.name);
                    if (row.name == self.sql.name) {
                        self.sql = row;
                    }
                    div.click(function () {
                        share.currentTarget = this;
                        self.sqlClicked(row);
                    });

                    $("#sqls").append(div);
                }
            }

            if (self.sql.sql) {
                self.exeSql(self.sql, true);
            }
        },
        sqlClicked: function (row) {
            if (window.name == row.name) {
                self.toEditSql(row);
            } else {
                window.open('./stock.html#' + row.name, row.name);
            }
        },
        toEditSql: async function (row) {
            //弹出的窗口中有两个输入框，一个是name,一个是sql，name是row.name,sql是row.sql，点击确定后，将name和sql更新到数据库
            let html = `    <div class="sqlEditor flexcolumn" style="width: 500px;">
                                <div class="flexrow justify">
                                    <button class="btn btn-secondary buttonRun"> 执行</button>
                                    <button class="btn btn-primary buttonSave">保存</button>
                                </div>
                                <div class="height10">
                                </div>
                                <div class="flexcolumn">
                                    名称:<input type="text" class="name" value="${row.name}" placeholder="名称">
                                    参数:<input type="text" class="params" value="${row.params}" placeholder="参数">
                                    <textarea class="sql" rows="10" placeholder="sql">${row.sql}</textarea>
                                </div>
                            </div>
                            `;
            let popup = await share.popup__(null, html);
            let c = $(`#${popup.id}`);
            c.find(".params").val(row.params);
            $(".buttonSave", c).click(function () {
                let name = $(".name", c).val().trim();
                let sql = $(".sql", c).val().trim();
                row.name = name;
                row.params = $(".params", c).val().trim();
                row.sql = sql;
                self.updateSql(row);
            });
            $(".buttonRun", c).click(function () {
                let name = $(".name", c).val().trim();
                let sql = $(".sql", c).val().trim();
                let params = $(".params", c).val().trim();
                let start = $(".sql", c)[0].selectionStart;
                let end = $(".sql", c)[0].selectionEnd;
                let selection = null;
                if (start >= 0 && end > start) {
                    selection = sql.substring(start, end);
                }

                let param = { name, params, sql };
                if (selection != null) {
                    param.sql = selection;
                    delete param["name"];
                }

                self.exeSql(param, param.sql.indexOf("select") == 0);
            })
        },
        updateSql: async function (row) {
            let res = await share.postSync__("/stock/sql/update", row);
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.closePopup__();
                await self.getSqls();
            }
        },
        exeSql: async function (row, show) {
            //将sql 以base64编码
            let text = btoa(encodeURIComponent(JSON.stringify(row)));
            let res = await share.postSync__("/stock/query", { text });
            let table = $("#stockTable");
            self.sql = row;
            if (res.error) {
                share.toastError__(JSON.stringify(res.error));
            } else {

                if (show) {
                    self.sqlRow = row;
                    self.rows = res.data;
                    if (self.rows && self.rows.length > 0 && self.sqlRow.name) {
                        location.hash = `${row.name}`;
                    }
                    self.showRows(false);
                }
            }
        },
        moveStock: async function (code, action, successMessage) {
            let res = await share.getSync__(`/stock/${action}?code=${code}`);
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__(successMessage, 1000);
            }
        },
        escapeHtml: function (text) {
            return $("<div>").text(text == null ? "" : `${text}`).html();
        },
        escapeHtmlAttr: function (text) {
            return self.escapeHtml(text)
                .replace(/"/g, "&quot;")
                .replace(/\r/g, "&#13;")
                .replace(/\n/g, "&#10;");
        },
        getStockIntroKey: function (scode) {
            return self.normalizeScode(scode || "");
        },
        getRowStockIntro: function (row) {
            if (row == null) {
                return "";
            }

            let keys = ["intro"];
            for (let i = 0; i < keys.length; i++) {
                let value = row[keys[i]];
                if (value != null && `${value}`.trim() != "") {
                    return `${value}`.trim();
                }
            }

            return "";
        },
        buildStockIntroHtml: function (scode, intro) {
            let text = intro && intro != "" ? intro : self.stockIntroPlaceholder;
            let emptyClass = intro && intro != "" ? "" : " empty";
            return `<div class="stockIntro${emptyClass}" data-scode="${self.escapeHtmlAttr(scode)}" data-intro="${self.escapeHtmlAttr(intro || "")}" title="点击修改简介">${self.escapeHtml(text)}</div>`;
        },
        renderStockIntro: function (target, intro) {
            let value = intro == null ? "" : `${intro}`;
            target.removeClass("editing saving");
            target.attr("data-intro", value);
            if (value.trim() == "") {
                target.addClass("empty");
                target.text(self.stockIntroPlaceholder);
            } else {
                target.removeClass("empty");
                target.text(value);
            }
        },
        applyStockIntro: function (scode, intro) {
            let key = self.getStockIntroKey(scode);
            let value = intro == null ? "" : `${intro}`;
            self.stockIntros[key] = value;

            self.rows.forEach(function (row) {
                if (self.getStockIntroKey(row["代码"]) == key) {
                    row["简介"] = value;
                    row.intro = value;
                }
            });

            $(`.stockIntro[data-scode="${key}"]`).each(function () {
                self.renderStockIntro($(this), value);
            });

            $(`[code="${key}"]`).each(function () {
                let tr = $(this);
                let data = tr.attr("data");
                if (data == null || data == "") {
                    return;
                }
                try {
                    data = JSON.parse(data);
                    data["简介"] = value;
                    data.intro = value;
                    tr.attr("data", JSON.stringify(data));
                } catch (e) {
                    console.log(e);
                }
            });
        },
        loadStockIntros: async function (codes) {
            let requestTime = Date.now();
            let normalizedCodes = [];
            codes.forEach(function (code) {
                let normalized = self.getStockIntroKey(code);
                if (normalized != "" && !normalizedCodes.includes(normalized)) {
                    normalizedCodes.push(normalized);
                }
            });

            if (normalizedCodes.length < 1) {
                return;
            }

            let res = await share.getSync__(`/stock/intros?scodes=${encodeURIComponent(normalizedCodes.join(","))}`);
            if (res.error || res.data == null) {
                return;
            }

            Object.keys(res.data).forEach(function (scode) {
                if (self.stockIntroUpdatedAt[scode] != null && self.stockIntroUpdatedAt[scode] > requestTime) {
                    return;
                }
                self.applyStockIntro(scode, res.data[scode]);
            });
        },
        startEditStockIntro: function (target) {
            if (target.hasClass("editing")) {
                return;
            }

            let scode = self.getStockIntroKey(target.attr("data-scode"));
            let intro = self.stockIntros[scode];
            if (intro == null) {
                intro = target.attr("data-intro") || "";
            }

            target.data("original-intro", intro);
            target.addClass("editing");
            target.empty();
            let input = $("<textarea class='stockIntroInput' rows='3'></textarea>");
            input.val(intro);
            input.off("click");
            input.on("click", function (e) {
                e.stopPropagation();
            });
            input.off("keydown");
            input.on("keydown", async function (e) {
                if (e.key == "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    await self.saveStockIntro($(this).parent(), $(this));
                } else if (e.key == "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    let currentTarget = $(this).parent();
                    self.renderStockIntro(currentTarget, currentTarget.data("original-intro") || "");
                }
            });
            input.off("blur");
            input.on("blur", function () {
                if ($(this).data("submitted")) {
                    return;
                }

                let currentTarget = $(this).parent();
                self.renderStockIntro(currentTarget, currentTarget.data("original-intro") || "");
            });
            target.append(input);
            input.trigger("focus");
            input[0].select();
        },
        saveStockIntro: async function (target, input) {
            let scode = self.getStockIntroKey(target.attr("data-scode"));
            let intro = input.val().trim();
            input.data("submitted", 1);
            target.addClass("saving");
            let res = await share.postSync__("/stock/intro/update", { scode, intro });
            if (res.error) {
                target.removeClass("saving");
                share.toastError__(res.error);
                self.renderStockIntro(target, target.data("original-intro") || "");
                return;
            }

            self.stockIntroUpdatedAt[scode] = Date.now();
            self.applyStockIntro(scode, intro);
            share.toastSuccess__("简介已更新", 1000);
        },
        bindStockIntroEvents: function () {
            $(".stockIntro").off("click");
            $(".stockIntro").on("click", function (e) {
                e.stopPropagation();
                self.startEditStockIntro($(this));
            });
        },
        addButtonClicked__: async function () {
            let popup;
            let buttons = [
                {
                    text: "新交易记录",
                    onTap: self.showTradeInput
                },
                {
                    text: "新sql",
                    onTap: function () {
                        self.toEditSql({ name: "", sql: "" });
                        popup.close();
                    }
                },
                {
                    text: "精简",
                    onTap: function () {
                        let trs = $(`.repeatCode`);
                        if (trs.is(":visible")) {
                            self.showRows(false);
                        } else {
                            self.showRows(true);
                        }

                    }
                },
                {
                    text: "现价",
                    onTap: function () {
                        let tds = $(`.curPrice, .tdRule,.tdStatus, .tdK1d`);
                        if (tds.is(":visible")) {
                            tds.hide();
                        } else {
                            tds.show();
                        }
                    }
                },
                {
                    text: "自建规则",
                    onTap: async function () {
                        popup.close();
                        let autoResult = $("#autoCreateRule").html();
                        popup = await share.popup__(null, autoResult);
                        let c = $(`#${popup.id}`);

                        // 加载当前时间设置
                        let timeRes = await share.getSync__("/stock/rule/action/startTime");
                        if (timeRes && timeRes.data) {
                            let d = timeRes.data;
                            c.find(".buyStartTime").val(d.buyStartTime || d.startTime || "00:00");
                            c.find(".sellStartTime").val(d.sellStartTime || d.startTime || "00:00");
                        }

                        c.find(".setBoth0930").on("click", function () {
                            c.find(".buyStartTime").val("10:00");
                            c.find(".sellStartTime").val("10:00");
                        });

                        c.find(".setBoth0000").on("click", function () {
                            c.find(".buyStartTime").val("00:00");
                            c.find(".sellStartTime").val("00:00");
                        });

                        async function saveStartTime(showSuccess) {
                            let buyValue = c.find(".buyStartTime").val().trim();
                            let sellValue = c.find(".sellStartTime").val().trim();
                            if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(buyValue)) {
                                share.toastError__("买入时间格式应为 HH:mm");
                                return false;
                            }
                            if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(sellValue)) {
                                share.toastError__("卖出时间格式应为 HH:mm");
                                return false;
                            }
                            let res = await share.postSync__("/stock/rule/action/startTime", { buyStartTime: buyValue, sellStartTime: sellValue });
                            if (res == null || res.error) {
                                share.toastError__(res && res.error ? res.error : "时间保存失败");
                                return false;
                            }
                            if (showSuccess) {
                                share.toastSuccess__(`已更新 买:${buyValue} 卖:${sellValue}`, 1000);
                            }
                            return true;
                        }

                        c.find(".updateStartTime").on("click", async function () {
                            await saveStartTime(true);
                        });

                        async function toCreateRule(type) {
                            let maxCount = $(".maxCount", c).val().trim();
                            let priceDelay = $(".priceDelay", c).val().trim();

                            if (!await saveStartTime()) return;

                            let res = await share.getSync__(`/stock/rule/create/auto?type=${type}&max=${maxCount}&priceDelay=${priceDelay}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                let succeeded = res.succeeded.map((item) => `${item.scode}.${item.sname}`).join("<br/>");
                                let failed = res.failed.map((item) => `${item.scode}.${item.sname}:${item.reason}`).join("<br/>");
                                c.find(".succeededRules").html(succeeded);
                                c.find(".failedRules").html(failed);
                                let done = res.done;
                                if (done) {
                                    share.toastSuccess__("finished");
                                } else {
                                    setTimeout(function () { toCreateRule(type); }, 2000);
                                }
                            }

                            return res;
                        }

                        c.find(".buttonToBuySell").on("click", async function () {
                            await toCreateRule("toBuySell");
                        });

                        c.find(".buttonToBuy").on("click", async function () {
                            await toCreateRule("toBuy");
                        });

                        c.find(".buttonToSell").on("click", async function () {
                            await toCreateRule("toSell");
                        });
                    }
                }
            ];

            popup = await share.popupAction__("", buttons);

        },
        showAutoActionStartTimeSetting: async function (target) {
            let res = await share.getSync__("/stock/rule/action/startTime");
            if (res.error) {
                share.toastError__(res.error);
                return;
            }

            let data = res.data || {};
            let buyStartTime = data.buyStartTime || data.startTime || "00:00";
            let sellStartTime = data.sellStartTime || data.startTime || "00:00";
            let currentTime = data.currentTime || "";
            let html = `
                <div class="flexcolumn" style="width:340px;">
                    <div class="form-floating widthauto margin4">
                        <input
                            type="text"
                            class="form-control buyStartTime h20"
                            value="${buyStartTime}"
                            placeholder="09:30"
                        >
                        <label class="floating-label">自动买入开始时间(HH:mm)</label>
                    </div>
                    <div class="form-floating widthauto margin4">
                        <input
                            type="text"
                            class="form-control sellStartTime h20"
                            value="${sellStartTime}"
                            placeholder="09:30"
                        >
                        <label class="floating-label">自动卖出开始时间(HH:mm)</label>
                    </div>
                    <div class="font12 gray margin4">当前时间: ${currentTime}。未到所填时间不会自动买卖。</div>
                    <div class="flexrow center margintb4">
                        <button class="btn btn-secondary marginlr4 setBoth0930">买卖都09:30</button>
                        <button class="btn btn-secondary marginlr4 setBoth0000">买卖都00:00</button>
                        <button class="btn btn-primary marginlr4 save">保存</button>
                    </div>
                </div>
            `;

            let popup = await share.popup__(target ? target : null, html);
            let c = $(`#${popup.id}`);

            c.find(".setBoth0930").on("click", function () {
                c.find(".buyStartTime").val("09:30");
                c.find(".sellStartTime").val("09:30");
            });

            c.find(".setBoth0000").on("click", function () {
                c.find(".buyStartTime").val("00:00");
                c.find(".sellStartTime").val("00:00");
            });

            c.find(".save").on("click", async function () {
                let buyValue = c.find(".buyStartTime").val().trim();
                let sellValue = c.find(".sellStartTime").val().trim();
                if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(buyValue)) {
                    share.toastError__("买入时间格式应为 HH:mm");
                    return;
                }
                if (!/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(sellValue)) {
                    share.toastError__("卖出时间格式应为 HH:mm");
                    return;
                }

                try {
                    let res = await share.postSync__("/stock/rule/action/startTime", { buyStartTime: buyValue, sellStartTime: sellValue });
                    if (res == null || res.error) {
                        share.toastError__(res && res.error ? res.error : "保存失败");
                        return;
                    }

                    if (res.data == null || res.data.buyStartTime == null || res.data.sellStartTime == null) {
                        share.toastError__("保存失败");
                        return;
                    }

                    share.toastSuccess__(`已更新 买:${res.data.buyStartTime} 卖:${res.data.sellStartTime}`, 1000);
                    await popup.close();
                } catch (e) {
                    share.toastError__(e && e.message ? e.message : "保存失败");
                }
            });
        },
        bindEvents: function () {
            $(".addButton").click(function () {
                share.currentTarget = this;
                self.addButtonClicked__();
            });

            // 列宽调整功能
            $('#stockTable th').each(function () {
                let cell = $(this);
                cell.addClass('resizable');
                cell.on('mousedown', function (e) {
                    var startX = e.pageX;
                    var startWidth = cell.width();
                    var $resizer = $('<div class="resizer"></div>');
                    $resizer.css({
                        height: cell.height(),
                        top: cell.offset().top,
                        left: cell.offset().left + cell.width() - 3
                    });
                    $('body').append($resizer);
                    $resizer.on('mousemove', function (e) {
                        var newWidth = startWidth + (e.pageX - startX);
                        cell.width(newWidth);
                    }).on('mouseup', function () {
                        $resizer.remove();
                    });
                });
            });
        },
        showTradeInput: async function () {
            await share.closePopup__();
            let template = $("#rows").html();
            let popup = await share.popup__(null,
                template
            );

            let c = $(`#${popup.id}`);

            $(".submitRows", c).click(function () {
                var url = "/stock/update";
                let rows = $(".rows", c).val().trim();
                let broker = $(".broker", c).val().trim();
                var params = {
                    "rows": rows,
                    "broker": broker
                };
                let success = function () {
                    share.toastSuccess__("submitted", 1000);
                    popup.close();
                };

                let fail = share.toastError__;

                share.httpPost__(
                    url,
                    params,
                    success,
                    fail ? fail : share.toastError__
                );
            });
        },
        deleteRule: async function () {
            let res = await share.getSync__("/stock/rule/delete", { scode: self.selectedData["代码"], id: self.selectedData["id"], broker: self.selectedData["券商"] });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled", 1000);
                // self.exeSql(self.sqlRow, true);
            }
        },
        toCancelRule: async function (all) {
            let res = await share.getSync__("/stock/rule/cancel", { scode: self.selectedData["代码"], broker: self.selectedData["券商"], all });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled", 1000);
                // self.exeSql(self.sqlRow, true);
            }
        },
        showMenu4RuleContent: async function () {
            let res = await share.getSync__("/stock/rule/status", { scode: self.selectedData["代码"], broker: self.selectedData["券商"] });
            let guide = ``;

            let buttons = [
                {
                    text: "删除",
                    onTap: function () {
                        share.closePopup__();
                        self.deleteRule();
                    }
                },
                {
                    text: "更新价格状态",
                    onTap: function () {
                        share.closePopup__();
                        self.toUpdateRuleStatus();
                    }
                },
                {
                    text: "取消",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule();
                    }
                },
                {
                    text: "取消所有",
                    onTap: function () {
                        share.closePopup__();
                        self.showCancelAllButton();
                    }
                }
            ];

            let popup = share.popupAction__(guide, buttons);
        },
        showCancelAllButton: async function () {
            let guide = ``;

            let buttons = [
                {
                    text: "取消所有A股",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule("A股");
                    }
                },
                {
                    text: "取消所有H股",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule("H股");
                    }
                },
                {
                    text: "取消所有待买",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule("待买");
                    }
                },
                {
                    text: "取消所有待卖",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule("待卖");
                    }
                },
                {
                    text: "取消所有币安",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule("BNB");
                    }
                },
                {
                    text: "取消所有",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule(1);
                    }
                }
            ];

            let popup = share.popupAction__(guide, buttons);
        },
        updateData: async function () {
            let sqlName = self.sqlRow.name.trim();
            if (self.sql.params.includes("现价")) {
                await self.updatePrices();
            }

            if (self.showRule && self.sql.params.includes("规则")) {
                await self.updateRuleStatus();
            }
        },
        showK1ms: async function (codes) {
            codes.forEach(function (scode) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1m");
                let k1m = td.find(".k1m");
                k1m.html("loading k1m");
                k1m.removeClass("hide");
            });

            let ticks = await share.getSync__(`/stock/k/1ms?type=0&scodes=${codes.join(",")}`);
            let lastCode = null;
            let lastVolume = 0;
            var timeData = [];
            var priceData = [];
            var volumeData = [];

            for (let i = 0; i < ticks.length; i++) {
                let tick = ticks[i];
                if (lastCode == null) {
                    lastCode = tick.scode;
                } else if (lastCode != tick.scode) {
                    self.drawK1mChartSmall(lastCode, timeData, priceData, volumeData);
                    lastCode = tick.scode;
                    timeData = [];
                    priceData = [];
                    volumeData = [];
                    lastVolume = 0;
                }

                let dateStr = (tick.time);
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const hours = dateStr.substring(8, 10);
                const minutes = dateStr.substring(10, 12);
                const seconds = dateStr.substring(12, 14);

                timeData.push(`${hours}:${minutes}`);
                priceData.push(tick.close);
                volumeData.push(tick.volume);
            }

            if (priceData.length > 0) {
                self.drawK1mChartSmall(lastCode, timeData, priceData, volumeData);
            }
        },
        showK1dsInView: async function () {
            let vtr = $('.firstCode').map(function (i, item) {
                let k1d = $(item).find(".k1d");
                let res = share.isInViewport($(item));
                if (res && k1d.html() == "") {
                    let data = $(this).attr("data");
                    let row = JSON.parse(data);
                    self.showK1ds([row["代码"]]);
                }
            });

        },
        showK1msInView: async function () {
            let vtr = $('.firstCode').map(function (i, item) {
                let k1m = $(item).find(".k1m");
                if (!k1m.hasClass("hide")) {
                    return;
                }

                let res = share.isInViewport($(item));
                if (res) {
                    let data = $(this).attr("data");
                    let row = JSON.parse(data);
                    self.showK1ms([row["代码"]]);
                }
            });

        },
        showK1ds: async function (codes) {
            let scode = codes[0];
            codes.forEach(function (scode) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1d");
                let period = self.getActiveKPeriod(td);
                self.setActiveKPeriod(td, period);
                let k1d = td.find(".k1d");
                k1d.html("loading k1d");
                k1d.removeClass("hide");
            });

            let tr = $(`.firstCode[code="${scode}"]`);
            let td = tr.find(".tdK1d");
            let k1d = td.find(".k1d");
            let period = self.getActiveKPeriod(td);
            let maxCount = 60;
            let endpoint = self.getKEndpoint(period);
            let data = await share.getSync__(`${endpoint}?scode=${scode}&type=0&max=${maxCount}`);
            let rows = data.rows;
            let sb = data.stockBasic;
            let categoryData = [];
            let values = [];
            let volumes = [];
            if (rows.length < 1) {
                k1d.html(`${rows.length} rows`);
                return;
            }

            const fillCount = maxCount / 2 - rows.length;
            for (let i = 0; i < fillCount; i++) {
                categoryData.push("-");
                values.push([0, 0, 0, 0, 0, 0, 0]);
                volumes.push([i, 0, 1]);
            }


            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];
                categoryData.push(row.time);
                values.push([row.open, row.close, row.high, row.low, row.volume, row.amount, row.cci]);
                volumes.push([i + fillCount, row.volume, row.open > row.close ? 1 : -1]);
            }

            if (values.length > 0) {
                let c = tr.find(".tdK1d");
                self.drawK1dChartSmall(scode, categoryData, values, volumes, c, self.getKPeriodLabel(period));
            }
        },

        showRows: function (expanded) {
            let table = $("#stockTable");
            let rows = self.rows;
            self.data = {};
            table.empty();
            let getRowGroupKey = function (row) {
                if (row == null) {
                    return "||";
                }
                let code = row["代码"] == null ? "" : `${row["代码"]}`;
                let broker = row["券商"] == null ? "" : `${row["券商"]}`;
                let type = row["type"] == null ? "" : `${row["type"]}`;
                return `${code}|${broker}|${type}`;
            };
            let getRepeatRowsByGroupKey = function (groupKey) {
                return $(`.repeatCode`).filter(function () {
                    return $(this).attr("data-repeat-group-key") == groupKey;
                });
            };
            let thead = $("<thead>");
            let tr = $("<tr>");
            let params = JSON.parse(self.sql.params);
            let kvs = params.keys;
            let showAll = params.showAll;
            let keys = [];
            if (kvs == null) {
                if (rows.length > 0) {
                    kvs = Object.keys(rows[0]);
                } else {
                    kvs = ["id", "tid"];
                }
            }

            kvs.forEach(ele => {
                if (typeof ele == "string") {
                    keys.push(ele);
                } else {
                    let key = Object.keys(ele)[0];
                    keys.push(key);
                    params[key] = ele[key];
                }
            });
            for (let i = 0; i < keys.length; i++) {
                let th = $("<th>");
                let title = keys[i];
                if (keys[i] == "K1d") {
                    title = "K线";
                }
                th.text(title);
                tr.append(th);
                th.addClass("nowrap");
                if (keys[i] == "现价") {
                    th.addClass("curPrice");
                } else if (keys[i] == "规则") {
                    th.addClass("thRule gray");
                } else if (keys[i] == "状态") {
                    th.addClass("tdStatus");
                } else if (keys[i] == "K1d") {
                    th.addClass("tdK1d gray");
                    th.addClass("thK1d gray");
                    th.addClass("clickable");
                } else if (keys[i] == "K1m") {
                    th.addClass("tdK1m gray");
                    th.addClass("thK1m");
                    th.addClass("clickable");
                }
            }

            window.addEventListener('scroll', function () {
                clearTimeout(self.scrollTimer);
                self.scrollTimer = setTimeout(function () {
                    console.log("scrolling");

                    if (self.showK1d) {
                        self.showK1dsInView();
                    }

                    if (self.showK1m) {
                        self.showK1msInView();
                    }
                }, 1000);
            });


            thead.append(tr);
            table.append(thead);

            let lastCode;
            let lastType = 0;
            let lastBroker;
            for (let i = 0; i < rows.length; i++) {
                let tr = $("<tr>");
                let row = rows[i];
                keys.forEach(key => {
                    if (row[params[key]] != null) {
                        row[key] = row[params[key]];
                    }
                });

                tr.attr("data", JSON.stringify(row));
                let firstRow = true;
                if (row["代码"] == null) {
                    row["代码"] = "";
                }
                let groupKey = getRowGroupKey(row);
                if (row["代码"] == lastCode && row["券商"] == lastBroker && row["type"] == lastType) {
                    firstRow = false;
                } else {
                    lastCode = row["代码"];
                    lastBroker = row["券商"];
                    lastType = row["type"];
                }

                for (let j = 0; j < keys.length; j++) {
                    let key = keys[j];
                    let td = $("<td>");
                    td.addClass("nowrap");
                    if (row[key] == null) {
                        row[key] = "";
                    }

                    let code = self.getMarket(lastCode);

                    if (key == "代码") {
                        tr.addClass(`code${row[key]}`);
                        if (firstRow) {
                            self.data[row[key]] = [row];
                            let intro = self.getRowStockIntro(row);
                            let introKey = self.getStockIntroKey(row[key]);
                            if (intro != "") {
                                self.stockIntros[introKey] = intro;
                            } else if (self.stockIntros[introKey] != null) {
                                intro = self.stockIntros[introKey];
                            }
                            td.html(`
                                <div class="stockCodeBlock">
                                    <div class="stockCodeLine">${self.escapeHtml(row[key])}<span class="kLine">${code}</span></div>
                                    ${self.buildStockIntroHtml(introKey, intro)}
                                </div>`);
                            td.addClass("bold");
                            tr.addClass("firstCode clickable");
                            tr.attr("data-repeat-group-key", groupKey);
                            td.addClass("code");
                        } else {
                            td.text(row[key]);
                            td.addClass("almostWhite");
                            self.data[row[key]].push(row);
                            tr.addClass("repeatCode");
                            tr.attr("data-repeat-group-key", groupKey);
                        }

                        tr.attr("code", row[key]);
                    } else if (key == "名称") {
                        let option = "";
                        if (row["type"] == 1) {
                            option = ".o"
                        }

                        if (firstRow) {
                            td.html(`${row[key]}${option} <span class="vote">⇅</span>`);
                        } else {
                            td.html(`${row[key]}${option}`);
                            td.addClass("almostwhite");
                        }
                    } else if (key == "序号") {
                        td.html(i + 1);
                    } else if (key == "券商") {
                        td.html(row[key]);
                    } else if (key == "tid") {

                        tr.addClass(`tid${row[key].replace(/[\.:]/g, '_')}`);

                        if (row["配对"] == "") {
                            td.html(`<span class="deleteRow clickable gray">X</span>` + row[key]);
                        } else {
                            td.html(`<span class="deleteRow clickable">X</span>` + row[key]);
                        }
                    } else if (key == "id") {
                        td.html(`<span class="deleteRowById clickable gray">X</span>` + row[key]);
                    } else if (key == "买卖") {
                        td.text(self.getBuySellText(row[key]));
                        td.addClass("tdBuySell");
                    } else if (key == "总额") {
                        td.text(share.convertIfInteger(row[key]));
                    } else if (key == "规则") {
                        td.addClass("tdRule");
                        td.addClass("ruleContent");
                        let rc = null;
                        try {
                            rc = JSON.parse(row[key]);
                        } catch (e) {

                        }
                        if (rc != null) {
                            let closed = row["已关闭"];
                            self.showRule({ rule: rc, closed }, td);
                            if (rc.order == "") {
                                td.find("table").css({
                                    border: "1px solid gray",
                                    "border-collapse": "collapse"
                                });
                                td.find("table td, table th").css({
                                    border: "none"
                                });
                            }

                        }
                    } else if (key == "状态") {
                        td.addClass("tdStatus");
                        if (firstRow) {
                            td.addClass("ruleStatus");
                            // td.removeClass("nowrap"); 
                        }
                    } else if (key == "K1d") {
                        if (firstRow) {
                            td.addClass("tdK1d");
                            let html = `
                            <div class="flexcolumn kPeriodPanel listPeriodPanel">
                                <div class="flexrow font10 margin4">
                                    <span class="kPeriodTab clickable active" data-period="1d">1d</span>
                                    <span class="kPeriodTab clickable gray marginlr4" data-period="1w">1w</span>
                                    <span class="kPeriodTab clickable gray" data-period="1mon">1M</span>
                                </div>
                                <div class="flexrow">
                                    <span class = "k1dCollapse gray clickable">+</span>
                                    <div class="flexcolumn">
                                    <div class="k1d hide"></div>
                                    </div>
                                </div>
                            </div>
                            `;
                            td.html(html);

                            // self.showK1ds([row["代码"]]);
                            // td.removeClass("nowrap"); 
                        }
                    } else if (key == "K1m") {
                        if (firstRow) {
                            td.addClass("tdK1m");
                            let html = `
                            <div class="flexrow">
                                <span class = "k1mCollapse gray clickable">+</span>
                                <div class="flexcolumn">
                                    <div class="k1m hide"></div>
                                </div>
                            </div>
                            `;
                            td.html(html);
                        }
                    } else if (key == "错误") {
                        td.text(share.convertIfInteger(row[key]));
                        if (row[key].indexOf("I:") >= 0) {
                            td.addClass("gray");
                        }
                    } else if (key == "持仓") {
                        let text = "";
                        if (row["volume"] != null && row["volume"] > 0) {
                            text = `${share.convertIfInteger(row["can_use_volume"])}/${share.convertIfInteger(row["volume"])}@${share.convertIfInteger(row["avg_price"], 2)}`;
                        }
                        td.text(text);

                    } else {
                        td.text(share.convertIfInteger(row[key]));
                        if (key == "现价") {
                            td.addClass("curPrice");
                            td.html(`<div class="currentPrice"></div>`);
                            if (firstRow) {
                                td.html(`<div class="currentPrice"></div>
                                        <div class="flexrow">
                                            <div class="positions left widthauto font12"></div>
                                            <div class="avgprice right font12"></div>
                                        </div>
                                        <div class="error font12"/>
                                        <div class="ruleStatus hide"/>`);
                            }
                        } else if (key == "市场") {
                            if (firstRow) {
                                td.text(code);
                            }
                        }
                    }

                    tr.append(td);
                }
                table.append(tr);
            }

            if (expanded || showAll) {
                $(".repeatCode").show();
            } else {
                $(".repeatCode").hide();
            }

            self.bindStockIntroEvents();
            self.loadStockIntros(Object.keys(self.data));

            $(".ruleStatus").click(function (e) {
                let data = $(this).parents("tr").attr("data");
                data = JSON.parse(data);
                self.selectedData = data;
                share.currentTarget = this;
                self.showMenu4RuleContent();
            })

            $(".thRule").click(function (e) {
                self.showingRule = !self.showingRule;
                if (self.showingRule) {
                    $(".thRule").removeClass("gray");
                    $(".tdRule table").removeClass("hide");
                } else {
                    $(".thRule").addClass("gray");
                    $(".tdRule table").addClass("hide");

                }
            })

            if (self.sql.name == "rule") {
                setTimeout(() => {
                    $(".thRule").click();
                }, 100);
            }

            $(".thK1d").click(function (e) {
                self.showK1d = !self.showK1d;
                if (self.showK1d) {
                    $(".thK1d").removeClass("gray");
                    $(".k1dCollapse").removeClass("gray");
                    $(".k1d").css({
                        width: "380px",
                        height: "300px"
                    }).removeClass("hide");
                } else {
                    $(".thK1d").addClass("gray");
                    $(".k1d").addClass("hide");
                    $(".k1dCollapse").addClass("gray");
                }
            })

            $(".thK1m").click(function (e) {
                self.showK1m = !self.showK1m;
                if (self.showK1m) {
                    $(".thK1m").removeClass("gray");
                    $(".k1mCollapse").removeClass("gray");
                } else {
                    $(".thK1m").addClass("gray");
                    $(".k1m").addClass("hide");
                    $(".k1mCollapse").addClass("gray");
                }
            })

            $(".firstCode").click(function () {
                let groupKey = $(this).attr("data-repeat-group-key");
                let trs = getRepeatRowsByGroupKey(groupKey);
                if (trs.is(":visible")) {
                    trs.hide();
                } else {
                    trs.show();
                }
            })

            share.onClick__($(".tdBuySell"), function (e) {
                e.stopPropagation();
                self.onBuySellClicked(this);
            });

            $(".ruleContent").click(function (e) {
                e.stopPropagation();
                let data = $(this).parent("tr").attr("data");
                data = JSON.parse(data);
                self.selectedData = data;
                share.currentTarget = this;
                self.showMenu4RuleContent();
            })

            $(".k1dCollapse").click(function (e) {
                e.stopPropagation();
                let k1d = $(this).parents("tr").find(".k1d");
                if (k1d.hasClass("hide")) {
                    let scode = $(this).parents("tr").attr("code");
                    k1d.removeClass("hide");
                    self.showK1ds([scode]);
                    $(this).addClass("hide");
                } else {
                    k1d.addClass("hide");
                }
            })

            $(".kPeriodTab").click(function (e) {
                e.stopPropagation();
                let tab = $(this);
                let period = tab.attr("data-period");
                let tr = tab.closest("tr");
                if (tr.length > 0) {
                    let td = tr.find(".tdK1d");
                    self.setActiveKPeriod(td, period);
                    let scode = tr.attr("code");
                    self.showK1ds([scode]);
                    return;
                }

                let popupRoot = tab.closest(".buySellPopupContent");
                if (popupRoot.length > 0) {
                    self.setActiveKPeriod(popupRoot, period);
                    let type = self.selectedData && self.selectedData["type"] != null ? self.selectedData["type"] : 0;
                    let scode = popupRoot.find(".scode").val().trim();
                    if (scode == "" && self.selectedData) {
                        scode = self.selectedData["代码"];
                    }
                    scode = self.normalizeScode(scode);
                    self.toDrawK1dChart(scode, type, popupRoot, period);
                }
            })

            $(".k1mCollapse").click(function (e) {
                e.stopPropagation();
                let k1m = $(this).parents("tr").find(".k1m");
                if (k1m.hasClass("hide")) {
                    let scode = $(this).parents("tr").attr("code");
                    k1m.removeClass("hide");
                    self.showK1ms([scode]);
                    $(this).addClass("hide");
                } else {
                    k1m.addClass("hide");
                }
            })

            $(".code").click(async function (e) {
                e.stopPropagation();
                let parentTr = $(this).parents("tr");
                let code = parentTr.attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let groupKey = parentTr.attr("data-repeat-group-key");
                let trs = getRepeatRowsByGroupKey(groupKey);
                trs.show();
                self.showStockDetail(code);
                //self.showChart(rows);
            })

            $(".kLine").click(async function (e) {
                e.stopPropagation();
                let parentTr = $(this).parents("tr");
                let code = parentTr.attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let groupKey = parentTr.attr("data-repeat-group-key");
                let trs = getRepeatRowsByGroupKey(groupKey);
                trs.show();
                self.showK(code);
            })

            $(".vote").click(async function (e) {
                e.stopPropagation();
                let code = $(this).parents("tr").attr("code");
                let popup;
                let buttons = [
                    {
                        text: "强置顶",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/forceMoveUp?code=${code}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                share.toastSuccess__("已强置顶", 1000);
                            }
                        }
                    },
                    {
                        text: "置顶",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/moveUp?code=${code}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                share.toastSuccess__("已置顶", 1000);
                            }
                        }
                    },
                    {
                        text: "归位",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/resetMove?code=${code}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                share.toastSuccess__("已归位", 1000);
                            }
                        }
                    },
                    {
                        text: "置底",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/moveDown?code=${code}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                share.toastSuccess__("已置底", 1000);
                            }
                        }
                    },
                    {
                        text: "强置底",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/forceMoveDown?code=${code}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                share.toastSuccess__("已强置底", 1000);
                            }
                        }
                    }
                ];
                share.currentTarget = e.currentTarget;
                popup = await share.popupAction__("", buttons);
            })

            $(".deleteRow").click(async function (e) {
                e.stopPropagation();
                let tr = $(this).parents("tr");
                let data = tr.attr("data");
                data = JSON.parse(data);

                let pairedIds = String(data["配对"] || "").split(",").map((item) => item.trim()).filter((item) => item != "");
                let pairedTr = $();
                pairedIds.forEach(function (pairedId) {
                    pairedTr = pairedTr.add($(`.tid${pairedId.replace(/[\.:]/g, '_')}`));
                });
                pairedTr.find("td").addClass("bg_purple");
                tr.find("td").addClass("bg_purple");
                let popup;
                let buttons = [
                    {
                        text: "隐藏本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.find("td").addClass("gray");
                            }
                        }
                    },
                    {
                        text: "清除本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}&force=1`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.remove();
                            }
                        }
                    },
                    {
                        text: "关闭",
                        onTap: function () {
                            popup.close();
                        }
                    }
                ];
                share.currentTarget = e.currentTarget;
                popup = await share.popupAction__("", buttons);
                popup.onClosed = function () {
                    pairedTr.find("td").removeClass("bg_purple");
                    tr.find("td").removeClass("bg_purple");
                }
            })

            $(".deleteRowById").click(async function (e) {
                e.stopPropagation();
                let tr = $(this).parents("tr");
                let data = tr.attr("data");
                data = JSON.parse(data);
                let isConfirmed = await share.isConfirmed__(`确定要删除${data.id}吗?`);
                if (isConfirmed) {
                    let params = JSON.parse(self.sql.params);
                    let table = params.mainTable;
                    if (table == null) {
                        share.toastWarning__("no mainTable in params");
                        return;
                    }
                    let res = await share.getSync__(`/stock/deleteRow?id=${data.id}&table=${table}`);
                    if (res.error) {
                        share.toastError__(res.error);
                    } else {
                        tr.remove();
                    }
                }
            })

            setTimeout(async function () {
                while (1 == 1) {
                    let start = new Date().getTime();
                    try {
                        if (!document.hidden) {
                            await self.updateData();
                        }
                    } catch (e) {
                        console.log(e);
                        await share.sleep(200);
                    }
                    let end = new Date().getTime();

                    await share.sleep(1000 - (end - start));
                }
            }, 500);
        },

        updateRuleStatus: async function () {
            let res = await share.getSync__("/stock/rule/status");
            self.notifyBlockedAction(res.autoActionGate);
            let func = function () {
                let td = $(this);
                let data = td.parents("tr").attr("data");
                if (data == null) {
                    return;
                }

                data = JSON.parse(data);

                let scode = data["代码"];
                let broker = data["券商"];

                if (res.data[scode]) {
                    let r = res.data[scode][broker];
                    if (r) {
                        self.showRuleStatus(r, td);
                    } else {
                        td.html("");
                    }
                } else {
                    td.html("");
                }
            }


            $(".ruleStatus").not(".hide").each(func);

            if (self.showingRule) {
                $(".tdRule").each(func);
            }
        },
        notifyBlockedAction: function (gate) {
            if (gate == null || gate.blockCount == null) {
                return;
            }

            if (!self.autoActionGateInited) {
                self.autoActionGateInited = true;
                self.lastBlockedActionCount = gate.blockCount;
                return;
            }

            if (gate.blockCount <= self.lastBlockedActionCount) {
                return;
            }

            self.lastBlockedActionCount = gate.blockCount;
            let blockedActionKey = self.buildBlockedActionMessageKey(gate);
            if (blockedActionKey != "" && self.blockedActionShownKeys[blockedActionKey]) {
                return;
            }
            let target = "当前规则";
            if (gate.lastScode && gate.lastSname) {
                target = `${gate.lastScode}.${gate.lastSname}`;
            } else if (gate.lastScode) {
                target = `${gate.lastScode}`;
            } else if (gate.lastSname) {
                target = `${gate.lastSname}`;
            }
            let actionText = gate.lastActionType == "sell" ? "卖出" : "买入";
            let startTime = gate.startTime || "00:00";
            let msg = `${target} 自动${actionText}${startTime}后才开始`;
            self.pushBlockedActionMessage(msg, gate, blockedActionKey);
        },
        buildBlockedActionMessageKey: function (gate) {
            if (gate == null) {
                return "";
            }

            let scode = "";
            try {
                if (gate.lastScode) {
                    scode = self.normalizeScode(gate.lastScode);
                }
            } catch (e) {
                scode = `${gate.lastScode || ""}`.trim().toUpperCase();
            }

            let sname = `${gate.lastSname || ""}`.trim().toUpperCase();
            let broker = `${gate.lastBroker || ""}`.trim().toUpperCase();
            let actionType = `${gate.lastActionType || ""}`.trim().toLowerCase();
            let startTime = `${gate.startTime || "00:00"}`.trim();
            let target = scode || sname;
            return [target, broker, actionType, startTime].join("|");
        },
        ensureBlockedActionMessageContainer: function () {
            if (self.blockedActionMessageContainer && self.blockedActionMessageContainer.length > 0) {
                return self.blockedActionMessageContainer;
            }

            let container = $("#blockedActionMessages");
            if (container.length == 0) {
                container = $("<div id='blockedActionMessages'>");
                container.css({
                    position: "fixed",
                    top: "8px",
                    right: "8px",
                    width: "360px",
                    "max-width": "calc(100vw - 16px)",
                    "z-index": 1030,
                    display: "flex",
                    "flex-direction": "column",
                    gap: "8px"
                });
                $("body").append(container);
            }

            self.blockedActionMessageContainer = container;
            return container;
        },
        pushBlockedActionMessage: function (message, gate, blockedActionKey) {
            if (blockedActionKey != null && blockedActionKey != "") {
                if (self.blockedActionShownKeys[blockedActionKey]) {
                    return;
                }
                self.blockedActionShownKeys[blockedActionKey] = 1;
            }

            let container = self.ensureBlockedActionMessageContainer();
            let now = share.timeFormat__(new Date(), "hh:mm:ss");

            let item = $("<div class='blockedActionMessageItem'>");
            item.data("blockedAction", {
                scode: gate && gate.lastScode ? gate.lastScode : "",
                sname: gate && gate.lastSname ? gate.lastSname : "",
                broker: gate && gate.lastBroker ? gate.lastBroker : "",
                actionType: gate && gate.lastActionType ? gate.lastActionType : "",
                startTime: gate && gate.startTime ? gate.startTime : "00:00"
            });
            item.data("blockedActionKey", blockedActionKey || "");
            item.css({
                position: "relative",
                "padding-top": "10px",
                padding: "10px 32px 10px 10px",
                "border-radius": "6px",
                "font-size": "12px",
                "line-height": "1.4",
                cursor: "pointer"
            });

            let close = $("<button type='button' aria-label='Close'>&times;</button>");
            close.css({
                position: "absolute",
                top: "2px",
                right: "6px",
                border: "none",
                background: "transparent",
                color: "#8a8a8a",
                "font-size": "16px",
                "line-height": "16px",
                cursor: "pointer",
                padding: 0
            });

            let msg = $("<div class='blockedActionMessageText'>");
            msg.text(message);
            let time = $("<div class='blockedActionMessageTime'>");
            time.text(now);
            time.css({
                "font-size": "10px",
                color: "#9a7b40",
                "margin-top": "4px",
                "text-align": "right"
            });

            close.on("click", function (e) {
                e.stopPropagation();
                let key = item.data("blockedActionKey") || "";
                if (key != "") {
                    delete self.blockedActionShownKeys[key];
                }
                item.remove();
                self.refreshBlockedActionMessageStyles();
            });

            item.on("click", async function () {
                share.currentTarget = this;
                await self.showBlockedActionMenu(this);
            });

            item.append(close);
            item.append(msg);
            item.append(time);

            container.prepend(item);
            let children = container.children();
            if (children.length > self.maxBlockedActionMessages) {
                children.slice(self.maxBlockedActionMessages).remove();
            }
            self.refreshBlockedActionMessageStyles();
        },
        refreshBlockedActionMessageStyles: function () {
            let container = self.ensureBlockedActionMessageContainer();
            container.children().each(function (index) {
                let c = $(this);
                let close = c.find("button");
                let time = c.find(".blockedActionMessageTime");
                if (index == 0) {
                    c.css({
                        border: "1px solid #f3d6a4",
                        background: "#fff8e8",
                        color: "#7a4e00",
                        "box-shadow": "0 2px 8px rgba(0,0,0,0.12)"
                    });
                    close.css({ color: "#8a8a8a" });
                    time.css({ color: "#9a7b40" });
                } else {
                    c.css({
                        border: "1px solid #d8d8d8",
                        background: "#f2f2f2",
                        color: "#7a7a7a",
                        "box-shadow": "none"
                    });
                    close.css({ color: "#9d9d9d" });
                    time.css({ color: "#9b9b9b" });
                }
            });
        },
        clearBlockedActionMessagesByScode: function (scode) {
            if (scode == null || scode === "") {
                return;
            }
            let normalizedScode = `${scode}`.trim().toUpperCase();
            let container = self.ensureBlockedActionMessageContainer();
            container.children().each(function () {
                let item = $(this);
                let blockedAction = item.data("blockedAction") || {};
                let itemScode = `${blockedAction.scode || ""}`.trim().toUpperCase();
                if (itemScode === normalizedScode) {
                    item.remove();
                }
            });
            self.clearBlockedActionShownKeysByScode(normalizedScode);
            self.refreshBlockedActionMessageStyles();
        },
        clearBlockedActionShownKeysByScode: function (scode) {
            if (scode == null || scode === "") {
                return;
            }

            let normalizedScode = "";
            try {
                normalizedScode = self.normalizeScode(scode);
            } catch (e) {
                normalizedScode = `${scode}`.trim().toUpperCase();
            }

            Object.keys(self.blockedActionShownKeys).forEach(function (key) {
                if (key.indexOf(`${normalizedScode}|`) == 0) {
                    delete self.blockedActionShownKeys[key];
                }
            });
        },
        findRowForBlockedAction: function (blockedAction) {
            let scode = blockedAction && blockedAction.scode ? blockedAction.scode : "";
            let normalizedScode = "";
            try {
                normalizedScode = self.normalizeScode(scode);
            } catch (e) {
                normalizedScode = `${scode || ""}`.trim().toUpperCase();
            }

            if (!normalizedScode) {
                return $();
            }

            let tr = $(`tr[code="${normalizedScode}"]`).first();
            if (tr.length == 0) {
                tr = $(`tr[code="${self.stripScodeSuffix(normalizedScode)}"]`).first();
            }
            return tr;
        },
        scrollToBlockedActionRow: async function (blockedAction) {
            let tr = self.findRowForBlockedAction(blockedAction);
            if (tr.length == 0) {
                return tr;
            }

            let shouldWait = !share.isInViewport(tr);
            let row = tr[0];
            if (row && typeof row.scrollIntoView == "function") {
                row.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest"
                });
            }

            if (shouldWait) {
                await new Promise(function (resolve) {
                    setTimeout(resolve, 320);
                });
            }

            return tr;
        },
        findBuySellCellForBlockedAction: function (blockedAction) {
            let tr = self.findRowForBlockedAction(blockedAction);
            if (tr.length == 0) {
                return $();
            }

            return tr.find(".tdBuySell").first();
        },
        showBlockedActionMenu: async function (target) {
            let blockedAction = $(target).data("blockedAction") || {};
            let actionText = blockedAction.actionType == "sell" ? "卖出" : "买入";
            let targetText = blockedAction.scode || blockedAction.sname || "当前规则";
            let title = `${targetText} 自动${actionText}`;
            let buttons = [
                {
                    text: "买卖",
                    onTap: async function () {
                        await share.closePopup__();
                        let buySellCell = self.findBuySellCellForBlockedAction(blockedAction);
                        if (buySellCell.length > 0) {
                            await self.scrollToBlockedActionRow(blockedAction);
                            share.currentTarget = buySellCell[0];
                            await self.onBuySellClicked(buySellCell[0]);
                            return;
                        }
                    }
                },
                {
                    text: "更改",
                    onTap: async function () {
                        await share.closePopup__();
                        await self.showAutoActionStartTimeSetting(target);
                    }
                },
                {
                    text: "放行",
                    onTap: async function () {
                        let scode = blockedAction.scode || "";
                        if (scode == "") {
                            share.toastError__("缺少放行所需信息");
                            return;
                        }

                        let res = await share.postSync__("/stock/rule/action/tempAllow", { scode });
                        if (res == null || res.error) {
                            share.toastError__(res && res.error ? res.error : "放行失败");
                            return;
                        }

                        await share.closePopup__();
                        self.clearBlockedActionMessagesByScode(scode);
                        share.toastSuccess__(`${scode} 已加入临时放行白名单`, 1200);
                    }
                }
            ];

            await share.popupAction__(title, buttons);
        },

        autoPrice: function (changed, c) {
            let buy = c.find(".buy").val().trim();
            let sell = c.find(".sell").val().trim();
            let buyAmount = c.find(".buyAmount").val().trim();
            let sellAmount = c.find(".sellAmount").val().trim();
            let buyTotal = c.find(".buyTotal").val().trim();
            let sellTotal = c.find(".sellTotal").val().trim();

            if (changed == "buyTotal") {
                c.find(".buyAmount").val(parseFloat(buyTotal) / parseFloat(buy));
            }

            if (changed == "buyAmount") {
                c.find(".buyTotal").val(parseFloat(buy) * parseFloat(buyAmount));
            }


            if (changed == "sellTotal") {
                c.find(".sellAmount").val(parseFloat(sellTotal) / parseFloat(sell));
            }
            if (changed == "sellAmount") {
                c.find(".sellTotal").val(parseFloat(sell) * parseFloat(sellAmount));
            }

            if (changed == "buy") {
                let buyTotal = parseFloat(buy) * parseFloat(buyAmount);
                $(".buyTotal").val(buyTotal);
                if (parseFloat(sell) < parseFloat(buy) * (1 + 0.02)) {
                    sell = parseFloat(buy) * (1 + 0.02);
                    c.find(".sell").val(sell);
                    let sellTotal = (sell) * parseFloat(c.find(".sellAmount").val().trim());
                    $(".sellTotal").val(sellTotal);
                }
            }
            if (changed == "sell") {
                let sellTotal = parseFloat(sell) * parseFloat(c.find(".sellAmount").val().trim());
                $(".sellTotal").val(sellTotal);
                if (parseFloat(buy) > parseFloat(sell) * (1 - 0.02)) {
                    buy = parseFloat(sell) * (1 - 0.02);
                    c.find(".buy").val(buy);
                    let buyTotal = (buy) * parseFloat(buyAmount);
                    $(".buyTotal").val(buyTotal);
                }
            }
        },
        showBuySell: async function (opt, popup) {
            let c = null;
            if (popup != null) {
                c = $(`#${popup.id}`);
            }

            let sell, buy, delta, broker, sellAmount, buyAmount, dip, bounce, order;
            if (opt) {
                sell = opt.sell;
                buy = opt.buy;
                delta = opt.delta;
                broker = opt.broker;
                sellAmount = opt.sellAmount;
                buyAmount = opt.buyAmount;
                dip = opt.dip;
                bounce = opt.bounce;
                order = opt.order;
            }
            if (broker == null) {
                broker = self.selectedData["券商"];
            }

            if (!["国信", "国金", "BNB", "OKX"].includes(broker)) {
                if (self.lastBroker) {
                    broker = self.lastBroker;
                } else {
                    broker = "国信";
                }
            }

            if (self.formatScode(self.selectedData["代码"]).indexOf("BJ") >= 0) {
                broker = "国金";
            }

            if (sellAmount == null || sellAmount == 0 || isNaN(sellAmount)) {
                sellAmount = Math.abs(self.selectedData["数量"]);
            }

            if (sellAmount == null || sellAmount == 0 || isNaN(sellAmount)) {
                sellAmount = 1;
            }
            buyAmount = sellAmount;

            let toModify = false;

            if (c == null) {
                toModify = true;
                c = $("#templateBuySell").html();
                let popup = await share.popup__(null, c);
                c = $(`#${popup.id}`);
            }

            c.find(".sname").val(`${self.selectedData["名称"]}`);
            c.find(".scode").val(`${self.normalizeScode(self.selectedData["代码"])}`);
            //添加.sname或.scode发生变化时的事件处理

            let onchanged = function () {
                let input = $(this).val().trim();
                //如果新内容是"北大荒(SH:600598)"这种格式，则将.scode的内容设置成"600598",将.sname的内容设置成"北大荒",请使用正则表达式并考虑"SH:"的处理
                let match = input.match(/^(.+?)\(([A-Z]+:)?([A-Z0-9.-]+)\)$/);
                if (match) {
                    let sname = match[1].trim();
                    let scode = match[2] ? `${match[3]}.${match[2].replace(":", "")}` : match[3];
                    c.find(".scode").val(self.normalizeScode(scode));
                    c.find(".sname").val(sname);
                } else if ($(this).hasClass("scode")) {
                    c.find(".scode").val(self.normalizeScode(input));
                }
            };

            c.find(".sname").change(onchanged);
            c.find(".scode").change(onchanged);
            c.find(".operationName").val(`${broker}`);
            c.find(".expireHours").val("12");
            let np = self.selectedData.curPrice;
            if (np == null || np == 0) {
                np = self.selectedData["价格"];
            }
            let oper = self.selectedData["买卖"];

            if (oper && oper.indexOf("买") > -1) {
                if (sell == null) {
                    sell = (np * (1 + 0.02)).toFixed(3);
                }
                if (buy == null || isNaN(buy)) {
                    buy = np;
                }
                if (buy == null || isNaN(buy)) {
                    buy = 0.01;
                }
                c.find(".sell").val(sell);
                c.find(".buy").val(buy);
                c.find(".sellFirst").prop("checked", true);
                c.find(".buyFirst").prop("checked", false);
            } else {
                if (buy == null) {
                    buy = (np * (1 - 0.02)).toFixed(3);
                }
                if (buy == null || isNaN(buy)) {
                    buy = np;
                }
                if (buy == null || isNaN(buy)) {
                    buy = 0.01;
                }

                if (sell == null) {
                    sell = np;
                }

                if (sell == null || isNaN(sell)) {
                    sell = 10000;
                }
                c.find(".buy").val(buy);
                c.find(".sell").val(sell);
                c.find(".sellFirst").prop("checked", false);
                c.find(".buyFirst").prop("checked", true);
            }

            if (toModify) {
                c.find(".sellFirst").prop("checked", false);
                c.find(".buyFirst").prop("checked", false);
                if (order == "buyFirst") {
                    c.find(".buyFirst").prop("checked", true);
                }
                if (order == "sellFirst") {
                    c.find(".sellFirst").prop("checked", true);
                }
            }

            let autoDelta = function () {
                let buy = c.find(".buy").val().trim();
                if (buy >= 100) {
                    c.find(".bounce").val(0.2);
                    c.find(".dip").val(0.2);
                } else {
                    c.find(".bounce").val(0.02);
                    c.find(".dip").val(0.02);
                }
            }


            if (delta == null) {
                delta = 0.02;
            }

            if (dip == null) {
                dip = delta;
            }
            if (bounce == null) {
                bounce = delta;
            }

            c.find(".bounce").val(bounce);
            c.find(".dip").val(dip);
            autoDelta();

            $('.buy', c).change(function () {
                self.autoPrice("buy", c);
            });
            $('.sell', c).change(function () {
                self.autoPrice("sell", c);
            });

            $('.buyTotal', c).change(function () {
                self.autoPrice("buyTotal", c);
            });

            $('.buyAmount', c).change(function () {
                self.autoPrice("buyAmount", c);
            });

            $('.sellTotal', c).change(function () {
                self.autoPrice("sellTotal", c);
            });

            $('.sellAmount', c).change(function () {
                self.autoPrice("sellAmount", c);
            });


            c.find(".buyAmount").val(buyAmount);
            c.find(".sellAmount").val(sellAmount);

            c.find(".buyFirst").on('change', function () {
                if (this.checked) {
                    c.find(".sellFirst").prop("checked", !this.checked);
                }
            });

            c.find(".sellFirst").on('change', function () {
                if (this.checked) {
                    c.find(".buyFirst").prop("checked", !this.checked);
                }
            });

            c.find(".buttonConfirm").click(async function (ele) {
                let broker = c.find(".operationName").val().trim();
                self.lastBroker = broker;
                let buy = c.find(".buy").val().trim();
                let bounce = c.find(".bounce").val().trim();
                let sell = c.find(".sell").val().trim();
                let dip = c.find(".dip").val().trim();
                let scode = self.normalizeScode(c.find(".scode").val().trim());
                let sname = c.find(".sname").val().trim();
                let sellAmount = c.find(".sellAmount").val().trim();
                let buyAmount = c.find(".buyAmount").val().trim();
                let expireHours = c.find(".expireHours").val().trim();
                let order = "";
                if (c.find(".buyFirst")[0].checked) {
                    order = "buyFirst";
                }

                if (c.find(".sellFirst")[0].checked) {
                    order = "sellFirst";
                }

                let submit = async function () {

                    let json = { buy, bounce, buyAmount, sell, dip, sellAmount, scode, sname, broker, order, expireHours };
                    let res = await share.getSync__(`/stock/rule/create?json=${encodeURIComponent(JSON.stringify(json))}`);
                    if (res.error) {
                        share.toastError__(res.error);
                    } else {
                        share.toastSuccess__("上传成功", 1000);
                    }
                }
                let brokerPopup;
                let buttons = [
                    {
                        text: "不变",
                        onTap: function () {
                            submit();
                            brokerPopup.close();
                            popup.close();
                        }
                    },
                    {
                        text: "国信",
                        onTap: function () {
                            broker = "国信";
                            submit();
                            brokerPopup.close();
                            popup.close();
                        }
                    },
                    {
                        text: "国金",
                        onTap: function () {
                            broker = "国金";
                            submit();
                            brokerPopup.close();
                            popup.close();
                        }
                    },
                    {
                        text: "自动",
                        onTap: async function () {
                            brokerPopup.close();
                            let type = 0;
                            let maxCount = 5;
                            let priceDelay = 10000000;
                            let res = await share.getSync__(`/stock/rule/create/auto?scode=${scode}&type=${type}&max=${maxCount}&priceDelay=${priceDelay}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                if (res.failed.length > 0) {
                                    share.toastError__(res.failed[0].reason);
                                } else {
                                    c.find(".rule").html("");
                                    c.find(".ruleStatus").html("");
                                    let r = await self.showRule(null, c.find(".rule"), scode, c.find(".ruleStatus"));
                                }
                            }
                        }
                    },
                    {
                        text: "关闭",
                        onTap: function () {
                            brokerPopup.close();
                            popup.close();
                        }
                    }
                ];

                share.currentTarget = ele.currentTarget;
                brokerPopup = await share.popupAction__("", buttons);
            })

            c.find(".buttonAuto").click(async function (ele) {
                let broker = c.find(".operationName").val().trim();
                self.lastBroker = broker;
                let scode = self.normalizeScode(c.find(".scode").val().trim());
                let type = 0;
                let maxCount = 5;
                let priceDelay = 10000000;
                let res = await share.getSync__(`/stock/rule/create/auto?scode=${scode}&type=${type}&max=${maxCount}&priceDelay=${priceDelay}`);
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    if (res.failed.length > 0) {
                        share.toastError__(res.failed[0].reason);
                    } else {
                        c.find(".rule").html("");
                        c.find(".ruleStatus").html("");
                        let r = await self.showRule(null, c.find(".rule"), scode, c.find(".ruleStatus"));
                    }
                }

            })

            self.autoPrice("buyAmount", c);
            self.autoPrice("sellAmount", c);
        },

        createFloatingWindow: function (url, width) {
            // 创建覆盖层
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.zIndex = '1000';

            // 创建浮动窗口容器
            const floatingWindow = document.createElement('div');
            floatingWindow.style.position = 'fixed';
            floatingWindow.style.top = '0';
            floatingWindow.style.left = '50%';
            floatingWindow.style.transform = 'translateX(-50%)';
            floatingWindow.style.width = `${width}px`;
            floatingWindow.style.height = '300px';
            floatingWindow.style.backgroundColor = 'white';
            floatingWindow.style.zIndex = '1001';
            floatingWindow.style.border = '1px solid #ccc';
            floatingWindow.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

            // 创建iframe
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';

            // 创建关闭按钮
            const closeButton = document.createElement('button');
            closeButton.textContent = '×';
            closeButton.style.position = 'absolute';
            closeButton.style.right = '10px';
            closeButton.style.top = '10px';
            closeButton.style.background = 'none';
            closeButton.style.border = 'none';
            closeButton.style.fontSize = '20px';
            closeButton.style.cursor = 'pointer';

            closeButton.onclick = function () {
                document.body.removeChild(overlay);
                document.body.removeChild(floatingWindow);
            };

            // 组装元素
            floatingWindow.appendChild(closeButton);
            floatingWindow.appendChild(iframe);
            document.body.appendChild(overlay);
            document.body.appendChild(floatingWindow);
        },
        openMiniBrowser: function (url, width, height) {
            // 计算窗口位置使其居中
            const left = (window.screen.width - width) / 2;
            const top = 0; // 顶部对齐

            // 打开新窗口
            const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
            window.open(url, 'miniBrowser', features);
        },


        stripScodeSuffix: function (stockCode) {
            const code = String(stockCode || "").trim();
            const index = code.lastIndexOf(".");
            if (index > 0) {
                return code.substring(0, index);
            }
            return code;
        },

        normalizeScode: function (stockCode) {
            let code = String(stockCode || "").trim().toUpperCase();
            if (!code) {
                throw new Error("股票代码不能为空");
            }

            if (/^[^.]+\.[A-Z]+$/.test(code)) {
                return code;
            }

            code = self.stripScodeSuffix(code);
            let market = self.getMarket(code);
            if (market == null || market == "" || market == "未知") {
                return code;
            }

            return `${code}.${market}`;
        },

        formatScode: function (stockCode) {
            let scode = self.normalizeScode(stockCode);
            let fields = scode.split(".");
            if (fields.length < 2) {
                return scode;
            }

            return `${fields[1]}${fields[0]}`;
        },
        getMarket: function (stockCode) {
            // 转换为字符串并去除空格
            const code = self.stripScodeSuffix(stockCode);

            // 检查代码是否有效
            if (!code) {
                return "";
            }

            let suffix = "未知";
            if (code.length == 6) {
                if (/^(600|601|603|605|688|900|51|58|56)\d+$/.test(code)) {
                    suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
                } else if (/^(000|001|002|003|30|15|16|12|3)\d+$/.test(code)) {
                    suffix = "SZ"; // 深交所（000/001/002/003/300 开头）
                } else if (/^(8|43|83|87|88|92)\d+$/.test(code)) {
                    suffix = "BJ"; // 北交所（8/43/83/87/88 开头）
                }
            } else if (/^\d{4,5}$/.test(code) || /^0[0-9]\d{3}$/.test(code)) {
                suffix = "HK"; // 港交所（4-5位数字，或 08 开头）
            } else if (code.indexOf("USDT") >= 0 || code.indexOf("BTC") >= 0 || code.indexOf("ETH") >= 0) {
                suffix = "EC";
            } else {
                share.debug__(`未知：${code}`);
            }

            // 返回格式化结果（如 600023.SH）
            return `${suffix}`;
        },

        showK: async function (code) {
            share.closePopup__();
            let fullCode = self.formatScode(code);
            let link = `https://xueqiu.com/S/${fullCode.split(".")[0].replace(/HK/g, "")}`;

            self.openMiniBrowser(link, 1150, 790);
            //self.createFloatingWindow(link, 800);
            //share.open__(link, `${code}`);

        },

        showStockDetail: async function (code) {
            share.closePopup__();
            let fullCode = self.formatScode(code);
            let link = `https://xueqiu.com/snowman/S/${fullCode}/detail`;

            self.openMiniBrowser(link, 840, 790);
            //self.createFloatingWindow(link, 800);
            //share.open__(link, `${code}`);

        },
        updatePrices: async function () {
            let res = await share.getSync__(`/stock/price/current`);
            let tdHeight = 0;
            let showRuleStatus = true;
            res.rows.forEach(row => {
                self.currentPrices[row.scode] = row;

                if (self.currentPrices[row.scode]) {
                    let tr = $(`[code="${row.scode}"]`);
                    tr.each(function () {
                        try {
                            let td = $(this);
                            if (tdHeight == 0) {
                                tdHeight = td.innerHeight();
                                // showRuleStatus = tdHeight > 300;
                            }
                            let cpc = td.find(".curPrice");
                            let data = td.attr("data");
                            let cp = cpc.find(".currentPrice");
                            data = JSON.parse(data);
                            let curPrice = share.convertIfInteger(row.buy);
                            let timePassed = share.getTimePassed__(row.updateTime);
                            if (data.type == 1) {
                                curPrice = share.convertIfInteger(row.optionPrice);
                                timePassed = share.getTimePassed__(row.optionUpdateTime);
                            }
                            data.curPrice = curPrice;
                            td.attr("data", JSON.stringify(data));
                            const price = data["价格"];
                            if (price == null) {
                                cp.html(`${curPrice} (${timePassed})`);
                                cp.addClass("red");
                            } else {
                                let delta = parseFloat(((curPrice - price) / price * 100).toFixed(1));
                                cp.html(`${curPrice} (${delta}% ${timePassed})`);
                                if (data["买卖"].indexOf("买") >= 0) {
                                    if (delta > 0) {
                                        cp.addClass("red");
                                    }

                                    if (delta < -2) {
                                        cp.addClass("green");
                                    }

                                    if (delta < -5) {
                                        cp.addClass("gold");
                                    }
                                }

                                if (delta < 0 && data["买卖"].indexOf("卖") >= 0) {
                                    cp.addClass("red");
                                }

                                let positions = ``;
                                if (data["volume"] != null && data["volume"] > 0) {
                                    positions = `${share.convertIfInteger(data["can_use_volume"])}/${share.convertIfInteger(data["volume"])}`;
                                }

                                cpc.find(".positions").html(`${positions}`);

                                let avgprice = `0@${data["券商"]}`;
                                if (data["volume"] != null && data["volume"] > 0) {
                                    avgprice = `${share.convertIfInteger(data["avg_price"], 2)}@${data["券商"]}`;
                                }

                                cpc.find(".avgprice").html(`${avgprice}`);

                                let error = cpc.find(".error");
                                if (data["autoCreateRuleFail"]) {
                                    error.html(`${share.convertIfInteger(data["autoCreateRuleFail"])}`);
                                    error.addClass("bg_05");
                                    if (data["autoCreateRuleFail"].indexOf("I:") >= 0) {
                                        error.addClass("gray");
                                    }
                                } else {
                                    error.removeClass("bg_05");
                                }

                                let rsc = cpc.find(".ruleStatus");
                                if (showRuleStatus && data["rule"]) {
                                    rsc.removeClass("hide");
                                    /*
                                    let rc = JSON.parse(data["rule"]);
                                    let closed = data["closed"];
                                    self.showRule({ rule: rc, closed }, rsc);
                                    if (rc.order == "") {
                                        rsc.find("table").css({
                                            border: "1px solid gray",
                                            "border-collapse": "collapse"
                                        });
                                        rsc.find("table td, table th").css({
                                            border: "none"
                                        });
                                    }
                                        */

                                } else {
                                    rsc.addClass("hide");
                                }

                            }
                        } catch (e) {
                            console.log(e);
                        }

                    })
                }
            });
        },
        onBuySellClicked: async function (ele) {
            let data = $(ele).parent("tr").attr("data");
            data = JSON.parse(data);
            self.selectedData = data;
            share.currentTarget = ele;
            let scode = data["代码"];
            let type = data["type"];
            if (type == null) {
                type = 0;
            }
            let tbs = $("#templateBuySell").html();
            let html = `
                    <div class="flexrow buySellPopupContent">
                       <div class="tradeList">
                       </div>
                       <div class="flexcolumn border padding4 margin4">
                            <div class="position flexrow center margin4">
                            </div>
                            ${tbs}
                            <div class="rule flexrow center margin4">
                            </div>
                            <div class="ruleStatus flexrow center margin4">
                            </div>
                       </div>
                       <div class="flexcolumn kPeriodPanel popupPeriodPanel">
                            <div class="kTick border margin4" style="width:480px; height:140px;">loading 1m</div>
                            <div class="flexrow font10 margin4">
                                <span class="kPeriodTab clickable active" data-period="1d">1d</span>
                                <span class="kPeriodTab clickable gray marginlr4" data-period="1w">1w</span>
                                <span class="kPeriodTab clickable gray" data-period="1mon">1M</span>
                            </div>
                            <div class="flexrow margin4">
                                <div class="day0Status flexrow width100p margin4 hide">
                                    <div class="dayPeriod marginlr4">1d</div>
                                    <div class="day0"></div>
                                    <div style="width:10px;"></div> 
                                    <div class="downStopPrice"></div>
                                    <div class="priceLow"></div>
                                    <div class="progressContainer separator flexcolumn widthauto height20">
                                        <div class="progressBar center"></div>
                                    </div>               
                                    <div class="priceHigh"></div>
                                    <div class="upStopPrice"></div>
                                </div>
                            </div>
                            <div class="k1d border margin4" style="width:480px;height:350px;">loading 1d</div>
                       </div>
                    </div>
                            `;
            let popup = await share.popup__(null, html, "bottom");

            let c = $(`#${popup.id}`);
            c.find(".kPeriodTab").click(function (e) {
                e.stopPropagation();
                let tab = $(this);
                let period = tab.attr("data-period");
                self.setActiveKPeriod(c, period);
                let popupScode = c.find(".scode").val().trim();
                if (popupScode == "") {
                    popupScode = scode;
                }
                self.toDrawK1dChart(self.normalizeScode(popupScode), type, c, period);
            });
            self.showPosition(null, c.find(".position"), scode);
            await self.showTradeList(c, scode, 0, type);
            self.showBuySell(null, popup);
            let r = await self.showRule(null, c.find(".rule"), scode, c.find(".ruleStatus"));

            c.find(".rule").click(function (e) {
                let rc = r.rule;
                let buy = share.convertIfInteger(rc.buy);
                let sell = share.convertIfInteger(rc.sell);
                c.find(".sell").val(sell);
                c.find(".buy").val(buy);
                c.find(".buyAmount").val(rc.buyAmount);
                c.find(".sellAmount").val(rc.sellAmount);
                c.find(".dip").val(share.convertIfInteger(rc.dip));
                c.find(".bounce").val(share.convertIfInteger(rc.bounce));
                if (rc.order == "sellFirst") {
                    c.find(".sellFirst").prop("checked", true);
                    c.find(".buyFirst").prop("checked", false);
                } else if (rc.order == "buyFirst") {
                    c.find(".sellFirst").prop("checked", false);
                    c.find(".buyFirst").prop("checked", true);
                } else {
                    c.find(".sellFirst").prop("checked", false);
                    c.find(".buyFirst").prop("checked", false);
                }
            })

            c.find(".buttonCancelRule").click(async function (e) {
                let res = await share.getSync__("/stock/rule/cancel", { scode: self.selectedData["代码"], broker: self.selectedData["券商"] });
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    share.toastSuccess__("canceled", 1000);
                    c.find(".rule").html("");
                    c.find(".ruleStatus").html("");
                    let r = await self.showRule(null, c.find(".rule"), scode, c.find(".ruleStatus"));
                }
            })



            let kTick = c.find(".kTick");
            share.getSync__(`/stock/k/1m?scode=${scode}&type=${type}&day=${Date.now()}`)
                .then((ticks) => {
                    var timeData = [];
                    var priceData = [];
                    var volumeData = [];
                    ticks.forEach(function (tick) {
                        let dateStr = (tick.time);
                        const year = dateStr.substring(0, 4);
                        const month = dateStr.substring(4, 6);
                        const day = dateStr.substring(6, 8);
                        const hours = dateStr.substring(8, 10);
                        const minutes = dateStr.substring(10, 12);
                        const seconds = dateStr.substring(12, 14);

                        timeData.push(`${hours}:${minutes}`);
                        priceData.push(tick.close);
                        volumeData.push(tick.volume);
                    });

                    self.drawK1mChart(scode, timeData, priceData, volumeData, kTick);
                }).catch(function (err) {
                    kTick.text(err);
                });

            self.toDrawK1dChart(scode, type, c);
        },
        getKEndpoint: function (period) {
            if (period == "1w") {
                return "/stock/k/1w";
            }
            if (period == "1mon") {
                return "/stock/k/1mon";
            }
            return "/stock/k/1d";
        },
        getKPeriodLabel: function (period) {
            if (period == "1w") {
                return "1w";
            }
            if (period == "1mon") {
                return "1m";
            }
            return "1d";
        },
        setActiveKPeriod: function (c, period) {
            c.find(".kPeriodTab").each(function () {
                let tab = $(this);
                let active = tab.attr("data-period") == period;
                tab.toggleClass("gray", !active);
                tab.toggleClass("active", active);
            });
        },
        getActiveKPeriod: function (c) {
            let active = c.find(".kPeriodTab.active").first();
            if (active.length > 0) {
                return active.attr("data-period");
            }
            let first = c.find(".kPeriodTab").first();
            if (first.length > 0) {
                return first.attr("data-period");
            }
            return "1d";
        },
        splitData: function (rawData) {
            let categoryData = [];
            let values = [];
            let volumes = [];
            for (let i = 0; i < rawData.length; i++) {
                categoryData.push(rawData[i].splice(0, 1)[0]);
                values.push(rawData[i]);
                volumes.push([i, rawData[i][4], rawData[i][0] > rawData[i][1] ? 1 : -1]);
            }
            return {
                categoryData: categoryData,
                values: values,
                volumes: volumes
            };
        },
        calculateMA: function (dayCount, data) {
            var result = [];
            for (var i = 0, len = data.values.length; i < len; i++) {
                if (i < dayCount) {
                    result.push('-');
                    continue;
                }
                var sum = 0;
                for (var j = 0; j < dayCount; j++) {
                    let d = data.values[i - j];
                    if (d == null) {
                        result.push('-');
                        continue;
                    }
                    sum += d[1];
                }
                result.push(+(sum / dayCount).toFixed(3));
            }
            return result;
        },
        calculateMAn: function (dayCount, data) {
            var result = [];
            for (var i = 0, len = data.values.length; i < len; i++) {
                if (i < dayCount) {
                    result.push('-');
                    continue;
                }
                var sum = 0;
                for (var j = 0; j < dayCount; j++) {
                    let d = data.values[i - j];
                    if (d == null) {
                        result.push('-');
                        continue;
                    }
                    let avg = d[5] / d[4];
                    while (avg / d[3] > 2) {
                        avg = avg / 10;
                    }

                    sum += avg;
                }
                result.push(+(sum / dayCount).toFixed(3));
            }
            return result;
        },
        calculateTickMA: function (data) {
            var result = [];
            var sum = 0;
            var volume = 0;
            for (var i = 0, len = data.values.length; i < len; i++) {
                if (data.values[i] == null && data.volumes[i] == null) {
                    break;
                }
                sum += data.values[i] * data.volumes[i];
                volume += data.volumes[i];
                result.push(+(sum / volume).toFixed(3));
            }
            return result;
        },

        onTdClicked: function (ele) {
            let data = $(ele).parents("tr").attr("data");
            data = JSON.parse(data);
            self.selectedData = data;
            share.currentTarget = ele;
        },
        toUpdateRuleStatus: async function () {
            let html = `

                <div class="input-group">
                </div>

                <div class="flexrow width100p">

                        <div class="form-floating widthauto margin4">
                            <input
                                type="text"
                                min="5"
                                class="form-control currentPrice h20"
                                name="currentPrice"
                                value=""
                                placeholder=" "
                            >
                            <label class="floating-label">当前价格</label>
                        </div>


                    <button type="button" class="btn btn-primary widthAuto margin4 buttonConfirm">
                        更新价格
                    </button>
                </div>

                <div class="flexrow width100p">
                    <div class="form-floating widthauto margin4" style="width:120px;">
                        <input
                            type="text"
                            min="5"
                            class="form-control actionStatus h20"
                            name="actionStatus"
                            value="56"
                            placeholder=" "
                        >
                        <label class="floating-label">委托状态</label>
                    </div>
                    <button type="button" class="btn btn-primary widthAuto margin4 buttonOrdered">
                         已下单
                    </button>
                </div>
            `;
            let popup = await share.popup__(null, html);
            let c = $(`#${popup.id}`);
            c.find(".buttonConfirm").on("click", async function () {
                let data = self.selectedData;
                let price = c.find(".currentPrice").val().trim();
                let res = await share.getSync__(`/stock/updatePrice?price=${price}&scode=${self.normalizeScode(data["代码"])}`);
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    share.toastSuccess__("已更新", 1000);
                }
            });
            c.find(".buttonOrdered").on("click", async function () {
                let data = self.selectedData;
                let status = c.find(".actionStatus").val().trim();
                let rule = JSON.parse(data["规则"]);
                let body = {
                    "broker": rule.broker,
                    "scode": self.normalizeScode(data["代码"]),
                    "status": status,
                    "orderNo": "" + Date.now() + ""
                };
                let res = await share.postSync__(`/stock/rule/action/ordered`, body);
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    share.toastSuccess__("已下单成功", 1000);
                }
            });
        },

        drawK1mChart: function (scode, categoryData, values, volumes, $c) {
            if ($c == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1d");
                $c = td.find(".kTick");
            }

            $c.css({
                width: "480px",
                height: "140px"
            });

            $c.removeAttr("_echarts_instance_");
            // $c.html("loading kTick");

            var chartDom = $c[0];
            var chart = echarts.init(chartDom);
            let finalTime = 15 * 60;
            if (self.formatScode(scode).indexOf("HK") >= 0) {
                finalTime = 16 * 60 + 10;
            }

            let lastTime = 9 * 60 + 9;
            if (categoryData.length > 0) {
                lastTime = categoryData[categoryData.length - 1].split(":");
                lastTime = parseInt(lastTime[0]) * 60 + parseInt(lastTime[1]);
            }

            if (self.formatScode(scode).indexOf("EC") >= 0) {
                finalTime = lastTime + 30;
            }

            for (let i = lastTime + 1; i <= finalTime; i++) {
                //将i转换成 01:01 这种"时:分"格式，不足两位的前面补0
                let h = Math.floor(i / 60);
                let m = i % 60;
                if (h < 10) {
                    h = "0" + h;
                }

                if (m < 10) {
                    m = "0" + m;
                }

                categoryData.push(h + ":" + m);
                values.push(null);
                volumes.push(null);
            }


            // 配置项
            var option = {
                title: {
                    show: false,
                },
                legend: {
                    show: false,
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    }
                },
                grid: [
                    {
                        top: '6px',
                        left: '35px',
                        right: '10px',
                        height: '84px',
                    },
                    {
                        left: '35px',
                        right: '10px',
                        bottom: '0px',
                        height: '50px'
                    }
                ],
                xAxis: [
                    {
                        type: 'category',
                        data: categoryData,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { onZero: false },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        splitNumber: 20,
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: categoryData,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { onZero: false },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        splitNumber: 20,
                        min: 'dataMin',
                        max: 'dataMax'
                    }
                ],
                yAxis: [
                    {
                        scale: true,
                        splitArea: {
                            show: true
                        }
                    },
                    {
                        scale: true,
                        gridIndex: 1,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1],
                        start: 0,
                        end: 100
                    }
                ],
                series: [
                    {
                        name: '价格',
                        type: 'line',
                        data: values,
                        smooth: true,
                        lineStyle: {
                            width: 1
                        },
                        symbol: 'none',
                        areaStyle: {
                            opacity: 0.8,
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                {
                                    offset: 0,
                                    color: 'rgba(58,77,233,0.8)'
                                },
                                {
                                    offset: 1,
                                    color: 'rgba(58,77,233,0.1)'
                                }
                            ])
                        }
                    },
                    {
                        name: 'MA',
                        type: 'line',
                        data: self.calculateTickMA({ categoryData, values, volumes }),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            color: "red",
                            opacity: 0.5
                        }
                    },
                    {
                        name: '成交量',
                        type: 'bar',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumes,
                        itemStyle: {
                            color: function (params) {
                                var colorList = values.map((price, index) => {
                                    return index === 0 ? '#aaa' :
                                        price > values[index - 1] ? '#f00' : '#0f0';
                                });
                                return colorList[params.dataIndex];
                            },
                            width: 2
                        }
                    }
                ]
            };

            // 使用配置项显示图表
            chart.setOption(option);

            // 响应式调整
            window.addEventListener('resize', function () {
                chart.resize();
            });
        },

        drawK1mChartSmall: function (scode, categoryData, values, volumes, $c) {
            if ($c == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1m");
                td.find(".k1mCollapse").addClass("hide");
                $c = td.find(".k1m");
            }

            $c.css({
                width: "160px",
                height: "90px"
            });

            $c.removeAttr("_echarts_instance_");
            // $c.html("loading kTick");

            var chartDom = $c[0];
            var chart = echarts.init(chartDom);
            let finalTime = 15 * 60;
            if (self.formatScode(scode).indexOf("HK") >= 0) {
                finalTime = 16 * 60 + 10;
            }

            let lastTime = 9 * 60 + 9;
            if (categoryData.length > 0) {
                lastTime = categoryData[categoryData.length - 1].split(":");
                lastTime = parseInt(lastTime[0]) * 60 + parseInt(lastTime[1]);
            }

            if (self.formatScode(scode).indexOf("EC") >= 0) {
                finalTime = lastTime + 30;
            }

            for (let i = lastTime + 1; i <= finalTime; i++) {
                //将i转换成 01:01 这种"时:分"格式，不足两位的前面补0
                let h = Math.floor(i / 60);
                let m = i % 60;
                if (h < 10) {
                    h = "0" + h;
                }

                if (m < 10) {
                    m = "0" + m;
                }

                categoryData.push(h + ":" + m);
                values.push(null);
                volumes.push(null);
            }


            // 配置项
            var option = {
                title: {
                    show: false,
                },
                legend: {
                    show: false,
                },
                toolbox: {
                    feature: {
                        myCustomTool: {
                            show: true,
                            title: '关闭',
                            icon: 'path://M15 15 L25 25 M25 15 L15 25',
                            onclick: function (e, i, name, event) {
                                self.toCloseK1m(scode);
                                event.event.stopPropagation();
                            }
                        }
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    },
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 2,
                    textStyle: {
                        color: '#000',
                        fontSize: 8
                    },
                    formatter: function (params) {
                        var result = params[0].axisValue + '<br/>';
                        params.forEach(function (item) {
                            result += item.seriesName + ': ' + item.value + '<br/>';
                        });
                        return result;
                    },
                    position: function (pos, params, el, elRect, size) {
                        const obj = {
                            top: 0
                        };
                        obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                        return obj;
                    }
                },
                grid: [
                    {
                        bottom: '0px',
                        left: '1px',
                        right: '1px',
                        height: '84px',
                    },
                    {
                        left: '1px',
                        right: '1px',
                        bottom: '0px',
                        height: '50px'
                    }
                ],
                xAxis: [
                    {
                        type: 'category',
                        data: categoryData,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { onZero: false },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        splitNumber: 20,
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: categoryData,
                        scale: true,
                        boundaryGap: false,
                        axisLine: { onZero: false },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        splitNumber: 20,
                        min: 'dataMin',
                        max: 'dataMax'
                    }
                ],
                yAxis: [
                    {
                        scale: true,
                        splitArea: {
                            show: true
                        },
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    },
                    {
                        scale: true,
                        gridIndex: 1,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1],
                        start: 0,
                        end: 100
                    }
                ],
                series: [
                    {
                        name: '价格',
                        type: 'line',
                        data: values,
                        smooth: true,
                        lineStyle: {
                            width: 1
                        },
                        symbol: 'none',
                        areaStyle: {
                            opacity: 0.8,
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                {
                                    offset: 0,
                                    color: 'rgba(58,77,233,0.8)'
                                },
                                {
                                    offset: 1,
                                    color: 'rgba(58,77,233,0.1)'
                                }
                            ])
                        }
                    },
                    {
                        name: 'MA',
                        type: 'line',
                        data: self.calculateTickMA({ categoryData, values, volumes }),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            color: "red",
                            opacity: 0.5
                        }
                    },
                    {
                        name: '成交量',
                        type: 'bar',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumes,
                        itemStyle: {
                            color: function (params) {
                                var colorList = values.map((price, index) => {
                                    return index === 0 ? '#aaa' :
                                        price > values[index - 1] ? '#f00' : '#0f0';
                                });
                                return colorList[params.dataIndex];
                            },
                            width: 2
                        }
                    }
                ]
            };

            // 使用配置项显示图表
            chart.setOption(option);

            // 响应式调整
            window.addEventListener('resize', function () {
                chart.resize();
            });
        },
        showPosition: async function (positions, $c, scode) {
            if (positions == null) {
                let res = await share.getSync__(`/stock/positions?scode=${scode}`);
                positions = res.data;
            }
            let tr = positions.map(row => {
                let html = `
                    <tr> 
                        <td>${row.broker}</td> 
                        <td>${row.can_use_volume}/${row.volume}</td>
                        <td>${share.convertIfInteger(row.avg_price)}</td>
                        <td>${share.convertIfInteger(row.market_value)}</td>
                    </tr>
                 `;
                return html;
            });

            let html = `
                                   <table class="width100p">
                                       ${tr.join("")}
                                   </table>
                               `;


            $c.html(html);
        },
        getBuySellText: function (buySell) {
            if (buySell == null || buySell == "") {
                return "";
            } else if (buySell.indexOf("买") >= 0) {
                return "买入";
            } else if (buySell.indexOf("卖") >= 0) {
                return "卖出";
            }
        },
        showTradeList: async function (c, scode, all, type) {
            if (all == null) {
                all = 0;
            }

            if (type == null) {
                type = 0;
            }

            let res = await share.getSync__(`/stock/trades?scode=${scode}&all=${all}&type=${type}`);
            let trades = res.data;
            let cprice = 0;
            if (self.currentPrices[scode]) {
                cprice = self.currentPrices[scode].buy;
            }
            let cash = 0;
            let positions = 0;
            let tr = trades.map(row => {
                let html = `
                    <tr class="tradeHistoryTr clickable" data='${JSON.stringify(row)}'> 
                        <td>${row.tday}</td> 
                        <td>${row.ttime}</td>
                        <td>${self.getBuySellText(row.operationDirection)}</td>
                        <td>${row.tprice}</td>
                        <td>${row.tamount}</td>
                        <td>${row.operationName}</td>
                    </tr>
                 `;
                cash -= row.tprice * row.tamount;
                positions += row.tamount;
                if (row.deleted) {
                    html = `
                    <tr class="tradeHistoryTr clickable" data='${JSON.stringify(row)}'> 
                        <td class="gray">${row.tday}</td> 
                        <td class="gray">${row.ttime}</td>
                        <td class="gray">${self.getBuySellText(row.operationDirection)}</td>
                        <td class="gray">${row.tprice}</td>
                        <td class="gray">${row.tamount}</td>
                        <td class="gray">${row.operationName}</td>
                    </tr>
                 `;
                }

                return html;
            });

            let html = `<div>盈亏: ${cash + positions * cprice}</div>
                        <table class="table">
                            <thead>
                                <tr class="tradeListHeader clickable">
                                    <th class="nowrap">日期</th>
                                    <th class="nowrap">时间</th>
                                    <th class="nowrap">买卖</th>
                                    <th class="nowrap">价格</th>
                                    <th class="nowrap">数量</th>
                                    <th class="nowrap">券商</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tr.join("")}
                            </tbody>
                        </table>
                               `;
            c.find(".tradeList").html(html);

            c.find(".tradeList").find(".tradeListHeader").on("click", function () {
                if (all == 0) {
                    self.showTradeList(c, scode, 1, type);
                } else {
                    self.showTradeList(c, scode, 0, type);
                }
            });

            $(".tradeHistoryTr", c).click(async function () {
                share.currentTarget = this;
                let tr = $(this);
                let dataStr = $(this).attr("data");
                let data = JSON.parse(dataStr);
                let popup;
                let buttons = [
                    {
                        text: "-2%买入",
                        onTap: function () {
                            popup.close();
                            let buy = data.tprice * (1 - 0.02);
                            c.find(".buy").val(buy);
                            // c.find(".sell").val(data.tprice);
                            self.autoPrice("buy", c);
                        }
                    },
                    {
                        text: "+2%卖出",
                        onTap: function () {
                            popup.close();
                            let sell = data.tprice * (1 + 0.02);
                            c.find(".sell").val(sell);
                            // c.find(".buy").val(data.tprice);
                            self.autoPrice("sell", c);
                        }
                    },
                    {
                        text: "隐藏本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.find("td").addClass("gray");
                            }
                        }
                    },
                    {
                        text: "取消隐藏",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/undeleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.find("td").removeClass("gray");
                            }
                        }
                    },
                    {
                        text: "清除本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}&force=1`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.remove();
                            }
                        }
                    },
                    {
                        text: "增量配对隐藏",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/delete/auto?scode=${scode}&delta=1`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                self.showTradeList(c, scode, 1, type);
                            }
                        }
                    },
                    {
                        text: "全量配对隐藏",
                        onTap: async function () {
                            popup.close();
                            let res = await share.getSync__(`/stock/delete/auto?scode=${scode}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                self.showTradeList(c, scode, 1, type);
                            }
                        }
                    }
                ];

                popup = await share.popupAction__("", buttons);


            });

        },
        showRule: async function (r, c, scode, statusContainer) {
            if (r == null) {
                let res = await share.getSync__(`/stock/rule/status?scode=${scode}`);
                r = res.data;
                if (r == null) {
                    return;
                }
            }

            let rc = r.rule;
            //如果rc是string，则转换为对象
            if (typeof rc == 'string') {
                rc = JSON.parse(rc);
                r.rule = rc;
            }

            self.showRuleStatus(r, c);

            return r;
        },

        toCloseK1d: async function (scode) {
            let tr = $(`.firstCode[code="${scode}"]`);
            let td = tr.find(".tdK1d");
            k1d = td.find(".k1d");
            k1d.html("");
            k1d.addClass("hide");
            td.find(".k1dCollapse").removeClass("hide");
        },

        toCloseK1m: async function (scode) {
            let tr = $(`.firstCode[code="${scode}"]`);
            let td = tr.find(".tdK1m");
            k1d = td.find(".k1m");
            k1d.html("");
            k1d.addClass("hide");
            td.find(".k1mCollapse").removeClass("hide");
        },

        calculateKDJ: function (data, N = 9, M1 = 3, M2 = 3) {
            const kdj = { K: [], D: [], J: [] };

            for (let i = 0; i < data.length; i++) {
                // 获取最近N个交易日的数据
                const startIdx = Math.max(0, i - N + 1);
                const periodData = data.slice(startIdx, i + 1);

                // 计算周期内最高价和最低价
                const highest = Math.max(...periodData.map(d => d[2]));
                const lowest = Math.min(...periodData.map(d => d[3]));

                // 计算RSV
                const rsv = ((data[i][1] - lowest) / (highest - lowest)) * 100;

                // 计算K值（RSV的M1日指数移动平均）
                let kValue;
                if (i === 0 || highest == lowest) {
                    kValue = 50; // 初始值
                } else {
                    kValue = (2 / 3) * kdj.K[i - 1] + (1 / 3) * rsv;
                }

                // 计算D值（K值的M2日指数移动平均）
                let dValue;
                if (i === 0) {
                    dValue = 50; // 初始值
                } else {
                    dValue = (2 / 3) * kdj.D[i - 1] + (1 / 3) * kValue;
                }

                // 计算J值
                const jValue = 3 * kValue - 2 * dValue;

                kdj.K.push(parseFloat(kValue.toFixed(2)));
                kdj.D.push(parseFloat(dValue.toFixed(2)));
                kdj.J.push(parseFloat(jValue.toFixed(2)));
            }

            return kdj;
        },
        calculateBOLL: function (data, period = 20, k = 2) {
            const bollData = {
                mid: [], // 中轨
                upper: [], // 上轨
                lower: []  // 下轨
            };

            for (let i = 0; i < data.length; i++) {
                if (i < period - 1) {
                    // 前period-1个数据点无法计算BOLL
                    bollData.mid.push('-');
                    bollData.upper.push('-');
                    bollData.lower.push('-');
                    continue;
                }

                // 计算中轨（移动平均）
                let sum = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    sum += data[j][1]; // 收盘价
                }
                const ma = sum / period;
                bollData.mid.push(ma);

                // 计算标准差
                let varianceSum = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    varianceSum += Math.pow(data[j][1] - ma, 2);
                }
                const std = Math.sqrt(varianceSum / period);

                // 计算上轨和下轨
                bollData.upper.push(ma + k * std);
                bollData.lower.push(ma - k * std);
            }

            return bollData;
        },
        drawK1dChart: function (scode, type, categoryData, values, volumes, c, periodLabel) {
            if (periodLabel == null) {
                periodLabel = "1d";
            }
            let k1d = c.find(".k1d");
            if (k1d == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1d");
                k1d = td.find(".k1d");
            }
            const upColor = '#00da3c';
            const downColor = '#ec0000';
            k1d.css({
                width: "480px",
                height: "380px"
            });
            k1d.removeAttr("_echarts_instance_");
            // k1d.html("loading k1d");
            var chartDom = k1d[0];
            var chart = echarts.init(chartDom);
            let data = { categoryData, values, volumes };

            const bollData = self.calculateBOLL(values);
            const kdjData = self.calculateKDJ(values);
            // 配置项
            var option = {
                animation: false,
                legend: {
                    bottom: 2,
                    left: 'center',
                    data: [periodLabel, 'kdJ', 'MA5', 'MA10', 'MA20', 'MA60', 'Boll', 'cci', 'Volume'],
                    selected: {
                        "MA20": true,
                        "MA60": true,
                        'Kdj': true,
                        'kDj': true,
                        'kdJ': true,
                        'Boll': true,
                        'Boll中': true,
                        'Boll下': true
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        label: {
                            show: false
                        },
                    },
                    formatter: function (params) {
                        var result = [params[0].axisValue];
                        params.forEach(function (item) {
                            if (item.seriesName === periodLabel) {
                                result.push('开盘: ' + parseFloat(item.value[1]).toFixed(3));
                                result.push('收盘: ' + parseFloat(item.value[2]).toFixed(3));
                                result.push('最高: ' + parseFloat(item.value[3]).toFixed(3));
                                result.push('最低: ' + parseFloat(item.value[4]).toFixed(3));
                                result.push('振幅: ' + parseFloat(item.value[3] - item.value[4]).toFixed(3));
                                result.push('均幅: ' + parseFloat(item.value[8]).toFixed(3));
                                result.push('成交额: ' + parseFloat(item.value[6]));
                            } else {
                                result.push(item.seriesName + ': ' + item.value);
                            }
                        });
                        return `<div class="flexcolumn font10"><div class="height10">${result.join('</div><div class="height10">')}</div></div>`;
                    },
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 10,
                    textStyle: {
                        color: '#000'
                    },
                    position: function (pos, params, el, elRect, size) {
                        const obj = {
                            top: 10
                        };
                        obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                        return obj;
                    }
                    // extraCssText: 'width: 170px'
                },
                axisPointer: {
                    link: [
                        {
                            xAxisIndex: 'all'
                        }
                    ],
                    label: {
                        backgroundColor: '#777'
                    }
                },
                toolbox: {
                    feature: {
                        myCustomTool: {
                            show: true,
                            title: '重载',
                            icon: 'path://M23 4v6h-6, M1 20v-6h6, M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
                            onclick: function (e, i, name, event) {
                                share.currentTarget = event.event.currentTarget;
                                self.showK1dReloadMenu(
                                    async function () {
                                        self.toDrawK1dChart(scode, type, c);
                                    },
                                    async function () {
                                        let succeeded = await self.forceReloadK1d(scode);
                                        if (succeeded) {
                                            self.toDrawK1dChart(scode, type, c);
                                        }
                                    }
                                );
                                event.event.stopPropagation();
                            }
                        },
                        dataZoom: {
                            yAxisIndex: false
                        },
                        brush: {
                            type: ['lineX', 'clear']
                        }
                    }
                },
                brush: {
                    xAxisIndex: 'all',
                    brushLink: 'all',
                    outOfBrush: {
                        colorAlpha: 0.1
                    }
                },
                visualMap: {
                    show: false,
                    seriesIndex: 8,
                    dimension: 2,
                    pieces: [
                        {
                            value: 1,
                            color: downColor
                        },
                        {
                            value: -1,
                            color: upColor
                        }
                    ]
                },
                grid: [
                    {
                        left: '30px',
                        right: '4px',
                        height: '160px',
                        top: '10px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '180px',
                        height: '20px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '200px',
                        height: '40px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '240px',
                        height: '60px'
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1, 2, 3],
                        start: 85,
                        end: 100
                    },
                    {
                        show: true,
                        xAxisIndex: [0, 1, 2, 3],
                        type: 'slider',
                        top: '290px',
                        start: 85,
                        end: 100
                    }
                ],
                xAxis: [
                    {
                        type: 'category',
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax',
                        axisPointer: {
                            z: 100
                        }
                    },
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 2,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 3,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    }
                ],
                yAxis: [
                    {
                        scale: true,
                        splitArea: {
                            show: true
                        }
                    },
                    {
                        scale: true,
                        gridIndex: 1,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    },
                    {
                        scale: true,
                        gridIndex: 2,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        splitLine: { show: false }
                    },
                    {
                        scale: true,
                        gridIndex: 3,
                        axisLabel: { show: false },
                        splitLine: { show: false }
                    }
                ],
                graphic: [
                    {
                        type: 'text',
                        left: 'right',
                        top: 20,
                        z: 100,
                        style: {
                            text: '',
                            fill: '#333',
                            fontSize: 12
                        },
                        onclick: function () {
                            // 按钮点击事件
                            alert('按钮被点击了');
                        }
                    }
                ],
                series: [
                    {
                        name: periodLabel,
                        type: 'candlestick',
                        data: values,
                        itemStyle: {
                            color0: upColor,
                            color: downColor,
                            borderColor: undefined,
                            borderColor0: undefined
                        }
                    },
                    {
                        name: 'MA5',
                        type: 'line',
                        data: self.calculateMA(5, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA10',
                        type: 'line',
                        data: self.calculateMA(10, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA20',
                        type: 'line',
                        data: self.calculateMA(20, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA60',
                        type: 'line',
                        show: false,
                        data: self.calculateMA(60, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'Boll中',
                        type: 'line',
                        data: bollData.mid,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#333333'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Boll',
                        type: 'line',
                        data: bollData.upper,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#ff7f50'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Boll下',
                        type: 'line',
                        data: bollData.lower,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#87cefa'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Volume',
                        type: 'bar',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumes,
                        itemStyle: {
                            color: function (params) {
                                var kData = option.series[0].data;
                                if (kData.length > params.dataIndex) {
                                    return kData[params.dataIndex][1] >= kData[params.dataIndex][0]
                                        ? '#ef232a' : '#14b143';
                                }

                                return '#ef232a';
                            }
                        }
                    },
                    {
                        name: 'cci',
                        type: 'line',
                        data: values.map((item) => item[6]),
                        smooth: false,
                        symbol: 'none',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'cci+100',
                        type: 'line',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        markLine: {
                            data: [
                                {
                                    yAxis: 100,
                                    lineStyle: {
                                        color: '#0cc039ff',
                                        width: 1,
                                        type: 'solid'
                                    },
                                    label: {
                                        show: true,
                                        position: 'end',
                                        formatter: '100',
                                        color: '#0cc039ff'
                                    }
                                }
                            ],
                            symbol: 'none'
                        }
                    },
                    {
                        name: 'cci-100',
                        type: 'line',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        markLine: {
                            data: [
                                {
                                    yAxis: -100,
                                    lineStyle: {
                                        color: '#e74c3c',
                                        width: 1,
                                        type: 'solid'
                                    },
                                    label: {
                                        show: true,
                                        position: 'end',
                                        formatter: '100',
                                        color: '#e74c3c'
                                    }
                                }
                            ],
                            symbol: 'none'
                        }
                    },
                    {
                        name: 'Kdj',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.K,
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kDj',
                        type: 'line',
                        show: false,
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.D,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kdJ',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.J,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kdJ+20',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        markLine: {
                            symbol: 'none',
                            lineStyle: {
                                type: 'dashed',
                                width: 1
                            },
                            data: [
                                {
                                    yAxis: 20
                                }
                            ]
                        }
                    },
                    {
                        name: 'kdJ+80',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        markLine: {
                            symbol: 'none',
                            lineStyle: {
                                type: 'dashed',
                                width: 1
                            },
                            data: [
                                {
                                    yAxis: 80
                                }
                            ]
                        }
                    }
                ]
            };

            // 使用配置项显示图表
            chart.setOption(option);

            function toggleLine(lineName, show) {
                const option = chart.getOption();
                const series = option.series;

                for (let i = 0; i < series.length; i++) {
                    if (series[i].name === lineName) {
                        // 切换显示状态
                        series[i].show = show;
                        break;
                    }
                }

                chart.setOption({ series }, { replaceMerge: 'series' });
            }

            chart.on('legendselectchanged', function (params) {
                const selected = params.selected;

                const kdjSel = selected['kdJ'];
                const bollSel = selected['Boll'];
                //toggleLine('Kdj', isSelected);

                option.legend.selected = {
                    ...option.legend.selected,
                    'Kdj': kdjSel,
                    'kDj': kdjSel,
                    'kdJ': kdjSel,
                    'kdJ+20': kdjSel,
                    'kdJ+80': kdjSel,
                    'Boll': bollSel,
                    'Boll中': bollSel,
                    'Boll下': bollSel
                };

                chart.setOption(option);

                // toggleLine('kDj', isSelected);
                // toggleLine('kdJ', isSelected);
                // toggleLine('kdJ+20', isSelected);
                // toggleLine('kdJ+80', isSelected);
            });


            // 响应式调整
            window.addEventListener('resize', function () {
                chart.resize();
            });
        },
        drawK1dChartSmall: function (scode, categoryData, values, volumes, c, periodLabel) {
            if (periodLabel == null) {
                periodLabel = "1d";
            }
            c.find(".k1dCollapse").addClass("hide");
            let k1d = c.find(".k1d");
            if (k1d == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1d");
                k1d = td.find(".k1d");
            }
            const upColor = '#00da3c';
            const downColor = '#ec0000';
            k1d.css({
                width: "400px",
                height: "300px"
            });
            k1d.removeAttr("_echarts_instance_");
            // k1d.html("loading k1d");
            var chartDom = k1d[0];
            var chart = echarts.init(chartDom);

            let lastDay = categoryData[categoryData.length - 1];
            let lastDayColor = "gray";
            let todayStr = share.timeFormat__(new Date(), "yyyyMMdd");
            if (todayStr != lastDay) {
                lastDayColor = "red";
            }
            let data = { categoryData, values, volumes };
            const kdjData = self.calculateKDJ(values);
            const bollData = self.calculateBOLL(values);
            // 配置项
            var option = {
                animation: false,
                legend: {
                    show: false,
                    bottom: 2,
                    left: 'center',
                    data: [periodLabel, 'kdJ', 'MA5', 'MA10', 'MA20', 'MA60', 'Boll', 'cci', 'Volume'],
                    selected: {
                        "MA20": true,
                        "MA60": true,
                        'Kdj': true,
                        'kDj': true,
                        'kdJ': true,
                        'Boll': true,
                        'Boll中': true,
                        'Boll下': true
                    }
                },
                graphic: {
                    type: 'text',
                    right: 20,
                    top: 1,
                    style: {
                        text: `${lastDay}`,
                        font: '10px Microsoft YaHei',
                        fill: lastDayColor,
                        width: 10,
                        height: 10
                    },
                    onclick: function () {
                        // 按钮点击事件
                        alert('按钮被点击了');
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        label: {
                            show: false
                        },
                    },
                    formatter: function (params) {
                        var result = [params[0].axisValue];
                        params.forEach(function (item) {
                            if (item.seriesName === periodLabel) {
                                result.push('开盘: ' + parseFloat(item.value[1]).toFixed(3));
                                result.push('收盘: ' + parseFloat(item.value[2]).toFixed(3));
                                result.push('最高: ' + parseFloat(item.value[3]).toFixed(3));
                                result.push('最低: ' + parseFloat(item.value[4]).toFixed(3));
                                result.push('成交额: ' + parseFloat(item.value[6]));
                            } else {
                                result.push(item.seriesName + ': ' + item.value);
                            }
                        });
                        return `<div class="flexcolumn font10"><div class="height10">${result.join('</div><div class="height10">')}</div></div>`;
                    },
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 10,
                    textStyle: {
                        color: '#000'
                    },
                    position: function (pos, params, el, elRect, size) {
                        const obj = {
                            top: 10
                        };
                        obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                        return obj;
                    }
                    // extraCssText: 'width: 170px'
                },
                axisPointer: {
                    link: [
                        {
                            xAxisIndex: 'all'
                        }
                    ],
                    label: {
                        backgroundColor: '#777'
                    }
                },
                toolbox: {
                    feature: {
                        myCustomTool: {
                            title: '重载',
                            icon: 'path://M23 4v6h-6, M1 20v-6h6, M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
                            onclick: function (e, i, name, event) {
                                share.currentTarget = event.event.currentTarget;
                                self.showK1dReloadMenu(
                                    async function () {
                                        self.showK1ds([scode]);
                                    },
                                    async function () {
                                        let succeeded = await self.forceReloadK1d(scode);
                                        if (succeeded) {
                                            self.showK1ds([scode]);
                                        }
                                    }
                                );
                                event.event.stopPropagation();
                            }
                        },
                        dataZoom: {
                            yAxisIndex: false
                        },
                        brush: {
                            type: ['lineX', 'clear']
                        }
                    }
                },
                brush: {
                    xAxisIndex: 'all',
                    brushLink: 'all',
                    outOfBrush: {
                        colorAlpha: 0.1
                    }
                },
                visualMap: {
                    show: false,
                    seriesIndex: 8,
                    dimension: 2,
                    pieces: [
                        {
                            value: 1,
                            color: downColor
                        },
                        {
                            value: -1,
                            color: upColor
                        }
                    ]
                },
                grid: [
                    {
                        left: '30px',
                        right: '4px',
                        height: '160px',
                        top: '10px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '180px',
                        height: '20px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '200px',
                        height: '40px'
                    },
                    {
                        left: '30px',
                        right: '4px',
                        top: '240px',
                        height: '60px'
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1, 2],
                        start: 0,
                        end: 100
                    },
                    {
                        show: false,
                        xAxisIndex: [0, 1, 2],
                        type: 'slider',
                        top: '240px',
                        start: 0,
                        end: 100
                    }
                ],
                xAxis: [
                    {
                        type: 'category',
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax',
                        axisPointer: {
                            z: 100
                        }
                    },
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 2,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    },
                    {
                        type: 'category',
                        gridIndex: 3,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: {
                            onZero: false,
                            show: false
                        },
                        axisTick: { show: false },
                        splitLine: { show: false },
                        axisLabel: { show: false },
                        min: 'dataMin',
                        max: 'dataMax'
                    }
                ],
                yAxis: [
                    {
                        scale: true,
                        splitArea: {
                            show: true
                        }
                    },
                    {
                        scale: true,
                        gridIndex: 1,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    },
                    {
                        scale: true,
                        gridIndex: 2,
                        splitNumber: 2,
                        axisLabel: { show: false },
                        axisLine: { show: false },
                        axisTick: { show: false },
                        splitLine: { show: false }
                    },
                    {
                        scale: true,
                        gridIndex: 3,
                        axisLabel: { show: false },
                        splitLine: { show: false }
                    }
                ],
                series: [
                    {
                        name: periodLabel,
                        type: 'candlestick',
                        data: values,
                        itemStyle: {
                            color0: upColor,
                            color: downColor,
                            borderColor: undefined,
                            borderColor0: undefined
                        }
                    },
                    {
                        name: 'MA5',
                        type: 'line',
                        data: self.calculateMA(5, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA10',
                        type: 'line',
                        data: self.calculateMA(10, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA20',
                        type: 'line',
                        data: self.calculateMA(20, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA60',
                        type: 'line',
                        show: false,
                        data: self.calculateMA(60, data),
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'Boll中',
                        type: 'line',
                        data: bollData.mid,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#333333'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Boll',
                        type: 'line',
                        data: bollData.upper,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#ff7f50'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Boll下',
                        type: 'line',
                        data: bollData.lower,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                            color: '#87cefa'
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'Volume',
                        type: 'bar',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumes,
                        itemStyle: {
                            color: function (params) {
                                var kData = option.series[0].data;
                                if (kData.length > params.dataIndex) {
                                    return kData[params.dataIndex][1] >= kData[params.dataIndex][0]
                                        ? '#ef232a' : '#14b143';
                                }

                                return '#ef232a';
                            }
                        }
                    },
                    {
                        name: 'cci',
                        type: 'line',
                        data: values.map((item) => item[6]),
                        smooth: false,
                        symbol: 'none',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'cci+100',
                        type: 'line',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        markLine: {
                            data: [
                                {
                                    yAxis: 100,
                                    lineStyle: {
                                        color: '#0cc039ff',
                                        width: 1,
                                        type: 'solid'
                                    },
                                    label: {
                                        show: true,
                                        position: 'end',
                                        formatter: '100',
                                        color: '#0cc039ff'
                                    }
                                }
                            ],
                            symbol: 'none'
                        }
                    },
                    {
                        name: 'cci-100',
                        type: 'line',
                        xAxisIndex: 2,
                        yAxisIndex: 2,
                        markLine: {
                            data: [
                                {
                                    yAxis: -100,
                                    lineStyle: {
                                        color: '#e74c3c',
                                        width: 1,
                                        type: 'solid'
                                    },
                                    label: {
                                        show: true,
                                        position: 'end',
                                        formatter: '100',
                                        color: '#e74c3c'
                                    }
                                }
                            ],
                            symbol: 'none'
                        }
                    },
                    {
                        name: 'Kdj',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.K,
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kDj',
                        type: 'line',
                        show: false,
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.D,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kdJ',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        data: kdjData.J,
                        smooth: true,
                        lineStyle: {
                            width: 1,
                        },
                        symbol: 'none'
                    },
                    {
                        name: 'kdJ+20',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        markLine: {
                            symbol: 'none',
                            lineStyle: {
                                type: 'dashed',
                                width: 1
                            },
                            data: [
                                {
                                    yAxis: 20
                                }
                            ]
                        }
                    },
                    {
                        name: 'kdJ+80',
                        type: 'line',
                        xAxisIndex: 3,
                        yAxisIndex: 3,
                        markLine: {
                            symbol: 'none',
                            lineStyle: {
                                type: 'dashed',
                                width: 1
                            },
                            data: [
                                {
                                    yAxis: 80
                                }
                            ]
                        }
                    }
                ]
            };

            // 使用配置项显示图表
            chart.setOption(option);
        },
        showRuleStatus: function (r, c) {
            if (r == null) {
                return;
            }

            let rc = r.rule;

            let statusMapping = self.statusMapping;
            let mapping = self.mapping;

            rc.minPrice = rc.minPrice ? parseFloat(rc.minPrice) : 0;
            rc.maxPrice = rc.maxPrice ? parseFloat(rc.maxPrice) : 0;
            rc.currentPrice = rc.currentPrice ? parseFloat(rc.currentPrice) : 0;
            let prices = `<div class="flexcolumn margin4">
                    <div>${share.convertIfInteger(rc.minPrice)}</div> 
                    <div> ${share.convertIfInteger(rc.currentPrice)}</div>
                    <div> ${share.convertIfInteger(rc.maxPrice)}</div>
                </div>
            `;

            if (r.status == "toBuy") {
                prices = `<div class="flexrow center">
                            <div class="margin4">${rc.broker}${mapping[r.status]}<br><span class="font10">${share.convertIfInteger(rc.bounce)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${share.convertIfInteger(rc.buy)} : <br>${rc.buyAmount}</div>
                                ${prices}
                            <div class="margin4">——<br> : ${share.convertIfInteger(rc.sell)}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.convertIfInteger(rc.dip)}</span><br>${rc.sellAmount}</div>
                          </div>`;
            } else if (r.status == "toSell") {
                prices = `<div class="flexrow center">
                            <div class="margin4">——<br><span class="font10">${share.convertIfInteger(rc.bounce)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${rc.buy} : <br>${rc.buyAmount}</div>
                            ${prices}
                            <div class="margin4">${rc.broker}${mapping[r.status]}<br>: ${share.convertIfInteger(rc.sell)}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.convertIfInteger(parseFloat(rc.dip))}</span><br> ${rc.sellAmount}</div>
                          </div>`;
            } else {
                prices = `<div class="flexrow center">
                            <div class="margin4">${rc.broker}买<br><span class="font10">${share.convertIfInteger(rc.bounce)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${share.convertIfInteger(rc.buy)} : <br> ${rc.buyAmount} </div>
                            ${prices}
                            <div class="margin4">${rc.broker}卖<br> : ${share.convertIfInteger(rc.sell)}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.convertIfInteger(parseFloat(rc.dip))}</span><br>${rc.sellAmount}</div>
                          </div>`;
            }
            let expireTime = r.expireTime ? share.timeFormat__(r.expireTime, "失效:yyyy-MM-dd hh:mm") : "";
            if (r.autoCreateRuleFail && r.autoCreateRuleFail != "") {
                expireTime = `${r.autoCreateRuleFail}`;
            }
            let color = "red";
            if (r.expireTime < Date.now()) {
                color = "gray";
            }
            let actions = "";
            if (r.actions && r.actions.length > 0) {
                actions = r.actions.map(a => {
                    let statusText = statusMapping["" + a.status];
                    if (statusText == null) {
                        statusText = a.status ? a.status : "";
                    }
                    if (a.status == 10) {
                        statusText = +":" + a.orderNo;
                    }
                    return `
                                <div class="center">
                                    <table style="margin:2px 0 2px 0;display:inline-table">
                                        <tr>
                                            <td>${share.timeFormat__(a.createTime, "hh:mm:ss")}</td>
                                            <td>${a.action.substring(0, 1)}</td>
                                            <td>${share.convertIfInteger(a.price)}</td>
                                            <td>${a.amount}</td>
                                            <td>${a.done}</td>
                                        </tr>
                                        <tr>
                                            <td colspan="5">${statusText}</td>
                                        </tr>
                                    </table>
                                </div>
                                    `;
                }).join("");
            }
            let price = `
                        <div class="borderGray">
                            <div class="nowrap ${color} font10 center">
                            ${expireTime}
                            </div>
                            ${prices}

                            ${actions}
                        </div>
                            `;

            color = "";
            if (r.expireTime < Date.now() || r.closed) {
                color = "gray";
            }

            let html = `<div class="${color}">${price}</div>
            `;
            c.html(html);
        },
        toDrawK1dChart: function (scode, type, c, period) {
            if (period == null) {
                period = self.getActiveKPeriod(c);
            }
            self.setActiveKPeriod(c, period);
            let periodLabel = self.getKPeriodLabel(period);
            let k1d = c.find(".k1d");
            share.getSync__(`${self.getKEndpoint(period)}?scode=${scode}&type=${type}`)
                .then((data) => {
                    let rows = data.rows;
                    let sb = data.stockBasic;
                    let categoryData = [];
                    let values = [];
                    let volumes = [];
                    if (rows.length < 1) {
                        k1d.html(`${rows.length} rows`);
                        return;
                    }

                    let minCount = 200;
                    for (let i = 0; i < minCount - rows.length; i++) {
                        categoryData.push("-");
                        values.push([0, 0, 0, 0, 0, 0, 0, 0]);
                        volumes.push([i, 0, 1]);
                    }

                    for (let i = 0; i < rows.length; i++) {
                        let row = rows[i];
                        categoryData.push(row.time);
                        values.push([row.open, row.close, row.high, row.low, row.volume, row.amount, row.cci, row.range]);
                        volumes.push([i + minCount - rows.length, row.volume, row.open > row.close ? 1 : -1]);
                    }

                    if (values.length > 0) {
                        self.drawK1dChart(scode, type, categoryData, values, volumes, c, periodLabel);
                    }

                    let lastDay = categoryData[categoryData.length - 1];
                    let d0v = values[values.length - 1];
                    let d0low = share.convertIfInteger(d0v[3]);
                    let d0high = share.convertIfInteger(d0v[2]);
                    let d0close = share.convertIfInteger(d0v[1]);
                    c.find(".dayPeriod").text(periodLabel);
                    c.find(".day0").removeClass("bg_purple gray");
                    c.find(".day0").text(`${lastDay}:`);

                    let todayStr = share.timeFormat__(new Date(), "yyyyMMdd");
                    if (todayStr != lastDay) {
                        c.find(".day0").addClass("bg_purple gray");
                    }

                    c.find(".day0Status").removeClass("hide");
                    c.find(".priceLow").text(`${d0low}`);
                    c.find(".priceHigh").text(`${d0high}`);
                    if (sb && sb.downStopPrice > 0) {
                        c.find(".downStopPrice").text(`${share.convertIfInteger(sb.downStopPrice)}<`);
                        c.find(".upStopPrice").text(`<${share.convertIfInteger(sb.upStopPrice)}`);
                    }
                    //获取progressContainer的实际宽度
                    let totalWidth = c.find(".progressContainer").width();
                    if (d0high == d0low) {
                        c.find(".progressBar").width(totalWidth);
                        c.find(".progressBar").text(`|---|`);
                    } else if (d0close == d0low) {
                        c.find(".progressBar").width(0);
                        c.find(".progressBar").text(`|---`);
                    } else {
                        let lw = 4;
                        let w = lw + (totalWidth - lw) * (d0close - d0low) / (d0high - d0low);
                        c.find(".progressBar").width(w);
                        c.find(".progressBar").text(`${d0close}`);
                    }
                }).catch(
                    function (err) {
                        k1d.text(err.stack);
                    }
                );
        },
        showK1dReloadMenu: async function (onReload, onForceReload) {
            let popup;
            let buttons = [
                {
                    text: "重载",
                    onTap: async function () {
                        popup.close();
                        await onReload();
                    }
                },
                {
                    text: "强制重载",
                    onTap: async function () {
                        popup.close();
                        await onForceReload();
                    }
                }
            ];
            popup = await share.popupAction__("", buttons);
        },
        forceReloadK1d: async function (scode) {
            let res = await share.getSync__(`/stock/reload/k1d?scode=${scode}&force=1`);
            if (res.error) {
                share.toastError__(res.error);
                return false;
            }

            share.toastSuccess__("已清空并重载1d数据", 1000);
            return true;
        },
        showChart: async function (rows) {
            let max = 0;
            let min = 100000;
            let recent = 0;
            let ratio = 2;
            let dates = rows.map(row => `${row.日期} ${row.时间}`);
            let prices = rows.map(row => {
                if (row.价格 > max) {
                    max = row.价格;
                }
                if (row.价格 < min) {
                    min = row.价格;
                }
                if (recent == 0) {
                    recent = row.价格;
                }
                return row.价格
            });

            let html = `
                <div class="flexcolumn center">
                    <div class="flexrow width100p">
                        <div class="flexcolumn center width100p">
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2">
                                    <input type="text" id="ratio" style="width:25px;" value="${ratio}">%
                                </div>
                                <div class="marginlr10 col-xs-4 left">最近: <input style="width:60px;" type="text" id="last" value="${recent}"></div>
                                <div class="marginlr10 col-xs-3 recentUp">+${ratio}%: ${share.convertIfInteger((recent * (1 + ratio / 100)))}</div>
                                <div class="marginlr10 col-xs-3 recentDown">-${ratio}%: ${share.convertIfInteger((recent * (1 - ratio / 100)))}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+3%: ${share.convertIfInteger((recent * (1 + 3 / 100)))}</div>
                                <div class="marginlr10 col-xs-3">-3%: ${share.convertIfInteger((recent * (1 - 3 / 100)))}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+5%: ${share.convertIfInteger((recent * (1 + 5 / 100)))}</div>
                                <div class="marginlr10 col-xs-3">-5%: ${share.convertIfInteger((recent * (1 - 5 / 100)))}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+10%: ${share.convertIfInteger((recent * (1 + 10 / 100)))}</div>
                                <div class="marginlr10 col-xs-3">-10%: ${share.convertIfInteger((recent * (1 - 10 / 100)))}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最大: ${max}</div>
                                <div class="marginlr10 col-xs-4 maxUp">+${ratio}%: ${share.convertIfInteger((max * (1 + ratio / 100)))}</div>
                                <div class="marginlr10 col-xs-4 maxDown">-${ratio}%: ${share.convertIfInteger((max * (1 - ratio / 100)))}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最小: ${min}</div>
                                <div class="marginlr10 col-xs-4 minUp">+${ratio}%: ${share.convertIfInteger((min * (1 + ratio / 100)))}</div>
                                <div class="marginlr10 col-xs-4 minDown">-${ratio}%: ${share.convertIfInteger((min * (1 - ratio / 100)))}</div>
                            </div>
                        </div>
                    </div>
                    <canvas id="priceChart" style="width: 500px; height: 300px;"></canvas>
                </div>
            `;
            let popup = await share.popup__(null, html);
            let c = $(`#${popup.id}`);

            // 获取 canvas 元素
            let ctx = $('#priceChart', c)[0].getContext('2d');
            let input = $('#ratio', c);

            function calc() {
                let r = input.val().trim();
                let l = $('#last', c).val().trim();
                $(".recentUp", c).text(`+${r}%: ${share.convertIfInteger((l * (1 + r / 100)))}`);
                $(".recentDown", c).text(`-${r}%: ${share.convertIfInteger((l * (1 - r / 100)))}`);
                $(".maxUp", c).text(`+${r}%: ${share.convertIfInteger((max * (1 + r / 100)))}`);
                $(".maxDown", c).text(`-${r}%: ${share.convertIfInteger((max * (1 - r / 100)))}`);
                $(".minUp", c).text(`+${r}%: ${share.convertIfInteger((min * (1 + r / 100)))}`);
                $(".minDown", c).text(`-${r}%: ${share.convertIfInteger((min * (1 - r / 100)))}`);
            }
            input.change(function () {
                calc();
            });
            $('#last', c).change(function () {
                calc();
            });

            $('.ratio', c).click(function () {
                let ratio = $(this).attr("ratio");
                input.val(ratio);
                calc();
            });

            // 创建折线图
            let chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: '价格',
                        data: prices,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        pointStyle: (context) => {
                            const i = context.dataIndex;
                            if (rows[i]["数量"] > 0) {
                                return "circle";
                            }
                            return "triangle";
                        },
                        pointBackgroundColor: (context) => {
                            const i = context.dataIndex;
                            if (rows[i]["数量"] > 0) {
                                return "green";
                            }
                            return "red";
                        },
                        borderColor: "lightgray",
                        pointBorderColor: (context) => {
                            const i = context.dataIndex;
                            if (rows[i]["数量"] > 0) {
                                return "green";
                            }
                            return "red";
                        },
                        fill: false
                    }]
                },
                options: {
                    responsive: true,  // 自适应
                    plugins: {
                        datalabels: {
                            color: 'black', // 设置标签颜色
                            align: 'top', // 标签的位置，可以是 'top', 'bottom', 'left', 'right'
                            //anchor: 'start', // 'start' means the label will be aligned with the point
                            formatter: function (value, context) {
                                return value; // 返回 y 值
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time', // 设置 X 轴为时间类型
                            time: {
                                unit: 'day',  // 按天显示
                                displayFormats: {
                                    day: 'yyyyMMdd hh:mm:ss', // 显示日期的格式
                                },
                            },
                        },
                        y: {
                            beginAtZero: false  // Y轴从零开始
                        }
                    }
                }
            });
        }
    };

    $(function () {
        self.init();
    });

    return self;
})();
