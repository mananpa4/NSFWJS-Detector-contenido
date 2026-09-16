import type { VideoJob } from '../types.js';

/** Puerto de cola de trabajos de video (hibrido via QUEUE). */
export interface JobQueue {
  enqueue(job: VideoJob): Promise<void>;
  /** El worker consume con dequeue(); la API solo encola. */
  dequeue(): Promise<VideoJob | null>;
}

/** Memoria (FIFO en proceso): desarrollo y tests. */
export class MemoryQueue implements JobQueue {
  private items: VideoJob[] = [];

  async enqueue(job: VideoJob): Promise<void> {
    this.items.push(job);
  }

  async dequeue(): Promise<VideoJob | null> {
    return this.items.shift() ?? null;
  }
}

/**
 * BullMQ sobre Redis (lazy: solo se importa si QUEUE=bullmq).
 * Requiere REDIS_URL. Nombre de cola: `moderate-video`.
 */
export class BullMqQueue implements JobQueue {
  private queue: import('bullmq').Queue | null = null;

  private async open(): Promise<import('bullmq').Queue> {
    if (this.queue !== null) return this.queue;
    const { Queue } = (await import('bullmq')) as typeof import('bullmq');
    const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
    this.queue = new Queue('moderate-video', { connection });
    return this.queue;
  }

  async enqueue(job: VideoJob): Promise<void> {
    const q = await this.open();
    await q.add('moderate', job, { jobId: job.id, removeOnComplete: 100 });
  }

  async dequeue(): Promise<VideoJob | null> {
    // La API no consume: el worker usa Worker de BullMQ (ver packages/worker).
    return null;
  }
}
