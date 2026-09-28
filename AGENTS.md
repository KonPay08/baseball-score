# Agent Instructions

## Goal

このRepositoryの目的は、ユーザーとの認識合わせ・仮説検証に利用できる高品質なプロトタイプを素早く構築することである。

完成度よりも検証速度を優先する。

ただし、コード品質・再現性・検証可能性を著しく損なう実装は避ける。

---

## Before Starting

タスク開始前に以下を行う。

1. `PROJECT.md` を読む
2. タスクに関連する `docs/` を読む
3. 既存実装を確認する
4. 要件と既存実装に矛盾がないか確認する

必要のないドキュメントを大量にContextへ読み込まない。

---

## Implementation Principles

- 要件を勝手に追加しない
- 未決定事項を推測して重要仕様を確定しない
- Prototype Goalを優先する
- Core Use Caseを最優先する
- 過剰設計しない
- 将来使うかもしれない機能を先回りして作らない
- 既存Architectureを尊重する
- 変更範囲を必要最小限にする
- UIは実際に操作可能な状態まで実装する

---

## Prototype Principles

Prototypeでは以下を優先する。

1. User Experience
2. Core Use Case
3. Feedback Speed
4. Implementation Speed
5. Code Perfection

本番品質の以下は、明示的な要求がない限りPrototypeでは優先しない。

- 高度なScaling
- 複雑なPermission
- 完全なObservability
- Production Migration
- 高度なOptimization
- 完全なMulti Tenant対応

---

## Environment

Environment構築については `docs/development.md` を参照する。

基本コマンド：

Setup:

./scripts/setup.sh

Development:

./scripts/dev.sh

Test:

./scripts/test.sh

Verification:

./scripts/verify.sh

---

## Verification

タスク完了前に必ずVerificationを行う。

最低限：

- Type Check
- Lint
- Unit Test
- Build

UIまたはユーザーフローを変更した場合：

- Browserで動作確認
- Core Use Case確認
- Console Error確認

適用可能な場合：

- E2E Test

Verificationに失敗した状態でタスクを完了扱いしない。

---

## Documentation

以下が変更された場合、関連ドキュメントを更新する。

- Product behavior
- Domain rule
- Architecture
- Development setup

重要なArchitecture Decisionを行った場合は、

`docs/decisions/`

へ記録する。

---

## Production Safety

明示的な許可がない限り以下を行わない。

- ProductionへのDeploy
- Production Database変更
- Production Secret利用
- Production Data変更
- Production External Service操作

Prototype / Development / Sandbox環境を使用する。

---

## Output Contract

タスク終了時は以下を報告する。

### Changes

何を変更したか。

### Verification

実行した確認内容と結果。

### Preview

確認可能なURLまたは起動方法。

### Decisions

実装中に行った重要な判断。

### Unknowns

ユーザーまたは顧客への確認が必要な事項。

### Next

次に検証すると良い事項がある場合のみ記載する。
