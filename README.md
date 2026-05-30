# Equity Treasury Agent

[![npm](https://img.shields.io/npm/v/equity-treasury-agent.svg)](https://www.npmjs.com/package/equity-treasury-agent)

An LLM-powered enterprise treasury agent that issues and administers tokenized
securities on Hedera testnet from natural language. It wires the
[`@hebx/hak-ats-plugin`](https://www.npmjs.com/package/@hebx/hak-ats-plugin) Hedera
Agent Kit plugin into a LangGraph ReAct agent: you describe what you want, the model
selects and calls the on-chain tools, and every action settles as a real transaction.

This is not a scripted demo. Tool selection and arguments are decided by the LLM,
and every tool call hits the live network — real contracts, real testnet HBAR.

## What it does

Through the ATS plugin, the agent can:

- **Deploy** a tokenized equity security (an ERC-1400 / Asset Tokenization Studio
  diamond) and return its address and transaction hash
- **Issue** units to an investor
- **Transfer** units between holders through the compliance path
- **Read** a security's info (name, symbol, supply, paused state)
- **Read** the cap table (holders and balances) from on-chain Transfer events
- **Pay a dividend** as a pro-rata HBAR fan-out across current holders

Equity only (bonds are not yet supported by the deployed reference configuration).
Testnet only — the plugin's policies hard-deny mainnet.

## Architecture

```
natural language
      │
      ▼
LangGraph ReAct agent  ── system prompt (treasury persona) ──┐
      │                                                       │
      │  toolkit.getTools()                                   │
      ▼                                                       │
HederaLangchainToolkit  ◄── @hebx/hak-ats-plugin (6 tools) ───┘
      │
      ▼
Hedera testnet (Hashio JSON-RPC) + mirror node
ATS factory 0.0.7512002 · resolver 0.0.7511642
```

The plugin is consumed as the published npm package `@hebx/hak-ats-plugin`.

## Requirements

- Node.js >= 20
- A Hedera **testnet** account with ECDSA keys and some HBAR
- A Google Gemini API key (default) or an OpenAI API key

## Setup

### Install from npm

The package ships an `ats-agent` bin:

```bash
npm install -g equity-treasury-agent

# configure (see .env.example in the repo for the full contract)
ats-agent 'Deploy a new equity "Acme Series A" symbol ACME ISIN US0378331005, max supply 1000000, USD, allowed country US, voting rights, preferred dividend.'
```

The agent reads credentials from the environment (or a `.env` in the working
directory). Copy [`.env.example`](./.env.example) and fill in your operator creds
and `GEMINI_API_KEY` before running.

### From source

```bash
git clone <this-repo>
cd equity-treasury-agent

# install agent + plugin dependencies
npm install

# configure
cp .env.example .env   # fill in operator creds + GEMINI_API_KEY
```

## Usage

Verify the environment before a live run:

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
> issue 1000 units of 0x<diamond> to 0x<investor>, then show the cap table
> pay a dividend of 5 HBAR to holders of 0x<diamond>
> exit
```

## Notes

- **Addresses.** Issuance and transfers use **EVM addresses** (`0x...`), not Hedera
  `0.0.x` ids. The agent will ask for the EVM address if you give it an account id.
- **ISIN.** Deployment requires a checksum-valid ISO-6166 ISIN. `US0378331005`
  (Apple) is a convenient valid value for testnet.
- **Cap-table lag.** The cap table is reconstructed from mirror-node Transfer logs,
  which trail a transaction by a few seconds. A read immediately after an issue may
  show stale data; re-read shortly after.
- **Safety.** Mainnet-deny, max-supply-cap, and jurisdiction-allowlist policies are
  enforced inside the plugin tools, not by the prompt.

## Scripts

| Script | Description |
|---|---|
| `npm run preflight` | Check env, operator balance, RPC, mirror node, LLM key |
| `npm run agent` | Run the agent (one-shot with args, or interactive) |
| `npm run build` | Type-build the agent to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |

## License

MIT
