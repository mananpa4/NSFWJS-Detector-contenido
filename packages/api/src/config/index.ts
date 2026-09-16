/** Configuracion por entorno: que implementacion usa cada puerto. */

export type StoreKind = 'memory' | 'sqlite' | 'postgres';
export type QueueKind = 'memory' | 'bullmq';
export type ImageProviderKind = 'nsfwjs' | 'hf-vit' | 'py-svc';
export type TextFilterKind = 'embedded' | 'none';

export interface AppConfig {
  port: number;
  store: StoreKind;
  queue: QueueKind;
  imageProvider: ImageProviderKind;
  textFilter: TextFilterKind;
  pySvcUrl: string;
  pySvcEnabled: boolean;
  ollamaEnabled: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  databaseUrl: string;
  redisUrl: string;
}

function pick<T extends string>(env: string | undefined, allowed: T[], fallback: T): T {
  if (env !== undefined && (allowed as string[]).includes(env)) return env as T;
  return fallback;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3000),
  store: pick(process.env.STORE, ['memory', 'sqlite', 'postgres'], 'memory'),
  queue: pick(process.env.QUEUE, ['memory', 'bullmq'], 'memory'),
  imageProvider: pick(process.env.IMAGE_PROVIDER, ['nsfwjs', 'hf-vit', 'py-svc'], 'nsfwjs'),
  textFilter: pick(process.env.TEXT_FILTER, ['embedded', 'none'], 'embedded'),
  pySvcUrl: process.env.PY_SVC_URL ?? 'http://localhost:8001',
  pySvcEnabled: (process.env.PY_SVC_ENABLED ?? 'true') === 'true',
  ollamaEnabled: (process.env.OLLAMA_ENABLED ?? 'false') === 'true',
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'llava:7b',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://moderacion:moderacion@localhost:5432/moderacion',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
};
