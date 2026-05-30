import { Client } from '@hiero-ledger/sdk';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HederaLangchainToolkit } from '@hashgraph/hedera-agent-kit-langchain';
import { atsPlugin } from '@hebx/hak-ats-plugin';
import type { AgentEnv } from './config.js';
import { buildHederaClient, buildLlm } from './runtime.js';
import { TREASURY_SYSTEM_PROMPT } from './prompts.js';

export interface TreasuryAgent {
  /** Run one natural-language instruction; returns the agent's final text reply. */
  run(instruction: string): Promise<string>;
  /** Underlying Hedera client, so callers can close it on shutdown. */
  client: Client;
}

/**
 * Build the equity treasury agent: a LangGraph ReAct agent whose tools are the
 * live ATS plugin tools, registered through the Hedera Agent Kit LangChain toolkit.
 * The LLM chooses which tools to call and with what arguments — nothing here is
 * scripted or mocked.
 */
export async function createTreasuryAgent(env: AgentEnv): Promise<TreasuryAgent> {
  const client = buildHederaClient(env);

  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: { plugins: [atsPlugin] },
  });

  const llm = await buildLlm(env);
  const agent = createReactAgent({
    llm,
    tools: toolkit.getTools(),
    prompt: new SystemMessage(TREASURY_SYSTEM_PROMPT),
  });

  return {
    client,
    async run(instruction: string): Promise<string> {
      // recursionLimit bounds the ReAct loop so a confused model cannot spin
      // forever. A multi-step request (deploy -> issue -> cap table) needs a
      // handful of tool turns plus summaries; 24 leaves comfortable headroom.
      const response = await agent.invoke(
        { messages: [new HumanMessage(instruction)] },
        { recursionLimit: 24 },
      );
      const last = response.messages[response.messages.length - 1];
      return typeof last.content === 'string'
        ? last.content
        : JSON.stringify(last.content);
    },
  };
}
