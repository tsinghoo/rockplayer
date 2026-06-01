#!/usr/bin/env python3
import base64
import json
import os
import re
import sqlite3
import sys
import threading
import time
import traceback
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlparse


PASSCODE = "995560"


def now_ms() -> int:
    return int(time.time() * 1000)


def time_format(value: Any = None, fmt: Optional[str] = None) -> str:
    if value is None:
        dt = datetime.now()
    elif isinstance(value, datetime):
        dt = value
    else:
        if isinstance(value, str) and value.isdigit():
            value = int(value)
        if isinstance(value, (int, float)):
            if value > 10**12:
                dt = datetime.fromtimestamp(value / 1000.0)
            else:
                dt = datetime.fromtimestamp(value)
        else:
            return ""
    if fmt is None:
        fmt = "%Y-%m-%d %H:%M:%S"
    mapping = {
        "yyyyMMdd": "%Y%m%d",
        "yyMMddhhmm": "%y%m%d%H%M",
        "yyMMdd": "%y%m%d",
        "hh:mm:ss": "%H:%M:%S",
        "yyyy-MM-dd hh:mm:ss": "%Y-%m-%d %H:%M:%S",
        "hh:mm": "%H:%M",
    }
    return dt.strftime(mapping.get(fmt, fmt))


def add0(v: int) -> str:
    return f"{int(v):02d}"


def strip_scode_suffix(scode: Any) -> str:
    if scode is None:
        return ""
    scode = str(scode).strip().upper()
    idx = scode.rfind(".")
    return scode[:idx] if idx > 0 else scode


def has_scode_suffix(scode: Any) -> bool:
    return bool(re.match(r"^[^.]+\.[A-Za-z]+$", str(scode or "").strip()))


def get_market(stock_code: Any) -> str:
    code = strip_scode_suffix(stock_code).strip()
    if not code:
        return ""
    if len(code) == 6:
        if re.match(r"^(600|601|603|605|688|900|51|58|56)\d+$", code):
            return "SH"
        if re.match(r"^(000|001|002|003|30|15|16|12|3)\d+$", code):
            return "SZ"
        if re.match(r"^(8|43|83|87|88|92)\d+$", code):
            return "BJ"
    if re.match(r"^\d{4,5}$", code) or re.match(r"^0[0-9]\d{3}$", code):
        return "HK"
    if "USDT" in code or "BTC" in code or "ETH" in code:
        return "EC"
    return ""


def normalize_scode(scode: Any, min_length: int = 5) -> str:
    if scode is None:
        return ""
    scode = str(scode).strip().upper()
    if not scode:
        return ""
    if has_scode_suffix(scode):
        code, suffix = scode.split(".", 1)
        suffix = suffix.replace("HGT", "HK").replace("SGT", "HK").upper()
        if code.isdigit() and len(code) < min_length:
            code = ("000000" + code)[-min_length:]
        return f"{code}.{suffix}"
    code = scode
    if code.isdigit() and len(code) < min_length:
        code = ("000000" + code)[-min_length:]
    suffix = get_market(code)
    return f"{code}.{suffix}" if suffix else code


def format_scode(scode: Any) -> Optional[str]:
    code = normalize_scode(scode)
    return code if code and has_scode_suffix(code) else None


def get_scode_type(scode: Any) -> int:
    return 1 if str(scode or "").strip().upper().startswith("O_") else 0


def normalize_type(value: Any, scode: Any) -> int:
    try:
        return int(value)
    except Exception:
        return get_scode_type(scode)


def get_scode_aliases(scode: Any, min_length: int = 5) -> List[str]:
    values = []
    normalized = normalize_scode(scode, min_length)
    raw = strip_scode_suffix(scode)
    if normalized:
        values.append(normalized)
    if raw and raw not in values:
        values.append(raw)
    return values


def normalize_db_row_scodes(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not row:
        return row
    if row.get("scode") is not None:
        row["scode"] = normalize_scode(row["scode"])
    if row.get("stock_code") is not None:
        row["stock_code"] = normalize_scode(row["stock_code"])
    return row


def normalize_db_rows_scodes(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    for row in rows:
        normalize_db_row_scodes(row)
    return rows


def quote_sqlite_identifier(name: str) -> str:
    return '"' + str(name).replace('"', '""') + '"'


def normalize_rule_ratio(value: Any, fallback: float) -> float:
    try:
        result = float(value)
        if result > 0:
            return result
    except Exception:
        pass
    return fallback


def convert_if_integer(number: Any) -> Any:
    value = round(float(number), 3)
    if abs(value - int(value)) < 1e-9:
        return int(value)
    return value


def parse_trade_timestamp(tday: Any, ttime: Any) -> Optional[int]:
    if tday is None or ttime is None:
        return None
    tday = str(tday).strip()
    ttime = str(ttime).strip()
    if not re.match(r"^\d{8}$", tday):
        return None
    parts = ttime.split(":")
    if len(parts) != 3:
        digits = re.sub(r"\D", "", ttime)
        if len(digits) == 5:
            digits = "0" + digits
        if len(digits) < 6:
            digits = digits.ljust(6, "0")
        if len(digits) >= 6:
            parts = [digits[:2], digits[2:4], digits[4:6]]
    if len(parts) != 3:
        return None
    dt = datetime(
        int(tday[:4]),
        int(tday[4:6]),
        int(tday[6:8]),
        int(parts[0] or 0),
        int(parts[1] or 0),
        int(parts[2] or 0),
    )
    return int(dt.timestamp() * 1000)


class Db:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.lock = threading.RLock()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

    def _to_dicts(self, cursor: sqlite3.Cursor) -> List[Dict[str, Any]]:
        return [dict(row) for row in cursor.fetchall()]

    def run(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        with self.lock:
            try:
                cur = self.conn.execute(sql, params or [])
                self.conn.commit()
                return {"changes": cur.rowcount, "lastrowid": cur.lastrowid}
            except Exception as exc:
                return {"error": str(exc)}

    def executescript(self, sql: str) -> Dict[str, Any]:
        with self.lock:
            try:
                self.conn.executescript(sql)
                self.conn.commit()
                return {}
            except Exception as exc:
                return {"error": str(exc)}

    def all(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        with self.lock:
            try:
                cur = self.conn.execute(sql, params or [])
                return {"rows": self._to_dicts(cur)}
            except Exception as exc:
                return {"error": str(exc), "rows": []}

    def get(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            try:
                cur = self.conn.execute(sql, params or [])
                row = cur.fetchone()
                return dict(row) if row else None
            except Exception:
                return {"error": traceback.format_exc()}


class StockService:
    def __init__(self, directory_path: str):
        self.directory_path = directory_path
        self.db = Db(os.path.join(directory_path, "stock.db"))
        self.rules: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self.g_actions: List[Dict[str, Any]] = []
        self.screen_path = os.path.join(directory_path, "screen.json")
        self.worker_create_rule = {
            "id": 0,
            "scode": None,
            "max": 1,
            "type": None,
            "priceDelay": 30,
            "succeeded": [],
            "failed": [],
        }
        self.auto_action_start_time = {
            "buy": {"minutes": 0, "value": "00:00"},
            "sell": {"minutes": 0, "value": "00:00"},
            "loadedAt": 0,
        }
        self.auto_action_blocked_log_minute = {"buy": -1, "sell": -1}
        self.auto_action_blocked_info = {
            "count": 0,
            "lastAt": 0,
            "lastScode": "",
            "lastSname": "",
            "lastBroker": "",
            "lastActionType": "",
            "lastStartTime": "",
        }
        self.temp_auto_actions: Dict[str, int] = {}
        self.upgrade_db()
        self.reload_rules()

    def insert_or_replace(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        keys = list(row.keys())
        cols = ",".join(keys)
        placeholders = ",".join(["?"] * len(keys))
        values = [json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in row.values()]
        return self.db.run(f"insert or replace into {table}({cols}) values({placeholders})", values)

    def insert_or_ignore(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        keys = list(row.keys())
        cols = ",".join(keys)
        placeholders = ",".join(["?"] * len(keys))
        values = [json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for v in row.values()]
        return self.db.run(f"insert or ignore into {table}({cols}) values({placeholders})", values)

    def get_typed_scode_query(self, scode: Any, type_value: Any, min_length: int = 5) -> Dict[str, Any]:
        aliases = get_scode_aliases(scode, min_length)
        normalized = normalize_type(type_value, scode)
        return {
            "type": normalized,
            "aliases": aliases,
            "candidateIds": aliases[:],
            "scodePlaceholders": ",".join(["?"] * len(aliases)),
            "idPlaceholders": ",".join(["?"] * len(aliases)),
        }

    def get_stock_basic_by_scode(self, scode: Any, type_value: Any = None) -> Optional[Dict[str, Any]]:
        query = self.get_typed_scode_query(scode, type_value)
        row = self.db.get(
            f"select * from tStockBasic where type=? and (scode in ({query['scodePlaceholders']}) or id in ({query['idPlaceholders']})) limit 1",
            [query["type"]] + query["aliases"] + query["candidateIds"],
        )
        return normalize_db_row_scodes(row)

    def update_stock_basic_by_scode(self, fields: Dict[str, Any]) -> Dict[str, Any]:
        scode = normalize_scode(fields.get("scode"))
        if not scode:
            return {"error": "scode required"}
        query = self.get_typed_scode_query(scode, fields.get("type"))
        row = dict(fields)
        row["scode"] = scode
        type_value = query["type"]
        target = self.db.get(
            f"select id from tStockBasic where type=? and (scode in ({query['scodePlaceholders']}) or id in ({query['idPlaceholders']})) limit 1",
            [type_value] + query["aliases"] + query["candidateIds"],
        )
        if target and not target.get("error"):
            columns = list(row.keys())
            assignments = ", ".join([f"{column}=?" for column in columns])
            return self.db.run(
                f"update tStockBasic set {assignments} where id=?",
                [row[column] for column in columns] + [target["id"]],
            )
        row["id"] = scode
        row["type"] = type_value
        row["market"] = get_market(scode)
        return self.insert_or_replace("tStockBasic", row)

    def normalize_rule_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        normalize_db_row_scodes(row)
        row["type"] = normalize_type(row.get("type"), row.get("scode"))
        if isinstance(row.get("rule"), str):
            try:
                row["rule"] = json.loads(row["rule"])
            except Exception:
                row["rule"] = {}
        return row

    def normalize_start_time(self, value: Any) -> Dict[str, Any]:
        value = str(value or "").strip()
        if not value:
            return {"minutes": 0, "value": "00:00"}
        m = re.match(r"^(\d{1,2}):(\d{2})$", value)
        if not m:
            return {"error": "bad startTime"}
        hh = int(m.group(1))
        mm = int(m.group(2))
        if hh < 0 or hh > 23 or mm < 0 or mm > 59:
            return {"error": "bad startTime"}
        return {"minutes": hh * 60 + mm, "value": f"{hh:02d}:{mm:02d}"}

    def refresh_auto_action_start_time(self) -> None:
        if self.auto_action_start_time["loadedAt"] > now_ms() - 10000:
            return
        buy_row = self.db.get("select value from config where key='autoActionStartTimeBuy'")
        sell_row = self.db.get("select value from config where key='autoActionStartTimeSell'")
        self.auto_action_start_time["buy"] = self.normalize_start_time((buy_row or {}).get("value"))
        self.auto_action_start_time["sell"] = self.normalize_start_time((sell_row or {}).get("value"))
        self.auto_action_start_time["loadedAt"] = now_ms()

    def grant_temp_auto_action(self, scode: str) -> Dict[str, Any]:
        normalized = normalize_scode(scode)
        self.temp_auto_actions[normalized] = now_ms() + 5 * 60 * 1000
        return {"scode": normalized}

    def consume_temp_auto_action(self, scode: str) -> Optional[Dict[str, Any]]:
        normalized = normalize_scode(scode)
        expire_at = self.temp_auto_actions.get(normalized)
        if expire_at and expire_at >= now_ms():
            del self.temp_auto_actions[normalized]
            return {"scode": normalized}
        if expire_at:
            del self.temp_auto_actions[normalized]
        return None

    def get_auto_action_gate_info(self) -> Dict[str, Any]:
        self.refresh_auto_action_start_time()
        return {
            "buyStartTime": self.auto_action_start_time["buy"]["value"],
            "sellStartTime": self.auto_action_start_time["sell"]["value"],
            "blocked": self.auto_action_blocked_info,
        }

    def allow_auto_create_action(self, row: Dict[str, Any], action_type: Optional[str] = None) -> bool:
        self.refresh_auto_action_start_time()
        if action_type is None:
            action_type = "sell" if row.get("action") == "sell" else "buy"
        gate = self.auto_action_start_time[action_type]
        if gate["minutes"] <= 0:
            return True
        now = datetime.now()
        minute = now.hour * 60 + now.minute
        if minute >= gate["minutes"]:
            return True
        temp_allowed = self.consume_temp_auto_action(row.get("scode", ""))
        if temp_allowed is not None:
            return True
        self.auto_action_blocked_info = {
            "count": self.auto_action_blocked_info["count"] + 1,
            "lastAt": now_ms(),
            "lastScode": row.get("scode", ""),
            "lastSname": row.get("sname", ""),
            "lastBroker": row.get("broker", ""),
            "lastActionType": action_type,
            "lastStartTime": gate["value"],
        }
        return False

    def update_price_to_rule(self, scode: str, price: float) -> None:
        rs = self.rules.get(normalize_scode(scode))
        if not rs:
            return
        for rule_row in rs.values():
            rule = rule_row["rule"]
            rule["currentPrice"] = price
            if rule.get("maxPrice") is None or price > rule["maxPrice"]:
                rule["maxPrice"] = price
            if rule.get("minPrice") is None or price < rule["minPrice"]:
                rule["minPrice"] = price

    def reload_rules(self) -> None:
        result = self.db.all("select * from tTradeRule where closed=0")
        if result.get("error"):
            return
        self.rules = {}
        for rule in result["rows"]:
            self.reload_rule(rule)

    def reload_rule(self, rule_row: Optional[Dict[str, Any]]) -> None:
        if not rule_row:
            return
        r = self.normalize_rule_row(rule_row)
        now = now_ms()
        if r.get("expireTime") is not None and int(r["expireTime"]) < now:
            self.db.run("update tRuleAction set done=-1 where ruleId=?", [r["id"]])
            self.db.run("update tTradeRule set closed=1 where id=?", [r["id"]])
            self.rules.get(r["scode"], {}).pop(r["broker"], None)
            return
        if int(r.get("closed", 0) or 0) != 0:
            self.rules.get(r["scode"], {}).pop(r["broker"], None)
            return
        self.rules.setdefault(r["scode"], {})[r["broker"]] = r
        sb = self.get_stock_basic_by_scode(r["scode"], r["type"])
        if sb:
            r["rule"]["currentPrice"] = sb.get("buy")
        r["actions"] = []
        ra = self.db.get("select * from tRuleAction where ruleId=? order by createTime desc limit 1", [r["id"]])
        if ra and not ra.get("error"):
            normalize_db_row_scodes(ra)
            r["actions"].append(ra)
            done = int(ra.get("done", 0) or 0)
            if done in (0, 1):
                r["status"] = "ordered"
            elif done == -1:
                r["status"] = "cancelled"
            elif done == 2:
                r["status"] = "done"
                self.db.run("update tTradeRule set closed=1 where id=?", [r["id"]])
                self.rules.get(r["scode"], {}).pop(r["broker"], None)
        else:
            order = r["rule"].get("order")
            if order == "buyFirst":
                r["status"] = "toBuy"
            elif order == "sellFirst":
                r["status"] = "toSell"
            else:
                r["status"] = "todo"
        self.check_rule([r["scode"]])

    def try_to_sell(self, rule_row: Dict[str, Any]) -> bool:
        rule = rule_row["rule"]
        price = 0.0
        dip = float(rule.get("dip", 0) or 0)
        current = float(rule.get("currentPrice", 0) or 0)
        sell = float(rule.get("sell", 0) or 0)
        max_price = float(rule.get("maxPrice", 0) or 0)
        if dip < 0:
            price = sell
        elif current >= sell and max_price >= sell:
            if max_price - current >= dip:
                price = current
        if price <= 0:
            return False
        action = {
            "id": f"{rule_row['id']}-{now_ms()}",
            "ruleId": rule_row["id"],
            "scode": rule["scode"],
            "sname": rule["sname"],
            "action": "sell",
            "broker": rule["broker"],
            "price": price,
            "amount": rule.get("sellAmount", 0),
            "orderNo": "",
            "done": 0,
            "createTime": now_ms(),
            "type": normalize_type(rule_row.get("type"), rule["scode"]),
        }
        self.insert_or_replace("tRuleAction", action)
        rule_row["status"] = "ordered"
        rule_row.setdefault("actions", []).append(action)
        return True

    def try_to_buy(self, rule_row: Dict[str, Any]) -> bool:
        rule = rule_row["rule"]
        buy_price = 0.0
        bounce = float(rule.get("bounce", 0) or 0)
        current = float(rule.get("currentPrice", 0) or 0)
        buy = float(rule.get("buy", 0) or 0)
        min_price = float(rule.get("minPrice", current) or current)
        if bounce < 0:
            buy_price = buy
        elif current <= buy and min_price <= buy and current - min_price >= bounce:
            buy_price = current
        if buy_price <= 0:
            return False
        if rule_row.get("actions"):
            latest = rule_row["actions"][-1].get("createTime", 0)
            if now_ms() - int(latest) < 1000:
                return False
        action = {
            "id": f"{rule_row['id']}-{now_ms()}",
            "ruleId": rule_row["id"],
            "scode": rule["scode"],
            "sname": rule["sname"],
            "action": "buy",
            "broker": rule["broker"],
            "price": buy_price,
            "amount": rule.get("buyAmount", 0),
            "orderNo": "",
            "done": 0,
            "createTime": now_ms(),
            "type": normalize_type(rule_row.get("type"), rule["scode"]),
        }
        self.insert_or_replace("tRuleAction", action)
        rule_row["status"] = "ordered"
        rule_row.setdefault("actions", []).append(action)
        return True

    def check_rule(self, scodes: List[str]) -> None:
        now = now_ms()
        for scode in scodes:
            normalized = normalize_scode(scode)
            rs = self.rules.get(normalized) or {}
            for rule_row in list(rs.values()):
                if rule_row.get("expireTime") is not None and int(rule_row["expireTime"]) < now:
                    self.db.run("update tRuleAction set done=-1 where ruleId=?", [rule_row["id"]])
                    self.db.run("update tTradeRule set closed=1 where id=?", [rule_row["id"]])
                    self.rules.get(rule_row["scode"], {}).pop(rule_row["broker"], None)
                    continue
                status = rule_row.get("status")
                if status == "todo":
                    if not self.try_to_buy(rule_row):
                        self.try_to_sell(rule_row)
                elif status == "toBuy":
                    self.try_to_buy(rule_row)
                elif status == "toSell":
                    self.try_to_sell(rule_row)

    def get_ma(self, day_count: int, rows_1d: List[Dict[str, Any]]) -> List[float]:
        result = []
        for i in range(0, len(rows_1d) - day_count):
            segment = rows_1d[i : i + day_count]
            result.append(round(sum(float(d["close"]) for d in segment) / day_count, 3))
        return result

    def calc_1d_cci(self, data: List[Dict[str, Any]], period: int, on_calced=None) -> None:
        typical_prices = [(float(x["high"]) + float(x["low"]) + float(x["close"])) / 3 for x in data]
        for i in range(0, len(data) - period + 1):
            if i > 0 and float(data[i].get("cci", -800)) != -800:
                continue
            tps = typical_prices[i : i + period]
            sma = sum(tps) / period
            mad = sum(abs(tp - sma) for tp in tps) / period
            cci = 0 if mad == 0 else (typical_prices[i] - sma) / (0.015 * mad)
            data[i]["cci"] = round(cci, 2)
            if on_calced:
                on_calced(data[i])

    def ensure_data_1d_is_enough(self, scode: str, sname: str, prev_res=None):
        if prev_res is None:
            prev_res = self.db.all("select * from t1d where scode=? order by time desc limit 30", [scode])
        rows = prev_res.get("rows") or []
        if len(rows) < 3:
            prev_res["reason"] = "no 1d data"
            return prev_res
        if str(rows[0]["time"]) != time_format(datetime.now(), "yyyyMMdd"):
            prev_res["reason"] = "no today 1d"
            return prev_res
        return prev_res

    def ensure_low_price_increasing(self, scode: str, sname: str, prev_res=None, start: int = 0, end: int = 1):
        prev_res = self.ensure_data_1d_is_enough(scode, sname, prev_res)
        if prev_res.get("reason"):
            return prev_res
        for i in range(start, end):
            if float(prev_res["rows"][i]["low"]) < float(prev_res["rows"][i + 1]["low"]):
                prev_res["reason"] = f"{i}.low < {i + 1}.low"
                return prev_res
        return prev_res

    def ensure_high_price_increasing(self, scode: str, sname: str, prev_res=None, start: int = 0, end: int = 1):
        prev_res = self.ensure_data_1d_is_enough(scode, sname, prev_res)
        if prev_res.get("reason"):
            return prev_res
        for i in range(start, end):
            if float(prev_res["rows"][i]["high"]) < float(prev_res["rows"][i + 1]["high"]):
                prev_res["reason"] = f"{i}.high < {i + 1}.high"
                return prev_res
        return prev_res

    def ensure_above_ma5(self, scode: str, sname: str, prev_res=None, start: int = 0, end: int = 1):
        prev_res = self.ensure_data_1d_is_enough(scode, sname, prev_res)
        if prev_res.get("reason"):
            return prev_res
        prev_res["ma5"] = prev_res.get("ma5") or self.get_ma(5, prev_res["rows"])
        days = 0
        for i in range(start, end):
            if prev_res["ma5"][i] < (float(prev_res["rows"][i]["high"]) + float(prev_res["rows"][i]["low"])) / 2:
                days += 1
        if days < end - start:
            prev_res["reason"] = f"larger than ma5 {days}/{end - start} days"
        return prev_res

    def is_cci_cross_up_n100(self, scode: str, sname: str, prev_res=None):
        prev_res = self.ensure_data_1d_is_enough(scode, sname, prev_res)
        if prev_res.get("reason"):
            return prev_res
        self.calc_1d_cci(prev_res["rows"], 14)
        for i in range(0, 2):
            if float(prev_res["rows"][i]["cci"]) >= -100 and float(prev_res["rows"][i + 1]["cci"]) <= -100:
                for j in range(i - 1, -1, -1):
                    if float(prev_res["rows"][j]["cci"]) < float(prev_res["rows"][j + 1]["cci"]):
                        prev_res["reason"] = f"{j}.cci({prev_res['rows'][j]['cci']}) < {j + 1}.cci({prev_res['rows'][j + 1]['cci']})"
                        return prev_res
                return prev_res
        prev_res["reason"] = "no cci cross up -100"
        return prev_res

    def set_buy_price_by_sell(self, rc: Dict[str, Any], max_delta: float) -> None:
        rc["buy"] = rc["sell"] * (1 - 0.02)
        if rc["sell"] - rc["buy"] > max_delta:
            rc["buy"] = rc["sell"] - max_delta
        rc["buy"] = round(rc["buy"], 3)
        rc["sell"] = round(rc["sell"], 3)

    def set_sell_price_by_buy(self, rc: Dict[str, Any], max_delta: float) -> None:
        rc["sell"] = rc["buy"] * (1 + 0.02)
        if rc["sell"] - rc["buy"] > max_delta:
            rc["sell"] = rc["buy"] + max_delta
        rc["buy"] = round(rc["buy"], 3)
        rc["sell"] = round(rc["sell"], 3)

    def save_create_rule_failure(self, scode: str, error_text: str) -> None:
        query = self.get_typed_scode_query(scode, None)
        self.db.run(
            f"update tStockBasic set autoCreateRuleFail=? where type=? and (scode in ({query['scodePlaceholders']}) or id in ({query['idPlaceholders']}))",
            [error_text, query["type"]] + query["aliases"] + query["candidateIds"],
        )

    def auto_create_rule(self, scode: str, stock_basic_info=None, not_batch: bool = False) -> Dict[str, Any]:
        scode = normalize_scode(scode)
        type_value = get_scode_type(scode)
        stock_basic_info = stock_basic_info or self.get_stock_basic_by_scode(scode, type_value)
        normalize_db_row_scodes(stock_basic_info)
        if not stock_basic_info:
            return {"error": "stock basic missing", "sname": scode}
        sname = stock_basic_info.get("sname") or scode
        aliases = get_scode_aliases(scode)
        placeholders = ",".join(["?"] * len(aliases))
        trade = self.db.get(
            f"select * from tstock where scode in ({placeholders}) and deleted=0 order by tday desc, ttime desc limit 1",
            aliases,
        )
        if not trade:
            return {"error": "no trade history", "sname": sname}
        normalize_db_row_scodes(trade)
        old_rule = self.db.get(
            f"select * from tTradeRule where type=? and scode in ({placeholders}) and broker=?",
            [type_value] + aliases + [trade["operationName"]],
        )
        if old_rule and int(old_rule.get("closed", 0) or 0) == 0:
            return {"error": "I:exists", "sname": sname}
        if stock_basic_info.get("updateTime", 0) < now_ms() - 1000 * self.worker_create_rule["priceDelay"]:
            return {"error": "price is old", "sname": sname}
        amount = abs(float(trade.get("tamount", 0) or 0))
        broker = trade.get("operationName")
        if broker not in ("BNB", "OKX"):
            volume_multiple = int(stock_basic_info.get("volumeMultiple") or 100)
            if amount < volume_multiple:
                amount = volume_multiple
            if amount != 50 and amount < 100:
                amount = 100
        current_price = float(stock_basic_info.get("buy", 0) or 0)
        min_delta, max_delta, delta_ratio = 0.5, 2, 0.02
        if current_price < 30:
            min_delta, max_delta, delta_ratio = 0.3, 1, 0.04
        elif current_price >= 300:
            min_delta, max_delta, delta_ratio = 1, 3, 0.01
        if broker in ("BNB", "OKX"):
            min_delta, max_delta = 1, 20000
        dip = normalize_rule_ratio(stock_basic_info.get("dip"), 0.02)
        bounce = normalize_rule_ratio(stock_basic_info.get("bounce"), 0.02)
        last_price = float(trade.get("tprice", 0) or 0)
        buy_delta = delta_ratio * last_price
        sell_delta = delta_ratio * last_price
        buy_price = max(last_price - buy_delta, last_price - max_delta)
        sell_price = min(max(last_price + sell_delta, last_price + min_delta), last_price + max_delta)
        buy_price = round(buy_price, 3)
        sell_price = round(sell_price, 3)
        rc = None
        if broker == "广发":
            return {"error": "I:need buy by hand", "sname": sname}
        if float(trade.get("tamount", 0) or 0) == 0:
            all_data = self.is_cci_cross_up_n100(scode, sname)
            if all_data.get("reason"):
                return {"error": "I:buy by hand", "sname": sname}
            return {"error": "cci buy", "sname": sname}
        if "卖" in str(trade.get("operationDirection", "")):
            if not not_batch and self.worker_create_rule["type"] == "toSell":
                return {"error": "toSell", "sname": sname}
            if old_rule:
                try:
                    old_rule["rule"] = json.loads(old_rule["rule"])
                except Exception:
                    pass
                if old_rule.get("rule", {}).get("buyAmount", 1) < 1:
                    return {"error": "I:buy by hand", "sname": sname}
            all_data = self.ensure_data_1d_is_enough(scode, sname)
            if current_price <= buy_price:
                all_data = self.ensure_high_price_increasing(scode, sname, all_data, 0, 1)
                all_data = self.ensure_low_price_increasing(scode, sname, all_data, 0, 2)
                all_data = self.ensure_above_ma5(scode, sname, all_data, 0, 1)
                if all_data.get("reason"):
                    return {"error": all_data["reason"], "sname": sname}
                avg_price = (current_price + float(all_data["rows"][0]["low"])) / 2
                min_price = min(avg_price, current_price * (1 - delta_ratio / 2))
                if buy_price > min_price:
                    buy_price = round(min_price, 3)
                rc = {
                    "buy": buy_price,
                    "bounce": bounce,
                    "buyDelta": buy_delta,
                    "sellDelta": sell_delta,
                    "buyAmount": amount,
                    "sell": current_price,
                    "dip": dip,
                    "sellAmount": amount,
                    "scode": scode,
                    "sname": trade["sname"],
                    "broker": broker,
                    "order": "buyFirst",
                    "auto": 1,
                    "expireHours": 12,
                }
                self.set_sell_price_by_buy(rc, max_delta)
            else:
                all_data = self.ensure_low_price_increasing(scode, sname, all_data, 0, 1)
                all_data = self.ensure_above_ma5(scode, sname, all_data, 0, 1)
                if all_data.get("reason"):
                    return {"error": all_data["reason"], "sname": sname}
                rc = {
                    "buy": buy_price,
                    "bounce": bounce,
                    "buyDelta": buy_delta,
                    "sellDelta": sell_delta,
                    "buyAmount": amount,
                    "sell": last_price,
                    "dip": dip,
                    "sellAmount": amount,
                    "scode": scode,
                    "sname": trade["sname"],
                    "broker": broker,
                    "order": "buyFirst",
                    "auto": 1,
                    "expireHours": 12,
                }
                if current_price < buy_price:
                    rc["buy"] = current_price * (1 - 0.01)
                    if current_price - rc["buy"] > min_delta:
                        rc["buy"] = current_price - min_delta
                if rc["buy"] * rc["buyAmount"] < 10000:
                    rc["broker"] = "国信"
                self.set_sell_price_by_buy(rc, max_delta)
        elif "买" in str(trade.get("operationDirection", "")):
            if not not_batch and self.worker_create_rule["type"] == "toBuy":
                return {"error": "toBuy", "sname": sname}
            if old_rule:
                try:
                    old_rule["rule"] = json.loads(old_rule["rule"])
                except Exception:
                    pass
                if old_rule.get("rule", {}).get("sellAmount", 1) < 1:
                    return {"error": "I:sell by hand", "sname": sname}
            rc = {
                "buy": last_price,
                "bounce": bounce,
                "buyDelta": buy_delta,
                "sellDelta": sell_delta,
                "buyAmount": amount,
                "sell": sell_price,
                "dip": dip,
                "sellAmount": amount,
                "scode": scode,
                "sname": trade["sname"],
                "broker": broker,
                "order": "sellFirst",
                "auto": 1,
                "expireHours": 12,
            }
            if current_price > (rc["sell"] + last_price) / 2:
                rc["sell"] = current_price * (1 + delta_ratio)
                if rc["sell"] - current_price > max_delta / 2:
                    rc["sell"] = current_price + max_delta / 2
                self.set_buy_price_by_sell(rc, max_delta)
        else:
            return {"error": "bad trade direction", "sname": sname}
        rule_id = f"{scode}.{rc['broker']}"
        expire_time = datetime.now().replace(hour=16, minute=10, second=0, microsecond=0)
        rule_row = {
            "id": rule_id,
            "broker": rc["broker"],
            "scode": scode,
            "sname": sname,
            "rule": json.dumps(rc, ensure_ascii=False),
            "createTime": now_ms(),
            "closed": 0,
            "expireTime": int(expire_time.timestamp() * 1000),
            "type": type_value,
        }
        self.insert_or_replace("tTradeRule", rule_row)
        self.db.run("delete from tRuleAction where type=? and scode=? and broker=?", [type_value, scode, rc["broker"]])
        return {"rule": rule_row, "sname": sname}

    def refresh_table_scode_column(self, table_name: str, column_name: str) -> Dict[str, Any]:
        table_sql_name = quote_sqlite_identifier(table_name)
        column_sql_name = quote_sqlite_identifier(column_name)
        result = self.db.all(
            f"select distinct {column_sql_name} as scode from {table_sql_name} where {column_sql_name} is not null and trim({column_sql_name})<>''"
        )
        if result.get("error"):
            return result
        for row in result["rows"]:
            old_scode = row["scode"]
            new_scode = normalize_scode(old_scode)
            if not new_scode or new_scode == old_scode:
                continue
            update_result = self.db.run(
                f"update {table_sql_name} set {column_sql_name}=? where {column_sql_name}=?",
                [new_scode, old_scode],
            )
            if update_result.get("error"):
                return update_result
        return {}

    def refresh_all_table_scodes(self) -> Dict[str, Any]:
        tables = self.db.all("select name from sqlite_master where type='table' and name not like 'sqlite_%'")
        if tables.get("error"):
            return tables
        for row in tables["rows"]:
            table_name = row["name"]
            columns = self.db.all(f"pragma table_info({quote_sqlite_identifier(table_name)})")
            if columns.get("error"):
                return columns
            if not any(column["name"] == "scode" for column in columns["rows"]):
                continue
            result = self.refresh_table_scode_column(table_name, "scode")
            if result.get("error"):
                return result
        return {}

    def queue_future_leverage_action(self, scode: str, leverage: int, broker: str = "BNB") -> Dict[str, Any]:
        normalized = normalize_scode(scode)
        if not normalized.startswith("O_"):
            return {"error": "future scode required"}
        type_value = 1
        aliases = get_scode_aliases(normalized)
        placeholders = ",".join(["?"] * len(aliases))
        self.db.run(
            f"delete from tRuleAction where type=? and scode in ({placeholders}) and broker=? and done=0 and action in ('setLeverage','changeLeverage','updateLeverage')",
            [type_value] + aliases + [broker],
        )
        stock_basic_info = self.get_stock_basic_by_scode(normalized, type_value)
        now = now_ms()
        return self.insert_or_replace(
            "tRuleAction",
            {
                "id": f"{normalized}.{broker}.setLeverage.{now}",
                "ruleId": f"{normalized}.{broker}.setLeverage",
                "scode": normalized,
                "sname": (stock_basic_info or {}).get("sname", normalized),
                "action": "setLeverage",
                "price": 0,
                "amount": leverage,
                "orderNo": "",
                "done": 0,
                "createTime": now,
                "broker": broker,
                "status": "",
                "type": type_value,
            },
        )

    def auto_delete(self, delta: Any, scode: str) -> None:
        scode = normalize_scode(scode)
        if str(delta) != "1":
            self.db.run("update tstock set tpair='', deleted=0 where scode=?", [scode])
        rows = self.db.all("select * from tstock where scode=? and deleted=0 order by tday, ttime, tid", [scode]).get("rows", [])
        latest_trade_id = rows[-1]["tid"] if rows else None

        def get_trade_number(value: Any) -> float:
            try:
                return float(value)
            except Exception:
                return 0.0

        def can_auto_pair_trade(t1, t2) -> bool:
            amount1 = get_trade_number(t1["tamount"])
            amount2 = get_trade_number(t2["tamount"])
            if abs(amount1 + amount2) > 1e-8:
                return False
            price1 = get_trade_number(t1["tprice"])
            price2 = get_trade_number(t2["tprice"])
            if price1 <= price2 and amount1 < 0:
                return False
            if price1 > price2 and amount1 > 0:
                return False
            return True

        def can_sell_match_buy(sell_trade, buy_trade) -> bool:
            return get_trade_number(buy_trade["tprice"]) <= get_trade_number(sell_trade["tprice"])

        def hide_trade_group(group_trades):
            tids = [trade["tid"] for trade in group_trades]
            for trade in group_trades:
                tpair = ",".join([tid for tid in tids if tid != trade["tid"]])
                self.db.run("update tstock set tpair=?, deleted=1 where tid=?", [tpair, trade["tid"]])
                trade["deleted"] = 1
                trade["tpair"] = tpair

        def find_trade_subset_by_amount(candidates, target_amount):
            suffix_amounts = [0.0] * (len(candidates) + 1)
            for i in range(len(candidates) - 1, -1, -1):
                suffix_amounts[i] = suffix_amounts[i + 1] + get_trade_number(candidates[i]["tamount"])
            tried = set()

            def dfs(start, remaining):
                if abs(remaining) < 1e-8:
                    return []
                if start >= len(candidates) or remaining < -1e-8:
                    return None
                if suffix_amounts[start] + 1e-8 < remaining:
                    return None
                key = f"{start}:{remaining:.8f}"
                if key in tried:
                    return None
                for i in range(start, len(candidates)):
                    candidate = candidates[i]
                    amount = get_trade_number(candidate["tamount"])
                    if amount <= 0:
                        continue
                    result = dfs(i + 1, remaining - amount)
                    if result is not None:
                        return [candidate] + result
                tried.add(key)
                return None

            return dfs(0, target_amount)

        for i in range(0, len(rows) - 1):
            t1 = rows[i]
            if t1.get("deleted") or abs(get_trade_number(t1["tamount"])) < 1e-8:
                continue
            for j in range(i + 1, len(rows)):
                t2 = rows[j]
                if t2.get("deleted") or t2["tid"] == latest_trade_id or abs(get_trade_number(t2["tamount"])) < 1e-8:
                    continue
                if not can_auto_pair_trade(t1, t2):
                    continue
                hide_trade_group([t1, t2])
                break

        for sell_index, sell_trade in enumerate(rows):
            sell_amount = get_trade_number(sell_trade["tamount"])
            if sell_trade.get("deleted") or sell_amount >= 0 or sell_trade["tid"] == latest_trade_id:
                continue
            target_amount = abs(sell_amount)
            candidate_buys = []
            for buy_index in range(0, sell_index):
                buy_trade = rows[buy_index]
                if buy_trade.get("deleted") or get_trade_number(buy_trade["tamount"]) <= 0:
                    continue
                if not can_sell_match_buy(sell_trade, buy_trade):
                    continue
                candidate_buys.append(buy_trade)
            if len(candidate_buys) < 2:
                continue
            matched_buys = find_trade_subset_by_amount(candidate_buys, target_amount)
            if matched_buys and len(matched_buys) >= 2:
                hide_trade_group([sell_trade] + matched_buys)

    def upgrade_db(self) -> None:
        row = self.db.get("SELECT * FROM config where key=?", ["dbVersion"])
        updates = [
            "alter table tStockBasic add column MinLimitOrderVolume int default 100;",
            "alter table t1d add column kdj_k real default 0;",
            "alter table t1d add column kdj_d real default 0;",
            "alter table t1d add column kdj_j real default 0;",
            "alter table t1d add column boll_u real default 0;",
            "alter table t1d add column boll_m real default 0;",
            "alter table t1d add column boll_l real default 0;",
            "alter table t1d add column range real default 0;",
            "alter table tstock add column lastOperationTime int default 0;",
            "create table t1w(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);",
            "create table t1mon(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);",
            "alter table tStockBasic add column intro text default '';",
            "alter table tStockBasic add column type int default 0;",
            "alter table tRuleAction add column type int default 0;",
            "alter table tTradeRule add column type int default 0;",
            "alter table tStockBasic add column leverage int default 5;",
            "alter table tStockBasic add column dip real default 0.02;",
            "alter table tStockBasic add column bounce real default 0.02;",
            "alter table tStockBasic add column autoCreateRuleFail text;",
            "alter table tStockBasic add column market text;",
            "alter table tStockBasic add column priority int default 0;",
            "alter table tStockBasic add column volumeMultiple int default 100;",
            "alter table tStockBasic add column upStopPrice real default 0;",
            "alter table tStockBasic add column downStopPrice real default 0;",
            "alter table tStockBasic add column totalVolume real default 0;",
            "alter table tStockBasic add column floatVolume real default 0;",
            "alter table tStockBasic add column bNotProfitable real default 0;",
            "alter table tStockBasic add column LastVolume real;",
        ]
        if not row or row.get("error"):
            self.db.executescript(
                """
CREATE TABLE IF NOT EXISTS config(key varchar(50) primary key, value text);
CREATE TABLE IF NOT EXISTS t1d(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0, cci INTEGER DEFAULT -800);
CREATE TABLE IF NOT EXISTS t1m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);
CREATE TABLE IF NOT EXISTS t5m(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real);
CREATE TABLE IF NOT EXISTS tRuleAction(id text primary key, ruleId text, scode text, sname text, action text, price real, amount real, orderNo text, done int default 0, createTime integer, broker text default '', status text default '', type int default 0);
CREATE TABLE IF NOT EXISTS tStockBasic(id text primary key, scode text, sname text, buy real default 0, sell real default 0, updateTime integer, priority int default 0, volumeMultiple int default 100, upStopPrice real default 0, downStopPrice real default 0, totalVolume real default 0, floatVolume real default 0, bNotProfitable real default 0, market text, LastVolume real, intro text default '', type int default 0, leverage int default 5, dip real default 0.02, bounce real default 0.02, autoCreateRuleFail text, MinLimitOrderVolume int default 100);
CREATE TABLE IF NOT EXISTS tStockPrice(id text primary key, scode text, sname text, delta real default 0, price real default 0, ratio real default 0, ratio1 real default 0, updateTime integer);
CREATE TABLE IF NOT EXISTS tTradeRule(id text primary key, scode text, sname text, rule text, createTime integer, closed integer default 0, broker text, expireTime int, type int default 0);
CREATE TABLE IF NOT EXISTS tallstock(id text primary key, scode text, sname text, sector text, priority int default 0, updateTime integer);
CREATE TABLE IF NOT EXISTS tcandidate(id text primary key, scode text, sname text, priority int default 0, updateTime integer);
CREATE TABLE IF NOT EXISTS tpositions(id text primary key, broker text, account_id text, avg_price real, can_use_volume real, frozen_volume real, market_value real, on_road_volume real, open_price real, stock_code text, volume real, updateTime integer, floatProfit real default 0, type int default 0);
CREATE TABLE IF NOT EXISTS tsql(id text primary key, name text, sql text, lastUseTime integer, params text);
CREATE TABLE IF NOT EXISTS tstock(tid text PRIMARY KEY, scode text, sname TEXT, tday text, ttime text, tprice REAL, operationDirection text, operationName text, market text, tamount integer, tcash REAL, taccount text, tpair text, lastOperationTime text, deleted int default 0, type int default 0);
CREATE TABLE IF NOT EXISTS ttick(id text primary key, scode text, time int, data text);
CREATE TABLE IF NOT EXISTS t1w(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);
CREATE TABLE IF NOT EXISTS t1mon(id text primary key, scode text, time text, open real, close real, high real, low real, volume int, amount real, type int default 0);
insert or ignore into config values('dbVersion', '0');
                """
            )
        else:
            try:
                version = int(row["value"])
            except Exception:
                version = 0
            for idx, sql in enumerate(updates[version:], start=version + 1):
                result = self.db.run(sql)
                if not result.get("error"):
                    self.db.run("update config set value=? where key='dbVersion'", [str(idx)])
        self.db.run("insert or ignore into config(key, value) values('dbVersion', ?)", [str(len(updates))])


service: Optional[StockService] = None


class Handler(BaseHTTPRequestHandler):
    server_version = "StockPython/1.0"

    def log_message(self, fmt, *args):
        return

    def _json_response(self, data: Any, status: int = 200, js: Optional[str] = None):
        text = json.dumps(data, ensure_ascii=False)
        if js:
            text = f"{js}({text})"
            self.send_response(status)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
        else:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
        payload = text.encode("utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _text_response(self, text: str, status: int = 200):
        payload = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _parse_query(self):
        parsed = urlparse(self.path)
        query = {k: v[-1] for k, v in parse_qs(parsed.query).items()}
        return parsed.path, query

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        body = self.rfile.read(length)
        if not body:
            return {}
        ctype = self.headers.get("Content-Type", "")
        if "application/json" in ctype or not ctype:
            return json.loads(body.decode("utf-8"))
        if "application/x-www-form-urlencoded" in ctype:
            return {k: v[-1] for k, v in parse_qs(body.decode("utf-8")).items()}
        return json.loads(body.decode("utf-8"))

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def _handle(self, method: str):
        global service
        path, query = self._parse_query()
        body = {}
        if method == "POST":
            try:
                body = self._read_json()
            except Exception as exc:
                self._json_response({"error": str(exc)}, 400)
                return
        js = query.get("js")
        try:
            if path == "/stock/account" and method == "GET":
                row = service.db.get("select * from config where key='stockAccount'") or {"value": "null"}
                text = f"{js}({row.get('value', 'null')})" if js else row.get("value", "null")
                self._text_response(text)
                return
            if path == "/stock/account" and method == "POST":
                if body.get("passcode") != PASSCODE:
                    self._text_response("bad request", 400)
                    return
                service.db.run("insert or replace into config (key, value) values (?,?)", ["stockAccount", json.dumps(body.get("data"), ensure_ascii=False)])
                self._json_response({"data": "success"})
                return
            if path == "/stock/rule/action/startTime" and method == "GET":
                service.refresh_auto_action_start_time()
                current_time = f"{add0(datetime.now().hour)}:{add0(datetime.now().minute)}"
                self._json_response({"data": {"startTime": service.auto_action_start_time["buy"]["value"], "buyStartTime": service.auto_action_start_time["buy"]["value"], "sellStartTime": service.auto_action_start_time["sell"]["value"], "currentTime": current_time}}, js=js)
                return
            if path == "/stock/rule/action/startTime" and method == "POST":
                service.refresh_auto_action_start_time()
                buy_start = body.get("buyStartTime") or body.get("startTime")
                sell_start = body.get("sellStartTime") or body.get("startTime")
                buy_result = service.normalize_start_time(buy_start or service.auto_action_start_time["buy"]["value"])
                sell_result = service.normalize_start_time(sell_start or service.auto_action_start_time["sell"]["value"])
                if buy_result.get("error"):
                    self._json_response({"error": buy_result["error"]}, 400)
                    return
                if sell_result.get("error"):
                    self._json_response({"error": sell_result["error"]}, 400)
                    return
                service.db.run("insert or replace into config (key, value) values (?, ?)", ["autoActionStartTimeBuy", buy_result["value"]])
                service.db.run("insert or replace into config (key, value) values (?, ?)", ["autoActionStartTimeSell", sell_result["value"]])
                service.auto_action_start_time["buy"] = buy_result
                service.auto_action_start_time["sell"] = sell_result
                service.auto_action_start_time["loadedAt"] = now_ms()
                self._json_response({"data": {"startTime": buy_result["value"], "buyStartTime": buy_result["value"], "sellStartTime": sell_result["value"]}})
                return
            if path == "/stock/rule/action/tempAllow" and method == "POST":
                scode = normalize_scode(body.get("scode"))
                if not scode:
                    self._json_response({"error": "bad scode"}, 400)
                    return
                result = service.grant_temp_auto_action(scode)
                self._json_response({"data": {"scode": result["scode"]}})
                return
            if path in ("/stock/moveUp", "/stock/moveDown", "/stock/forceMoveUp", "/stock/forceMoveDown", "/stock/resetMove") and method == "GET":
                code = normalize_scode(query.get("code"))
                type_value = get_scode_type(code)
                if path == "/stock/resetMove":
                    last_trade = service.db.get("select tday, ttime from tstock where scode=? order by tday desc, ttime desc limit 1", [code])
                    if not last_trade:
                        self._json_response({"error": "未找到交易记录"}, 404, js=js)
                        return
                    ts = parse_trade_timestamp(last_trade.get("tday"), last_trade.get("ttime"))
                    if ts is None:
                        self._json_response({"error": "交易时间格式无效"}, 400, js=js)
                        return
                    value = ts
                elif path == "/stock/moveUp":
                    value = now_ms()
                elif path == "/stock/moveDown":
                    value = -1 * now_ms()
                elif path == "/stock/forceMoveUp":
                    value = now_ms() + 20 * 365 * 24 * 60 * 60 * 1000
                else:
                    value = -1 * now_ms() - 20 * 365 * 24 * 60 * 60 * 1000
                service.db.run("update tstock set lastOperationTime=? where scode=?", [value, code])
                service.db.run("update tStockBasic set priority=? where scode=? and type=?", [value, code, type_value])
                service.db.run("update tTradeRule set createTime=? where scode=? and type=?", [value, code, type_value])
                if js:
                    self._text_response(f"{js}({{}})")
                else:
                    self._json_response({})
                return
            if path in ("/stock/updatePrice", "/stock/updatePrice/option") and method == "GET":
                scode = normalize_scode(query.get("scode"))
                price = float(query.get("price") or 0)
                update_time = int(query.get("time") or now_ms())
                if path == "/stock/updatePrice":
                    service.update_price_to_rule(scode, price)
                    service.update_stock_basic_by_scode({"scode": scode, "buy": price, "updateTime": update_time})
                    service.check_rule([scode])
                else:
                    service.update_stock_basic_by_scode({"scode": scode, "buy": price, "updateTime": update_time, "type": 1})
                if js:
                    self._text_response(f"{js}({{}})")
                else:
                    self._json_response({})
                return
            if path == "/stock/intros" and method == "GET":
                scodes = [normalize_scode(x) for x in (query.get("scodes") or "").split(",") if normalize_scode(x)]
                unique = []
                for scode in scodes:
                    if scode not in unique:
                        unique.append(scode)
                if not unique:
                    self._json_response({"data": {}})
                    return
                query_scodes = []
                for scode in unique:
                    for alias in get_scode_aliases(scode):
                        if alias not in query_scodes:
                            query_scodes.append(alias)
                placeholders = ",".join(["?"] * len(query_scodes))
                result = service.db.all(
                    f"select scode, id, intro from tStockBasic where scode in ({placeholders}) or id in ({placeholders})",
                    query_scodes + query_scodes,
                )
                data = {scode: "" for scode in unique}
                for row in result.get("rows", []):
                    scode = normalize_scode(row.get("scode") or row.get("id"))
                    if scode:
                        data[scode] = row.get("intro") or ""
                self._json_response({"data": data})
                return
            if path == "/stock/intro/update" and method == "POST":
                scode = normalize_scode(body.get("scode"))
                intro = str(body.get("intro") or "").strip()
                if not scode:
                    self._json_response({"error": "scode required"}, 400)
                    return
                result = service.update_stock_basic_by_scode({"scode": scode, "intro": intro, "updateTime": now_ms()})
                if result.get("error"):
                    self._json_response(result, 400)
                    return
                self._json_response({"data": {"scode": scode, "intro": intro}})
                return
            if path == "/stock/future/leverage/update" and method == "POST":
                scode = normalize_scode(body.get("scode"))
                try:
                    leverage = int(body.get("leverage"))
                except Exception:
                    leverage = 0
                if not scode or not scode.startswith("O_"):
                    self._json_response({"error": "future scode required"}, 400)
                    return
                if leverage <= 0:
                    self._json_response({"error": "invalid leverage"}, 400)
                    return
                update_result = service.update_stock_basic_by_scode({"scode": scode, "leverage": leverage, "updateTime": now_ms(), "type": 1})
                if update_result.get("error"):
                    self._json_response(update_result, 400)
                    return
                action_result = service.queue_future_leverage_action(scode, leverage, "BNB")
                if action_result.get("error"):
                    self._json_response(action_result, 400)
                    return
                self._json_response({"data": {"scode": scode, "leverage": leverage, "broker": "BNB"}})
                return
            if path == "/stock/deleteRow" and method == "GET":
                if query.get("id") and query.get("table"):
                    service.db.run(f"delete from {query['table']} where id=?", [query["id"]])
                elif query.get("force"):
                    service.db.run("delete from tstock where tid=?", [query.get("tid")])
                else:
                    service.db.run("update tstock set deleted=1 where tid=?", [query.get("tid")])
                self._text_response(f"{js}({{}})" if js else "{}")
                return
            if path == "/stock/undeleteRow" and method == "GET":
                service.db.run("update tstock set deleted=0, tpair='' where tid=?", [query.get("tid")])
                self._text_response(f"{js}({{}})" if js else "{}")
                return
            if path == "/stock/screen/nodes" and method == "POST":
                with open(service.screen_path, "w", encoding="utf-8") as f:
                    json.dump(body, f, ensure_ascii=False)
                self._json_response({"data": "success"})
                return
            if path == "/stock/screen/nodes" and method == "GET":
                data = {}
                if os.path.exists(service.screen_path):
                    with open(service.screen_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                self._json_response({"data": data}, js=js)
                return
            if path == "/stock/prices" and method == "POST":
                for price in body:
                    price["scode"] = normalize_scode(price.get("scode"))
                    stamp = now_ms()
                    price["id"] = f"{price['scode']}_{stamp}"
                    price["updateTime"] = stamp
                    service.insert_or_replace("tStockPrice", price)
                    service.insert_or_replace("tStockBasic", {"id": price["scode"], "scode": price["scode"], "sname": price.get("sname"), "buy": price.get("price"), "updateTime": stamp})
                self._json_response({"action": []})
                return
            if path == "/stock/basic/update" and method == "POST":
                stocks = body.get("data") or []
                for stock in stocks:
                    stock["scode"] = normalize_scode(stock.get("scode"))
                    stock["id"] = stock["scode"]
                    stock["updateTime"] = now_ms()
                    service.insert_or_replace("tAllStock", stock)
                self._json_response({"action": []})
                return
            if path == "/stock/candidates" and method == "POST":
                stocks = body.get("data") or []
                if not stocks:
                    service.db.run("delete from tcandidate")
                priority = int(time_format(datetime.now(), "yyMMddhhmm"))
                for stock in stocks:
                    scode = normalize_scode(stock[0])
                    service.insert_or_replace("tcandidate", {"id": scode, "scode": scode, "sname": stock[1], "priority": priority, "updateTime": priority})
                self._json_response({})
                return
            if path == "/stock/positions" and method == "POST":
                if body.get("passcode") != PASSCODE:
                    self._text_response("bad request", 400)
                    return
                broker = body.get("broker")
                if broker and body.get("clean"):
                    service.db.run("delete from tPositions where id like ?", [f"{broker}%"])
                positions = body.get("data") or []
                type_value = int(body.get("type") or 0)
                for pos in positions:
                    pos["stock_code"] = normalize_scode(pos.get("stock_code"))
                    pos["id"] = f"{pos.get('broker')}_{pos.get('account_id')}_{pos['stock_code']}_{type_value}"
                    pos["updateTime"] = now_ms()
                    pos["type"] = type_value
                    service.insert_or_replace("tPositions", pos)
                self._json_response({})
                return
            if path == "/stock/positions" and method == "GET":
                scode = query.get("scode")
                if scode is None:
                    result = service.db.all("select * from tPositions")
                else:
                    aliases = get_scode_aliases(scode)
                    placeholders = ",".join(["?"] * len(aliases))
                    result = service.db.all(f"select * from tPositions where stock_code in ({placeholders})", aliases)
                normalize_db_rows_scodes(result.get("rows", []))
                self._json_response({"data": result.get("rows", [])}, js=js)
                return
            if path == "/stock/trades" and method == "GET":
                scode = query.get("scode")
                type_value = int(query.get("type") or 0)
                if scode is None:
                    result = service.db.all("select * from tstock")
                else:
                    aliases = get_scode_aliases(scode)
                    placeholders = ",".join(["?"] * len(aliases))
                    sql = f"select * from tstock where scode in ({placeholders}) and type=? and deleted=0 order by tday desc, ttime desc"
                    params = aliases + [type_value]
                    if str(query.get("all")) == "1":
                        sql = f"select * from tstock where scode in ({placeholders}) and type=? order by tday desc, ttime desc"
                    result = service.db.all(sql, params)
                normalize_db_rows_scodes(result.get("rows", []))
                self._json_response({"data": result.get("rows", [])}, js=js)
                return
            if path in ("/stock/quotes", "/stock/quotes.mini") and method == "POST":
                if body.get("passcode") != PASSCODE:
                    self._text_response("bad request", 400)
                    return
                data = body.get("data") or {}
                if path == "/stock/quotes":
                    for scode, values in data.items():
                        scode = normalize_scode(scode)
                        for tick_time, tick in values.items():
                            parsed = datetime.strptime(tick_time, "%Y%m%d%H%M%S.%f")
                            update_time = int(parsed.timestamp() * 1000)
                            price = tick.get("lastPrice", 0)
                            if price:
                                service.update_price_to_rule(scode, price)
                                service.update_stock_basic_by_scode({"scode": scode, "buy": price, "updateTime": update_time})
                                tick = dict(tick)
                                for key in ("stime", "pvolume", "lastSettlementPrice", "settlementPrice"):
                                    tick.pop(key, None)
                                minute = datetime.fromtimestamp(int(tick["time"]) / 1000).replace(second=0, microsecond=0)
                                service.insert_or_replace("ttick", {"id": f"{scode}_{int(minute.timestamp() * 1000)}", "scode": scode, "time": int(minute.timestamp() * 1000), "data": json.dumps(tick, ensure_ascii=False)})
                else:
                    for scode, tick in data.items():
                        scode = normalize_scode(scode)
                        price = tick.get("lastPrice", 0)
                        if price:
                            service.update_price_to_rule(scode, price)
                            service.update_stock_basic_by_scode({"scode": scode, "buy": price, "updateTime": tick.get("time")})
                service.check_rule(list(data.keys()))
                self._text_response("ok")
                return
            if path == "/stock/details" and method == "POST":
                if body.get("passcode") != PASSCODE:
                    self._text_response("bad request", 400)
                    return
                rows = body.get("data") or []
                update_time = now_ms()
                for row in rows:
                    aliases = get_scode_aliases(row.get("scode"))
                    placeholders = ",".join(["?"] * len(aliases))
                    service.db.run(
                        f"update tStockBasic set sname=?, market=?, LastVolume=?, TotalVolume=?, FloatVolume=?, UpStopPrice=?, DownStopPrice=?, VolumeMultiple=?, MinLimitOrderVolume=?, bNotProfitable=?, updateTime=? where scode in ({placeholders})",
                        [row.get("sname"), row.get("ExchangeID"), row.get("LastVolume"), row.get("TotalVolume"), row.get("FloatVolume"), row.get("UpStopPrice"), row.get("DownStopPrice"), row.get("VolumeMultiple"), row.get("MinLimitOrderVolume"), row.get("bNotProfitable"), update_time] + aliases,
                    )
                if not rows:
                    service.db.run("UPDATE tstock SET sname = (SELECT tsb.sname FROM tStockBasic tsb WHERE tsb.scode = tstock.scode) WHERE EXISTS (SELECT 1 FROM tStockBasic tsb WHERE tsb.scode = tstock.scode)")
                self._text_response("ok")
                return
            if path == "/stock/rule/create" and method == "GET":
                payload = json.loads(query.get("json"))
                payload["scode"] = normalize_scode(payload.get("scode"))
                payload["type"] = normalize_type(payload.get("type"), payload["scode"])
                payload["dip"] = normalize_rule_ratio(payload.get("dip"), 0.02)
                payload["bounce"] = normalize_rule_ratio(payload.get("bounce"), 0.02)
                now = now_ms()
                broker = payload.get("broker")
                expire_hours = float(eval(str(payload.get("expireHours", "0")), {"__builtins__": {}}, {}))
                expire_time = now + int(expire_hours * 60 * 60 * 1000)
                if expire_hours == 0:
                    dt = datetime.now().replace(hour=16, minute=10, second=0, microsecond=0)
                    expire_time = int(dt.timestamp() * 1000)
                stock_basic_info = service.get_stock_basic_by_scode(payload["scode"], payload["type"])
                if stock_basic_info and broker not in ("OKX", "BNB"):
                    if int(stock_basic_info.get("volumeMultiple") or 1) == 1:
                        stock_basic_info["volumeMultiple"] = 100
                    if payload.get("buyAmount", 0) > 0 and payload["buyAmount"] < stock_basic_info["volumeMultiple"]:
                        payload["buyAmount"] = stock_basic_info["volumeMultiple"]
                    if payload.get("sellAmount", 0) > 0 and payload["sellAmount"] < stock_basic_info["volumeMultiple"]:
                        payload["sellAmount"] = stock_basic_info["volumeMultiple"]
                if payload.get("buyDelta") is None:
                    payload["buyDelta"] = payload["sell"] - payload["buy"]
                if payload.get("sellDelta") is None:
                    payload["sellDelta"] = payload["buyDelta"]
                rule_id = f"{payload['scode']}.{broker}"
                result = service.db.run(
                    "insert or replace into tTradeRule(id, broker, scode, sname, rule, createTime, expireTime, type) values(?,?,?,?,?,?,?,?)",
                    [rule_id, broker, payload["scode"], payload.get("sname"), json.dumps(payload, ensure_ascii=False), now, expire_time, payload["type"]],
                )
                aliases = get_scode_aliases(payload["scode"])
                placeholders = ",".join(["?"] * len(aliases))
                service.db.run(f"delete from tRuleAction where type=? and scode in ({placeholders}) and broker=?", [payload["type"]] + aliases + [broker])
                rule_row = service.db.get(f"select * from tTradeRule where type=? and scode in ({placeholders}) and broker=?", [payload["type"]] + aliases + [broker])
                service.reload_rule(rule_row)
                buy = 0
                active_rule = service.rules.get(payload["scode"], {}).get(broker)
                if active_rule and active_rule.get("rule"):
                    buy = active_rule["rule"].get("currentPrice", 0)
                service.update_stock_basic_by_scode({"scode": payload["scode"], "sname": payload.get("sname"), "market": get_market(payload["scode"]), "buy": buy, "dip": payload["dip"], "bounce": payload["bounce"], "priority": now, "updateTime": now, "type": payload["type"]})
                trades = service.db.all(f"select * from tStock where scode in ({placeholders}) and deleted=0 and tamount<>0", aliases).get("rows", [])
                if not trades:
                    service.insert_or_replace("tstock", {"tday": time_format(now, "yyyyMMdd"), "ttime": time_format(now, "hh:mm:ss"), "sname": payload.get("sname"), "scode": payload["scode"], "operationDirection": "卖出", "operationName": broker, "market": get_market(payload["scode"]), "tamount": 0, "tprice": payload["sell"], "tcash": 0, "tid": f"{payload['scode']}.{payload.get('sname')}", "taccount": "", "tpair": "", "deleted": 0, "lastOperationTime": now})
                    service.check_rule([payload["scode"]])
                resp = result if result.get("error") else {}
                self._json_response(resp, js=js)
                return
            if path == "/stock/rule/create/auto" and method == "GET":
                max_value = int(query.get("max") or 1)
                service.worker_create_rule["max"] = max_value
                service.worker_create_rule["type"] = query.get("type")
                service.worker_create_rule["priceDelay"] = int(query.get("priceDelay") or 30)
                succeeded = []
                failed = []
                scode = query.get("scode")
                if scode:
                    result = service.auto_create_rule(scode, None, True)
                    if result.get("error") is None:
                        service.save_create_rule_failure(scode, "")
                        succeeded.append({"scode": scode, "sname": result.get("sname")})
                        service.reload_rule(result["rule"])
                    else:
                        service.save_create_rule_failure(scode, result["error"])
                        failed.append({"scode": scode, "sname": result.get("sname"), "reason": result["error"]})
                    self._json_response({"succeeded": succeeded, "failed": failed, "done": 1}, js=js)
                    return
                rows = service.db.all("select * from tStockBasic").get("rows", [])
                for stock_basic_info in rows:
                    if len(succeeded) >= max_value:
                        break
                    scode = stock_basic_info.get("scode")
                    sname = stock_basic_info.get("sname")
                    result = service.auto_create_rule(scode, stock_basic_info)
                    if result.get("error") is None:
                        service.save_create_rule_failure(scode, "")
                        succeeded.append({"scode": scode, "sname": sname})
                    else:
                        service.save_create_rule_failure(scode, result["error"])
                        failed.append({"scode": scode, "sname": sname, "reason": result["error"]})
                service.reload_rules()
                self._json_response({"succeeded": succeeded, "failed": failed, "done": 1}, js=js)
                return
            if path == "/stock/k/1m" and method == "GET":
                scode = normalize_scode(query.get("scode"))
                type_value = int(query.get("type") or 0)
                day = datetime.fromtimestamp(int(query["day"]) / 1000) if query.get("day") else datetime.now()
                day = day.replace(hour=0, minute=0, second=0, microsecond=0)
                next_day = day + timedelta(days=1)
                aliases = get_scode_aliases(scode)
                placeholders = ",".join(["?"] * len(aliases))
                rows = service.db.all(
                    f"select * from t1m where scode in ({placeholders}) and type=? and time > ? and time < ? order by scode, time",
                    aliases + [type_value, time_format(day, "yyyyMMdd"), time_format(next_day, "yyyyMMdd")],
                ).get("rows", [])
                normalize_db_rows_scodes(rows)
                self._json_response(rows, js=js)
                return
            if path == "/stock/reload/k1d" and method == "GET":
                scode = normalize_scode(query.get("scode"))
                broker = query.get("broker")
                if str(query.get("force")) == "1":
                    aliases = get_scode_aliases(scode)
                    placeholders = ",".join(["?"] * len(aliases))
                    service.db.run(f"delete from t1d where scode in ({placeholders})", aliases)
                action = {"id": f"{scode}-reloadK1d", "ruleId": scode, "scode": scode, "sname": scode, "action": "reloadK1d", "broker": broker, "price": 0, "amount": 0, "orderNo": "", "done": 0, "createTime": now_ms(), "type": get_scode_type(scode)}
                service.insert_or_replace("tRuleAction", action)
                self._json_response({})
                return
            if path in ("/stock/k/1d", "/stock/k/1w", "/stock/k/1mon", "/stock/k/1ds", "/stock/k/1ws", "/stock/k/1mons", "/stock/k/1ms") and method == "GET":
                period_map = {
                    "/stock/k/1d": "t1d",
                    "/stock/k/1w": "t1w",
                    "/stock/k/1mon": "t1mon",
                    "/stock/k/1ds": "t1d",
                    "/stock/k/1ws": "t1w",
                    "/stock/k/1mons": "t1mon",
                    "/stock/k/1ms": "t1m",
                }
                table = period_map[path]
                scode = normalize_scode(query.get("scode"))
                type_value = int(query.get("type") or 0)
                limit = int(query.get("limit") or 2000)
                aliases = get_scode_aliases(scode)
                placeholders = ",".join(["?"] * len(aliases))
                rows = service.db.all(f"select * from {table} where scode in ({placeholders}) and type=? order by time desc limit ?", aliases + [type_value, limit]).get("rows", [])
                normalize_db_rows_scodes(rows)
                self._json_response(rows[::-1], js=js)
                return
            if path == "/stock/rule/cancel" and method == "GET":
                scode = normalize_scode(query.get("scode"))
                broker = query.get("broker")
                type_value = get_scode_type(scode)
                all_value = query.get("all")
                rule_id = f"{scode}.{broker}"
                if all_value == "1":
                    service.db.run("update tTradeRule set closed=1")
                    service.db.run("update tRuleAction set done=-1")
                elif all_value == "A股":
                    service.db.run("update tTradeRule set closed=1 where scode in (select scode from tstockbasic where market in ('BJ','SH','SZ') and type=0)")
                    service.db.run("update tRuleAction set done=-1 where type=0 and scode in (select scode from tstockbasic where market in ('BJ','SH','SZ') and type=0)")
                elif all_value == "H股":
                    service.db.run("update tTradeRule set closed=1 where scode in (select scode from tstockbasic where market in ('HK') and type=0)")
                    service.db.run("update tRuleAction set done=-1 where type=0 and scode in (select scode from tstockbasic where market in ('HK') and type=0)")
                elif all_value == "BNB":
                    service.db.run("update tTradeRule set closed=1 where scode in (select scode from tstockbasic where market in ('EC') and type=0)")
                    service.db.run("update tRuleAction set done=-1 where type=0 and scode in (select scode from tstockbasic where market in ('EC') and type=0)")
                elif all_value == "待买":
                    service.db.run("update tTradeRule set closed=1 where rule like '%buyFirst%'")
                    service.db.run("update tRuleAction set done=-1 where action='buy'")
                elif all_value == "待卖":
                    service.db.run("update tTradeRule set closed=1 where rule like '%sellFirst%'")
                    service.db.run("update tRuleAction set done=-1 where action='sell'")
                else:
                    service.db.run("update tTradeRule set closed=1 where id=?", [rule_id])
                    service.db.run("update tRuleAction set done=-1 where ruleId=? and type=?", [rule_id, type_value])
                service.reload_rules()
                self._json_response({}, js=js)
                return
            if path == "/stock/rule/delete" and method == "GET":
                scode = normalize_scode(query.get("scode"))
                type_value = get_scode_type(scode)
                broker = query.get("broker")
                aliases = get_scode_aliases(scode)
                placeholders = ",".join(["?"] * len(aliases))
                service.db.run(f"delete from tTradeRule where type=? and scode in ({placeholders}) and broker=?", [type_value] + aliases + [broker])
                service.db.run(f"delete from tRuleAction where type=? and scode in ({placeholders}) and broker=?", [type_value] + aliases + [broker])
                service.reload_rules()
                self._json_response({}, js=js)
                return
            if path == "/stock/rule/actions" and method == "GET":
                broker = query.get("broker")
                rows = service.db.all("select * from tRuleAction where broker=? and done=0", [broker]).get("rows", [])
                for row in rows:
                    code = format_scode(row.get("scode"))
                    if code:
                        row["scode"] = code
                pending = []
                for row in rows:
                    if service.allow_auto_create_action(row):
                        pending.append(row)
                self._json_response({"data": pending}, js=js)
                return
            if path == "/stock/action/done" and method == "GET":
                service.db.run("update tRuleAction set done=1 where id=?", [query.get("id")])
                service.reload_rules()
                self._json_response({}, js=js)
                return
            if path == "/stock/rule/status" and method == "GET":
                scode = normalize_scode(query.get("scode"))
                result = {}
                if not scode:
                    result["data"] = service.rules
                elif not service.rules.get(scode):
                    typed = service.get_typed_scode_query(scode, None)
                    res = service.db.all(f"select * from tTradeRule where type=? and scode in ({typed['scodePlaceholders']})", [typed["type"]] + typed["aliases"])
                    if res.get("rows"):
                        data = normalize_db_row_scodes(res["rows"][0])
                        data["type"] = normalize_type(data.get("type"), data.get("scode"))
                        tsb = service.get_stock_basic_by_scode(scode, typed["type"])
                        data["autoCreateRuleFail"] = (tsb or {}).get("autoCreateRuleFail", "")
                        result["data"] = data
                    else:
                        result["data"] = None
                else:
                    result["data"] = list(service.rules[scode].values())[0]
                result["autoActionGate"] = service.get_auto_action_gate_info()
                self._json_response(result, js=js)
                return
            if path == "/stock/fe/user/login" and method == "GET":
                self._json_response({"login": query.get("login")}, js=js)
                return
            if path == "/stock/codes" and method == "GET":
                rows = service.db.all("select scode from tstockbasic order by priority desc").get("rows", [])
                scodes = [code for code in [format_scode(row.get("scode")) for row in rows] if code]
                self._json_response(scodes, js=js)
                return
            if path == "/stock/rule/codes" and method == "GET":
                rows = service.db.all("select distinct scode from tTradeRule").get("rows", [])
                scodes = [code for code in [format_scode(row.get("scode")) for row in rows] if code]
                self._json_response(scodes, js=js)
                return
            if path == "/stock/rule/codes/active" and method == "GET":
                rows = service.db.all("select distinct scode from tTradeRule where closed=0").get("rows", [])
                scodes = [code for code in [format_scode(row.get("scode")) for row in rows] if code]
                self._json_response(scodes, js=js)
                return
            if path == "/stock/candidates" and method == "GET":
                rows = service.db.all("select scode from tcandidate order by priority desc").get("rows", [])
                scodes = [code for code in [format_scode(row.get("scode")) for row in rows] if code]
                self._json_response(scodes, js=js)
                return
            if path in ("/stock/1d/lastDate", "/stock/1w/lastDate", "/stock/1mon/lastDate", "/stock/1m/lastMinute") and method == "GET":
                scode = normalize_scode(query.get("scode"))
                aliases = get_scode_aliases(scode)
                placeholders = ",".join(["?"] * len(aliases))
                if path == "/stock/1d/lastDate":
                    row = service.db.get(f"select max(time) as lastDate from t1d where scode in ({placeholders})", aliases)
                elif path == "/stock/1w/lastDate":
                    row = service.db.get(f"select max(time) as lastDate from t1w where scode in ({placeholders})", aliases)
                elif path == "/stock/1mon/lastDate":
                    row = service.db.get(f"select max(time) as lastDate from t1mon where scode in ({placeholders})", aliases)
                else:
                    row = service.db.get(f"select max(time) as lastMinute from t1m where scode in ({placeholders})", aliases)
                self._json_response(row or {}, js=js)
                return
            if path == "/stock/price/current" and method == "GET":
                rows = service.db.all("select * from tstockbasic").get("rows", [])
                normalize_db_rows_scodes(rows)
                self._json_response({"rows": rows}, js=js)
                return
            if path == "/stock/delete/auto" and method == "GET":
                service.auto_delete(query.get("delta"), query.get("scode"))
                self._text_response(f"{js}({json.dumps({'data': 'success'}, ensure_ascii=False)})" if js else json.dumps({"data": "success"}, ensure_ascii=False))
                return
            if path == "/stockUpdate" and method == "GET":
                refresh_result = service.refresh_all_table_scodes()
                if refresh_result.get("error"):
                    self._json_response({"error": refresh_result["error"]}, 500)
                else:
                    self._json_response({})
                return
            if path == "/stock/query" and method == "POST":
                row = json.loads(unquote(base64.b64decode(body.get("text", "")).decode("utf-8")))
                sql = row.get("sql")
                name = row.get("name")
                params = row.get("params")
                result = service.db.all(sql, [])
                normalize_db_rows_scodes(result.get("rows", []))
                if name is not None:
                    service.db.run("insert or replace into tsql (id, name, sql, params, lastUseTime) values (?,?,?,?,?)", [name, name, sql, params, now_ms()])
                self._json_response({"data": result.get("rows", [])})
                return
            if path == "/stock/k/upload" and method == "POST":
                data = body.get("data") or []
                scode = normalize_scode(body.get("scode"))
                period = body.get("period")
                type_value = int(body.get("type") or 0)
                for item in data:
                    if period == "tick":
                        date = datetime.strptime(item[0], "%Y%m%d%H%M%S")
                        if float(item[3]) > 0:
                            service.insert_or_replace("ttick", {"id": f"{scode}-{type_value}-{int(date.timestamp() * 1000)}", "scode": scode, "time": int(date.timestamp() * 1000), "data": json.dumps({"volume": item[1], "amount": item[2], "lastPrice": item[3]}, ensure_ascii=False)})
                    else:
                        row = {"id": f"{scode}-{type_value}-{item[0]}", "scode": scode, "time": item[0], "open": item[1], "close": item[2], "high": item[3], "low": item[4], "volume": 0 if float(item[5]) < 0 and period == "1m" else abs(item[5]) if float(item[5]) < 0 else item[5], "amount": item[6], "type": type_value}
                        if period == "1d":
                            row["cci"] = item[7]
                        service.insert_or_replace(f"t{period}", row)
                        if period == "1d":
                            rows = service.db.all("select * from t1d where scode=? order by time desc limit 16", [scode]).get("rows", [])
                            if len(rows) >= 14:
                                service.calc_1d_cci(rows, 14, lambda x: service.db.run("update t1d set cci=? where id=?", [x["cci"], x["id"]]))
                self._json_response({})
                return
            if path == "/stock/deal/update" and method == "POST":
                deal = dict(body)
                normalized = normalize_scode(deal.get("scode"))
                parts = normalized.split(".")
                deal["scode"] = f"{parts[0]}.{parts[1]}" if len(parts) > 1 else normalized
                if deal.get("sname", "") == "":
                    row = service.get_stock_basic_by_scode(deal["scode"])
                    deal["sname"] = (row or {}).get("sname", deal["scode"])
                if deal.get("market", "") == "":
                    deal["market"] = parts[1] if len(parts) > 1 else ""
                deal["tday"] = str(deal["tday"]).replace("-", "")
                ttime = str(deal["ttime"])
                if len(ttime) == 5:
                    deal["ttime"] = "0" + ttime[:1] + ":" + ttime[1:3] + ":" + ttime[3:5]
                elif len(ttime) == 6:
                    deal["ttime"] = ttime[:2] + ":" + ttime[2:4] + ":" + ttime[4:6]
                deal["lastOperationTime"] = now_ms()
                deal["tprice"] = convert_if_integer(float(deal["tprice"]))
                deal["tid"] = f"{deal['tday']}.{deal['ttime']}.{deal['scode']}.{deal['tprice']}"
                old = service.db.get("select * from tStock where tid=?", [deal["tid"]])
                if not old:
                    result = service.insert_or_ignore("tStock", deal)
                else:
                    old["tamount"] = float(old.get("tamount", 0) or 0) + float(deal.get("tamount", 0) or 0)
                    result = service.insert_or_replace("tStock", old)
                if not result.get("error"):
                    service.db.run("update tStock set lastOperationTime=? where scode=?", [deal["lastOperationTime"], deal["scode"]])
                service.auto_delete(0, deal["scode"])
                self._json_response({"error": result.get("error")} if result.get("error") else {})
                return
            if path == "/stock/rule/action/ordered" and method == "POST":
                scode = normalize_scode(body.get("scode"))
                type_value = get_scode_type(scode)
                broker = body.get("broker")
                status = str(body.get("status"))
                order_no = body.get("orderNo")
                aliases = get_scode_aliases(scode)
                placeholders = ",".join(["?"] * len(aliases))
                if status in ("56", "53", "54"):
                    service.db.run(f"update tRuleAction set done=2, status=?, orderNo=? where type=? and scode in ({placeholders}) and broker=?", [status, order_no, type_value] + aliases + [broker])
                elif status in ("10", "50", "57") or status.startswith("57:"):
                    service.db.run(f"update tRuleAction set done=1, status=?, orderNo=? where type=? and scode in ({placeholders}) and broker=?", [status, order_no, type_value] + aliases + [broker])
                else:
                    self._json_response({})
                    return
                service.reload_rules()
                self._json_response({})
                return
            if path == "/stock/sqls" and method == "GET":
                rows = service.db.all("select * from tsql order by lastUseTime desc").get("rows", [])
                self._json_response({"data": rows}, js=js)
                return
            if path == "/stock/sql/update" and method == "POST":
                service.db.run("insert or replace into tsql (id, name, params, sql, lastUseTime) values (?,?,?,?,?)", [body.get("name"), body.get("name"), body.get("params"), body.get("sql"), now_ms()])
                self._json_response({"data": "success"})
                return
            self._json_response({"error": "not implemented"}, 404)
        except Exception:
            self._json_response({"error": traceback.format_exc()}, 500)


def main():
    global service
    if len(sys.argv) < 3:
        print("python3 stock.py <port> <data_dir>")
        sys.exit(1)
    port = int(sys.argv[1])
    directory_path = sys.argv[2]
    service = StockService(directory_path)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"stock.py listening on 127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
