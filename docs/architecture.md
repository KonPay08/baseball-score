# Architecture

## Overview

Prototypeではシンプルな構成を優先する。

Default:

Browser
↓
TanStack Start
↓
Cloudflare Workers
↓
Optional Data Layer

## Frontend

- React
- TanStack Start
- Tailwind CSS
- shadcn/ui

## Backend

原則としてTanStack Start / Cloudflare Workers内で構築する。

Prototype段階では不要なService分割を行わない。

## Database

必要な場合のみ利用する。

Default candidate:

Cloudflare D1

## Authentication

Prototype GoalにAuthenticationが必要な場合のみ実装する。

本格的なAuthentication / Authorization設計は商品化フェーズで再評価する。

## External Services

TBD

## Architecture Principles

- Simple
- Replaceable
- Observable enough to debug
- Minimal dependencies
- Avoid premature abstraction
