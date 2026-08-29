#!/bin/sh
set -eu
case "$(uname -s)-$(uname -m)" in
Darwin-arm64) a=herdr-replay-macos-aarch64;; Darwin-x86_64) a=herdr-replay-macos-x86_64;; Linux-aarch64|Linux-arm64) a=herdr-replay-linux-aarch64;; Linux-x86_64) a=herdr-replay-linux-x86_64;; *) exit 1;; esac
mkdir -p bin
curl -fsSL "https://github.com/neospeed83/herdr-replay/releases/latest/download/$a" -o bin/herdr-replay
chmod +x bin/herdr-replay
