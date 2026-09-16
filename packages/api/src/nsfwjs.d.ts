/**
 * Shim de tipos: `nsfwjs` es dependencia lazy (no instalada en dev).
 * Se importa solo con `await import('nsfwjs')` cuando IMAGE_PROVIDER=nsfwjs.
 * Al instalar `nsfwjs` + `@tensorflow/tfjs-node`, este shim queda
 * eclipsado por los tipos reales del paquete.
 */
declare module 'nsfwjs';
