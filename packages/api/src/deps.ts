import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { ForbiddenWords } from './text/forbiddenWords.js';
import { WordSet } from './text/wordSet.js';
import { MemoryQueue, BullMqQueue, type JobQueue } from './queue/index.js';
import { MemoryStore, PostgresStore, SqliteStore, type Store } from './store/index.js';
import { HfVitClassifier, NsfwJsClassifier, PySvcClassifier, type ImageClassifier } from './providers/imageClassifier.js';
import { DisabledPySvc, HttpPySvc, type PySvc } from './providers/pySvc.js';

/** Grafo de dependencias segun `config` (STORE/QUEUE/IMAGE_PROVIDER/TEXT_FILTER). */
export interface Deps {
  store: Store;
  queue: JobQueue;
  imageClassifier: ImageClassifier;
  pySvc: PySvc;
  textFilter: ForbiddenWords | null;
}

function loadWordList(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const words: string[] = [];
  for (const name of ['words.base.txt', 'words.extra.txt']) {
    try {
      const raw = readFileSync(join(here, '..', '..', 'data', name), 'utf8');
      words.push(...WordSet.parse(raw));
    } catch {
      // words.extra.txt es opcional.
    }
  }
  const envExtra = process.env.FORBIDDEN_EXTRA ?? '';
  if (envExtra !== '') words.push(...WordSet.parse(envExtra));
  return words;
}

export function buildDeps(): Deps {
  const store: Store =
    config.store === 'postgres'
      ? new PostgresStore()
      : config.store === 'sqlite'
        ? new SqliteStore()
        : new MemoryStore();

  const queue: JobQueue = config.queue === 'bullmq' ? new BullMqQueue() : new MemoryQueue();

  const imageClassifier: ImageClassifier =
    config.imageProvider === 'py-svc'
      ? new PySvcClassifier(config.pySvcUrl)
      : config.imageProvider === 'hf-vit'
        ? new HfVitClassifier()
        : new NsfwJsClassifier();

  const pySvc: PySvc = config.pySvcEnabled ? new HttpPySvc(config.pySvcUrl) : new DisabledPySvc();

  const removed = WordSet.parse(process.env.FORBIDDEN_REMOVED ?? '');
  const textFilter =
    config.textFilter === 'embedded'
      ? new ForbiddenWords(new WordSet(loadWordList(), [], removed))
      : null;

  return { store, queue, imageClassifier, pySvc, textFilter };
}
