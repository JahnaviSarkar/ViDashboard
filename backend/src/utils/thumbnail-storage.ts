import fs from 'fs';
import path from 'path';
import { safeFetch } from './ssrf';
import { logger } from './logger';

export interface ThumbnailSaveResult {
  localPath: string;
  localUrl: string;
}

export function getThumbnailStorageDir(): string {
  const baseDir = process.env.STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
  const thumbDir = path.join(baseDir, 'thumbnails');
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }
  return thumbDir;
}

/**
 * Downloads a remote image (e.g. expiring Instagram/Meta CDN URL) and stores
 * it locally in backend/storage/thumbnails/, returning its local serving URL.
 */
export async function downloadAndSaveThumbnail(
  remoteUrl: string,
  platform: string,
  platformVideoId: string
): Promise<ThumbnailSaveResult | null> {
  if (!remoteUrl || !remoteUrl.startsWith('http')) {
    return null;
  }

  try {
    const thumbDir = getThumbnailStorageDir();
    const cleanId = platformVideoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${platform}_${cleanId}.jpg`;
    const localPath = path.join(thumbDir, filename);
    const localUrl = `/storage/thumbnails/${filename}`;

    // If file already exists and is non-empty, avoid redownloading
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
      return { localPath, localUrl };
    }

    const res = await safeFetch(remoteUrl, { timeoutMs: 6000 });
    if (res.statusCode >= 200 && res.statusCode < 300 && res.buffer.length > 0) {
      fs.writeFileSync(localPath, res.buffer);
      logger.debug({ platformVideoId, filename }, 'Saved remote thumbnail locally');
      return { localPath, localUrl };
    }

    logger.warn({ remoteUrl, statusCode: res.statusCode }, 'Failed to download thumbnail buffer');
    return null;
  } catch (err: any) {
    logger.warn({ err: err.message, remoteUrl }, 'Error downloading and saving thumbnail');
    return null;
  }
}

