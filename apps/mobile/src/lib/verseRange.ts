// Collapse a set of numbers into a compact range string: [3,4,5,7] -> "3–5, 7".
export function collapseNumbers(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b);
  if (s.length === 0) return '';
  const parts: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (let i = 1; i <= s.length; i++) {
    if (i < s.length && s[i] === prev + 1) {
      prev = s[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    if (i < s.length) {
      start = s[i];
      prev = s[i];
    }
  }
  return parts.join(', ');
}

export type ParsedEntity =
  | { kind: 'catechism'; number: number }
  | { kind: 'bible'; book: string; chapter: number; number: number };

// Bookmark entity ids are "CCC.<n>" (Catechism) or "BOOK.CH.VERSE" (Bible).
export function parseEntity(entityId: string): ParsedEntity {
  const parts = entityId.split('.');
  if (parts[0] === 'CCC') {
    return { kind: 'catechism', number: parseInt(parts[1] ?? '0', 10) || 0 };
  }
  return {
    kind: 'bible',
    book: parts[0] ?? '',
    chapter: parseInt(parts[1] ?? '0', 10) || 0,
    number: parseInt(parts[2] ?? '0', 10) || 0,
  };
}

// A nice label for a set of saved rows: the shared prefix of the first row's
// reference ("John 3:", "Catecismo ") + the collapsed number range.
export function groupLabel(rows: { entity_id: string; reference: string }[]): string {
  if (rows.length === 0) return '';
  const first = rows[0].reference || rows[0].entity_id;
  const prefix = first.replace(/\d+\s*$/, '');
  const nums = rows.map((r) => parseEntity(r.entity_id).number);
  return `${prefix}${collapseNumbers(nums)}`;
}
