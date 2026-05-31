#!/usr/bin/env node
import 'dotenv/config';
import { loadAgentEnv } from './config.js';
import { createTreasuryAgent } from './agent.js';
import * as ui from './ui.js';

/**
 * End-to-end live demo: a full tokenized-equity lifecycle driven entirely by
 * natural-language instructions through the LLM agent. Every step is a real tool
 * call against live Hedera testnet — real contracts, real HBAR, real HCS messages.
 *
 * Story: "Acme Robotics raises a Series A." A treasury operator walks the agent
 * through deploy -> register -> KYC -> issue -> cap table -> follow-on issue by
 * Hedera account id -> updated cap table -> document anchor -> audit trail, the way a
 * real back-office user would. The account-id step proves that holders can be addressed
 * by either a 0x EVM address or a Hedera id (0.0.X), resolved automatically, with reads
 * echoing both forms (plugin v0.4.x).
 *
 *   npm run demo            # run the whole story
 *   npm run demo -- 1 2 3   # run only the listed step numbers
 *
 * Gated on testnet by default. Set ALLOW_MAINNET_DEMO=1 to permit mainnet (it will
 * still refuse silently-destructive steps without that flag).
 */

interface DemoStep {
  n: number;
  title: string;
  /** Natural-language instruction handed to the LLM agent verbatim. */
  instruction: (ctx: DemoContext) => string;
  /** Optional pause before this step runs, to let the mirror node index the prior
   *  write before a read (mirror-node indexing lags the consensus tx by a few seconds). */
  settleMs?: number;
}

interface DemoContext {
  investor: string;
  /** Same holder as `investor`, expressed as a Hedera id (0.0.X). Drives the step-5
   *  account-id resolution demo; undefined when INVESTOR_ACCOUNT_ID is unset. */
  investorAccountId?: string;
  symbol: string;
  isin: string;
}

const STEPS: DemoStep[] = [
  {
    n: 1,
    title: 'Deploy the Series A equity',
    instruction: (c) =>
      `Deploy a new equity security named "Acme Robotics Series A" with symbol ${c.symbol}, ` +
      `ISIN ${c.isin}, a maximum supply of 1,000,000 shares, currency USD, allowed countries ` +
      `US and MA as an allowlist, with voting rights and PREFERRED dividend rights. ` +
      `After it deploys, register it in the HCS securities registry so we can resolve it by symbol later.`,
  },
  {
    n: 2,
    title: 'Attest investor KYC',
    instruction: (c) =>
      `Record a KYC attestation marking investor ${c.investor} as GRANTED, jurisdiction US, ` +
      `reference "acme-sa-001", on the securities registry.`,
  },
  {
    n: 3,
    title: 'Issue shares to the investor',
    instruction: (c) =>
      `Resolve the security with symbol ${c.symbol} to its address, then issue 50,000 shares ` +
      `to investor ${c.investor}.`,
  },
  {
    n: 4,
    title: 'Read the cap table',
    instruction: (c) =>
      `Resolve symbol ${c.symbol} and show me the current cap table (holders and balances).`,
  },
  {
    n: 5,
    title: 'Issue a follow-on tranche addressed by Hedera account id',
    instruction: (c) =>
      `Issue another 25,000 shares of ${c.symbol} to investor ${c.investorAccountId} — ` +
      `note that's a Hedera account id (0.0.X), not an EVM address. Resolve it and confirm ` +
      `the issuance with the transaction hash.`,
  },
  {
    n: 6,
    title: 'Read the updated cap table (both address forms)',
    // Reads run after the issue above; the mirror node needs a few seconds to index the
    // new Transfer event, so settle before reading or the balance comes back stale.
    settleMs: 6000,
    instruction: (c) =>
      `Resolve symbol ${c.symbol} and show me the updated cap table, with each holder's ` +
      `EVM address and Hedera account id (0.0.X).`,
  },
  {
    n: 7,
    title: 'Anchor the term sheet as a document-of-record',
    instruction: (c) =>
      `Anchor a document titled "Acme Robotics Series A Term Sheet" to the registry for symbol ` +
      `${c.symbol}. The document content is: "Series A Preferred. Price $4.00/share. ` +
      `Pre-money $40M. Liquidation preference 1x non-participating. Board: 2 founders, 1 investor."`,
  },
  {
    n: 8,
    title: 'Read back the registry audit trail',
    instruction: () =>
      `List the full securities-registry audit trail and summarize what records exist ` +
      `(registered securities, KYC attestations, document anchors).`,
  },
];

async function main(): Promise<void> {
  const env = loadAgentEnv();

  if (env.HEDERA_NETWORK === 'mainnet' && process.env.ALLOW_MAINNET_DEMO !== '1') {
    throw new Error(
      'Refusing to run the demo on mainnet. Set ALLOW_MAINNET_DEMO=1 to override (spends real value).',
    );
  }

  const investor =
    env.INVESTOR_EVM_ADDRESS ??
    (() => {
      throw new Error('INVESTOR_EVM_ADDRESS must be set in .env for the demo');
    })();

  // Same holder, as a Hedera id, for the account-id resolution step. Optional: if it's
  // not set we drop that step rather than send a malformed instruction (see below).
  const investorAccountId = env.INVESTOR_ACCOUNT_ID;

  // A unique symbol per run keeps registry resolution unambiguous across repeat demos.
  // The tool caps symbols at 8 chars, so use a short prefix + 4-digit suffix (e.g. ACME1234).
  const stamp = String(Date.now()).slice(-4);
  const ctx: DemoContext = {
    investor,
    investorAccountId,
    symbol: `ACME${stamp}`,
    isin: 'US0378331005',
  };

  // Optional step filter from argv (e.g. `npm run demo -- 1 3`).
  const want = process.argv
    .slice(2)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n));
  const selected = want.length ? STEPS.filter((s) => want.includes(s.n)) : STEPS;

  // Steps 5 (account-id issuance) and 6 (the resulting updated cap-table read) need
  // INVESTOR_ACCOUNT_ID to demonstrate id -> EVM resolution. If it's unset, drop both
  // rather than issuing to `undefined` or reading an unchanged cap table.
  const steps = investorAccountId ? selected : selected.filter((s) => s.n !== 5 && s.n !== 6);
  if (!investorAccountId && selected.some((s) => s.n === 5)) {
    ui.note('INVESTOR_ACCOUNT_ID not set — skipping steps 5 & 6 (account-id issuance + updated cap table). Set it in .env to include them.');
  }

  ui.banner({
    network: env.HEDERA_NETWORK,
    model: env.LLM_MODEL ?? (env.LLM_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'),
    provider: env.LLM_PROVIDER,
    investor: ctx.investor,
    symbol: ctx.symbol,
    steps: steps.length,
  });

  const agent = await createTreasuryAgent(env);
  let failures = 0;
  const runStarted = Date.now();

  try {
    for (const step of steps) {
      const instruction = step.instruction(ctx);
      ui.stepHeader(step.n, STEPS.length, step.title);
      ui.instruction(instruction);
      if (step.settleMs) {
        ui.note(`settling ${(step.settleMs / 1000).toFixed(0)}s for the mirror node to index the prior write…`);
        await new Promise((r) => setTimeout(r, step.settleMs));
      }
      const started = Date.now();
      const spin = ui.spinner('agent is working…');
      try {
        const reply = await agent.run(instruction);
        spin.stop();
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        ui.reply(reply);
        ui.stepOk(secs);
      } catch (err) {
        spin.stop();
        failures += 1;
        const msg = err instanceof Error ? err.message : String(err);
        ui.stepFail(step.n, msg);
      }
    }
  } finally {
    agent.client.close();
  }

  ui.summary({
    total: steps.length,
    failures,
    network: env.HEDERA_NETWORK,
    elapsedSec: ((Date.now() - runStarted) / 1000).toFixed(1),
  });
  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
