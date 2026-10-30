import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { safeFetch } from './ssrf';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

let cachedFfmpegPath: string | null = null;

export function getFfmpegPath(): string | null {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  try {
    // Try resolving ffmpeg-static
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
      cachedFfmpegPath = ffmpegStatic;
      return cachedFfmpegPath;
    }
  } catch {
    // ffmpeg-static not resolved directly
  }

  // Check backend/node_modules/ffmpeg-static
  const localFfmpeg = path.resolve(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg.exe');
  if (fs.existsSync(localFfmpeg)) {
    cachedFfmpegPath = localFfmpeg;
    return cachedFfmpegPath;
  }

  const backendFfmpeg = path.resolve(process.cwd(), 'backend/node_modules/ffmpeg-static/ffmpeg.exe');
  if (fs.existsSync(backendFfmpeg)) {
    cachedFfmpegPath = backendFfmpeg;
    return cachedFfmpegPath;
  }

  return null;
}

export function getFramesStorageDir(): string {
  const baseDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage');
  const framesDir = path.resolve(baseDir, 'frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  return framesDir;
}

export interface ExtractedFramesResult {
  evidence: 'frames' | 'thumbnail' | 'caption_only';
  framePaths: string[];
  frameBuffers: Buffer[];
}

/**
 * Extracts up to 3 representative frames from a video URL using ffmpeg
 */
export async function extractVideoFrames(
  videoId: string,
  mediaUrl?: string,
  thumbnailPathOrUrl?: string
): Promise<ExtractedFramesResult> {
  const framesDir = getFramesStorageDir();
  const ffmpegPath = getFfmpegPath();

  // 1. Try extracting frames from mediaUrl if ffmpeg and video URL are available
  if (ffmpegPath && mediaUrl && mediaUrl.startsWith('http')) {
    const tempVideoPath = path.join(os.tmpdir(), `vid_${videoId}_${Date.now()}.mp4`);
    try {
      // Download video (limit to 15MB for fast processing)
      const downloadRes = await safeFetch(mediaUrl, { timeoutMs: 10000, maxBytes: 15 * 1024 * 1024 });
      if (downloadRes.statusCode >= 200 && downloadRes.statusCode < 300 && downloadRes.buffer.length > 0) {
        fs.writeFileSync(tempVideoPath, downloadRes.buffer);

        const extractedPaths: string[] = [];
        const extractedBuffers: Buffer[] = [];
        const timestamps = ['00:00:01', '00:00:03', '00:00:05'];

        for (let i = 0; i < timestamps.length; i++) {
          const outPath = path.join(framesDir, `${videoId}_frame${i + 1}.jpg`);
          try {
            await execFileAsync(ffmpegPath, [
              '-y',
              '-ss',
              timestamps[i],
              '-i',
              tempVideoPath,
              '-vframes',
              '1',
              '-q:v',
              '2',
              outPath,
            ]);

            if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
              extractedPaths.push(outPath);
              extractedBuffers.push(fs.readFileSync(outPath));
            }
          } catch {
            // Timestamp might be beyond duration, continue
          }
        }

        if (extractedBuffers.length > 0) {
          logger.info(
            { videoId, frameCount: extractedBuffers.length },
            'Successfully extracted video frames with ffmpeg'
          );
          return {
            evidence: 'frames',
            framePaths: extractedPaths,
            frameBuffers: extractedBuffers,
          };
        }
      }
    } catch (err: any) {
      logger.debug({ videoId, err: err.message }, 'Failed video frame extraction with ffmpeg');
    } finally {
      if (fs.existsSync(tempVideoPath)) {
        try {
          fs.unlinkSync(tempVideoPath);
        } catch {}
      }
    }
  }

  // 2. Fallback to thumbnail buffer if reachable
  if (thumbnailPathOrUrl) {
    try {
      let thumbBuf: Buffer | null = null;
      if (fs.existsSync(thumbnailPathOrUrl)) {
        thumbBuf = fs.readFileSync(thumbnailPathOrUrl);
      } else if (thumbnailPathOrUrl.startsWith('http')) {
        const res = await safeFetch(thumbnailPathOrUrl, { timeoutMs: 6000, maxBytes: 5 * 1024 * 1024 });
        if (res.statusCode >= 200 && res.statusCode < 300 && res.buffer.length > 0) {
          thumbBuf = res.buffer;
        }
      }

      if (thumbBuf && thumbBuf.length > 0) {
        return {
          evidence: 'thumbnail',
          framePaths: [thumbnailPathOrUrl],
          frameBuffers: [thumbBuf],
        };
      }
    } catch (err: any) {
      logger.debug({ videoId, err: err.message }, 'Failed to load thumbnail buffer');
    }
  }

  // 3. Neither video frames nor thumbnail could be loaded
  return {
    evidence: 'caption_only',
    framePaths: [],
    frameBuffers: [],
  };
}

