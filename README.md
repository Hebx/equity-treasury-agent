# Equity Treasury Agent

[![npm](https://img.shields.io/npm/v/equity-treasury-agent.svg)](https://www.npmjs.com/package/equity-treasury-agent)
[![plugin](https://img.shields.io/npm/v/%40hebx%2Fhak-ats-plugin.svg?label=%40hebx%2Fhak-ats-plugin)](https://www.npmjs.com/package/@hebx/hak-ats-plugin)
[![Hedera](https://img.shields.io/badge/Hedera-testnet%20%7C%20mainnet-7056F5.svg)](https://hedera.com)

**Tell it, in a sentence, to issue a tokenized stock — and watch a real ERC-1400
security, its cap table, its investor KYC, and its documents of record land on Hedera.**

A company's cap table, KYC file, and signed term sheets usually live in three
different spreadsheets and a shared drive that no outsider can trust. The Equity
Treasury Agent collapses all three onto one chain and hands them to a treasury
operator who speaks plain English. It wires the
[`@hebx/hak-ats-plugin`](https://www.npmjs.com/package/@hebx/hak-ats-plugin) Hedera
Agent Kit plugin into a LangGraph ReAct agent: you describe the outcome, the model
picks the right tool and arguments, and every action settles as a real transaction
with a tamper-evident record behind it.

Nothing here is scripted. The LLM decides which tool to call and with what
arguments; every call hits the live network — real contracts, real HBAR, real
Hedera Consensus Service messages. The repo ships a one-command lifecycle demo
(`npm run demo`) that proves it end to end on testnet.

## What it does

Through the ATS plugin, the agent can:

- **Deploy** a tokenized **equity** security (an ERC-1400 / Asset Tokenization Studio
  diamond) and return its address and transaction hash
- **Deploy** a tokenized **bond** with par value and a start/maturity schedule
- **Issue** units to an investor
- **Transfer** units between holders through the compliance path
- **Force-transfer** units (regulatory clawback) via the ERC-1644 controller authority
  for lost-key recovery, court orders, or sanctions enforcement
- **Pause / unpause** all transfers on a security (emergency freeze)
- **Read** a security's info (name, symbol, supply, paused state)
- **Read** the cap table (holders and balances) from on-chain Transfer events
- **Pay a dividend** as a pro-rata HBAR fan-out across current holders

Investors, holders, and securities can be named by **EVM address (`0x...`) or Hedera id
(`0.0.x`)** interchangeably — ids are resolved automatically, and reads report both forms.

Plus an on-chain **registry and audit trail** built on Hedera Consensus Service (HCS):

- **Register** a deployed security so it can be **resolved by name, symbol, or ISIN**
  instead of a raw `0x` address
- **Log corporate actions** (issue, transfer, dividend, pause) as a tamper-evident trail
- **Attest investor KYC** (GRANTED / REVOKED) as an auditable record
- **Anchor documents** (term sheets, prospectuses, board resolutions) by SHA-256 digest

## Network: opt-in, at your own risk

Network selection works like any other Hedera library: set `HEDERA_NETWORK` and you
operate on that network.

- `HEDERA_NETWORK=testnet` (default) → Hedera testnet, test HBAR
- `HEDERA_NETWORK=mainnet` → Hedera mainnet, **real value, irreversible transactions**

There is no separate flag and no mainnet "deny." Mainnet is a deliberate, explicit
choice. The safety policies that *do* stay enforced on every network are the
**max-supply cap** and the **jurisdiction allowlist**. On-chain KYC enforcement via the
ERC-3643 identity registry is a roadmap item; today KYC is recorded as an HCS
attestation, not a transfer-gating on-chain binding.

## User story

> *"As the treasury operator at a mid-size private company, I want to stand up our
> Series A equity on-chain, bring our cap table into one auditable place, and run
> investor operations in plain English — without hand-deploying contracts or
> reconciling spreadsheets."*

A walk-through of that story with this agent:

```text
> Deploy a new equity "Acme Series A" symbol ACME ISIN US0378331005,
  max supply 1000000, USD, allowed countries US and GB, voting rights, preferred dividend.
  → deploys the diamond, returns 0xACME… + tx hash

> Register ACME in the registry so we can refer to it by name.
  → anchors a security.registered record to the HCS topic

> Attest KYC granted for investor 0xInvestor1 (jurisdiction US).
  → anchors a kyc.attestation record

> Issue 250000 ACME to 0xInvestor1, then show me the cap table.
  → issues units, then reads holders + balances from the mirror node

> Anchor our Series A term sheet (here is the text…) to ACME.
  → hashes the document and anchors the SHA-256 as the document-of-record

> Pay a dividend of 50 HBAR to ACME holders.
  → pro-rata HBAR fan-out across the current cap table
```

Everything above is a real transaction, and every administrative step leaves a
tamper-evident record on the HCS registry.

## Real enterprise use case: tokenized bond issuance with a compliance audit trail

A regional **real-estate fund** raises a €10M development bond and wants the raise to
be auditable end-to-end for its regulator, with the ability to enforce sanctions and
recover lost holdings.

1. **Issue the instrument.** Deploy a bond `RE-FUND-2031` (EUR par value, 6-year
   maturity), capped supply, with the country control list set to its allowed EU
   jurisdictions. The jurisdiction-allowlist policy blocks any disallowed country at
   deploy time.
2. **Onboard investors.** As each investor clears KYC/AML off-chain, the operator
   anchors a KYC attestation to the registry — an independent, timestamped record the
   regulator can read without trusting the fund's internal database.
3. **Distribute.** Issue bond units to cleared investors; every issuance is logged as a
   corporate action with its transaction hash.
4. **Anchor the prospectus.** The offering memorandum's SHA-256 digest is anchored, so
   anyone can prove the document on file is the exact one investors received.
5. **Enforce and recover.** If a holder is later sanctioned, the operator can
   **pause** the security or **force-transfer** the holding to a custody address under
   the ERC-1644 controller authority — and that action, too, lands in the audit trail.
6. **Report.** At any time, reading the registry reproduces the full lifecycle:
   registration, KYC attestations, issuances, transfers, freezes, and document anchors —
   reconstructed independently from the Hedera mirror node, not from the fund's books.

The result is a security whose entire administrative history is verifiable by a third
party, which is exactly what a securities regulator expects of a transfer agent.

## Proof: a clean end-to-end run on live testnet

The lifecycle below was driven entirely by natural language through the LLM agent on
Hedera testnet (model `gemini-2.5-flash`, operator `0.0.9050506`). Every value is
tool-returned and confirmed on-chain or via the mirror node — not lifted from the
agent's prose. Reproduce it with `npm run demo`.

| Step | Action | On-chain result |
|---|---|---|
| 1 | Deploy + register equity | diamond `0x997f2c7a…0f5b94` · HCS topic `0.0.9105211` seq 1 |
| 2 | Attest investor KYC | registry seq 2 (GRANTED, US, ref `acme-sa-001`) |
| 3 | Issue 50,000 shares | tx `0x96dcac85…49ad5` |
| 4 | Read cap table | total supply 50,000 · 1 holder (from Transfer events) |
| 5 | Issue 25,000 more, addressed by Hedera id `0.0.x` | id resolved to the holder's EVM address; balance → 75,000, still 1 holder |
| 6 | Anchor term sheet | SHA-256 `a2cd29bc…08e6b3` · registry seq 3 |
| 7 | Replay audit trail | 1 security + 1 KYC + 1 document, all resolved |

Whole-lifecycle cost: ~1.9 HBAR, dominated by the deploy. Symbols and topics are minted
fresh per run, so repeats never collide.

> Steps 1–4, 6, 7 show values from a verified six-step run (2026-05-31). Step 5 — the
> follow-on issuance addressed by a Hedera account id — was added in agent `v0.2.0`
> (plugin `0.4.x`); its exact tx hash is filled in on your next `npm run demo`. Because
> step 5 re-issues to the *same* holder, the step 6/7 registry values are unchanged (an
> issuance is an on-chain mint, not a registry record), and step 4 is the pre-tranche
> snapshot.

## Architecture

One instruction in plain English fans out into a tool call, an on-chain transaction,
and an audit-trail record. The agent is a thin orchestrator; all capability lives in
the published plugin.

```
   “Issue 50,000 ACME shares to 0xInvestor”
                  │
                  ▼
      ┌───────────────────────┐
      │  LangGraph ReAct agent │   network-aware treasury persona
      └───────────┬───────────┘
                  │  picks tool + args (LLM, not a script)
                  ▼
      ┌───────────────────────┐
      │  @hebx/hak-ats-plugin  │   14 tools · policies enforced here
      └───────────┬───────────┘
                  │
        ┌─────────┴───────────────┐
        ▼                         ▼
  ┌───────────┐            ┌──────────────┐
  │  Hedera   │            │     HCS      │
  │  EVM /    │            │  registry +  │
  │  ATS      │            │  audit trail │
  │  diamonds │            │   (topic)    │
  └─────┬─────┘            └──────┬───────┘
        │  real tx                │  tamper-evident record
        ▼                         ▼
        └──────── mirror node (read-back) ────────┘
```

The lifecycle the agent walks, end to end:

```
  deploy ──▶ register ──▶ attest KYC ──▶ issue ──▶ cap table ──▶ issue by 0.0.x ──▶ anchor doc ──▶ audit trail
   (EVM)      (HCS)         (HCS)        (EVM)     (mirror)       (EVM, id→EVM)      (HCS)          (HCS)
```

The plugin is consumed as the published npm package `@hebx/hak-ats-plugin` (v0.4.x).

## Requirements

- Node.js >= 20
- A Hedera account (testnet or mainnet) with ECDSA keys and some HBAR
- A Google Gemini API key (default) or an OpenAI API key

## Setup

### Install from npm

The package ships an `ats-agent` bin:

```bash
npm install -g equity-treasury-agent

# configure (see .env.example in the repo for the full contract)
ats-agent 'Deploy a new equity "Acme Series A" symbol ACME ISIN US0378331005, max supply 1000000, USD, allowed country US, voting rights, preferred dividend.'
```

Or run it without installing, using `npx`:

```bash
npx equity-treasury-agent 'Show me the cap table for 0x<diamond>'
```

The agent reads credentials from the environment (or a `.env` in the working
directory). Copy [`.env.example`](./.env.example) and fill in your operator creds
and an LLM key before running (`GEMINI_API_KEY` for Google, or `OPENAI_API_KEY` with
optional `OPENAI_BASE_URL` for OpenAI or a local kiro-gateway proxy). Set
`HEDERA_NETWORK=mainnet` only when you intend to operate on mainnet with real value.

### From source

```bash
git clone <this-repo>
cd equity-treasury-agent

# install agent + plugin dependencies
npm install

# configure
cp .env.example .env   # fill in operator creds + LLM key (see .env.example)
```

## Usage

Verify the environment before a live run (prints the active network and warns on mainnet):

```bash
npm run preflight
```

One-shot:

```bash
npm run agent -- 'Deploy a new equity "Acme Series A" symbol ACME ISIN US0378331005, max supply 1000000, USD, allowed country US, voting rights, preferred dividend.'
```

Interactive:

```bash
npm run agent
> register ACME in the registry, then resolve "ACME" to its address
> issue 1000 units of 0x<diamond> to 0x<investor>, then show the cap table
> pause 0x<diamond>
> pay a dividend of 5 HBAR to holders of 0x<diamond>
> exit
```

### Live end-to-end demo

The repo ships a scripted lifecycle that drives the agent through deploy → register →
KYC → issue → cap table → follow-on issue addressed by Hedera account id → document
anchor → audit trail, each as a real natural-language instruction against live testnet:

```bash
npm run preflight   # confirm balance, RPC, mirror, and LLM key first
npm run demo        # run the full story; npm run demo -- 1 3 runs only those steps
```

The demo uses a unique security symbol per run so repeat runs never collide. Each step
prints the instruction, the agent's reply (with diamond address, tx hashes, and the HCS
topic), and its timing. It exits non-zero if any step fails, so it is safe to gate a
release check on it.

## Notes

- **Network.** `HEDERA_NETWORK` selects testnet (default) or mainnet. Mainnet moves
  real value and is irreversible; the agent and preflight both surface the active
  network so you always know where you are.
- **Addresses.** Every address — the security and any investor / holder — can be given
  as either an **EVM address** (`0x...`) or a **Hedera id** (`0.0.x`). Ids are resolved to
  their canonical EVM address automatically before each on-chain call, so the two forms
  are interchangeable and the agent never has to ask you to convert. Reads echo both:
  the cap table reports each holder's account id alongside its EVM address, and issuance
  returns the investor's account id when you addressed them by id. (Dividends pay native
  HBAR to the `0.0.x` accounts resolved from the cap table.)
- **ISIN.** Deployment requires a checksum-valid ISO-6166 ISIN. `US0378331005`
  (Apple) is a convenient valid value for testing.
- **Registry topic.** The first registry write creates an HCS topic and returns its id.
  Within a single agent session, later reads (resolve / list) automatically reuse that
  topic, so a deploy-then-resolve flow works out of the box. To reuse the **same**
  registry across separate runs, set `HCS_REGISTRY_TOPIC_ID` to the returned id.
- **Symbols.** Security symbols are capped at 8 characters (e.g. `ACME`, `RE2031`).
- **Cap-table lag.** The cap table is reconstructed from mirror-node Transfer logs,
  which trail a transaction by a few seconds. A read immediately after an issue may
  show stale data; re-read shortly after.
- **Bonds.** Equity and bond instruments are supported. Coupon-rate facets are not yet
  wired — the agent deploys the core bond instrument with its par value and maturity.
- **Safety.** Max-supply-cap and jurisdiction-allowlist policies are enforced inside the
  plugin tools, not by the prompt.
- **LLM rate limits.** The agent retries transient `429`/`5xx` responses automatically
  (`LLM_MAX_RETRIES`, default 4). A hard *daily* quota cap (e.g. the Gemini free tier's
  20 requests/day) is not something retries can defeat — use a paid Gemini key or route
  through local **kiro-gateway** (`LLM_PROVIDER=openai`, `OPENAI_BASE_URL=http://127.0.0.1:8000/v1`,
  `OPENAI_API_KEY` = `PROXY_API_KEY`, model `claude-haiku-4.5` or `claude-sonnet-4.5`).

## Scripts

| Script | Description |
|---|---|
| `npm run preflight` | Check network, env, operator balance, RPC, mirror node, LLM key (+ proxy when set) |
| `npm run agent` | Run the agent (one-shot with args, or interactive) |
| `npm run demo` | Run the full live lifecycle demo on testnet |
| `npm run build` | Type-build the agent to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |

## License

MIT
