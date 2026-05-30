import { Client, AccountId, PrivateKey } from '@hiero-ledger/sdk';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AgentEnv } from './config.js';

/**
 * Native Hedera client for the operator. The ATS plugin signs its EVM contract
 * calls through its own internal local ECDSA signer; this client satisfies the
 * toolkit constructor and backs native operations such as the dividend HBAR
 * fan-out. Testnet only.
 */
export function buildHederaClient(env: AgentEnv): Client {
  return Client.forTestnet().setOperator(
    AccountId.fromString(env.HEDERA_OPERATOR_ID),
    PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY),
  );
}

/**
 * Build the chat model from env. Defaults to Google Gemini; set LLM_PROVIDER=openai
 * to switch. temperature=0 keeps tool selection stable without making the agent
 * deterministic — the LLM still chooses tools and arguments from natural language.
 */
export async function buildLlm(env: AgentEnv): Promise<BaseChatModel> {
  if (env.LLM_PROVIDER === 'openai') {
    const { ChatOpenAI } = await import('@langchain/openai');
    return new ChatOpenAI({
      model: env.LLM_MODEL ?? 'gpt-4o-mini',
      temperature: 0,
      apiKey: env.OPENAI_API_KEY,
    }) as unknown as BaseChatModel;
  }
  const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
  return new ChatGoogleGenerativeAI({
    model: env.LLM_MODEL ?? 'gemini-2.5-flash',
    temperature: 0,
    apiKey: env.GEMINI_API_KEY,
  }) as unknown as BaseChatModel;
}
