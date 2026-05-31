import { z } from 'zod';

/**
 * Agent-side environment contract. Intentionally a superset of the plugin's own
 * env (the plugin validates its slice independently at tool-call time); this
 * schema covers what the agent process itself needs to boot: operator creds, the
 * LLM provider, and the demo investor default.
 *
 * Network is opt-in via HEDERA_NETWORK: set testnet or mainnet and you operate on that
 * network at your own risk (same model as the plugin). There is no separate flag and no
 * mainnet deny; the safety caps (max-supply, jurisdiction allowlist) stay enforced on
 * every network.
 */
const envSchema = z.object({
  HEDERA_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
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
  // Transient-error retry budget for the LLM client (per-minute 429s, brief 5xx). Does not
  // defeat a hard daily quota cap. Defaults to 4 when unset.
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(10).optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  // OpenAI-compatible proxy (e.g. local kiro-gateway). Omit for api.openai.com.
  OPENAI_BASE_URL: z.string().url().optional(),

  // Demo convenience: default holder for issue/transfer when the prompt omits one.
  INVESTOR_ACCOUNT_ID: z.string().regex(/^0\.0\.\d+$/).optional(),
  INVESTOR_EVM_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),

  // Optional: reuse an existing HCS securities-registry topic instead of creating one.
  HCS_REGISTRY_TOPIC_ID: z.string().regex(/^0\.0\.\d+$/).optional(),
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
