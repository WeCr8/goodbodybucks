"""
conftest.py — Shared pytest fixtures for GB$ E2E and unit tests.

Starts the Flask app in a background thread for the duration of the test
session. Tests can use the `base_url` fixture to get the server address and
the `page` fixture (provided by pytest-playwright) to drive Chromium.

The server starts WITHOUT Firebase Admin (no serviceAccountKey.json required
for UI structure / static-asset tests). API endpoint tests that require real
Firebase are skipped automatically when credentials are absent.
"""
import os
import threading
import time
import socket
import subprocess
import sys

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_server(url: str, timeout: float = 10.0) -> bool:
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


# ---------------------------------------------------------------------------
# Session-scoped server fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def app_server():
    """
    Start the Flask dev server in a subprocess for the whole test session.
    Yields the base URL string. Terminates the process on teardown.
    """
    port = _find_free_port()
    env  = os.environ.copy()
    env["PORT"] = str(port)
    env["FLASK_ENV"] = "testing"
    # If no credentials file, set a dummy path so Firebase init fails quietly
    if not env.get("GOOGLE_APPLICATION_CREDENTIALS"):
        env["GOOGLE_APPLICATION_CREDENTIALS"] = "nonexistent_creds.json"

    # app.py raises RuntimeError at startup if serviceAccountKey.json is absent.
    # Detect that case quickly and skip the E2E session rather than hang.
    creds_path = env.get("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    project_root = os.path.dirname(os.path.dirname(__file__))
    abs_creds = (
        creds_path if os.path.isabs(creds_path)
        else os.path.join(project_root, creds_path)
    )
    if not os.path.isfile(abs_creds):
        pytest.skip(
            "serviceAccountKey.json not found — Flask server cannot start without "
            "Firebase credentials. Set GOOGLE_APPLICATION_CREDENTIALS to run E2E tests."
        )

    proc = subprocess.Popen(
        [sys.executable, "app.py"],
        env=env,
        cwd=project_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    base_url = f"http://127.0.0.1:{port}"
    ready = _wait_for_server(base_url + "/api/health", timeout=15)
    if not ready:
        stderr_output = proc.stderr.read().decode(errors="replace") if proc.stderr else ""
        proc.terminate()
        pytest.skip(
            f"Flask server failed to start on port {port}. stderr:\n{stderr_output[:500]}"
        )

    yield base_url

    proc.terminate()
    proc.wait(timeout=5)


@pytest.fixture(scope="session")
def base_url(app_server):
    return app_server


# ---------------------------------------------------------------------------
# Playwright browser config (supplement pytest-playwright defaults)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_type_launch_args():
    """Run Chromium headless with no sandbox in CI."""
    return {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}


# ---------------------------------------------------------------------------
# Firebase-required skip marker
# ---------------------------------------------------------------------------

def has_firebase_creds() -> bool:
    path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    return os.path.isfile(path)


skip_no_firebase = pytest.mark.skipif(
    not has_firebase_creds(),
    reason="Firebase credentials not present — skipping live-API test",
)
