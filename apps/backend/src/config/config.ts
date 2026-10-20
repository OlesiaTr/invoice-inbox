import { z } from 'zod';

// Empty strings in .env mean "not set".
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  PORT: z.coerce.number().int().default(3000),
  ACCESS_CODE: optional,
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().default(10 * 1024 * 1024),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  S3_ENDPOINT: optional,
  S3_REGION: optional,
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,

  LLM_DRIVER: z.enum(['ollama', 'gemini', 'mock']).default('ollama'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:7b'),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().default('gemini-flash-latest'),
  // Comma-separated; tried in order when the primary model is overloaded.
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-flash-lite-latest'),
  LLM_TIMEOUT_SECONDS: z.coerce.number().int().default(90),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  // Must exceed the slowest job (OCR + LLM); it doubles as the claim lease.
  QUEUE_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().default(180),
  MAX_PROCESSING_ATTEMPTS: z.coerce.number().int().min(1).default(3),
});

export type AppConfig = z.infer<typeof configSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Loads `.env` from the working directory if present (Node's built-in loader). */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment (Docker, hosting platform).
  }
}
