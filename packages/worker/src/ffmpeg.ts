import { execFile } from 'node:child_process';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type MediaKind = 'image' | 'animatedImage' | 'audio' | 'video' | 'unknown';

export interface MediaProbe {
  kind: MediaKind;
  durationSec: number;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
}

const IMAGE_EXT = new Set(['avif', 'bmp', 'heic', 'heif', 'ico', 'jpeg', 'jpg', 'jxl', 'png', 'tif', 'tiff', 'webp']);
const ANIMATED_EXT = new Set(['apng', 'gif']);
const AUDIO_EXT = new Set(['aac', 'ac3', 'aif', 'aiff', 'amr', 'ape', 'dts', 'flac', 'm4a', 'mka', 'mp2', 'mp3', 'oga', 'ogg', 'opus', 'wav', 'wma', 'wv']);
const VIDEO_EXT = new Set(['3gp', 'asf', 'avi', 'divx', 'flv', 'm2ts', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'mts', 'ogv', 'rm', 'rmvb', 'ts', 'vob', 'webm', 'wmv']);

function extOf(path: string): string {
  const name = path.split('?')[0]?.split('#')[0]?.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function kindFromPath(path: string): MediaKind {
  const ext = extOf(path);
  if (ANIMATED_EXT.has(ext)) return 'animatedImage';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  return 'unknown';
}

interface FfprobeJson {
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
  format?: { duration?: string; format_name?: string };
}

/**
 * probe(): equivalente servidor de `ChismyFfmpegMulti.probe` (ffprobe JSON).
 * Sin runtime empaquetado: usa ffprobe del sistema (Docker lo instala).
 */
export async function probe(source: string, ffprobeBin = 'ffprobe'): Promise<MediaProbe> {
  const fallback = kindFromPath(source);
  try {
    const { stdout } = await run(ffprobeBin, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source]);
    const decoded = JSON.parse(String(stdout)) as FfprobeJson;
    const video = decoded.streams?.find((s) => s.codec_type === 'video');
    const audio = decoded.streams?.find((s) => s.codec_type === 'audio');
    const seconds = Number(decoded.format?.duration ?? 0);
    const kind: MediaKind =
      video !== undefined ? (fallback === 'animatedImage' ? 'animatedImage' : 'video') : audio !== undefined ? 'audio' : fallback;
    return {
      kind,
      durationSec: Number.isFinite(seconds) ? seconds : 0,
      width: video?.width ?? null,
      height: video?.height ?? null,
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      container: decoded.format?.format_name ?? null,
    };
  } catch {
    return { kind: fallback, durationSec: 0, width: null, height: null, videoCodec: null, audioCodec: null, container: extOf(source) };
  }
}

/**
 * extractFrames(): 1 fps por defecto (politica de video). Devuelve rutas jpg.
 * Semantica espejo de `scripts/extract-frames.*`.
 */
export async function extractFrames(source: string, outDir?: string, fps = 1, ffmpegBin = 'ffmpeg'): Promise<string[]> {
  const dir = outDir ?? (await mkdtemp(join(tmpdir(), 'frames-')));
  await run(ffmpegBin, ['-y', '-i', source, '-vf', `fps=${fps}`, '-q:v', '3', join(dir, 'frame-%04d.jpg')]);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
  return files.map((f) => join(dir, f));
}

/** createThumbnail(): espejo de `ChismyFfmpegMulti.createThumbnail`. */
export async function createThumbnail(source: string, outPath: string, ffmpegBin = 'ffmpeg'): Promise<string | null> {
  try {
    await run(ffmpegBin, ['-y', '-ss', '0.25', '-i', source, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', outPath]);
    return outPath;
  } catch {
    return null;
  }
}

/** normalize(): copia interoperable MP4 H.264/AAC (espejo de prepareForChat). */
export async function normalize(source: string, outPath: string, sd = false, ffmpegBin = 'ffmpeg'): Promise<boolean> {
  try {
    await run(ffmpegBin, [
      '-y', '-i', source, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', sd ? '28' : '26', '-vf', `scale=${sd ? 854 : 1280}:-2`, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-movflags', '+faststart', outPath,
    ]);
    return true;
  } catch {
    return false;
  }
}
