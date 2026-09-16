import { moderateVideo } from './jobs/moderateVideo.js';

/**
 * Entrada del worker.
 * - QUEUE=memory: la API encola en proceso; este loop consume MemoryQueue
 *   compartida via HTTP interno. TODO(vibecoding): cablear polling a la API
 *   o mover la cola a BullMQ.
 * - QUEUE=bullmq: TODO(vibecoding): suscribir `Worker('moderate-video')`
 *   y llamar a moderateVideo() por job.
 */
// eslint-disable-next-line no-console
console.log('worker-moderacion listo (TODO: suscripcion a cola real).');

void moderateVideo;
