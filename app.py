"""
Nexus EMS Bot - launcher for Python hosting servers.

The bot is written for Node.js, but many hosting panels (Pterodactyl and the
like) give you a *Python* server whose start command is fixed to
"pip install -r requirements.txt" and then "python app.py". This file makes
that work while using as little disk as possible:

  * Node.js is downloaded once from nodejs.org (about 31 MB), checked against
    the official SHA-256 checksum, and only the `node` program is kept
    (about 125 MB) in the .node folder. Nothing goes through pip or /tmp.
  * The upload zip already contains the built bot and its JavaScript
    dependencies (node_modules), so nothing is installed on the host.

Settings live in .env (see .env.example). On a Node.js server, ignore this
file and run `npm install` then `npm start`.
"""

from __future__ import annotations

import glob
import hashlib
import os
import platform
import shutil
import signal
import subprocess
import sys
import tarfile
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
NODE_DIR = os.path.join(HERE, ".node")
NODE_BIN = os.path.join(NODE_DIR, "bin", "node")
NODE_LINE = "latest-v22.x"
MIN_NODE_MAJOR = 18
# The node program is ~125 MB; leave room to spare while it is written.
NEEDED_MB = 140


def say(message: str) -> None:
    print(f"[launcher] {message}", flush=True)


def fail(lines: list[str]) -> None:
    print("", flush=True)
    for line in lines:
        print(f"  {line}", flush=True)
    print("", flush=True)
    sys.exit(1)


def mb(n: float) -> str:
    return f"{n / 1024 / 1024:.0f} MB"


def node_version(node: str) -> int | None:
    try:
        out = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
        return int(out.lstrip("v").split(".")[0])
    except Exception:
        return None


def reclaim_space() -> None:
    """Removes what an earlier setup (Node.js through pip) left behind."""
    freed = 0
    targets = glob.glob(os.path.join(HERE, ".local", "lib", "python*", "site-packages", "nodejs_wheel*"))
    targets += glob.glob(os.path.join(HERE, ".local", "Lib", "site-packages", "nodejs_wheel*"))
    targets += [os.path.join(HERE, ".cache", "pip"), os.path.join(HERE, ".node.download")]
    for path in targets:
        if not os.path.exists(path):
            continue
        for root, _dirs, files in os.walk(path):
            for f in files:
                try:
                    freed += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
        else:
            try:
                os.remove(path)
            except OSError:
                pass
    if freed > 1024 * 1024:
        say(f"freed {mb(freed)} left over from the earlier setup")


class HashingReader:
    """Hashes a download while tarfile streams through it."""

    def __init__(self, raw):
        self.raw = raw
        self.sha = hashlib.sha256()

    def read(self, size=-1):
        chunk = self.raw.read(size)
        self.sha.update(chunk)
        return chunk


def linux_arch() -> str:
    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        return "x64"
    if machine in ("aarch64", "arm64"):
        return "arm64"
    fail([f"Nexus EMS Bot cannot start: this server's CPU ({machine}) has no Node.js download."])
    return ""


def download_node() -> None:
    free = shutil.disk_usage(HERE).free
    if free < NEEDED_MB * 1024 * 1024:
        fail(
            [
                f"Nexus EMS Bot cannot start: not enough disk space ({mb(free)} free, {NEEDED_MB} MB needed for Node.js).",
                "",
                "Free some space in the panel's File Manager - old bot files, logs, a .cache folder -",
                "or raise the server's disk limit, then press Start again.",
            ]
        )

    try:
        import lzma  # noqa: F401  (xz support; present in standard Python builds)

        ext, mode = "tar.xz", "r|xz"
    except ImportError:
        ext, mode = "tar.gz", "r|gz"

    base = f"https://nodejs.org/dist/{NODE_LINE}"
    arch = linux_arch()
    say("downloading Node.js from nodejs.org (one time, about 31 MB)...")
    with urllib.request.urlopen(f"{base}/SHASUMS256.txt", timeout=60) as res:
        sums = res.read().decode()
    entry = next((l.split() for l in sums.splitlines() if l.endswith(f"-linux-{arch}.{ext}")), None)
    if not entry:
        fail([f"Could not find a Node.js {NODE_LINE} download for linux-{arch}."])
    expected, name = entry[0], entry[1]

    partial = os.path.join(HERE, ".node.download")
    os.makedirs(os.path.dirname(NODE_BIN), exist_ok=True)
    found = False
    with urllib.request.urlopen(f"{base}/{name}", timeout=120) as res:
        reader = HashingReader(res)
        with tarfile.open(fileobj=reader, mode=mode) as archive:
            for member in archive:
                if member.isfile() and member.name.endswith("/bin/node"):
                    src = archive.extractfile(member)
                    with open(partial, "wb") as out:
                        shutil.copyfileobj(src, out, 1024 * 1024)
                    found = True
        # Read to the end so the checksum covers the whole file.
        while reader.read(1024 * 1024):
            pass

    if reader.sha.hexdigest() != expected:
        if os.path.exists(partial):
            os.remove(partial)
        fail(["The Node.js download did not match its official checksum - press Start to try again."])
    if not found:
        fail(["The Node.js download did not contain the node program - press Start to try again."])

    os.chmod(partial, 0o755)
    os.replace(partial, NODE_BIN)
    say(f"Node.js installed ({name})")


def find_node() -> str:
    if os.path.exists(NODE_BIN) and (node_version(NODE_BIN) or 0) >= MIN_NODE_MAJOR:
        return NODE_BIN
    system_node = shutil.which("node")
    if system_node and (node_version(system_node) or 0) >= MIN_NODE_MAJOR:
        return system_node
    if os.name == "nt":
        fail(["Install Node.js 18 or newer from https://nodejs.org, then run: npm install && npm start"])
    download_node()
    if (node_version(NODE_BIN) or 0) < MIN_NODE_MAJOR:
        shutil.rmtree(NODE_DIR, ignore_errors=True)
        fail(["The downloaded Node.js would not run on this server - press Start to try again."])
    return NODE_BIN


def main() -> None:
    os.chdir(HERE)
    reclaim_space()

    if not os.path.exists(os.path.join(HERE, "node_modules", "discord.js")):
        fail(
            [
                "Nexus EMS Bot cannot start: the node_modules folder is missing.",
                "",
                "Upload the complete nexus-ems-bot.zip (made with `npm run package` on your PC) and unzip it",
                "here - it includes node_modules. Do not upload a node_modules folder copied from elsewhere.",
            ]
        )
    if not os.path.exists(os.path.join(HERE, "dist", "index.js")):
        fail(["Nexus EMS Bot cannot start: the dist folder is missing. Upload the complete nexus-ems-bot.zip."])

    node = find_node()
    say(f"using Node.js v{node_version(node)}")

    env = dict(os.environ)
    env["PATH"] = os.path.dirname(node) + os.pathsep + env.get("PATH", "")

    say("starting Nexus EMS Bot")
    child = subprocess.Popen([node, os.path.join(HERE, "index.js")], cwd=HERE, env=env)

    # The panel's Stop button signals this process; pass it on so the bot
    # disconnects cleanly instead of being killed mid-request.
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
