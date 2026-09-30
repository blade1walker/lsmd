"""
Nexus EMS Bot - launcher for Python hosting servers.

The bot is written for Node.js, but many hosting panels (Pterodactyl and the
like) give you a *Python* server whose start command is fixed to
"pip install -r requirements.txt" and then "python app.py". This file makes
that work:

  1. requirements.txt installs `nodejs-wheel-binaries`, which ships a
     complete Node.js (with npm) as a normal Python package.
  2. This script finds that Node.js, installs the bot's own dependencies with
     npm the first time (or whenever package-lock.json changes), and then
     starts the bot with `node index.js`.

Nothing to configure here - settings live in .env (see .env.example).
On a Node.js server, ignore this file and run `npm install` then `npm start`.
"""

from __future__ import annotations

import glob
import os
import shutil
import signal
import stat
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MIN_NODE_MAJOR = 18


def say(message: str) -> None:
    print(f"[launcher] {message}", flush=True)


def fail(lines: list[str]) -> None:
    print("", flush=True)
    for line in lines:
        print(f"  {line}", flush=True)
    print("", flush=True)
    sys.exit(1)


def add_local_site_packages() -> None:
    # Panels install requirements with `pip install --prefix .local`; make
    # sure that folder is importable even when user site-packages is off.
    candidates = glob.glob(os.path.join(HERE, ".local", "lib", "python*", "site-packages"))  # Linux
    candidates += glob.glob(os.path.join(HERE, ".local", "Lib", "site-packages"))  # Windows
    for path in candidates:
        if path not in sys.path:
            sys.path.insert(0, path)


def node_version(node: str) -> int | None:
    try:
        out = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
        return int(out.lstrip("v").split(".")[0])
    except Exception:
        return None


def find_node() -> tuple[str, str]:
    """Returns (node executable, npm-cli.js)."""
    add_local_site_packages()
    try:
        import nodejs_wheel  # type: ignore

        root = os.path.dirname(nodejs_wheel.__file__)
        node = os.path.join(root, "node.exe") if os.name == "nt" else os.path.join(root, "bin", "node")
        npm_cli = os.path.join(root, "lib", "node_modules", "npm", "bin", "npm-cli.js")
        if os.path.exists(node):
            # Some uploads lose the executable bit; put it back.
            mode = os.stat(node).st_mode
            if not mode & stat.S_IXUSR:
                os.chmod(node, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            if os.path.exists(npm_cli):
                return node, npm_cli
    except ImportError:
        pass

    # No Python-packaged Node.js - fall back to one installed on the machine.
    system_node = shutil.which("node")
    if system_node and (node_version(system_node) or 0) >= MIN_NODE_MAJOR:
        npm_cli = os.path.join(os.path.dirname(os.path.realpath(system_node)), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
        if os.path.exists(npm_cli):
            return system_node, os.path.normpath(npm_cli)

    fail(
        [
            "Nexus EMS Bot cannot start: Node.js was not found.",
            "",
            "This server runs Python, so the bot brings Node.js in through pip.",
            "Make sure requirements.txt (next to app.py) contains:",
            "    nodejs-wheel-binaries==22.20.0",
            "and that the panel's startup installs it (Startup tab -> Requirements file: requirements.txt).",
            "Or install it by hand from the console:  pip install --prefix .local nodejs-wheel-binaries==22.20.0",
        ]
    )
    raise SystemExit(1)  # unreachable; keeps type checkers happy


def needs_install() -> bool:
    marker = os.path.join(HERE, "node_modules", ".package-lock.json")
    lock = os.path.join(HERE, "package-lock.json")
    if not os.path.exists(os.path.join(HERE, "node_modules", "discord.js")) or not os.path.exists(marker):
        return True
    return os.path.exists(lock) and os.path.getmtime(lock) > os.path.getmtime(marker)


def main() -> None:
    os.chdir(HERE)
    node, npm_cli = find_node()
    version = node_version(node)
    say(f"using Node.js v{version} ({node})")

    # npm's scripts (the build step) call `node` by name, so it must be on PATH.
    env = dict(os.environ)
    env["PATH"] = os.path.dirname(node) + os.pathsep + env.get("PATH", "")
    env.setdefault("NPM_CONFIG_UPDATE_NOTIFIER", "false")
    env.setdefault("NPM_CONFIG_FUND", "false")
    env.setdefault("NPM_CONFIG_AUDIT", "false")

    if needs_install():
        say("installing the bot's dependencies (first start takes a minute)...")
        # A node_modules copied from another computer (e.g. Windows) breaks on
        # Linux; start clean if discord.js is missing from it.
        if os.path.isdir(os.path.join(HERE, "node_modules")) and not os.path.exists(os.path.join(HERE, "node_modules", "discord.js")):
            shutil.rmtree(os.path.join(HERE, "node_modules"), ignore_errors=True)
        result = subprocess.run([node, npm_cli, "install", "--no-audit", "--no-fund"], cwd=HERE, env=env)
        if result.returncode != 0:
            fail(
                [
                    "npm install failed - see the errors above.",
                    "If they mention another platform (win32, esbuild), delete the node_modules folder and restart.",
                ]
            )

    say("starting Nexus EMS Bot")
    child = subprocess.Popen([node, os.path.join(HERE, "index.js")], cwd=HERE, env=env)

    # The panel's Stop button sends SIGINT/SIGTERM to this process; pass it on
    # so the bot disconnects cleanly instead of being killed mid-request.
    def forward(signum, _frame):
        if child.poll() is None:
            child.send_signal(signum)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, forward)
        except (ValueError, OSError):
            pass

    while True:
        try:
            code = child.wait()
            break
        except KeyboardInterrupt:
            continue
    sys.exit(code)


if __name__ == "__main__":
    main()
