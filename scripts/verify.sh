#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

pnpm typecheck
pnpm lint
pnpm test
pnpm build
