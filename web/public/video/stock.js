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
        sql: { name: "" },
        currentPrices: {},
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
                    text: "增量配对",
                    onTap: function () { self.toPair(0) }
                },
                {
                    text: "重新配对",
                    onTap: function () { self.toPair(1) }
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

                        async function toCreateRule(type) {
                            let maxCount = $(".maxCount", c).val().trim();
                            let priceDelay = $(".priceDelay", c).val().trim();

                            let res = await share.getSync__(`/stock/rule/create/auto?type=${type}&max=${maxCount}&priceDelay=${priceDelay}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                let succeeded = res.succeeded.map((item) => `${item.scode}.${item.sname}`).join("<br/>");
                                let failed = res.failed.map((item) => `${item.scode}.${item.sname}:${item.reason}`).join("<br/>");
                                let done = res.done;
                                if (done) {
                                    share.toastSuccess__("finished", 2000);
                                }
                                c.find(".succeededRules").html(succeeded);
                                c.find(".failedRules").html(failed);
                            }
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
        toPair: async function (reset) {
            share.closePopup__();
            let res = await share.getSync__("/stock/pair", { reset });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("pair success", 1000);
            }
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
                self.exeSql(self.sqlRow, true);
            }
        },
        toCancelRule: async function (all) {
            let res = await share.getSync__("/stock/rule/cancel", { scode: self.selectedData["代码"], broker: self.selectedData["券商"], all });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled", 1000);
                self.exeSql(self.sqlRow, true);
            }
        },
        showMenu4RuleContent: async function () {
            let res = await share.getSync__("/stock/rule/status", { scode: self.selectedData["代码"], broker: self.selectedData["券商"] });
            let guide = ``;

            let buttons = [
                {
                    text: "修改",
                    onTap: function () {
                        share.closePopup__();
                        let rule = self.selectedData["规则"];
                        rule = JSON.parse(rule);
                        self.showBuySell(rule);
                    }
                },
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
                await self.getCurrentPrices();
            }

            if (self.showRule && self.sql.params.includes("规则")) {
                await self.getRuleStatus();
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
                if (!k1d.hasClass("hide")) {
                    return;
                }

                let res = share.isInViewport($(item));
                if (res) {
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
            codes.forEach(function (scode) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdK1d");
                k1d = td.find(".k1d");
                k1d.html("loading k1d");
                k1d.removeClass("hide");
            });

            //let ticks = await share.getSync__(`/stock/k/1m?scode=${codes.join(",")}&day=${Date.now()}`);
            let rows = await share.getSync__(`/stock/k/1ds?type=0&scodes=${codes.join(",")}`);
            let lastCode = null;
            let lastVolume = 0;

            let categoryData = [];
            let values = [];
            let volumes = [];

            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];
                if (lastCode == null) {
                    lastCode = row.scode;
                } else if (lastCode != row.scode) {

                    let tr = $(`.firstCode[code="${lastCode}"]`);
                    let c = tr.find(".tdK1d");
                    self.drawK1dChartSmall(lastCode, categoryData, values, volumes, c);
                    lastCode = row.scode;
                    categoryData = [];
                    values = [];
                    volumes = [];
                }

                categoryData.push(row.time);
                values.push([row.open, row.close, row.high, row.low]);
                volumes.push([i, row.volume, row.open > row.close ? 1 : -1]);
            }

            if (values.length > 0) {
                let tr = $(`.firstCode[code="${lastCode}"]`);
                let c = tr.find(".tdK1d");
                self.drawK1dChartSmall(lastCode, categoryData, values, volumes, c);
            }
        },

        showRows: function (expanded) {
            let table = $("#stockTable");
            let rows = self.rows;
            self.data = {};
            table.empty();
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
                th.text(keys[i]);
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
                            td.html(row[key] + `<span class="kLine">${code}</span>`);
                            td.addClass("bold");
                            tr.addClass("firstCode clickable");
                            td.addClass("code");
                        } else {
                            td.text(row[key]);
                            td.addClass("almostWhite");
                            self.data[row[key]].push(row);
                            tr.addClass("repeatCode");
                            tr.addClass(`repeatCode${lastCode}`);
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
                        td.addClass("buySell");
                    } else if (key == "总额") {
                        td.text(share.toFixed(row[key]));
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
                            <div class="flexrow">
                                <span class = "k1dCollapse gray clickable">+</span>
                                <div class="flexcolumn">

                                    <div class="k1d hide"></div>
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
                    } else {
                        td.text(share.convertIfInteger(row[key]));
                        if (key == "现价") {
                            td.addClass("curPrice");
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

            if (keys.includes("K1d")) {
                // self.showK1d();
            }

            $(".ruleStatus").click(function (e) {
                self.onTdClicked(this);
                self.toUpdateRuleStatus();
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
                let code = $(this).attr("code");
                let trs = $(`.repeatCode${code}`);
                if (trs.is(":visible")) {
                    trs.hide();
                } else {
                    trs.show();
                }
            })

            $(".buySell").click(function (e) {
                e.stopPropagation();
                self.onBuySellClicked(this);
            })

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
                let code = $(this).parents("tr").attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let trs = $(`.repeatCode${code}`);
                trs.show();
                self.showStockDetail(code);
                //self.showChart(rows);
            })

            $(".kLine").click(async function (e) {
                e.stopPropagation();
                let code = $(this).parents("tr").attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let trs = $(`.repeatCode${code}`);
                trs.show();
                self.showK(code);
            })

            $(".vote").click(async function (e) {
                e.stopPropagation();
                let code = $(this).parents("tr").attr("code");
                let popup;
                let buttons = [
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

                let pairedId = data["配对"];
                let pairedTr = $(`.tid${pairedId.replace(/[\.:]/g, '_')}`);
                pairedTr.find("td").addClass("bg_purple");
                tr.find("td").addClass("bg_purple");
                let popup;
                let buttons = [
                    {
                        text: "删除本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.remove();
                            }
                        }
                    },
                    {
                        text: "彻底删除本行",
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
                        text: "删除本行及关联",
                        onTap: async function () {
                            popup.close();

                            if (pairedId == "" || pairedId == null || pairedTr.length == 0) {
                                share.toastError__("未找到配对行");
                                return;
                            }

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.remove();

                                if (pairedId != "" && pairedId != null) {
                                    let res = await share.getSync__(`/stock/deleteRow?tid=${pairedId}`);
                                    if (res.error) {
                                        share.toastError__(res.error);
                                    } else {
                                        pairedTr.remove();
                                    }
                                }
                            }
                        }
                    },
                    {
                        text: "取消删除",
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

        getRuleStatus: async function () {
            let res = await share.getSync__("/stock/rule/status");
            if (self.showingRule) {
                $(".ruleStatus").each(function () {
                    let td = $(this);
                    let scode = td.parents("tr").attr("code").trim();
                    let r = res.data[scode];
                    if (r) {
                        self.showRuleStatus(r, td);
                    }
                })
                $(".tdRule").each(function () {
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
                        }
                    }
                })
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

            if (!["国信", "国金", "BNB"].includes(broker)) {
                if (self.lastBroker) {
                    broker = self.lastBroker;
                } else {
                    broker = "国信";
                }
            }

            if (self.formatScode(self.selectedData["代码"]).indexOf("BJ") >= 0) {
                broker = "国金";
            }

            if (sellAmount == null || isNaN(sellAmount)) {
                sellAmount = Math.abs(self.selectedData["数量"]);
                buyAmount = sellAmount;
            }

            if (sellAmount == null || isNaN(sellAmount)) {
                sellAmount = 100;
                buyAmount = sellAmount;
            }

            let toModify = false;

            if (c == null) {
                toModify = true;
                c = $("#templateBuySell").html();
                let popup = await share.popup__(null, c);
                c = $(`#${popup.id}`);
            }

            c.find(".sname").val(`${self.selectedData["名称"]}`);
            c.find(".scode").val(`${self.selectedData["代码"]}`);
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
            let priceAutoed = "";
            let autoPrice = function (changed) {
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

                    if (priceAutoed == "sell") {
                        priceAutoed = "";
                        return;
                    }
                    priceAutoed = "buy";
                    if (parseFloat(sell) < parseFloat(buy) * (1 + 0.02))
                        c.find(".sell").val(parseFloat(buy) * (1 + 0.02));
                }
                if (changed == "sell") {
                    let sellTotal = parseFloat(sell) * parseFloat(c.find(".sellAmount").val().trim());

                    $(".sellTotal").val(sellTotal);
                    if (priceAutoed == "buy") {
                        priceAutoed = "";
                        return;
                    }
                    priceAutoed = "sell";
                    if (parseFloat(buy) > parseFloat(sell) * (1 - 0.02))
                        c.find(".buy").val(parseFloat(sell) * (1 - 0.02));
                }
            }

            $('.buy', c).change(function () {
                autoPrice("buy");
            });
            $('.sell', c).change(function () {
                autoPrice("sell");
            });

            $('.buyTotal', c).change(function () {
                autoPrice("buyTotal");
            });

            $('.buyAmount', c).change(function () {
                autoPrice("buyAmount");
            });

            $('.sellTotal', c).change(function () {
                autoPrice("sellTotal");
            });

            $('.sellAmount', c).change(function () {
                autoPrice("sellAmount");
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
                let scode = c.find(".scode").val().trim();
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
                let scode = c.find(".scode").val().trim();
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

            autoPrice("buyAmount");
            autoPrice("sellAmount");
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


        formatScode: function (stockCode) {
            // 转换为字符串并去除空格
            const code = String(stockCode).trim();

            // 检查代码是否有效
            if (!code) {
                throw new Error("股票代码不能为空");
            }

            let suffix = "";
            if (code.length == 6) {
                if (/^(600|601|603|605|688|900|51)\d+$/.test(code)) {
                    suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
                } else if (/^(000|001|002|003|30|15)\d+$/.test(code)) {
                    suffix = "SZ"; // 深交所（000/001/002/003/300 开头）
                } else if (/^(8|43|83|87|88|92)\d+$/.test(code)) {
                    suffix = "BJ"; // 北交所（8/43/83/87/88 开头）
                }
            } else if (/^\d{4,5}$/.test(code) || /^0[0-9]\d{3}$/.test(code)) {
                suffix = ""; // 港交所（4-5位数字，或 08 开头）
            } else if (code.indexOf("USDT") >= 0 || code.indexOf("BTC") >= 0 || code.indexOf("ETH") >= 0) {
                suffix = "EC";
            } else {
                share.debug__(`未知：${code}`);
            }

            // 返回格式化结果（如 600023.SH）
            return `${suffix}${code}`;
        },
        getMarket: function (stockCode) {
            // 转换为字符串并去除空格
            const code = String(stockCode).trim();

            // 检查代码是否有效
            if (!code) {
                return "";
            }

            let suffix = "未知";
            if (code.length == 6) {
                if (/^(600|601|603|605|688|900|51|58|56)\d+$/.test(code)) {
                    suffix = "SH"; // 上交所（600/601/603/605/688/900 开头）
                } else if (/^(000|001|002|003|30|15)\d+$/.test(code)) {
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
            let link = `https://xueqiu.com/S/${fullCode}`;

            self.openMiniBrowser(link, 840, 790);
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
        getCurrentPrices: async function () {
            let res = await share.getSync__(`/stock/price/current`);
            res.rows.forEach(row => {
                self.currentPrices[row.scode] = row;
                if (self.currentPrices[row.scode]) {
                    let tr = $(`[code="${row.scode}"]`);
                    tr.each(function () {
                        try {
                            let th = $(this);
                            let cpl = th.find(".curPrice");
                            let data = th.attr("data");

                            data = JSON.parse(data);
                            let curPrice = share.convertIfInteger(row.buy);
                            let timePassed = share.getTimePassed__(row.updateTime);
                            if (data.type == 1) {
                                curPrice = share.convertIfInteger(row.optionPrice);
                                timePassed = share.getTimePassed__(row.optionUpdateTime);
                            }
                            data.curPrice = curPrice;
                            th.attr("data", JSON.stringify(data));
                            const price = data["价格"];
                            if (price == null) {
                                cpl.html(`${curPrice} (${timePassed})`);
                            } else {
                                let delta = parseFloat(((curPrice - price) / price * 100).toFixed(1));
                                cpl.html(`${curPrice} (${delta}% ${timePassed})`);
                                cpl.removeClass("red");
                                cpl.removeClass("green");
                                cpl.removeClass("gold");
                                if (data["买卖"].indexOf("买") >= 0) {
                                    if (delta > 0) {
                                        cpl.addClass("red");
                                    }

                                    if (delta < -2) {
                                        cpl.addClass("green");
                                    }

                                    if (delta < -5) {
                                        cpl.addClass("gold");
                                    }
                                }

                                if (delta < 0 && data["买卖"].indexOf("卖") >= 0) {
                                    cpl.addClass("red");
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
                    <div class="flexrow">
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
                       <div class="flexcolumn">
                            <div class="kTick border margin4" style="width:480px; height:140px;">loading 1m</div>
                            <div class="flexrow margin4">
                                <div class="day0Status flexrow width100p margin4 hide">
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
            let data = $(ele).parent("tr").attr("data");
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
                let res = await share.getSync__(`/stock/updatePrice?price=${price}&scode=${data["代码"]}`);
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
                    "scode": data["代码"],
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

            let html = `
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
                        text: "设置价格",
                        onTap: function () {
                            popup.close();
                            let buy = data.tprice * (1 - 0.02);
                            let sell = data.tprice * (1 + 0.02);
                            c.find(".buy").val(buy);
                            c.find(".sell").val(sell);
                        }
                    },
                    {
                        text: "删除本行",
                        onTap: async function () {
                            popup.close();

                            let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                            if (res.error) {
                                share.toastError__(res.error);
                            } else {
                                tr.remove();
                            }
                        }
                    },
                    {
                        text: "彻底删除本行",
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
                        text: "取消删除",
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
                        text: "自动删除",
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
        drawK1dChart: function (scode, type, categoryData, values, volumes, c) {
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
                height: "320px"
            });
            k1d.removeAttr("_echarts_instance_");
            // k1d.html("loading k1d");
            var chartDom = k1d[0];
            var chart = echarts.init(chartDom);
            let data = { categoryData, values, volumes };

            const bollData = self.calculateBOLL(values);
            // 配置项
            var option = {
                animation: false,
                legend: {
                    bottom: 2,
                    left: 'center',
                    data: ['1d', 'MA5', 'MA10', 'MA20', 'MA60', 'Boll上', 'Boll中', 'Boll下', 'cci', 'Volume'],
                    selected: {
                        "MA20": false,
                        "MA60": false,
                        'Boll上': false,
                        'Boll中': false,
                        'Boll下': false,
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
                            if (item.seriesName === '1d') {
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
                            show: true,
                            title: '重载',
                            icon: 'path://M23 4v6h-6, M1 20v-6h6, M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
                            onclick: function (e, i, name, event) {
                                self.toDrawK1dChart(scode, type, c);
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
                    seriesIndex: 5,
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
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1, 2],
                        start: 85,
                        end: 100
                    },
                    {
                        show: true,
                        xAxisIndex: [0, 1, 2],
                        type: 'slider',
                        top: '240px',
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
                        name: '1d',
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
                        name: 'Boll上',
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
        drawK1dChartSmall: function (scode, categoryData, values, volumes, c) {
            c.find(".k1dCollapse").addClass("hide");
            k1d = c.find(".k1d");
            const upColor = '#00da3c';
            const downColor = '#ec0000';
            k1d.css({
                width: "160px",
                height: "90px"
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
            // 配置项
            var option = {
                animation: false,
                graphic: {
                    type: 'text',
                    left: 'left',
                    top: 1,
                    style: {
                        text: `${lastDay}`,
                        font: '10px Microsoft YaHei',
                        fill: lastDayColor,
                        width: 10,
                        height: 10
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    },
                    formatter: function (params) {
                        var result = params[0].axisValue + '<br/>';
                        params.forEach(function (item) {
                            if (item.seriesName === '1d') {
                                result += '开盘: ' + parseFloat(item.value[1]).toFixed(3) + '<br/>';
                                result += '收盘: ' + parseFloat(item.value[2]).toFixed(3) + '<br/>';
                                result += '最高: ' + parseFloat(item.value[3]).toFixed(3) + '<br/>';
                                result += '最低: ' + parseFloat(item.value[4]).toFixed(3) + '<br/>';
                                result += '成交量: ' + volumes[params[0].dataIndex][1] + '<br/>';
                            } else {
                                result += item.seriesName + ': ' + item.value + '<br/>';
                            }
                        });
                        return result;
                    },
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 2,
                    textStyle: {
                        color: '#000',
                        fontSize: 8
                    },
                    position: function (pos, params, el, elRect, size) {
                        const obj = {
                            top: 0
                        };
                        obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
                        return obj;
                    }
                    // extraCssText: 'width: 170px'
                },
                grid: {
                    left: 2,
                    right: 2,
                    top: 0,
                    bottom: 0,
                    containLabel: false
                },
                toolbox: {
                    feature: {
                        myCustomTool: {
                            show: true,
                            title: '关闭',
                            icon: 'path://M15 15 L25 25 M25 15 L15 25',
                            onclick: function (e, i, name, event) {
                                self.toCloseK1d(scode);
                                event.event.stopPropagation();
                            }
                        }
                    }
                },
                xAxis:
                {
                    type: 'category',
                    data: categoryData,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    min: 'dataMin',
                    max: 'dataMax',
                    axisPointer: {
                        z: 100
                    }
                },
                yAxis:
                {
                    scale: true,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: true }
                },
                series: [
                    {
                        name: '1d',
                        type: 'candlestick',
                        data: values,
                        itemStyle: {
                            color: downColor,
                            color0: upColor,
                            borderColor: undefined,
                            borderColor0: undefined
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
                            <div class="margin4">${rc.broker}${mapping[r.status]}<br>: ${share.convertIfInteger(rc.sell)}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.toFixed(parseFloat(rc.dip))}</span><br> ${rc.sellAmount}</div>
                          </div>`;
            } else {
                prices = `<div class="flexrow center">
                            <div class="margin4">${rc.broker}买<br><span class="font10">${share.convertIfInteger(rc.bounce)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${share.convertIfInteger(rc.buy)} : <br> ${rc.buyAmount} </div>
                            ${prices}
                            <div class="margin4">${rc.broker}卖<br> : ${share.convertIfInteger(rc.sell)}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.toFixed(parseFloat(rc.dip))}</span><br>${rc.sellAmount}</div>
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
            let price = `
                                <tr>
                                    <td colspan="6" class="nowrap">
                                    <div class="nowrap ${color} font10 center">
                                    ${expireTime}
                                    </div>
                                    ${prices}
                                    </td>
                                </tr>
                            `;
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
                                        <tr>
                                            <td>${share.timeFormat__(a.createTime, "yyyy-MM-dd hh:mm:ss")}</td>
                                            <td>${a.action}</td>
                                            <td>${share.convertIfInteger(a.price)}</td>
                                            <td>${a.amount}</td>
                                            <td>${a.done}</td>
                                            <td>${statusText}</td>
                                        </tr>
                                    `;
                }).join("");
            }

            color = "";
            if (r.expireTime < Date.now() || r.closed) {
                color = "gray";
            }

            let html = `<table class="${color}">${price}${actions}</table>
            `;
            c.html(html);
        },
        toDrawK1dChart: function (scode, type, c) {
            let k1d = c.find(".k1d");
            share.getSync__(`/stock/k/1d?scode=${scode}&type=${type}`)
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
                        values.push([0, 0, 0, 0, 0, 0, 0]);
                        volumes.push([i, 0, 1]);
                    }

                    for (let i = 0; i < rows.length; i++) {
                        let row = rows[i];
                        categoryData.push(row.time);
                        values.push([row.open, row.close, row.high, row.low, row.volume, row.amount, row.cci]);
                        volumes.push([i, row.volume, row.open > row.close ? 1 : -1]);
                    }

                    if (values.length > 0) {
                        self.drawK1dChart(scode, type, categoryData, values, volumes, c);
                    }

                    let lastDay = categoryData[categoryData.length - 1];
                    let d0v = values[values.length - 1];
                    let d0low = share.toFixed(d0v[3]);
                    let d0high = share.toFixed(d0v[2]);
                    let d0close = share.toFixed(d0v[1]);
                    c.find(".day0").text(`${lastDay}:`);

                    let todayStr = share.timeFormat__(new Date(), "yyyyMMdd");
                    if (todayStr != lastDay) {
                        c.find(".day0").addClass("bg_purple gray");
                    }

                    c.find(".day0Status").removeClass("hide");
                    c.find(".priceLow").text(`${d0low}`);
                    c.find(".priceHigh").text(`${d0high}`);
                    if (sb && sb.downStopPrice > 0) {
                        c.find(".downStopPrice").text(`${sb.downStopPrice}<`);
                        c.find(".upStopPrice").text(`<${sb.upStopPrice}`);
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







