window.feed_list = window.feed_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        init: async function () {
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
            let keys = ["日期", "时间", "名称", "代码", "买卖", "业务名称", "市场", "数量", "价格", "总额", "tid", "taccount", "配对"];
            for (let i = 0; i < keys.length; i++) {
                let th = $("<th>");
                th.text(keys[i]);
                tr.append(th);
            }

            thead.append(tr);
            table.append(thead);

            let tbody = $("<tbody>");
            let lastCode;
            for (let i = 1; i < rows.length; i++) {
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
                            tr.attr("code", row[key]);
                            td.addClass("code");
                        }

                        lastCode = row[key];
                    } else {
                        td.text(row[key]);
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
            $(".code").click(function () {
                let code = $(this).parents("tr").attr("code");
                let rows = self.data[code];
                share.currentTarget = this;
                // 初始化折线图
                self.showChart(rows);
            })

        },
        showChart: async function (rows) {
            let max = 0;
            let min = 100000;
            let last = 0;
            let ratio = 2;
            let dates = rows.map(row => `${row.日期} ${row.时间}`);
            let prices = rows.map(row => {
                if (row.价格 > max) {
                    max = row.价格;
                }
                if (row.价格 < min) {
                    min = row.价格;
                }
                last = row.价格;
                return row.价格
            });

            let html = `
<div class="flexcolumn center">
    <div class="flexrow width100p">
        <div class="flexcolumn center">
            <input type="text" id="ratio" style="width:40px;" value="${ratio}">
        </div>
        <div class="flexcolumn center">
            <div class="flexrow width100p">
                <div class="marginlr10">最近: <input style="width:60px;" type="text" id="last" value="${last}"></div>
                <div class="marginlr10 recentUp">+${ratio}%: ${last * (1 + ratio / 100)}</div>
                <div class="marginlr10 recentDown">-${ratio}%: ${last * (1 - ratio / 100)}</div>
            </div>
            <div class="flexrow width100p">
                <div class="marginlr10">最大: ${max}</div>
                <div class="marginlr10 maxUp">+${ratio}%: ${max * (1 + ratio / 100)}</div>
                <div class="marginlr10 maxDown">-${ratio}%: ${max * (1 - ratio / 100)}</div>
            </div>
            <div class="flexrow width100p">
                <div class="marginlr10">最小: ${min}</div>
                <div class="marginlr10 minUp">+${ratio}%: ${min * (1 + ratio / 100)}</div>
                <div class="marginlr10 minDown">-${ratio}%: ${min * (1 - ratio / 100)}</div>
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
            input.change(function () {
                let r = input.val();
                let l = $('#last', c).val();
                $(".recentUp", c).text(`+${r}%: ${l * (1 + r / 100)}`);
                $(".recentDown", c).text(`-${r}%: ${l * (1 - r / 100)}`);
                $(".maxUp", c).text(`+${r}%: ${max * (1 + r / 100)}`);
                $(".maxDown", c).text(`-${r}%: ${max * (1 - r / 100)}`);
                $(".minUp", c).text(`+${r}%: ${min * (1 + r / 100)}`);
                $(".minDown", c).text(`-${r}%: ${min * (1 - r / 100)}`);
            });
            $('#last', c).change(function () {
                let r = input.val();
                let l = $('#last', c).val();
                $(".recentUp", c).text(`+${r}%: ${l * (1 + r / 100)}`);
                $(".recentDown", c).text(`-${r}%: ${l * (1 - r / 100)}`);
                $(".maxUp", c).text(`+${r}%: ${max * (1 + r / 100)}`);
                $(".maxDown", c).text(`-${r}%: ${max * (1 - r / 100)}`);
                $(".minUp", c).text(`+${r}%: ${min * (1 + r / 100)}`);
                $(".minDown", c).text(`-${r}%: ${min * (1 - r / 100)}`);
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