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
  const isMainnet = env.HEDERA_NETWORK === 'mainnet';

  process.stdout.write(`Network: ${env.HEDERA_NETWORK.toUpperCase()}\n`);
  if (isMainnet) {
    process.stdout.write(
      'WARNING: mainnet is configured. Tools will spend real HBAR and moves are irreversible.\n',
    );
  }
  process.stdout.write('\n');

  // 1. Operator balance (native query on the configured network).
  const client = (isMainnet ? Client.forMainnet() : Client.forTestnet()).setOperator(
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
  const rpcUrl =
    process.env.HEDERA_RPC_URL ??
    (isMainnet ? 'https://mainnet.hashio.io/api' : 'https://testnet.hashio.io/api');
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
  const mirror =
    process.env.HEDERA_MIRROR_NODE_URL ??
    (isMainnet
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com');
  try {
    const res = await fetch(`${mirror}/api/v1/network/nodes?limit=1`);
    checks.push({ name: 'mirror node', ok: res.ok, detail: `HTTP ${res.status}` });
  } catch (err) {
    checks.push({ name: 'mirror node', ok: false, detail: msg(err) });
  }

  // 4. LLM key present (and optional OpenAI-compatible proxy reachability).
  const hasKey =
    env.LLM_PROVIDER === 'google' ? Boolean(env.GEMINI_API_KEY) : Boolean(env.OPENAI_API_KEY);
  const llmDetail =
    env.LLM_PROVIDER === 'openai' && env.OPENAI_BASE_URL
      ? `${env.LLM_PROVIDER} via ${env.OPENAI_BASE_URL} (${env.LLM_MODEL ?? 'default model'})`
      : `${env.LLM_PROVIDER} (${env.LLM_MODEL ?? 'default model'})`;
  checks.push({
    name: 'llm key',
    ok: hasKey,
    detail: llmDetail,
  });

  if (env.LLM_PROVIDER === 'openai' && env.OPENAI_BASE_URL && env.OPENAI_API_KEY) {
    try {
      const res = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/models`, {
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
      });
      checks.push({
        name: 'llm proxy',
        ok: res.ok,
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} (${env.OPENAI_BASE_URL})`,
      });
    } catch (err) {
      checks.push({ name: 'llm proxy', ok: false, detail: msg(err) });
    }
  }

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
