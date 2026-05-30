import { z } from 'zod';

/**
 * Agent-side environment contract. Intentionally a superset of the plugin's own
 * env (the plugin validates its slice independently at tool-call time); this
 * schema covers what the agent process itself needs to boot: operator creds, the
 * LLM provider, and the demo investor default.
 *
 * Testnet is hard-pinned. The plugin's mainnet_deny policy is the enforcement
 * backstop; this is the first gate so the process refuses to even start otherwise.
 */
const envSchema = z.object({
  HEDERA_NETWORK: z.literal('testnet'),
  HEDERA_OPERATOR_ID: z.string().regex(/^0\.0\.\d+$/, 'must be Hedera id like 0.0.X'),
  HEDERA_OPERATOR_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be 64-char raw ECDSA hex private key'),
  HEDERA_OPERATOR_KEY_TYPE: z.literal('ECDSA'),
  HEDERA_OPERATOR_EVM_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be 0x-prefixed EVM address')
    .optional(),

  LLM_PROVIDER: z
    .enum(['google', 'gemini', 'openai'])
    .default('google')
    // 'gemini' is accepted as an alias for 'google' (some .env files use it).
    .transform((v) => (v === 'gemini' ? 'google' : v)),
  LLM_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Demo convenience: default holder for issue/transfer when the prompt omits one.
  INVESTOR_ACCOUNT_ID: z.string().regex(/^0\.0\.\d+$/).optional(),
  INVESTOR_EVM_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

export type AgentEnv = z.infer<typeof envSchema>;

let cached: AgentEnv | undefined;

export function loadAgentEnv(): AgentEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  // Provider-specific key must be present for the chosen provider.
  if (env.LLM_PROVIDER === 'google' && !env.GEMINI_API_KEY) {
    throw new Error('LLM_PROVIDER=google requires GEMINI_API_KEY');
  }
  if (env.LLM_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY');
  }

  cached = env;
  return cached;
}
