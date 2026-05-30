#!/usr/bin/env node
import 'dotenv/config';
import { Client, AccountId, PrivateKey, AccountBalanceQuery } from '@hiero-ledger/sdk';
import { loadAgentEnv } from './config.js';

/**
 * Preflight: verify the agent can actually operate before a live demo.
 * Checks env, operator balance, RPC, and mirror-node reachability with real calls.
 * Exits non-zero on any hard failure so it is safe to gate a demo script on it.
 */
async function main(): Promise<void> {
  const env = loadAgentEnv();
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // 1. Operator balance (native testnet query).
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(env.HEDERA_OPERATOR_ID),
    PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY),
  );
  try {
    const bal = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(env.HEDERA_OPERATOR_ID))
      .execute(client);
    const hbar = bal.hbars.toBigNumber().toNumber();
    checks.push({
      name: 'operator balance',
      ok: hbar > 5,
      detail: `${hbar} HBAR (${env.HEDERA_OPERATOR_ID})`,
    });
  } catch (err) {
    checks.push({ name: 'operator balance', ok: false, detail: msg(err) });
  } finally {
    client.close();
  }

  // 2. JSON-RPC reachable (chain id).
  const rpcUrl = process.env.HEDERA_RPC_URL ?? 'https://testnet.hashio.io/api';
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    });
    const json = (await res.json()) as { result?: string };
    checks.push({
      name: 'json-rpc',
      ok: Boolean(json.result),
      detail: json.result ? `chainId ${json.result}` : 'no result',
    });
  } catch (err) {
    checks.push({ name: 'json-rpc', ok: false, detail: msg(err) });
  }

  // 3. Mirror node reachable.
  const mirror = process.env.HEDERA_MIRROR_NODE_URL ?? 'https://testnet.mirrornode.hedera.com';
  try {
    const res = await fetch(`${mirror}/api/v1/network/nodes?limit=1`);
    checks.push({ name: 'mirror node', ok: res.ok, detail: `HTTP ${res.status}` });
  } catch (err) {
    checks.push({ name: 'mirror node', ok: false, detail: msg(err) });
  }

  // 4. LLM key present (presence only; no spend).
  const hasKey =
    env.LLM_PROVIDER === 'google' ? Boolean(env.GEMINI_API_KEY) : Boolean(env.OPENAI_API_KEY);
  checks.push({
    name: 'llm key',
    ok: hasKey,
    detail: `${env.LLM_PROVIDER} (${env.LLM_MODEL ?? 'default model'})`,
  });

  for (const c of checks) {
    process.stdout.write(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(16)} ${c.detail}\n`);
  }
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    process.stdout.write(`\n${failed.length} check(s) failed.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('\nAll preflight checks passed. Ready for a live run.\n');
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error(msg(err));
  process.exitCode = 1;
});
