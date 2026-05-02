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
        // Start: midnight of selected date
        const startTime = date.getTime();
        // End: midnight of next day (exclusive)
        const endTime = startTime + 24 * 60 * 60 * 1000;

        const response = await fetch(`/video/openwrt/history?start=${startTime}&end=${endTime}`, { cache: "no-store" });
        const json = await response.json();
        const records = Array.isArray(json.data) ? json.data : [];

        if (records.length === 0) {
            document.getElementById('eventLog').innerHTML = '<div class="event-item"><span class="empty">暂无记录</span></div>';
            if (chart) chart.clear();
            return;
        }

        // Group by IP and sort events chronologically
        const byIP = {};
        for (const r of records) {
            const ts = parseTimeToTimestamp(r.time);
            const startTs = r.startTime ? parseTimeToTimestamp(r.startTime) : ts;
            if (ts === null) continue;
            if (!byIP[r.ip]) byIP[r.ip] = [];
            byIP[r.ip].push({
                status: r.status,
                time: ts,
                startTime: startTs,
                host: r.host
            });
        }

        // Process each IP to find online/offline periods
        const deviceList = Object.keys(byIP).sort((a, b) => {
            const hostA = byIP[a][0]?.host || '';
            const hostB = byIP[b][0]?.host || '';
            return hostA.localeCompare(hostB);
        });

        // Create index map for y-axis positioning
        const ipToIndex = {};
        deviceList.forEach((ip, idx) => { ipToIndex[ip] = idx; });

        const series = [];

        deviceList.forEach((ip, idx) => {
            const events = byIP[ip].sort((a, b) => a.time - b.time);
            const host = events[0]?.host || '-';
            const label = `${escapeHtml(host)} (${escapeHtml(ip)})`;

            // Group events: each online/offline pair forms a period
            // Use startTime for the bar start, time for the bar end
            for (let i = 0; i < events.length; i++) {
                const evt = events[i];

                // For online records, draw a bar from startTime to time
                if (evt.status === 'online') {
                    const barStart = evt.startTime || evt.time;
                    const barEnd = evt.time;

                    series.push({
                        name: label,
                        type: 'bar',
                        yAxisIndex: 0,
                        barMaxWidth: 40,
                        itemStyle: { color: '#2ecc71' },
                        data: [[barStart, idx], [barEnd, idx]],
                        label: {
                            show: true,
                            formatter: function() {
                                const duration = Math.round((barEnd - barStart) / 60000);
                                return duration + '分钟';
                            },
                            position: 'insideRight',
                            fontSize: 11,
                            color: '#fff'
                        }
                    });
                }

                // Mark the time when status changed (for offline, this is where the period ends)
                if (evt.status === 'offline' || (i + 1 < events.length && events[i + 1].status === 'online')) {
                    series.push({
                        name: label,
                        type: 'bar',
                        yAxisIndex: 0,
                        barMaxWidth: 5,
                        itemStyle: { color: '#f0ebe3' },
                        data: [[evt.time, idx], [evt.time, idx]],
                        silent: true
                    });
                }
            }
        });

        // Render event log
        const eventLog = document.getElementById('eventLog');
        const sortedEvents = records.sort((a, b) => b.time - a.time).slice(0, 50);
        eventLog.innerHTML = sortedEvents.map(e => `
            <div class="event-item">
                <span class="event-device event-${e.status}">
                    ${e.status === 'online' ? '↑' : '↓'} ${escapeHtml(e.host || '-')} (${escapeHtml(e.ip)})
                </span>
                <span class="event-time">${formatTimeShort(e.time)}</span>
            </div>
        `).join('');

        // Render chart
        if (!chart) {
            chart = echarts.init(document.getElementById('chart'));
        }

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function(params) {
                    if (!params || params.length === 0 || params[0].data[0] === params[0].data[1]) return '';
                    const p = params[0];
                    const start = formatTimestamp(p.data[0]);
                    const end = formatTimestamp(p.data[1]);
                    const dur = Math.round((p.data[1] - p.data[0]) / 60000);
                    const deviceName = p.seriesName;
                    return `${deviceName}<br/>上线: ${start}<br/>下线: ${end}<br/>持续: ${dur}分钟`;
                }
            },
            legend: {
                type: 'scroll',
                width: '70%',
                pageTextStyle: { color: '#73685b' },
                textStyle: { color: '#2b241c', fontSize: 12 }
            },
            grid: {
                left: '140',
                right: '80',
                top: 60,
                bottom: 40
            },
            xAxis: {
                type: 'time',
                axisLabel: {
                    formatter: function(value) {
                        return new Date(value).toLocaleString('zh-CN', {
                            month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        });
                    },
                    interval: 3600000 // 1 hour
                },
                splitLine: { show: true, lineStyle: { color: '#e8e0d0', type: 'dashed' } }
            },
            yAxis: {
                type: 'category',
                data: deviceList.map(ip => escapeHtml(byIP[ip][0]?.host || '-')),
                axisLabel: { fontSize: 11 },
                inverse: false
            },
            series: series,
            dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }]
        };

        chart.setOption(option, true);

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