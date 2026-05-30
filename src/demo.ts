#!/usr/bin/env node
import 'dotenv/config';
import { loadAgentEnv } from './config.js';
import { createTreasuryAgent } from './agent.js';

/**
 * End-to-end live demo: a full tokenized-equity lifecycle driven entirely by
 * natural-language instructions through the LLM agent. Every step is a real tool
 * call against live Hedera testnet — real contracts, real HBAR, real HCS messages.
 *
 * Story: "Acme Robotics raises a Series A." A treasury operator walks the agent
 * through deploy -> register -> KYC -> issue -> cap table -> document anchor ->
 * audit trail, the way a real back-office user would.
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
}

interface DemoContext {
  investor: string;
  symbol: string;
  isin: string;
}

const HR = '─'.repeat(72);

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
    title: 'Anchor the term sheet as a document-of-record',
    instruction: (c) =>
      `Anchor a document titled "Acme Robotics Series A Term Sheet" to the registry for symbol ` +
      `${c.symbol}. The document content is: "Series A Preferred. Price $4.00/share. ` +
      `Pre-money $40M. Liquidation preference 1x non-participating. Board: 2 founders, 1 investor."`,
  },
  {
    n: 6,
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

  // A unique symbol per run keeps registry resolution unambiguous across repeat demos.
  // The tool caps symbols at 8 chars, so use a short prefix + 4-digit suffix (e.g. ACME1234).
  const stamp = String(Date.now()).slice(-4);
  const ctx: DemoContext = {
    investor,
    symbol: `ACME${stamp}`,
    isin: 'US0378331005',
  };

  // Optional step filter from argv (e.g. `npm run demo -- 1 3`).
  const want = process.argv
    .slice(2)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n));
  const steps = want.length ? STEPS.filter((s) => want.includes(s.n)) : STEPS;

  process.stdout.write(
    `\nEquity Treasury Agent — live e2e demo on ${env.HEDERA_NETWORK.toUpperCase()}\n` +
      `Investor: ${ctx.investor}\nSecurity symbol: ${ctx.symbol}\n${HR}\n`,
  );

  const agent = await createTreasuryAgent(env);
  let failures = 0;

  try {
    for (const step of steps) {
      const instruction = step.instruction(ctx);
      process.stdout.write(`\n[${step.n}/${STEPS.length}] ${step.title}\n> ${instruction}\n\n`);
      const started = Date.now();
      try {
        const reply = await agent.run(instruction);
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        process.stdout.write(`${reply}\n\n(${secs}s)\n${HR}\n`);
      } catch (err) {
        failures += 1;
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`STEP ${step.n} FAILED: ${msg}\n${HR}\n`);
      }
    }
  } finally {
    agent.client.close();
  }

  if (failures) {
    process.stdout.write(`\nDemo finished with ${failures} failed step(s).\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`\nDemo complete. All steps ran against live ${env.HEDERA_NETWORK}.\n`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
