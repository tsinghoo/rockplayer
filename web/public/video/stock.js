window.feed_list = window.feed_list || (function () {
    var share = window.mhgl_share;
    var page = window.mhgl_page;
    var navbar = parent.navFrame ? parent.navFrame.mhgl_navbar : window.mhgl_navbar;
    var self = {
        data: {},
        rows: [],
        init: async function () {
            let res = await share.getSync__("/stock/sqls");
            if (res.error) {
                $("#sqls").html(res.error);
            } else {
                let rows = res.data;
                //将rows里的数据显示在id是sqls的div里，并且每行的内容是rows的第i个元素，点击每行的时候拿对应的sql去调用"/stock/query"接口，并且将返回的数据显示在表格里
                for (let i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    let div = $("<div class='clickable padding4'>");
                    div.text(row.name);
                    div.click(function () {
                        self.sqlClicked(row);
                    });

                    $("#sqls").append(div);
                }
            }

            self.bindEvents();
        },
        sqlClicked: function (row) {
            self.exeSql(row);
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
            let keys = Object.keys(rows[0]);
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
                    if (key == "代码") {
                        tr.addClass(`code${row[key]}`);
                        if (row[key] === lastCode) {
                            //td.text(row[key]);
                            self.data[row[key]].push(row);
                            tr.addClass("repeatCode");
                            tr.addClass(`repeatCode${lastCode}`);
                        } else {
                            self.data[row[key]] = [row];
                            td.text(row[key]);
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
            // 提取日期和价格数据
            let dates = rows.map(row => row.日期);
            let prices = rows.map(row => row.价格);

            let html = `<canvas id="priceChart" style="width: 100%; height: 400px;"></canvas>`;
            let popup = await share.popup__(null, html);
            let c = $(`#${popup.id}`);

            // 获取 canvas 元素
            let ctx = $('#priceChart', c)[0].getContext('2d');

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
                        fill: false
                    }]
                },
                options: {
                    responsive: true,  // 自适应
                    scales: {
                        x: {
                            type: 'time', // 设置 X 轴为时间类型
                            time: {
                                unit: 'day',  // 按天显示
                                tooltipFormat: 'll', // 显示工具提示格式
                                displayFormats: {
                                    day: 'yyyyMMdd', // 显示日期的格式
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