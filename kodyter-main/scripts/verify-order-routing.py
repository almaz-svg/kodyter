"""Live demo acceptance: customer -> admin/cashier/pool -> courier -> cash.

Run only after migrations and seed_demo. Creates one labelled test order and
records its cash payment. Private credentials are read locally, never logged.
Remote runs require an exact HTTPS origin allowlist and separate cloud credentials.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
from decimal import Decimal
import http.cookiejar
import ipaddress
import json
from pathlib import Path
import re
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener
import uuid


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CREDENTIALS = ROOT / ".secrets/demo-accounts.txt"
DEMO_EMAILS = {
    "CUSTOMER": "customer@anasym.test",
    "ADMIN": "admin@anasym.test",
    "COURIER": "courier@anasym.test",
    "CASHIER": "cashier@anasym.test",
}


class VerificationFailure(Exception):
    """Messages are authored here, never copied from a response or credential."""


def validate_target(base_url: str, allow_remote_origin: str | None,
                    credentials_path: Path | None) -> tuple[str, Path]:
    """Validate before any request or credential read; never echo private inputs."""
    def parse_origin(value: str, *, remote: bool = False):
        try:
            # urlsplit silently removes some whitespace/control characters. Reject
            # them first so the consent string is exactly the request destination.
            if any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError
            if any(char in value for char in ("\\", "?", "#", "*")):
                raise ValueError
            origin = urlsplit(value)
            if (origin.scheme not in (("https",) if remote else ("http", "https"))
                    or not origin.hostname or origin.username is not None
                    or origin.password is not None
                    or origin.path not in (("",) if remote else ("", "/"))
                    or origin.query or origin.fragment or origin.netloc.endswith(":")):
                raise ValueError
            # Accessing port also validates nonnumeric and out-of-range values.
            if origin.port is not None and not 1 <= origin.port <= 65535:
                raise ValueError
            try:
                ipaddress.ip_address(origin.hostname)
            except ValueError:
                if (len(origin.hostname) > 253 or not all(
                    re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                    for label in origin.hostname.split(".")
                )):
                    raise ValueError
            return origin
        except ValueError:
            qualifier = "HTTPS" if remote else "HTTP(S)"
            raise ValueError(f"Expected a valid {qualifier} origin without userinfo, path, query, fragment or wildcard.") from None

    origin = parse_origin(base_url)
    try:
        loopback = origin.hostname == "localhost" or ipaddress.ip_address(origin.hostname).is_loopback
    except ValueError:
        loopback = False
    if allow_remote_origin is not None:
        parse_origin(allow_remote_origin, remote=True)
        if base_url != allow_remote_origin:
            raise ValueError("--allow-remote-origin must exactly match --base-url.")
    if not loopback:
        if allow_remote_origin is None:
            raise ValueError("Remote hosts require an explicit --allow-remote-origin HTTPS origin.")
        parse_origin(base_url, remote=True)
        if credentials_path is None:
            raise ValueError("Remote runs require an explicit separate --credentials file.")
        same_file = credentials_path.resolve() == DEFAULT_CREDENTIALS.resolve()
        try:
            same_file = same_file or credentials_path.samefile(DEFAULT_CREDENTIALS)
        except FileNotFoundError:
            pass  # The normal credential read reports missing files after demo validation.
        except OSError:
            raise ValueError("Could not validate the separate remote --credentials file.") from None
        if same_file:
            raise ValueError("Remote --credentials must not use the local demo-accounts.txt file.")
    return base_url.rstrip("/"), credentials_path if credentials_path is not None else DEFAULT_CREDENTIALS


def parse_credentials(text: str) -> dict[str, str]:
    """Use the last seed block per email; preserve password whitespace."""
    credentials = {}
    for match in re.finditer(r"(?m)^Email: ([^\r\n]+)\r?\nPassword: ([^\r\n]*)", text):
        credentials[match.group(1).strip().lower()] = match.group(2)
    return credentials


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward demo auth headers outside the selected origin.


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect())
        self.csrf = None

    def request(self, method: str, path: str, body: dict | None = None,
                expected: tuple[int, ...] = (200,)) -> tuple[int, Any]:
        headers = {"Accept": "application/json"}
        data = None
        if method not in ("GET", "HEAD", "OPTIONS"):
            if not self.csrf:
                _, csrf_data = self.request("GET", "/auth/csrf/")
                self.csrf = csrf_data.get("csrfToken")
                if not self.csrf:
                    raise VerificationFailure("CSRF bootstrap did not return a token.")
            headers.update({"Content-Type": "application/json", "X-CSRFToken": self.csrf,
                            "Origin": self.base_url, "Referer": self.base_url + "/"})
            data = json.dumps(body or {}).encode("utf-8")
        request = Request(self.base_url + "/api" + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                status, raw = response.status, response.read()
        except HTTPError as exc:
            status, raw = exc.code, exc.read()
        except (URLError, TimeoutError, OSError) as exc:
            raise VerificationFailure(f"API connection failed ({type(exc).__name__}).") from None
        if status not in expected:
            raise VerificationFailure(f"{method} {path.split('?')[0]} returned HTTP {status}; expected {expected}.")
        try:
            parsed = json.loads(raw) if raw else None
        except (ValueError, UnicodeError):
            raise VerificationFailure(f"{method} {path.split('?')[0]} returned invalid JSON.") from None
        return status, parsed

    def login(self, email: str, password: str) -> dict:
        _, user = self.request("POST", "/auth/login/", {"email": email, "password": password})
        self.csrf = None  # Django rotates the CSRF secret on login.
        return user


def verify(base_url: str, credentials_path: Path, report: dict) -> None:
    def check(name: str, condition: bool, message: str) -> None:
        report["checks"].append({"name": name, "passed": bool(condition)})
        if not condition:
            raise VerificationFailure(message)

    def record_order(order: dict) -> None:
        # Deliberately exclude recipient, contact, address, comments and tokens.
        report["order"] = {key: order.get(key) for key in
                           ("id", "number", "status", "total", "payment_status")}

    def find_order(rows: Any, order_id: int) -> dict | None:
        if not isinstance(rows, list):
            raise VerificationFailure("An order-list endpoint did not return an array.")
        return next((row for row in rows if row.get("id") == order_id), None)

    public = ApiClient(base_url)
    public.request("GET", "/health/")
    _, settings = public.request("GET", "/settings/")
    check("demo_environment", settings.get("demo_mode") is True,
          "Refusing to create a test order when demo_mode is not true.")
    try:
        credentials = parse_credentials(credentials_path.read_text(encoding="utf-8-sig"))
    except OSError:
        raise VerificationFailure("The private demo credential file could not be read.") from None
    check("four_demo_credentials_present", all(email in credentials for email in DEMO_EMAILS.values()),
          "A demo role is missing from the private credential file; run the updated seed_demo first.")
    clients, users = {}, {}
    for role, email in DEMO_EMAILS.items():
        client = ApiClient(base_url)
        users[role] = client.login(email, credentials[email])
        clients[role] = client
        check(f"login_{role.lower()}", users[role].get("role") == role,
              f"The {role} demo account has an unexpected role.")
    credentials.clear()
    buyer, admin, courier, cashier = (clients[role] for role in DEMO_EMAILS)

    _, products = buyer.request("GET", "/products/")
    available = [product for product in products if product.get("is_available") and product.get("is_visible")]
    check("available_product", bool(available), "No available demo product was found.")
    product = available[0]
    expected_total = Decimal(str(product["price"])) + Decimal(str(settings["delivery_fee"]))
    _, order = buyer.request("POST", "/orders/", {
        "recipient_name": "API ACCEPTANCE DEMO ONLY",
        "phone": "+77010000000",
        "address": "DEMO TEST ORDER - DO NOT DELIVER",
        "comment": "Automated role-flow verification " + report["run_id"],
        "items": [{"product_id": product["id"], "quantity": 1, "expected_price": product["price"]}],
        "expected_delivery_fee": settings["delivery_fee"],
        "idempotency_key": str(uuid.uuid4()),
    }, expected=(201,))
    record_order(order)
    order_id = order["id"]
    check("created_order_total", Decimal(str(order["total"])) == expected_total,
          "The created order total does not match the current product and delivery prices.")
    check("created_order_new", order.get("status") == "NEW", "The created order is not NEW.")

    for role, client in (("admin", admin), ("cashier", cashier)):
        _, rows = client.request("GET", "/orders/")
        visible = find_order(rows, order_id)
        check(f"immediate_{role}_visibility", bool(visible) and visible.get("number") == order["number"]
              and Decimal(str(visible["total"])) == expected_total,
              f"The same new order was not immediately visible to {role}.")
    _, pool = courier.request("GET", "/courier/available-orders/")
    check("immediate_courier_pool_visibility", find_order(pool, order_id) is not None,
          "The new unassigned order was not immediately present in the courier pool.")
    cashier.request("GET", "/admin/products/", expected=(403,))
    check("cashier_catalog_access_denied", True, "Cashier must not access admin catalog endpoints.")

    _, order = courier.request("POST", f"/orders/{order_id}/claim/", {})
    record_order(order)
    check("courier_claim", order.get("courier") == users["COURIER"]["id"],
          "Claim did not assign the order to the requesting courier.")
    _, pool = courier.request("GET", "/courier/available-orders/")
    check("claimed_order_removed_from_pool", find_order(pool, order_id) is None,
          "The claimed order remained in the available courier pool.")
    _, assigned = courier.request("GET", "/orders/")
    check("claimed_order_in_courier_queue", find_order(assigned, order_id) is not None,
          "The claimed order did not appear in the courier's assigned orders.")

    for actor, statuses in ((admin, ("CONFIRMED", "PREPARING", "READY")),
                            (courier, ("HANDED_OVER", "IN_TRANSIT", "DELIVERED"))):
        for target in statuses:
            _, order = actor.request("POST", f"/orders/{order_id}/transition/", {"status": target})
            record_order(order)
            check("transition_" + target.lower(), order.get("status") == target,
                  f"The order did not transition to {target}.")

    _, before = cashier.request("GET", "/cashier/summary/")
    try:
        summary_date = date.fromisoformat(before["date"]).isoformat()
    except (KeyError, TypeError, ValueError):
        raise VerificationFailure("Cash summary returned an invalid accounting date.") from None
    summary_path = "/cashier/summary/?" + urlencode({"date": summary_date})
    payment = {"method": "CASH", "idempotency_key": str(uuid.uuid4())}
    _, order = cashier.request("POST", f"/orders/{order_id}/payment/", payment, expected=(201,))
    record_order(order)
    check("cash_payment_recorded", order.get("payment_status") == "PAID"
          and order.get("paid_by") == users["CASHIER"]["id"] and bool(order.get("paid_at")),
          "Payment was not recorded with the expected cashier and timestamp.")
    _, after = cashier.request("GET", summary_path)
    check("cash_summary_increment", after["paid_count"] == before["paid_count"] + 1
          and Decimal(str(after["cash_received"])) == Decimal(str(before["cash_received"])) + expected_total,
          "Cash summary did not increase by exactly one order and its full total.")
    check("unpaid_summary_decrement", after["unpaid_delivered_count"] == before["unpaid_delivered_count"] - 1
          and Decimal(str(after["unpaid_delivered_total"])) == Decimal(str(before["unpaid_delivered_total"])) - expected_total,
          "Outstanding delivered totals did not decrease by the paid order.")
    _, repeated = cashier.request("POST", f"/orders/{order_id}/payment/", payment)
    check("payment_retry_same_record", repeated.get("id") == order_id
          and repeated.get("payment_status") == "PAID" and repeated.get("paid_at") == order.get("paid_at"),
          "Retry did not return the original payment record.")
    _, repeated_summary = cashier.request("GET", summary_path)
    check("payment_retry_no_extra_cash", repeated_summary["paid_count"] == after["paid_count"]
          and Decimal(str(repeated_summary["cash_received"])) == Decimal(str(after["cash_received"])),
          "Payment retry changed the paid count or cash received.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", action="store_true", help="Explicitly authorize creating and completing one demo order.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5173", help="Origin without /api; loopback only unless explicitly allowed.")
    parser.add_argument("--allow-remote-origin", help="Exact HTTPS origin matching --base-url; requires separate --credentials.")
    parser.add_argument("--credentials", type=Path, help="Private credential file; local default .secrets/demo-accounts.txt is forbidden for remote runs.")
    parser.add_argument("--report", type=Path, default=ROOT / "docs/order-routing-verification.json")
    args = parser.parse_args(argv)
    if not args.run:
        parser.error("--run is required. No API requests or credential reads were made.")
    try:
        args.base_url, args.credentials = validate_target(args.base_url, args.allow_remote_origin, args.credentials)
    except ValueError as exc:
        parser.error(str(exc))
    report = {"run_id": uuid.uuid4().hex[:12], "started_at": datetime.now(timezone.utc).isoformat(),
              "api_base": args.base_url.rstrip("/"), "result": "RUNNING", "order": None, "checks": []}
    try:
        verify(args.base_url, args.credentials, report)
        report["result"] = "PASS"
    except VerificationFailure as exc:
        report["result"] = "FAIL"
        report["failure"] = str(exc)
    except Exception as exc:
        report["result"] = "FAIL"
        report["failure"] = f"Unexpected verification error ({type(exc).__name__}); no private response was logged."
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{report['result']}: {sum(check['passed'] for check in report['checks'])} checks passed. Report: {args.report}")
    if report["result"] != "PASS":
        print(report["failure"], file=sys.stderr)
        return 1
    print(f"Demo order {report['order']['number']}: DELIVERED / PAID. This test order remains in the demo database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
