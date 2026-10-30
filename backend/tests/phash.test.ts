import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { computeDHash, hammingDistance, areDHashNearDuplicates } from '../src/utils/phash';

describe('Perceptual Difference Hash (dHash) & Hamming Distance', () => {
  it('computes a 16-character hexadecimal dHash for an image buffer', async () => {
    // Generate a simple 100x100 solid test image
    const imageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const hash = await computeDHash(imageBuffer);
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(16);
    expect(typeof hash).toBe('string');
  });

  it('computes identical dHash (Hamming distance 0) for the exact same image', async () => {
    const bufferA = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();

    const hashA = await computeDHash(bufferA);
    const hashB = await computeDHash(bufferA);

    expect(hashA).toBe(hashB);
    expect(hammingDistance(hashA, hashB)).toBe(0);
    expect(areDHashNearDuplicates(hashA, hashB, 10)).toBe(true);
  });

  it('calculates Hamming distance accurately across differing bits', () => {
    // 0000 0000 0000 0000 vs 0000 0000 0000 0001 -> 1 bit difference
    const hash1 = '0000000000000000';
    const hash2 = '0000000000000001';
    expect(hammingDistance(hash1, hash2)).toBe(1);
    expect(areDHashNearDuplicates(hash1, hash2, 10)).toBe(true);

    // 0000 0000 0000 0000 vs ffff ffff ffff ffff -> 64 bits difference
    const hashAllZero = '0000000000000000';
    const hashAllOne = 'ffffffffffffffff';
    expect(hammingDistance(hashAllZero, hashAllOne)).toBe(64);
    expect(areDHashNearDuplicates(hashAllZero, hashAllOne, 10)).toBe(false);

    // 8 bits difference (ff = 8 ones)
    const hash8Bits = '00000000000000ff';
    expect(hammingDistance(hashAllZero, hash8Bits)).toBe(8);
    expect(areDHashNearDuplicates(hashAllZero, hash8Bits, 10)).toBe(true);

    // 12 bits difference (fff = 12 ones -> > 10 threshold)
    const hash12Bits = '0000000000000fff';
    expect(hammingDistance(hashAllZero, hash12Bits)).toBe(12);
    expect(areDHashNearDuplicates(hashAllZero, hash12Bits, 10)).toBe(false);
  });

  it('handles invalid or empty hash inputs gracefully', () => {
    expect(hammingDistance(null, '0000000000000000')).toBe(64);
    expect(hammingDistance('0000', '0000000000000000')).toBe(64);
    expect(areDHashNearDuplicates(null, '0000000000000000')).toBe(false);
  });
});

