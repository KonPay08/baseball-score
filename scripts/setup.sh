#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

# Dependency install
pnpm install

# 必要な初期ファイル作成
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Setup complete."
