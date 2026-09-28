# Development

## Requirements

- Node.js
- pnpm
- Git

Node versionは `.nvmrc` を参照する。

## Setup

```bash
./scripts/setup.sh
```

## Development

```bash
./scripts/dev.sh
```

## Test

```bash
./scripts/test.sh
```

## Verification

```bash
./scripts/verify.sh
```

## Environment Variables

`.env.example` をコピーして利用する。

```bash
cp .env.example .env
```

Production Secretは使用しない。

## Cloud Agent

Cloud Agentは以下が実行できる状態を維持する。

```bash
git clone
./scripts/setup.sh
./scripts/dev.sh
```

複雑な手動設定を必要としないこと。

## Local Development

顧客との画面共有やリアルタイムなUI調整ではLocal Developmentを利用できる。

Local / Cloudで可能な限り同一のEnvironmentを利用する。
