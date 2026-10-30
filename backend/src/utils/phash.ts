import sharp from 'sharp';
import fs from 'fs';
import { logger } from './logger';

/**
 * Computes a 64-bit difference hash (dHash) for an image buffer or file path.
 *
 * Algorithm:
 * 1. Convert image to 8-bit grayscale.
 * 2. Resize to 9x8 pixels (ignoring aspect ratio).
 * 3. Compare each pixel with its right neighbor (8 comparisons per row * 8 rows = 64 bits).
 * 4. Pack the 64 bits into a 16-character hexadecimal string.
 */
export async function computeDHash(imageInput: Buffer | string): Promise<string | null> {
  try {
    let inputBuffer: Buffer;
    if (typeof imageInput === 'string') {
      if (!fs.existsSync(imageInput)) {
        return null;
      }
      inputBuffer = fs.readFileSync(imageInput);
    } else {
      inputBuffer = imageInput;
    }

    if (!inputBuffer || inputBuffer.length === 0) {
      return null;
    }

    // Resize to 9 columns x 8 rows in grayscale raw format
    const rawPixels = await sharp(inputBuffer)
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer();

    let binaryString = '';
    // 8 rows
    for (let row = 0; row < 8; row++) {
      const rowOffset = row * 9;
      // 8 comparisons per row
      for (let col = 0; col < 8; col++) {
        const leftPixel = rawPixels[rowOffset + col];
        const rightPixel = rawPixels[rowOffset + col + 1];
        binaryString += leftPixel < rightPixel ? '1' : '0';
      }
    }

    // Convert 64-bit binary string to 16-character hex string
    let hexHash = '';
    for (let i = 0; i < 64; i += 4) {
      const nibble = binaryString.substring(i, i + 4);
      hexHash += parseInt(nibble, 2).toString(16);
    }

    return hexHash;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to compute perceptual dHash');
    return null;
  }
}

/**
 * Computes the Hamming distance between two 16-character hexadecimal dHashes.
 * Returns the number of differing bit positions (0 to 64).
 */
export function hammingDistance(hashA?: string | null, hashB?: string | null): number {
  if (!hashA || !hashB || hashA.length !== 16 || hashB.length !== 16) {
    return 64; // Maximum distance for invalid/missing hashes
  }

  try {
    const valA = BigInt('0x' + hashA);
    const valB = BigInt('0x' + hashB);
    const xor = valA ^ valB;

    // Count set bits (Brian Kernighan's algorithm on BigInt)
    let dist = 0;
    let n = xor;
    while (n > 0n) {
      n &= n - 1n;
      dist++;
    }
    return dist;
  } catch {
    return 64;
  }
}

/**
 * Checks if two images are near-duplicates using dHash Hamming distance.
 * Default threshold is 10 bits difference.
 */
export function areDHashNearDuplicates(hashA?: string | null, hashB?: string | null, threshold = 10): boolean {
  if (!hashA || !hashB) return false;
  return hammingDistance(hashA, hashB) <= threshold;
}
