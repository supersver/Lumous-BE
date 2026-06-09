/**
 * Generates a concise, human-readable chat title from a user message.
 *
 * Rules:
 * - Maximum 50 characters
 * - Remove punctuation
 * - Remove filler words when possible
 * - Convert to title case
 * - Keep concise and readable
 *
 * @param message - The user's first message
 * @returns A generated chat title (max 50 chars)
 *
 * @example
 * generateChatTitle("Help me prepare for a React interview")
 * // => "React Interview Preparation"
 *
 * generateChatTitle("Explain React Fiber Architecture")
 * // => "React Fiber Architecture"
 */
export const generateChatTitle = (message: string): string => {
  if (!message || !message.trim()) {
    return 'New Chat';
  }

  // Common filler words to remove
  const fillerWords: Set<string> = new Set([
    'help',
    'me',
    'i',
    'for',
    'a',
    'an',
    'the',
    'can',
    'you',
    'how',
    'why',
    'what',
    'when',
    'where',
    'does',
    'do',
    'is',
    'are',
    'am',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'should',
    'would',
    'could',
    'will',
    'may',
    'might',
    'must',
    'explain',
    'tell',
    'show',
    'give',
    'create',
    'make',
    'build',
    'write',
    'describe',
    'to',
    'and',
    'or',
    'in',
    'on',
    'at',
    'by',
    'with',
    'from',
    'of',
    'about',
    'my',
    'your',
    'our',
    'their',
    'its',
    'his',
    'her',
    'between',
    'this',
    'that',
    'these',
    'those',
    'work',
    'works',
    'working',
    'please',
    'best',
    'using',
    'use',
    'used',
    'practices',
    'practice',
    'question',
    'questions',
    'prepare',
    'top',
    'need',
    'up',
  ]);

  // Remove punctuation and convert to lowercase
  const cleaned: string = message
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove all punctuation
    .trim();

  // Split into words
  let words: string[] = cleaned.split(/\s+/).filter((word: string) => word.length > 0);

  // Filter out filler words
  const meaningfulWords: string[] = words.filter(
    (word: string) =>
      !fillerWords.has(word) &&
      word.length > 1 && // Remove single letters
      !/^\d+$/.test(word), // Remove numbers
  );

  // If too few meaningful words were found, return default
  if (meaningfulWords.length === 0) {
    return 'New Chat';
  }

  // Use filtered meaningful words
  words = meaningfulWords;

  // Take first 5-7 words to form title (enough to be meaningful)
  words = words.slice(0, 7);

  // Convert to title case
  const titleCase: string = words
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Truncate to 50 characters if necessary
  const maxLength: number = 50;
  let finalTitle: string = titleCase;

  if (finalTitle.length > maxLength) {
    // Try to truncate at word boundary
    finalTitle = titleCase.substring(0, maxLength);
    const lastSpace: number = finalTitle.lastIndexOf(' ');

    if (lastSpace > maxLength / 2) {
      finalTitle = finalTitle.substring(0, lastSpace);
    }
  }

  return finalTitle || 'New Chat';
};
