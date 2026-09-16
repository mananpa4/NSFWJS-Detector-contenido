/**
 * 2a opinion VLM via Ollama (Llama 3.2 Vision / Llava).
 * Solo se invoca en zona gris (PENDIENTE) para no encarecer el pipeline.
 * Desactivado por defecto (OLLAMA_ENABLED=false): `ask()` devuelve null.
 */

export interface VlmVerdict {
  risky: boolean;
  description: string;
  latencyMs: number;
}

const PROMPT =
  'Describe si esta imagen contiene desnudez, actos sexuales o contenido ' +
  'sugerente/provocativo (lenceria, poses provocativas). Responde SOLO con ' +
  'una linea JSON: {"risky": true|false, "description": "..."}';

export async function askVlm(
  imagePath: string,
  opts: { enabled: boolean; baseUrl: string; model: string } = {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    baseUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL ?? 'llava:7b',
  },
): Promise<VlmVerdict | null> {
  if (!opts.enabled) return null;
  const started = Date.now();
  const { readFile } = await import('node:fs/promises');
  const b64 = (await readFile(imagePath)).toString('base64');
  const res = await fetch(`${opts.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: opts.model, prompt: PROMPT, images: [b64], stream: false }),
  });
  if (!res.ok) throw new Error(`ollama fallo: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  const match = (data.response ?? '').match(/\{[^}]*\}/);
  if (match === null) return { risky: false, description: data.response ?? '', latencyMs: Date.now() - started };
  try {
    const parsed = JSON.parse(match[0]) as { risky?: boolean; description?: string };
    return {
      risky: parsed.risky === true,
      description: String(parsed.description ?? ''),
      latencyMs: Date.now() - started,
    };
  } catch {
    return { risky: false, description: data.response ?? '', latencyMs: Date.now() - started };
  }
}
