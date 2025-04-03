//mairui.club: free: FF5BCE92-17AE-4A9D-A0E5-B4B0C20248C2

window.feed_list = window.feed_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        currentPrices: {},
        init: async function () {
            await self.getSqls();
            Chart.register(ChartDataLabels);
            setInterval(async function () {
                await self.getCurrentPrices();
            }, 3000);
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
                    div.click(function () {
                        share.currentTarget = this;
                        self.sqlClicked(row);
                    });

                    $("#sqls").append(div);
                }
            }
        },
        sqlClicked: function (row) {
            //弹出菜单
            let buttons = [
                {
                    text: "执行",
                    onTap: function () {
                        share.closePopup__();
                        self.exeSql(row);
                    }
                },
                {
                    text: "编辑",
                    onTap: function () {
                        share.closePopup__();
                        self.toEditSql(row);
                    }
                }
            ];

            share.popupAction__("", buttons);
        },
        toEditSql: async function (row) {
            //弹出的窗口中有两个输入框，一个是name,一个是sql，name是row.name,sql是row.sql，点击确定后，将name和sql更新到数据库
            let html = `    <div class="sqlEditor flexcolumn" style="width: 500px;">
                                <div class="flexcolumn">
                                    <input type="text" class="name" value="${row.name}" placeholder="名称">
                                    <textarea class="sql" rows="10" placeholder="sql">${row.sql}</textarea>
                                </div>
                                <div class="flexrow justify">
                                    <button class="btn btn-primary buttonSave">保存</button>
                                    <button class="btn btn-secondary buttonCancel">取消</button>
                                </div>
                            </div>
                            `;
            let popup = await share.popup__(null, html);
            let c = $(`#${popup.id}`);
            $(".buttonSave", c).click(function () {
                let name = $(".name", c).val();
                let sql = $(".sql", c).val();
                row.name = name;
                row.sql = sql;
                self.updateSql(row);
            });
            $(".buttonCancel", c).click(function () {
                popup.close();
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
        exeSql: async function (row) {
            let res = await share.postSync__("/stock/query", row);
            let table = $("#stockTable");
            if (res.error) {
                table.html(res.error);
            } else {
                self.rows = res.data;
                self.showRows(false);
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
                let cookies = $(".rows", c).val();
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
        showRows: function (expanded) {
            let table = $("#stockTable");
            let rows = self.rows;
            self.data = {};
            table.empty();
            let thead = $("<thead>");
            let tr = $("<tr>");
            let keys = ["日期", "时间", "名称", "代码", "买卖", "业务名称", "市场", "数量", "价格", "现价", "总额", "tid", "taccount", "配对"];
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
                for (let j = 0; j < keys.length; j++) {
                    let key = keys[j];
                    let td = $("<td>");
                    td.addClass("nowrap");
                    if (key == "代码") {
                        tr.addClass(`code${row[key]}`);
                        if (row[key] === lastCode) {
                            td.text(row[key]);
                            td.addClass("almostWhite");
                            self.data[row[key]].push(row);
                            tr.addClass("repeatCode");
                            tr.addClass(`repeatCode${lastCode}`);
                        } else {
                            self.data[row[key]] = [row];
                            td.text(row[key]);
                            td.addClass("bold");
                            tr.addClass("firstCode clickable");
                            td.addClass("code");
                        }

                        tr.attr("code", row[key]);
                        tr.attr("data", JSON.stringify(row));

                        lastCode = row[key];
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

            $(".firstCode").click(function () {
                let code = $(this).attr("code");
                let trs = $(`.repeatCode${code}`);
                if (trs.is(":visible")) {
                    trs.hide();
                } else {
                    trs.show();
                }
            })

            //鼠标在firstCode那些行之上时，显示一个弹出框，显示该股票的历史交易价格
            $(".code").click(function (e) {
                e.stopPropagation();
                let code = $(this).parents("tr").attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                share.popupPlacement = "top";
                let trs = $(`.repeatCode${code}`);
                trs.show();
                // 初始化折线图
                self.showChart(rows);
            })

            self.getCurrentPrices();
        },
        getCurrentPrices: async function () {
            let res = await share.getSync__(`/stock/price/current`);
            res.rows.forEach(row => {
                self.currentPrices[row.scode] = row;
                if (self.currentPrices[row.scode]) {
                    let tr = $(`[code="${row.scode}"]`);
                    tr.each(function () {
                        let th = $(this);
                        let cpl = th.find(".curPrice");
                        let data = th.attr("data");
                        data = JSON.parse(data);
                        const curPrice = row.buy;
                        const price = data["价格"];
                        let delta = ((curPrice - price) / price * 100).toFixed(1);
                        let tp = share.getTimePassed__(row.updateTime);
                        if (th.hasClass("repeatCode") && data["配对"] != "") {

                        } else {
                            cpl.text(`${curPrice} (${delta}% ${tp})`);
                        }

                        if (delta > 0 && data["买卖"] == "买入") {
                            if (data["配对"] != "") {
                                cpl.addClass("gold");
                            } else {
                                cpl.addClass("red");
                            }
                        }

                        if (delta < -5 && data["买卖"] == "买入") {
                            if (data["配对"] != "") {
                                cpl.addClass("gold");
                            } else {
                                cpl.addClass("green");
                            }
                        }

                        if (delta < 0 && data["买卖"] == "卖出") {
                            cpl.addClass("red");
                        }

                    })
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
                let r = input.val();
                let l = $('#last', c).val();
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
        },
    };

    $(function () {
        self.init();
    });

    return self;
})();
