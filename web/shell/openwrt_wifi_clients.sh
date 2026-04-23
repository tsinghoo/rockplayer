#!/bin/sh

INTERVAL="${1:-3}"
UPLOAD_URL="$2"
ROUTER_NAME="$3"

if [ -z "$ROUTER_NAME" ]; then
    ROUTER_NAME="$(hostname 2>/dev/null)"
fi

if [ -z "$ROUTER_NAME" ]; then
    ROUTER_NAME="openwrt"
fi

print_header() {
    clear
    date '+%F %T'
    echo
    printf "%-15s %-18s %-18s %-20s\n" "IP" "MAC" "HOST" "LEASE_END"
    printf "%-15s %-18s %-18s %-20s\n" \
        "---------------" "------------------" "------------------" "--------------------"
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

build_clients_json() {
    leases="$1"
    printf '%s\n' "$leases" | awk '
        function esc(str) {
            gsub(/\\/, "\\\\", str);
            gsub(/"/, "\\\"", str);
            return str;
        }
        BEGIN {
            first = 1;
            printf "[";
        }
        {
            lease_end = $1 + 0;
            mac = tolower($2);
            ip = $3;
            host = $4;

            if (host == "" || host == "*") {
                host = "-";
            }

            if (!first) {
                printf ",";
            }
            first = 0;

            printf "{\"ip\":\"%s\",\"mac\":\"%s\",\"host\":\"%s\",\"leaseEnd\":%s}",
                esc(ip), esc(mac), esc(host), lease_end;
        }
        END {
            printf "]";
        }
    '
}

upload_devices() {
    leases="$1"

    if [ -z "$UPLOAD_URL" ]; then
        return
    fi

    clients_json="$(build_clients_json "$leases")"
    router_json="$(json_escape "$ROUTER_NAME")"
    body="{\"router\":\"$router_json\",\"reportedAt\":$(date +%s000),\"clients\":$clients_json}"

    if command -v curl >/dev/null 2>&1; then
        curl -sS -X POST \
            -H "Content-Type: application/json" \
            -d "$body" \
            "$UPLOAD_URL" >/dev/null 2>&1
        return
    fi

    if command -v uclient-fetch >/dev/null 2>&1; then
        uclient-fetch \
            --post-data="$body" \
            --header="Content-Type: application/json" \
            -O - \
            "$UPLOAD_URL" >/dev/null 2>&1
        return
    fi

    if command -v wget >/dev/null 2>&1; then
        wget -qO- \
            --header="Content-Type: application/json" \
            --post-data="$body" \
            "$UPLOAD_URL" >/dev/null 2>&1
        return
    fi

    echo "upload skipped: missing curl/uclient-fetch/wget"
}

print_devices() {
    leases="$(cat /tmp/dhcp.leases 2>/dev/null)"

    if [ -z "$leases" ]; then
        echo "no dhcp leases"
        return
    fi

    printf '%s\n' "$leases" | awk '
        {
            lease_end = $1;
            mac = tolower($2);
            ip = $3;
            host = $4;

            if (host == "" || host == "*") {
                host = "-";
            }
            if (lease_end == "" || lease_end == "0") {
                lease_end = "-";
            } else {
                lease_end = strftime("%F %T", lease_end);
            }

            printf "%-15s %-18s %-18s %-20s\n", ip, mac, host, lease_end;
        }
    ' | sort

    upload_devices "$leases"
}

while true; do
    print_header
    print_devices
    sleep "$INTERVAL"
done
