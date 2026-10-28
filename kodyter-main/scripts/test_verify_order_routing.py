"""Offline safety tests for the live acceptance runner; never contact an API."""
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "verify_order_routing", Path(__file__).with_name("verify-order-routing.py"))
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)

REMOTE = "https://anasym-bakery.example.test"
CLOUD_CREDENTIALS = runner.ROOT / ".secrets/vercel-demo-accounts.txt"


class TargetValidationTests(unittest.TestCase):
    def test_loopback_keeps_default_credentials(self):
        for origin in ("http://127.0.0.1:5174", "http://localhost:8001/", "https://[::1]:8443"):
            with self.subTest(origin=origin):
                actual, credentials = runner.validate_target(origin, None, None)
                self.assertEqual(actual, origin.rstrip("/"))
                self.assertEqual(credentials, runner.ROOT / ".secrets/demo-accounts.txt")

    def test_remote_requires_explicit_allowance(self):
        with self.assertRaisesRegex(ValueError, "allow-remote-origin"):
            runner.validate_target(REMOTE, None, CLOUD_CREDENTIALS)

    def test_remote_requires_separate_explicit_credentials(self):
        for credentials in (None, runner.ROOT / ".secrets/demo-accounts.txt",
                            runner.ROOT / ".secrets/../.secrets/demo-accounts.txt"):
            with self.subTest(credentials=credentials):
                with self.assertRaisesRegex(ValueError, "credentials"):
                    runner.validate_target(REMOTE, REMOTE, credentials)

    def test_valid_explicit_remote(self):
        self.assertEqual(runner.validate_target(REMOTE, REMOTE, CLOUD_CREDENTIALS),
                         (REMOTE, CLOUD_CREDENTIALS))

    def test_remote_allowance_must_match_exactly(self):
        for allowance in ("https://different.example.test", REMOTE + ":443",
                          "https://ANASYM-BAKERY.example.test"):
            with self.subTest(allowance=allowance):
                with self.assertRaisesRegex(ValueError, "exactly match"):
                    runner.validate_target(REMOTE, allowance, CLOUD_CREDENTIALS)

    def test_invalid_remote_origins(self):
        for origin in ("http://anasym-bakery.example.test", REMOTE + "/",
                       REMOTE + "/api", REMOTE + "?", REMOTE + "?x=1",
                       REMOTE + "#", REMOTE + "#part", "https://u:p@host.test",
                       "https://@host.test", "https://*.example.test",
                       "https://host.test:bad", "https://host.test:65536",
                       "https://host.test:", "https://host.test\\path",
                       "https://host.test\n", " https://host.test",
                       "https://bad host.test", "https:///missing", "https://[::1"):
            with self.subTest(origin=repr(origin)):
                with self.assertRaises(ValueError):
                    runner.validate_target(origin, origin, CLOUD_CREDENTIALS)

    def test_invalid_loopback_is_not_silently_normalized(self):
        for origin in ("http://@localhost:5174", "http://localhost:wrong",
                       "http://localhost:70000", "http://localhost:5174/api",
                       "http://localhost:5174\n", "http://localhost:5174?",
                       "http://localhost:5174#"):
            with self.subTest(origin=repr(origin)):
                with self.assertRaises(ValueError):
                    runner.validate_target(origin, None, None)

    def test_rejected_cli_does_not_start_verification(self):
        with patch.object(runner, "verify") as verify, redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                runner.main(["--run", "--base-url", REMOTE,
                             "--allow-remote-origin", REMOTE])
        self.assertEqual(error.exception.code, 2)
        verify.assert_not_called()

    def test_remote_cannot_use_alias_of_local_credentials(self):
        # A separate-looking path must not reuse the local file via a hard link.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            local = root / "demo-accounts.txt"
            alias = root / "cloud-accounts.txt"
            local.write_text("private dummy fixture", encoding="utf-8")
            alias.hardlink_to(local)
            with patch.object(runner, "DEFAULT_CREDENTIALS", local):
                with self.assertRaisesRegex(ValueError, "credentials"):
                    runner.validate_target(REMOTE, REMOTE, alias)

    def test_explicit_remote_cli_keeps_demo_guard_before_credentials(self):
        def public_only(client, method, path, *args, **kwargs):
            self.assertEqual(client.base_url, REMOTE)
            self.assertEqual(method, "GET")
            if path == "/health/":
                return 200, {"status": "ok"}
            if path == "/settings/":
                return 200, {"demo_mode": False}
            self.fail("A non-demo target must not receive authentication or mutation requests.")

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with (patch.object(runner.ApiClient, "request", public_only),
                  patch.object(Path, "read_text", side_effect=AssertionError("Credentials must not be read")),
                  redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO())):
                result = runner.main([
                    "--run", "--base-url", REMOTE, "--allow-remote-origin", REMOTE,
                    "--credentials", str(CLOUD_CREDENTIALS), "--report", str(report_path),
                ])
            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(result, 1)
            self.assertEqual(report["result"], "FAIL")
            self.assertEqual(report["checks"], [{"name": "demo_environment", "passed": False}])


if __name__ == "__main__":
    unittest.main()
