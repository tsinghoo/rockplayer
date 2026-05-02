let currentDate = getTodayStr(); // YYMMDD format
let chart = null;

// Get YYMMDD string for a date
function getDateStr(d = new Date()) {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yy + mm + dd;
}

// Get today in YYMMDD format
function getTodayStr() {
    return getDateStr(new Date());
}

// Parse YYMMDD string to Date object
function parseDateStr(str) {
    if (!str || !/^\d{6}$/.test(str)) return null;
    const yy = parseInt(str.substring(0, 2)) + 2000;
    const mm = parseInt(str.substring(2, 4));
    const dd = parseInt(str.substring(4, 6));
    return new Date(yy, mm - 1, dd);
}

function formatTime(ts) {
    if (!ts) return "-";
    let value = Number(ts);
    if (!Number.isFinite(value) || value <= 0) return "-";
    if (value < 1000000000000) value = value * 1000;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function formatTimeShort(ts) {
    if (!ts) return "-";
    let value = String(ts);
    // Detect YYMMDDHHmm format (10 digits, e.g., "2605021123")
    if (/^\d{10}$/.test(value)) {
        const yy = parseInt(value.substring(0, 2)) + 2000;
        const mm = parseInt(value.substring(2, 4));
        const dd = parseInt(value.substring(4, 6));
        const hh = parseInt(value.substring(6, 8));
        const min = parseInt(value.substring(8, 10));
        const date = new Date(yy, mm - 1, dd, hh, min);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    // Fallback: treat as timestamp (ms or s)
    let num = Number(value);
    if (num < 1000000000000) num = num * 1000;
    const date = new Date(num);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    return String(text == null ? "" : text)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function loadClients() {
    const refreshText = document.getElementById("refreshText");
    refreshText.textContent = "刷新中...";
    try {
        const response = await fetch("/video/openwrt/clients", { cache: "no-store" });
        const json = await response.json();
        const data = json.data || {};
        const clients = Array.isArray(data.clients) ? data.clients : [];
        document.getElementById("router").textContent = data.router || "-";
        document.getElementById("deviceCount").textContent = String(clients.length);
        document.getElementById("reportedAt").textContent = formatTime(data.reportedAt);

        const stale = !data.reportedAt || Date.now() - Number(data.reportedAt) > 15000;
        const status = document.getElementById("status");
        status.textContent = stale ? "Stale" : "Online";
        status.className = stale ? "value status-warn" : "value status-ok";

        const tableBody = document.getElementById("tableBody");
        const mobileList = document.getElementById("mobileList");
        if (clients.length === 0) {
            tableBody.innerHTML = '<tr><td class="empty" colspan="3">暂无设备数据</td></tr>';
            mobileList.innerHTML = '<div class="panel device-card"><div class="empty">暂无设备数据</div></div>';
        } else {
            tableBody.innerHTML = clients.map(function (item) {
                return '<tr><td>' + escapeHtml(item.ip || "-") + '</td><td>' + escapeHtml(item.host || "-") + '</td><td>' + escapeHtml(formatTime(item.leaseEnd)) + '</td></tr>';
            }).join("");
            mobileList.innerHTML = clients.map(function (item) {
                return '<div class="panel device-card"><div class="device-head"><div class="device-name">' + escapeHtml(item.host || "-") + '</div><div class="device-expire">' + escapeHtml(formatTime(item.leaseEnd)) + '</div></div><div class="device-ip">' + escapeHtml(item.ip || "-") + '</div></div>';
            }).join("");
        }
        refreshText.textContent = "最近刷新: " + new Date().toLocaleTimeString();
    } catch (e) {
        document.getElementById("status").textContent = "Error";
        document.getElementById("status").className = "value status-warn";
        refreshText.textContent = "刷新失败: " + e.message;
    }
}

// Convert YYMMDDHHmm string to timestamp (ms) for chart processing
function parseTimeToTimestamp(timeStr) {
    if (!timeStr) return null;
    const value = String(timeStr);
    // YYMMDDHHmm format (10 digits, e.g., "2605021123")
    if (/^\d{10}$/.test(value)) {
        const yy = parseInt(value.substring(0, 2)) + 2000;
        const mm = parseInt(value.substring(2, 4));
        const dd = parseInt(value.substring(4, 6));
        const hh = parseInt(value.substring(6, 8));
        const min = parseInt(value.substring(8, 10));
        // Validate ranges
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) return null;
        return new Date(yy, mm - 1, dd, hh, min).getTime();
    }
    // Fallback: treat as timestamp (ms or s)
    let num = Number(value);
    if (isNaN(num) || num <= 0) return null;
    if (num < 1000000000000) num = num * 1000;
    return num;
}

// Format timestamp for display
function formatTimestamp(ts) {
    if (!ts || !Number.isFinite(ts) || ts <= 0) return '-';
    return new Date(ts).toLocaleString('zh-CN');
}

async function loadHistory() {
    try {
        const date = parseDateStr(currentDate);
        if (!date) return;
        const startTime = date.getTime();
        const endTime = startTime + 24 * 60 * 60 * 1000;

        const response = await fetch(`/video/openwrt/history?start=${startTime}&end=${endTime}`, { cache: "no-store" });
        const json = await response.json();
        const records = Array.isArray(json.data) ? json.data : [];

        // Build device data: collect online/offline events
        const deviceMap = new Map();
        records.forEach(rec => {
            const name = rec.host || rec.ip || 'Unknown';
            if (!deviceMap.has(name)) {
                deviceMap.set(name, []);
            }
            deviceMap.get(name).push({
                status: rec.status,
                time: parseTimeToTimestamp(rec.time),
                startTime: parseTimeToTimestamp(rec.startTime)
            });
        });

        // Convert to Gantt-style data for ECharts
        const seriesData = [];
        const categories = [];

        let idx = 0;
        deviceMap.forEach((events, name) => {
            categories.push(name);

            // Sort events by time
            events.sort((a, b) => (a.time || 0) - (b.time || 0));

            events.forEach(ev => {
                if (ev.status === 'online') {
                    // online event: start time is startTime if available, otherwise use the record's time
                    const tStart = ev.startTime || ev.time;
                    // Look ahead for the next offline event for this device
                    const nextOffline = events.find(e => e.status === 'offline' && e.time > ev.time);
                    const tEnd = nextOffline ? nextOffline.time : endTime;

                    if (tStart && tEnd && tStart < tEnd) {
                        seriesData.push({
                            name: name,
                            value: [idx, tStart, tEnd],
                            itemStyle: { color: '#2ecc71' }
                        });
                    }
                }
            });
            idx++;
        });

        // Render chart
        const chartDom = document.getElementById('chart');
        if (!chart) {
            chart = echarts.init(chartDom);
        }

        const allTimestamps = seriesData.map(d => d.value[1]).concat(seriesData.map(d => d.value[2]));
        const minTime = Math.min(...allTimestamps);
        const maxTime = Math.max(...allTimestamps);

        chart.setOption({
            tooltip: {
                formatter: function(params) {
                    const start = new Date(params.value[1]).toLocaleString('zh-CN');
                    const end = new Date(params.value[2]).toLocaleString('zh-CN');
                    return params.data.name + '<br/>上线: ' + start + '<br/>下线: ' + end;
                }
            },
            grid: {
                left: '120',
                right: '20',
                top: '20',
                bottom: '60'
            },
            xAxis: {
                type: 'time',
                min: minTime,
                max: maxTime,
                axisLabel: {
                    formatter: function(value) {
                        const d = new Date(value);
                        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
                    },
                    rotate: 0,
                    interval: Math.max(3600000, (maxTime - minTime) / 12) // at least 1 hour interval
                },
                splitLine: { show: true, lineStyle: { color: '#f0e8dc' } }
            },
            yAxis: {
                type: 'category',
                data: categories,
                axisLine: { lineStyle: { color: '#d9d0c2' } },
                axisLabel: { fontSize: 12 }
            },
            series: [{
                type: 'custom',
                renderItem: function(params, api) {
                    const categoryIndex = api.value(0);
                    const start = api.coord([api.value(1), categoryIndex]);
                    const end = api.coord([api.value(2), categoryIndex]);
                    const height = 20;

                    return {
                        type: 'rect',
                        shape: {
                            x: start[0],
                            y: start[1] - height / 2,
                            width: end[0] - start[0],
                            height: height,
                            r: 4
                        },
                        style: api.style(),
                        styleOverrides: [{
                            fill: '#2ecc71'
                        }]
                    };
                },
                encode: {
                    x: [1, 2],
                    y: 0
                },
                data: seriesData
            }]
        });

        // Render event log
        const eventLog = document.getElementById('eventLog');
        const recentEvents = records
            .filter(r => r.status)
            .sort((a, b) => (parseTimeToTimestamp(b.time) || 0) - (parseTimeToTimestamp(a.time) || 0))
            .slice(0, 50);

        if (recentEvents.length === 0) {
            eventLog.innerHTML = '<div style="padding: 14px; color: var(--muted);">暂无事件记录</div>';
        } else {
            eventLog.innerHTML = recentEvents.map(ev => {
                const name = ev.host || ev.ip || 'Unknown';
                const isOnline = ev.status === 'online';
                return '<div class="event-item">' +
                    '<span class="event-device ' + (isOnline ? 'event-online' : 'event-offline') + '">' +
                    (isOnline ? '↑' : '↓') + ' ' + escapeHtml(name) +
                    '</span>' +
                    '<span class="event-time">' + formatTimeShort(ev.time) + '</span>' +
                    '</div>';
            }).join('');
        }
    } catch (e) {
        console.error('Load history error:', e);
    }
}

// Time range buttons
document.querySelectorAll('.time-range button').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.time-range button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const dateAttr = btn.dataset.date;
        if (dateAttr === 'today') {
            currentDate = getTodayStr();
        } else if (dateAttr === 'yesterday') {
            currentDate = getDateStr(new Date(Date.now() - 86400000));
        } else if (dateAttr === '2daysago') {
            currentDate = getDateStr(new Date(Date.now() - 2 * 86400000));
        }
        // Clear custom date input
        document.getElementById('customDate').value = '';
        loadHistory();
    });
});

// Custom date input
document.getElementById('customDate').addEventListener('change', (e) => {
    const val = e.target.value; // YYYY-MM-DD
    if (!val) return;
    const [yyyy, mm, dd] = val.split('-');
    currentDate = String(parseInt(yyyy) - 2000).padStart(2, '0') + mm + dd;
    document.querySelectorAll('.time-range button').forEach(b => b.classList.remove('active'));
    loadHistory();
});

window.addEventListener('resize', () => { if (chart) chart.resize(); });

loadClients();
setInterval(loadClients, 3000);
loadHistory();
setInterval(loadHistory, 60000);