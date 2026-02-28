#!/usr/bin/env python3
"""Start/stop local dev servers with PID files."""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PID_DIR = PROJECT_ROOT / ".opencode" / "pids"
LOG_DIR = PROJECT_ROOT / ".opencode" / "logs"


def _pid_path(name: str) -> Path:
    return PID_DIR / f"{name}.pid"


def _is_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _stop(name: str) -> None:
    pid_path = _pid_path(name)
    if not pid_path.exists():
        return
    pid = int(pid_path.read_text().strip())
    if _is_running(pid):
        os.kill(pid, signal.SIGTERM)
    pid_path.unlink(missing_ok=True)


def _start(
    name: str,
    command: list[str],
    env: dict[str, str] | None = None,
    cwd: Path | None = None,
) -> None:
    PID_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    pid_path = _pid_path(name)
    if pid_path.exists():
        pid = int(pid_path.read_text().strip())
        if _is_running(pid):
            return
        pid_path.unlink(missing_ok=True)
    log_path = LOG_DIR / f"{name}.log"
    log_file = log_path.open("ab")
    process = subprocess.Popen(
        command,
        cwd=str(cwd or PROJECT_ROOT),
        env=env,
        stdout=log_file,
        stderr=log_file,
    )
    pid_path.write_text(str(process.pid), encoding="utf-8")


def _restart(
    name: str,
    command: list[str],
    env: dict[str, str] | None = None,
    cwd: Path | None = None,
) -> None:
    _stop(name)
    _start(name, command, env, cwd)


def _status(name: str) -> None:
    pid_path = _pid_path(name)
    log_path = LOG_DIR / f"{name}.log"
    if not pid_path.exists():
        print(f"{name}: stopped")
        return
    pid = int(pid_path.read_text().strip())
    if _is_running(pid):
        print(f"{name}: running (pid {pid}) log={log_path}")
        return
    print(f"{name}: stale pid file (pid {pid}) log={log_path}")


def _tail(name: str, lines: int, follow: bool) -> None:
    log_path = LOG_DIR / f"{name}.log"
    if not log_path.exists():
        print(f"{name}: no log file")
        return
    command = ["tail", f"-n{lines}"]
    if follow:
        command.append("-f")
    command.append(str(log_path))
    subprocess.run(command, check=False)


def _base_env() -> dict[str, str]:
    env = dict(os.environ)
    env.setdefault("PYTHONUNBUFFERED", "1")
    return env


def _api_command(dev_tools: bool) -> tuple[list[str], dict[str, str]]:
    env = _base_env()
    if dev_tools:
        env["ZODIAC_DEV_TOOLS"] = "1"
    return [sys.executable, "-m", "zodiac_art.api.app"], env


def _editor_command() -> tuple[list[str], dict[str, str]]:
    env = _base_env()
    return ["npm", "run", "dev", "--", "--host"], env


def _mcp_command() -> tuple[list[str], dict[str, str]]:
    env = _base_env()
    env.setdefault("MCP_TRANSPORT", "streamable-http")
    env.setdefault("MCP_PORT", "7331")
    return [sys.executable, "-m", "zodiac_art.mcp.server"], env


def _chrome_command() -> tuple[list[str], dict[str, str]]:
    env = _base_env()
    return [str(PROJECT_ROOT / "scripts" / "debug_chrome.sh")], env


def main() -> None:
    parser = argparse.ArgumentParser(description="Dev server control")
    parser.add_argument("action", choices=["start", "stop", "restart", "status", "tail"])
    parser.add_argument("target", choices=["api", "editor", "mcp", "chrome", "all"])
    parser.add_argument("--dev-tools", action="store_true", help="Enable ZODIAC_DEV_TOOLS")
    parser.add_argument("--lines", type=int, default=200, help="Tail line count")
    parser.add_argument("--follow", action="store_true", help="Follow logs")
    args = parser.parse_args()

    targets = [args.target]
    if args.target == "all":
        targets = ["api", "editor", "mcp", "chrome"]

    for target in targets:
        cwd = None
        if target == "api":
            command, env = _api_command(args.dev_tools)
        elif target == "editor":
            command, env = _editor_command()
            cwd = PROJECT_ROOT / "editor"
        elif target == "mcp":
            command, env = _mcp_command()
        elif target == "chrome":
            command, env = _chrome_command()
        else:
            raise ValueError(f"Unknown target: {target}")

        if args.action == "start":
            _start(target, command, env, cwd)
        elif args.action == "stop":
            _stop(target)
        elif args.action == "status":
            _status(target)
        elif args.action == "tail":
            _tail(target, args.lines, args.follow)
        else:
            _restart(target, command, env, cwd)


if __name__ == "__main__":
    main()
