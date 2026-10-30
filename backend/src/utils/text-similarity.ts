/**
 * Computes word-level Jaccard similarity between two text snippets (captions / ad copy).
 * Jaccard = |Tokens_A ∩ Tokens_B| / |Tokens_A ∪ Tokens_B|
 */
export function jaccardSimilarity(textA?: string | null, textB?: string | null): number {
  if (!textA || !textB) return 0;

  const tokenize = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '') // remove URLs
        .replace(/#\w+/g, '') // remove hashtags
        .replace(/[^\w\s]/g, ' ') // remove punctuation
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2) // keep tokens > 2 chars
    );
  };

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks if two text strings are near-duplicates using Jaccard similarity.
 * Default threshold is 0.85 (85% token overlap).
 */
export function isTextNearDuplicate(
  textA?: string | null,
  textB?: string | null,
  threshold = 0.85
): boolean {
  return jaccardSimilarity(textA, textB) >= threshold;
}

