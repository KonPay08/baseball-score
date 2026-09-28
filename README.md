# Prototype

顧客ヒアリングやアイデアから短時間で動作するプロトタイプを構築するためのRepository。

## Getting Started

```bash
./scripts/setup.sh
./scripts/dev.sh
```

## Documents

- [PROJECT.md](PROJECT.md) — 案件のContext（最初に読む）
- [AGENTS.md](AGENTS.md) — AI Agentの働き方
- [docs/product.md](docs/product.md) — Product Context
- [docs/domain.md](docs/domain.md) — Domain Context
- [docs/architecture.md](docs/architecture.md) — Architecture
- [docs/development.md](docs/development.md) — Development Environment

## Commands

| Command | 用途 |
|---|---|
| `./scripts/setup.sh` | Setup |
| `./scripts/dev.sh` | Development server |
| `./scripts/test.sh` | Test |
| `./scripts/verify.sh` | Verification（タスク完了前に必ず実行） |

## Technology Stack

- TypeScript / TanStack Start / React / Vite
- Tailwind CSS / shadcn/ui
- Cloudflare Workers（DBが必要な場合はCloudflare D1）
- Vitest / Playwright
- pnpm
