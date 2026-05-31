# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0: minor versions may
introduce breaking changes.

## [0.2.2] - 2026-05-31

### Changed
- Docs + npm metadata release (no behavior change). Expanded the package `description`
  and `keywords` (adds `erc-1644`, `security-tokens`, `cap-table`, `dividends`, `kyc`,
  `hcs`, `audit-trail`, `rwa`) so the agent is discoverable for the full lifecycle, not
  just deploy/issue.
- README Proof block refreshed to the chain-verified **8-step** run on
  `claude-sonnet-4.5` via an OpenAI-compatible router: deploy+register, KYC, issue 50k by
  EVM address, cap table, issue 25k by Hedera account id, updated cap table (both address
  forms), term-sheet anchor, audit trail. Final on-chain `balanceOf` = `totalSupply` =
  75,000, one holder. Replaces the older 6-step Gemini values and the step-5 placeholder.
- Bumped the `@hebx/hak-ats-plugin` dependency to `^0.4.3`.

## [0.2.1] - 2026-05-31

### Changed
- Version bump for an npm republish. No source changes.

## [0.2.0] - 2026-05-31

### Added
- **OpenAI-compatible router support.** `OPENAI_BASE_URL` lets the OpenAI provider target
  any OpenAI-compatible proxy (Groq, Cerebras, or a local kiro-gateway), so the agent can
  run on Claude Sonnet/Haiku and other models, not just Google Gemini. Documented in
  `.env.example`.
- **Beautified live CLI** (`src/ui.ts`, zero dependencies): centered banner with network
  badge + model, per-step boxed headers with a progress bar, highlighted transaction
  hashes / addresses / Hedera ids / SHA-256 digests / HashScan links, a working spinner,
  and a closing summary. Auto-disables color off-TTY and when `NO_COLOR` is set, so piped
  logs and recordings stay clean.
- **Follow-on issuance addressed by Hedera account id** as a first-class demo step. The
  demo grew from 7 to 8 steps: the post-issue cap-table read is split from the issuance
  with a mirror-node settle delay so the updated balance is indexed before the read.

### Changed
- Prompt hardening: the agent treats every message as a real instruction and summarizes
  each tool result, fixing an intermittent case where smaller/thinking-heavy models
  narrated a greeting instead of the tool's outcome.

## [0.1.0] - 2026-05

### Added
- Initial agent: LangGraph ReAct orchestrator over `@hebx/hak-ats-plugin`, one-shot and
  interactive CLI (`ats-agent`), preflight checks, and the live lifecycle demo.

[0.2.2]: https://github.com/Hebx/equity-treasury-agent/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Hebx/equity-treasury-agent/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Hebx/equity-treasury-agent/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Hebx/equity-treasury-agent/releases/tag/v0.1.0
