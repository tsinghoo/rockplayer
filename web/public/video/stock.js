
window.feed_list = window.feed_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        statusMapping: {
            "49": "待报",
            "50": "已报",
            "54": "已撤",
            "55": "部成",
            "56": "已成",
            "57": "废单"
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
            let buttons = [
                {
                    text: "新交易记录",
                    onTap: self.showTradeInput
                },
                {
                    text: "新sql",
                    onTap: function () { self.toEditSql({ name: "", sql: "" }); }
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
                        let tds = $(`.curPrice, .tdRule,.tdStatus, .tdKLine`);
                        if (tds.is(":visible")) {
                            tds.hide();
                        } else {
                            tds.show();
                        }
                    }
                }
            ];

            let popup = await share.popupAction__("", buttons);

        },
        toPair: async function (reset) {
            share.closePopup__();
            let res = await share.getSync__("/stock/pair", { reset });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("pair success");
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
                    share.toastSuccess__("submitted");
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
                share.toastSuccess__("canceled");
                self.exeSql(self.sqlRow, true);
            }
        },
        toCancelRule: async function (all) {
            let res = await share.getSync__("/stock/rule/cancel", { scode: self.selectedData["代码"], broker: self.selectedData["券商"], all });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled");
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
                        self.toBuySell(rule);
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

            if (self.sql.params.includes("规则")) {
                await self.getRuleStatus();
            }
        },
        updateKLine: async function (codes) {
            if (codes == null) {
                let vtr = $('.firstCode').filter(function () {
                    let res = share.isInViewport($(this));
                    if (res) {
                        let hide = $(this).find(".k1d").hasClass("hide");
                        return !hide
                    }

                    return res;
                });

                codes = vtr.toArray().map(function (item) {
                    let code = $(item).attr("code");
                    return code;
                });
            }
            codes = codes.slice(0, 3);
            codes.forEach(function (scode) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdKLine");
                kTick = td.find(".kTick");
                // kTick.html("loading kTick");
            });

            //let ticks = await share.getSync__(`/stock/tick?scode=${codes.join(",")}&day=${Date.now()}`);
            let ticks = await share.getSync__(`/stock/tick?scode=${codes.join(",")}`);
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

                    self.drawKTickChart(lastCode, timeData, priceData, volumeData);
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
                self.drawKTickChart(lastCode, timeData, priceData, volumeData);
            }
        },
        showK1d: async function (codes) {
            if (codes == null) {
                let vtr = $('.firstCode').filter(function () {
                    let tr = $(this);

                    let res = share.isInViewport($(this));
                    if (res) {
                        let hide = $(this).find(".k1d").hasClass("hide");
                        return !hide
                    }

                    return res;
                });

                codes = vtr.toArray().map(function (item) {
                    let code = $(item).attr("code");
                    return code;
                });
            }

            codes = codes.slice(0, 3);

            codes.forEach(function (scode) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdKLine");
                k1d = td.find(".k1d");
                // k1d.html("loading k1d");
            });



            //let ticks = await share.getSync__(`/stock/tick?scode=${codes.join(",")}&day=${Date.now()}`);
            let rows = await share.getSync__(`/stock/k1d?scode=${codes.join(",")}`);
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

                    self.drawK1dChart(lastCode, categoryData, values, volumes);
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
                self.drawK1dChart(lastCode, categoryData, values, volumes);
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
                    th.addClass("tdRule");
                } else if (keys[i] == "状态") {
                    th.addClass("tdStatus");
                } else if (keys[i] == "K线") {
                    th.addClass("tdKLine");
                    th.addClass("thKLine");
                    th.addClass("clickable");
                }
            }

            if (keys.includes("K线")) {
                window.addEventListener('scroll', function () {
                    clearTimeout(self.scrollTimer);
                    self.scrollTimer = setTimeout(function () {
                        self.updateKLine();
                        self.showK1d();
                    }, 250);
                });
            }

            thead.append(tr);
            table.append(thead);

            let lastCode;
            for (let i = 0; i < rows.length; i++) {
                let tr = $("<tr>");
                let row = rows[i];

                keys.forEach(key => {
                    if (row[params[key]] != null) {
                        row[key] = row[params[key]];
                    }
                });

                let firstRow = true;
                if (row["代码"] == null) {
                    row["代码"] = "";
                }
                if (row["代码"] == lastCode) {
                    firstRow = false;
                } else {
                    lastCode = row["代码"];
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
                        tr.attr("data", JSON.stringify(row));
                    } else if (key == "名称") {
                        if (firstRow) {
                            td.html(row[key] + `<span class="vote">V</span>`);
                        } else {
                            td.html(row[key]);
                            td.addClass("almostwhite");
                        }
                    } else if (key == "券商") {
                        td.html(row[key]);
                    } else if (key == "tid") {
                        if (firstRow) {
                            td.html(`<span class="deleteRow clickable white">X</span>` + row[key]);
                        } else {
                            if (row["配对"] == "") {
                                td.html(`<span class="deleteRow clickable gray">X</span>` + row[key]);
                            } else {
                                td.html(`<span class="deleteRow clickable">X</span>` + row[key]);
                            }
                        }
                    } else if (key == "id") {
                        td.html(`<span class="deleteRowById clickable gray">X</span>` + row[key]);
                    } else if (key == "买卖") {
                        td.text(row[key]);
                        td.addClass("buySell");
                    } else if (key == "总额") {
                        td.text(share.toFixed(row[key]));
                    } else if (key == "规则") {
                        td.addClass("tdRule");
                        let rc = null;
                        try {
                            rc = JSON.parse(row[key]);
                        } catch (e) {

                        }
                        if (rc != null) {
                            self.showRule({ rule: rc }, td);
                            if (rc.order == "") {
                                td.find("table").css({
                                    border: "1px solid gray",
                                    "border-collapse": "collapse"
                                });
                                td.find("table td, table th").css({
                                    border: "none"
                                });
                            }

                            td.addClass("ruleContent");
                        }
                    } else if (key == "状态") {
                        td.addClass("tdStatus");
                        if (firstRow) {
                            td.addClass("ruleStatus");
                            // td.removeClass("nowrap"); 
                        }
                    } else if (key == "K线") {
                        if (firstRow) {
                            td.addClass("tdKLine");
                            let html = `
                            <div class="flexrow">
                                <span class = "glyphicon glyphicon-minus kLineCollapse clickable"/>
                                <div class="flexcolumn">
                                    <div class="kTick hide"></div>
                                    <div class="k1d hide"></div>
                                </div>
                            </div>
                            `;
                            td.html(html);


                            // td.removeClass("nowrap"); 
                        }
                    } else {
                        td.text(row[key]);
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

            if (keys.includes("K线")) {
                // self.showK1d();
            }

            $(".ruleStatus").click(function (e) {
                self.onTdClicked(this);
                self.toUpdateRuleStatus();
            })

            $(".thKLine").click(function (e) {
                if ($($(".k1d")[0]).hasClass("hide")) {
                    $(".k1d").removeClass("hide");
                    $(".kTick").removeClass("hide");
                    self.showK1d();
                    self.updateKLine();
                } else {
                    $(".k1d").addClass("hide");
                    $(".kTick").addClass("hide");
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

            $(".kLineCollapse").click(function (e) {
                e.stopPropagation();
                let k1d = $(this).parents("tr").find(".k1d");
                let kTick = $(this).parents("tr").find(".kTick");
                if (k1d.hasClass("hide")) {
                    let scode = $(this).parents("tr").attr("code");

                    k1d.removeClass("hide");
                    kTick.removeClass("hide");

                    self.showK1d([scode]);
                    self.updateKLine([scode]);
                } else {
                    k1d.addClass("hide");
                    kTick.addClass("hide");
                }
            })


            //鼠标在firstCode那些行之上时，显示一个弹出框，显示该股票的历史交易价格
            $(".code").click(async function (e) {
                e.stopPropagation();
                let code = $(this).parents("tr").attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let trs = $(`.repeatCode${code}`);
                trs.show();
                self.showChart(rows);
            })

            //鼠标在firstCode那些行之上时，显示一个弹出框，显示该股票的历史交易价格
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
                let res = await share.getSync__(`/stock/vote?code=${code}`);
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    share.toastSuccess__("已置顶", 1000);
                }
            })

            $(".deleteRow").click(async function (e) {
                e.stopPropagation();
                let tr = $(this).parents("tr");
                let data = tr.attr("data");
                data = JSON.parse(data);
                let isConfirmed = await share.isConfirmed__(`确定要删除${data.tid}吗?`);
                if (isConfirmed) {
                    let res = await share.getSync__(`/stock/deleteRow?tid=${data.tid}`);
                    if (res.error) {
                        share.toastError__(res.error);
                    } else {
                        tr.remove();
                    }
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

            if (self.task == null) {
                self.task = setInterval(async function () {
                    await self.updateData();
                }, 1000);
            }
        },

        getRuleStatus: async function () {
            let res = await share.getSync__("/stock/rule/status");
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
        },

        toBuySell: async function (opt, c) {
            let sell, buy, delta, broker, sellAmount, buyAmount, dip, bounce;
            if (opt) {
                sell = opt.sell;
                buy = opt.buy;
                delta = opt.delta;
                broker = opt.broker;
                sellAmount = opt.sellAmount;
                buyAmount = opt.buyAmount;
                dip = opt.dip;
                bounce = opt.bounce;
            }
            if (broker == null) {
                broker = self.selectedData["券商"];
            }

            if (!["国信", "国金"].includes(broker)) {
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

            if (c == null) {
                c = $("#templateBuySell").html();
                let popup = await share.popup__(null, c);
                c = $(`#${popup.id}`);
            }

            c.find(".sname").val(`${self.selectedData["名称"]}`);
            c.find(".scode").val(`${self.selectedData["代码"]}`);
            c.find(".operationName").val(`${broker}`);
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

            let autoPrice = function (changed) {
                let buy = c.find(".buy").val().trim();
                let sell = c.find(".sell").val().trim();
                if (changed == 1) {
                    if (parseFloat(sell) < parseFloat(buy) + 2)
                        c.find(".sell").val(2 + parseFloat(buy));
                }
                if (changed == 2) {
                    if (parseFloat(buy) > parseFloat(sell) - 2)
                        c.find(".buy").val(parseFloat(sell) - 2);
                }
                autoDelta();
            }

            $('.buy', c).change(function () {
                autoPrice(1);
            });
            $('.sell', c).change(function () {
                autoPrice(2);
            });

            c.find(".buyAmount").val(buyAmount);
            c.find(".sellAmount").val(sellAmount);

            c.find(".buttonConfirm").click(async function () {
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
                let order = "";
                if (c.find(".buyFirst")[0].checked) {
                    order = "buyFirst";
                }

                if (c.find(".sellFirst")[0].checked) {
                    order = "sellFirst";
                }

                let json = { buy, bounce, buyAmount, sell, dip, sellAmount, scode, sname, broker, order };
                let res = await share.getSync__(`/stock/rule/create?json=${encodeURIComponent(JSON.stringify(json))}`);
                if (res.error) {
                    share.toastError__(res.error);
                } else {
                    share.toastSuccess__("上传成功");
                }
            })

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
                            const curPrice = share.toFixed(row.buy);
                            data.curPrice = curPrice;
                            th.attr("data", JSON.stringify(data));
                            const price = data["价格"];
                            let tp = share.getTimePassed__(row.updateTime);
                            if (price == null) {
                                cpl.text(`${share.toFixed(curPrice, 3)} (${tp})`);
                            } else {
                                let delta = ((curPrice - price) / price * 100).toFixed(1);
                                cpl.text(`${share.toFixed(curPrice, 3)} (${delta}% ${tp})`);

                                if (delta > 0 && data["买卖"].indexOf("买入") >= 0) {
                                    if (data["配对"] != "") {
                                        cpl.addClass("gold");
                                    } else {
                                        cpl.addClass("red");
                                    }
                                }

                                if (delta < -2 && data["买卖"] == "买入") {
                                    if (data["配对"] != "") {
                                        cpl.addClass("gold");
                                    } else {
                                        cpl.addClass("green");
                                    }
                                }

                                if (delta < 0 && data["买卖"] == "卖出") {
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
            let tbs = $("#templateBuySell").html();
            let html = `
                    <div class="flexrow">
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
                            <div class="kTick border margin4">loading 1m</div>
                            <div class="day0Status margin4"></div>
                            <div class="k1d border margin4">loading 1d</div>
                       </div>
                    </div>
                            `;
            let popup = await share.popup__(null, html, "bottom");

            let c = $(`#${popup.id}`);
            self.showPosition(null, c.find(".position"), scode);
            self.toBuySell(null, c);
            let r = await self.showRule(null, c.find(".rule"), scode, c.find(".ruleStatus"));
            c.find(".rule").click(function (e) {
                let rc = r.rule;
                let buy = share.toFixed(rc.buy, 3);
                let sell = share.toFixed(rc.sell, 3);
                c.find(".sell").val(sell);
                c.find(".buy").val(buy);
                c.find(".buyAmount").val(rc.buyAmount);
                c.find(".sellAmount").val(rc.sellAmount);
                c.find(".dip").val(share.toFixed(rc.dip, 3));
                c.find(".bounce").val(share.toFixed(rc.bounce, 3));
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

            let kTick = c.find(".kTick");

            let ticks = await share.getSync__(`/stock/tick?scode=${scode}&day=${Date.now()}`);
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

            self.drawKTickChart(scode, timeData, priceData, volumeData, kTick);

            let rows = await share.getSync__(`/stock/k1d?scode=${scode}`);

            let categoryData = [];
            let values = [];
            let volumes = [];

            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];
                categoryData.push(row.time);
                values.push([row.open, row.close, row.high, row.low]);
                volumes.push([i, row.volume, row.open > row.close ? 1 : -1]);
            }

            if (values.length > 0) {
                let k1d = c.find(".k1d");
                self.drawK1dChart(scode, categoryData, values, volumes, k1d);
            }

            let lastDay = categoryData[categoryData.length - 1];
            let d0v = values[values.length - 1];
            let d0low = share.toFixed(d0v[3]);
            let d0high = share.toFixed(d0v[2]);
            let d0close = share.toFixed(d0v[1]);
            c.find(".day0Status").text(`${lastDay}: ${d0low} < ${d0close} < ${d0high} `);
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
                    sum += data.values[i - j][1];
                }
                result.push(+(sum / dayCount).toFixed(3));
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

        drawKTickChart: function (scode, timeData, priceData, volumeData, $c) {
            if ($c == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdKLine");
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
            if (timeData.length > 0) {
                lastTime = timeData[timeData.length - 1].split(":");
                lastTime = parseInt(lastTime[0]) * 60 + parseInt(lastTime[1]);
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

                timeData.push(h + ":" + m);
                priceData.push(null);
                volumeData.push(null);
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
                        data: timeData,
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
                        data: timeData,
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
                        data: priceData,
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
                        name: '成交量',
                        type: 'bar',
                        xAxisIndex: 1,
                        yAxisIndex: 1,
                        data: volumeData,
                        itemStyle: {
                            color: function (params) {
                                var colorList = priceData.map((price, index) => {
                                    return index === 0 ? '#aaa' :
                                        price > priceData[index - 1] ? '#f00' : '#0f0';
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
                        <td>${row.avg_price}</td>
                        <td>${row.market_value}</td>
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

        toReloadK1d: async function (scode) {
            let res = await share.getSync__("/stock/reload/k1d", { scode, broker: "国金" });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("reloading", 1000);
            }
        },

        drawK1dChart: function (scode, categoryData, values, volumes, k1d) {
            if (k1d == null) {
                let tr = $(`.firstCode[code="${scode}"]`);
                let td = tr.find(".tdKLine");
                k1d = td.find(".k1d");
            }
            const upColor = '#00da3c';
            const downColor = '#ec0000';
            k1d.css({
                width: "480px",
                height: "300px"
            });
            k1d.removeAttr("_echarts_instance_");
            // k1d.html("loading k1d");
            var chartDom = k1d[0];
            var chart = echarts.init(chartDom);
            let data = { categoryData, values, volumes };
            // 配置项
            var option = {
                animation: false,
                legend: {
                    bottom: 2,
                    left: 'center',
                    data: ['1d', 'MA5', 'MA10', 'MA20', 'MA30', 'Volume']
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
                            onclick: function () {
                                self.toReloadK1d(scode);
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
                        height: '60px'
                    }
                ],
                dataZoom: [
                    {
                        type: 'inside',
                        xAxisIndex: [0, 1],
                        start: 92,
                        end: 100
                    },
                    {
                        show: true,
                        xAxisIndex: [0, 1],
                        type: 'slider',
                        top: '245px',
                        start: 92,
                        end: 100
                    }
                ],
                xAxis: [
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
                    {
                        type: 'category',
                        gridIndex: 1,
                        data: categoryData,
                        boundaryGap: false,
                        axisLine: { onZero: false },
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
                            color: upColor,
                            color0: downColor,
                            borderColor: undefined,
                            borderColor0: undefined
                        }
                    },
                    {
                        name: 'MA5',
                        type: 'line',
                        data: self.calculateMA(5, data),
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA10',
                        type: 'line',
                        data: self.calculateMA(10, data),
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA20',
                        type: 'line',
                        data: self.calculateMA(20, data),
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
                        }
                    },
                    {
                        name: 'MA30',
                        type: 'line',
                        data: self.calculateMA(30, data),
                        smooth: true,
                        lineStyle: {
                            opacity: 0.5
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
                    <div>${share.toFixed(rc.minPrice, 3)}</div> 
                    <div> ${share.toFixed(rc.currentPrice, 3)}</div>
                    <div> ${share.toFixed(rc.maxPrice, 3)}</div>
                </div>
            `;




            if (r.status == "toBuy") {
                prices = `<div class="flexrow center">
                            <div class="margin4">${mapping[r.status]}<br><span class="font10">${share.toFixed(parseFloat(rc.bounce), 3)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${rc.buy} : <br>${rc.buyAmount}</div>
                                ${prices}
                            <div class="margin4">${rc.broker}<br> : ${rc.sell}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.toFixed(parseFloat(rc.dip), 3)}</span><br>${rc.sellAmount}</div>
                          </div>`;
            } else if (r.status == "toSell") {
                prices = `<div class="flexrow center">
                            <div class="margin4">${rc.broker}<br><span class="font10">${share.toFixed(parseFloat(rc.bounce), 3)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${rc.buy} : <br>${rc.buyAmount}</div>
                            ${prices}
                            <div class="margin4">${mapping[r.status]}<br>: ${rc.sell}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.toFixed(parseFloat(rc.dip), 3)}</span><br> ${rc.sellAmount}</div>
                          </div>`;
            } else {
                prices = `<div class="flexrow center">
                            <div class="margin4">${rc.broker}<br><span class="font10">${share.toFixed(parseFloat(rc.bounce), 3)}<img style="width:10px;" src='./img/arrow-turn-up-sharp.svg'/></span>${rc.buy} : <br> ${rc.buyAmount} </div>
                            ${prices}
                            <div class="margin4">${rc.broker}<br> : ${rc.sell}<span class="font10"><img style="width:10px;" src='./img/arrow-turn-down-sharp.svg'/>${share.toFixed(parseFloat(rc.dip), 3)}</span><br>${rc.sellAmount}</div>
                          </div>`;
            }

            let price = `
                                <tr>
                                    <td colspan="7" class="nowrap">
                                    ${prices}
                                    </td>
                                </tr>
                            `;
            let actions = "";
            if (r.actions && r.actions.length > 0) {
                actions = r.actions.map(a => {
                    let statusText = statusMapping[a.status];
                    if (statusText == null) {
                        statusText = a.status ? a.status : "";
                    }
                    return `
                                        <tr>
                                            <td>${share.timeFormat__(a.createTime, "yyyy-MM-dd hh:mm:ss")}</td>
                                            <td>${a.action}</td>
                                            <td>${a.price}</td>
                                            <td>${a.amount}</td>
                                            <td>${a.orderNo}</td>
                                            <td>${a.done}</td>
                                            <td>${statusText}</td>
                                        </tr>
                                    `;
                }).join("");
            }

            let html = `<table>${price}${actions}</table>`;
            c.html(html);
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
                                <div class="marginlr10 col-xs-3 recentUp">+${ratio}%: ${share.toFixed((recent * (1 + ratio / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-3 recentDown">-${ratio}%: ${share.toFixed((recent * (1 - ratio / 100)), 4)}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+3%: ${share.toFixed((recent * (1 + 3 / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-3">-3%: ${share.toFixed((recent * (1 - 3 / 100)), 4)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+5%: ${share.toFixed((recent * (1 + 5 / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-3">-5%: ${share.toFixed((recent * (1 - 5 / 100)), 4)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+10%: ${share.toFixed((recent * (1 + 10 / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-3">-10%: ${share.toFixed((recent * (1 - 10 / 100)), 4)}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最大: ${max}</div>
                                <div class="marginlr10 col-xs-4 maxUp">+${ratio}%: ${share.toFixed((max * (1 + ratio / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-4 maxDown">-${ratio}%: ${share.toFixed((max * (1 - ratio / 100)), 4)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最小: ${min}</div>
                                <div class="marginlr10 col-xs-4 minUp">+${ratio}%: ${share.toFixed((min * (1 + ratio / 100)), 4)}</div>
                                <div class="marginlr10 col-xs-4 minDown">-${ratio}%: ${share.toFixed((min * (1 - ratio / 100)), 4)}</div>
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
                $(".recentUp", c).text(`+${r}%: ${share.toFixed((l * (1 + r / 100)), 4)}`);
                $(".recentDown", c).text(`-${r}%: ${share.toFixed((l * (1 - r / 100)), 4)}`);
                $(".maxUp", c).text(`+${r}%: ${share.toFixed((max * (1 + r / 100)), 4)}`);
                $(".maxDown", c).text(`-${r}%: ${share.toFixed((max * (1 - r / 100)), 4)}`);
                $(".minUp", c).text(`+${r}%: ${share.toFixed((min * (1 + r / 100)), 4)}`);
                $(".minDown", c).text(`-${r}%: ${share.toFixed((min * (1 - r / 100)), 4)}`);
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





