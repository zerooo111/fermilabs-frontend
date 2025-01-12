/**
 * env.ts
 * Environment configuration and validation
 */

import { z } from 'zod';

/**
 * Environment schema with Zod validation
 */
const envSchema = z.object({
  // App Configuration
  MODE: z.enum(['development', 'production', 'test']),
  DEV: z.boolean(),
  PROD: z.boolean(),

  // Solana Configuration
  VITE_SOLANA_CLUSTER: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  VITE_DEFAULT_MARKET_ADDRESS: z.string().min(32).max(44),

  // Optional RPC Configuration
  VITE_RPC_ENDPOINT: z.string().url().optional(),
});

/**
 * Type inference for our environment
 */
type Env = z.infer<typeof envSchema>;

/**
 * Validate and get environment variables
 * Throws detailed error if validation fails
 */
export function getValidatedEnv(): Env {
  try {
    return envSchema.parse({
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
      VITE_SOLANA_CLUSTER: import.meta.env.VITE_SOLANA_CLUSTER,
      VITE_DEFAULT_MARKET_ADDRESS: import.meta.env.VITE_DEFAULT_MARKET_ADDRESS,
      VITE_RPC_ENDPOINT: import.meta.env.VITE_RPC_ENDPOINT,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(issue => issue.path.join('.')).join(', ');
      throw new Error(
        `❌ Invalid environment variables: ${missingVars}\n\n` +
          `Please check your .env file and ensure all required variables are set correctly.`
      );
    }
    throw error;
  }
}

/**
 * Singleton instance of validated environment
 */
export const env = getValidatedEnv();
