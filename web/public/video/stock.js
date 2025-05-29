//mairui.club: free: FF5BCE92-17AE-4A9D-A0E5-B4B0C20248C2
window.feed_list = window.feed_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        sql: { name: "" },
        currentPrices: {},
        init: async function () {
            self.sql.name = decodeURIComponent(window.location.hash.substring(1));
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
            self.toEditSql(row);
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

                self.exeSql(param, selection == null);
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
            let res = await share.postSync__("/stock/query", row);
            let table = $("#stockTable");
            self.sql = row;
            if (res.error) {
                share.toastError__(JSON.stringify(res.error));
            } else {

                if (show) {
                    self.sqlRow = row;
                    self.rows = res.data;
                    if (self.rows && self.rows.length > 0) {
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
                        let tds = $(`.curPrice`);
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
                let cookies = $(".rows", c).val().trim();
                var params = {
                    "rows": cookies
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
            let res = await share.getSync__("/stock/rule/delete", { scode: self.selectedData["代码"] });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled");
                self.exeSql(self.sqlRow, true);
            }
        },
        toCancelRule: async function () {
            let res = await share.getSync__("/stock/rule/cancel", { scode: self.selectedData["代码"] });
            if (res.error) {
                share.toastError__(res.error);
            } else {
                share.toastSuccess__("canceled");
                self.exeSql(self.sqlRow, true);
            }
        },
        showMenu4RuleContent: async function () {
            let res = await share.getSync__("/stock/rule/status", { scode: self.selectedData["代码"] });
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
                    text: "取消",
                    onTap: function () {
                        share.closePopup__();
                        self.toCancelRule();
                    }
                }
            ];

            let popup = share.popupAction__(guide, buttons);
        },
        updateData: async function () {
            let sqlName = self.sqlRow.name.trim();
            if (sqlName == "all") {
                await self.getCurrentPrices();
                await self.getRuleStatus();
            } else if (sqlName == "智能单") {
                await self.getRuleStatus();
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
            let keys = params.keys;
            for (let i = 0; i < keys.length; i++) {
                let th = $("<th>");
                th.text(keys[i]);
                tr.append(th);
                if (keys[i] == "现价") {
                    th.addClass("curPrice");
                }
            }

            thead.append(tr);
            table.append(thead);

            let tbody = $("<tbody>");
            let lastCode;
            for (let i = 0; i < rows.length; i++) {
                let tr = $("<tr>");
                let row = rows[i];
                let firstRow = true;
                if (row["代码"] == lastCode) {
                    firstRow = false;
                } else {
                    lastCode = row["代码"];
                }

                for (let j = 0; j < keys.length; j++) {
                    let key = keys[j];
                    let td = $("<td>");
                    td.addClass("nowrap");
                    if (key == "代码") {
                        tr.addClass(`code${row[key]}`);
                        if (firstRow) {
                            self.data[row[key]] = [row];
                            td.html(row[key] + `<span class="kLine">K</span>`);
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
                    } else if (key == "买卖") {
                        td.text(row[key]);
                        td.addClass("buySell");
                    } else if (key == "规则") {
                        let rc = JSON.parse(row[key]);
                        if (firstRow && rc != null) {
                            let buy = `
                            <tr> 
                                <td>买:</td>
                                <td>${rc.buy}</td> 
                                <td>&uparrow;${parseFloat(rc.bounce).toFixed(3)}</td>
                                <td>${rc.buyAmount}</td>
                            </tr>
                        `;
                            let sell = `
                            <tr style="border:none;"> 
                                <td>卖:</td>
                                <td>${rc.sell}</td> 
                                <td>&downarrow;${parseFloat(rc.dip).toFixed(3)}</td>
                                <td>${rc.sellAmount}</td>
                            </tr>
                        `;
                            let html = `
                            <table>
                                ${buy}
                                ${sell}
                            </table>
                        `;

                            if (rc.order == "sellFirst") {
                                html = `
                            <table>
                                ${sell}
                                ${buy}
                            </table>
                            `;
                            }

                            td.html(html);
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
                        if (firstRow) {
                            td.addClass("ruleStatus");
                            // td.removeClass("nowrap"); 
                        }
                    } else {
                        td.text(row[key]);
                        if (key == "现价") {
                            td.addClass("curPrice");
                        }
                    }

                    tr.append(td);
                }
                tbody.append(tr);
            }

            table.append(tbody);

            if (expanded) {
                $(".repeatCode").show();
            } else {
                $(".repeatCode").hide();
            }


            $(".ruleStatus").click(function () {
                self.onTdClicked(this);
                self.onRuleStatusClicked();
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

            $(".buySell").click(function () {
                let data = $(this).parent("tr").attr("data");
                data = JSON.parse(data);
                self.selectedData = data;
                share.currentTarget = this;
                self.toBuySell();
            })

            $(".ruleContent").click(function () {
                let data = $(this).parent("tr").attr("data");
                data = JSON.parse(data);
                self.selectedData = data;
                share.currentTarget = this;
                self.showMenu4RuleContent();
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

            if (self.task == null) {
                self.task = setInterval(async function () {
                    await self.updateData();
                }, 1000);
            }
        },

        getRuleStatus: async function () {
            let res = await share.getSync__("/stock/rule/status");
            let statusMapping = {
                "49": "待报",
                "50": "已报",
                "54": "已撤",
                "55": "部成",
                "56": "已成",
                "57": "废单"
            };
            $(".ruleStatus").each(function () {
                let td = $(this);
                let scode = td.parents("tr").attr("code").trim();
                let r = res.data[scode];
                if (r) {
                    let rc = r.rule;

                    let mapping = {
                        "toBuy": "待买",
                        "toSell": "待卖",
                        "ordered": "已下单"
                    }
                    
                    rc.minPrice = rc.minPrice ? rc.minPrice : 0;
                    rc.maxPrice = rc.maxPrice ? rc.maxPrice : 0;
                    rc.currentPrice = rc.currentPrice ? rc.currentPrice : 0;

                    let price = `
                        <tr>
                            <td colspan="7">
                            ${mapping[r.status]}: [${rc.minPrice.toFixed(3)}, ${rc.maxPrice.toFixed(3)}]: ${rc.currentPrice.toFixed(3)}
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
                    td.html(html);
                }
            })
        },

        toBuySell: async function (opt) {
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
                broker = "国信";
            }

            if (self.formatScode(self.selectedData["代码"]).indexOf("BJ") >= 0) {
                broker = "国金";
            }

            if (sellAmount == null) {
                sellAmount = Math.abs(self.selectedData["数量"]);
                buyAmount = sellAmount;
            }
            if (delta == null) {
                delta = 0.02;
            }

            let c = $("#templateBuySell").html();
            let popup = await share.popup__(null, c);
            c = $(`#${popup.id}`);
            c.find(".sname").val(`${self.selectedData["名称"]}`);
            c.find(".scode").val(`${self.selectedData["代码"]}`);
            c.find(".operationName").val(`${broker}`);
            let np = buy;
            if (np == null) {
                np = self.selectedData["价格"];
            }
            let oper = self.selectedData["买卖"];
            if (oper && oper.indexOf("买") > -1) {
                if (sell == null) {
                    sell = (np * (1 + 0.02)).toFixed(3);
                }
                if (buy == null) {
                    buy = np;
                }
                c.find(".sell").val(sell);
                c.find(".buy").val(buy);
                c.find(".sellFirst").prop("checked", true);
                c.find(".buyFirst").prop("checked", false);
            } else {
                if (buy == null) {
                    buy = (np * (1 - 0.02)).toFixed(3);
                }

                if (sell == null) {
                    sell = np;
                }
                c.find(".buy").val(buy);
                c.find(".sell").val(sell);
                c.find(".sellFirst").prop("checked", false);
                c.find(".buyFirst").prop("checked", true);
            }

            if (dip == null) {
                dip = delta;
            }
            if (bounce == null) {
                bounce = delta;
            }

            c.find(".bounce").val(bounce);
            c.find(".dip").val(dip);


            c.find(".buyAmount").val(buyAmount);
            c.find(".sellAmount").val(sellAmount);

            c.find(".buttonConfirm").click(async function () {
                let broker = c.find(".operationName").val().trim();
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

            c.find(".buttonToAll").click(function () {

            })
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
                info(`未知：${code}`);
            }

            // 返回格式化结果（如 600023.SH）
            return `${suffix}${code}`;
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
                            const curPrice = row.buy;
                            const price = data["价格"];
                            let delta = ((curPrice - price) / price * 100).toFixed(1);
                            let tp = share.getTimePassed__(row.updateTime);
                            cpl.text(`${curPrice.toFixed(3)} (${delta}% ${tp})`);

                            if (delta > 0 && data["买卖"] == "买入") {
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
                        } catch (e) {
                            console.log(e);
                        }

                    })
                }
            });
        },
        onTdClicked: function (ele) {
            let data = $(ele).parent("tr").attr("data");
            data = JSON.parse(data);
            self.selectedData = data;
            share.currentTarget = ele;
        },
        onRuleStatusClicked: async function () {
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
                let body = {
                    "broker": "国信",
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
                                <div class="marginlr10 col-xs-3 recentUp">+${ratio}%: ${(recent * (1 + ratio / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-3 recentDown">-${ratio}%: ${(recent * (1 - ratio / 100)).toFixed(2)}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+3%: ${(recent * (1 + 3 / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-3">-3%: ${(recent * (1 - 3 / 100)).toFixed(2)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+5%: ${(recent * (1 + 5 / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-3">-5%: ${(recent * (1 - 5 / 100)).toFixed(2)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">${recent}</div>
                                <div class="marginlr10 col-xs-3">+10%: ${(recent * (1 + 10 / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-3">-10%: ${(recent * (1 - 10 / 100)).toFixed(2)}</div>
                            </div>

                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最大: ${max}</div>
                                <div class="marginlr10 col-xs-4 maxUp">+${ratio}%: ${(max * (1 + ratio / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-4 maxDown">-${ratio}%: ${(max * (1 - ratio / 100)).toFixed(2)}</div>
                            </div>
                            <div class="flexrow width100p">
                                <div class="flexrow col-xs-2"></div>
                                <div class="marginlr10 col-xs-4 left">最小: ${min}</div>
                                <div class="marginlr10 col-xs-4 minUp">+${ratio}%: ${(min * (1 + ratio / 100)).toFixed(2)}</div>
                                <div class="marginlr10 col-xs-4 minDown">-${ratio}%: ${(min * (1 - ratio / 100)).toFixed(2)}</div>
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
                $(".recentUp", c).text(`+${r}%: ${(l * (1 + r / 100)).toFixed(2)}`);
                $(".recentDown", c).text(`-${r}%: ${(l * (1 - r / 100)).toFixed(2)}`);
                $(".maxUp", c).text(`+${r}%: ${(max * (1 + r / 100)).toFixed(2)}`);
                $(".maxDown", c).text(`-${r}%: ${(max * (1 - r / 100)).toFixed(2)}`);
                $(".minUp", c).text(`+${r}%: ${(min * (1 + r / 100)).toFixed(2)}`);
                $(".minDown", c).text(`-${r}%: ${(min * (1 - r / 100)).toFixed(2)}`);
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

