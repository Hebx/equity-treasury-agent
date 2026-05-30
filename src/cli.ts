#!/usr/bin/env node
import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadAgentEnv } from './config.js';
import { createTreasuryAgent } from './agent.js';

/**
 * CLI for the equity treasury agent.
 *
 *   npm run agent -- "deploy an equity Acme Series A ..."   # one-shot
 *   npm run agent                                           # interactive REPL
 *
 * Operates on live Hedera testnet via the ATS plugin. Real transactions, real HBAR.
 */
async function main(): Promise<void> {
  const env = loadAgentEnv();
  const instruction = process.argv.slice(2).join(' ').trim();

  const agent = await createTreasuryAgent(env);

  try {
    if (instruction) {
      const reply = await agent.run(instruction);
      stdout.write(`\n${reply}\n`);
      return;
    }

    // Interactive mode.
    stdout.write(
      'Equity Treasury Agent (Hedera testnet). Type an instruction, or "exit" to quit.\n',
    );
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      for (;;) {
        const line = (await rl.question('\n> ')).trim();
        if (!line) continue;
        if (line === 'exit' || line === 'quit') break;
        try {
          const reply = await agent.run(line);
          stdout.write(`\n${reply}\n`);
        } catch (err) {
          stdout.write(`\nerror: ${err instanceof Error ? err.message : String(err)}\n`);
        }
      }
    } finally {
      rl.close();
    }
  } finally {
    agent.client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
