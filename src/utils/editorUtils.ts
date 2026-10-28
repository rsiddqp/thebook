/**
 * Finds the exact text range for a target phrase within a TipTap ProseMirror document.
 * If multiple occurrences exist, selects the one closest to preferredPos (e.g. current cursor).
 */
export function findTextRangeInDoc(
  doc: any,
  targetText: string,
  preferredPos = 0
): { from: number; to: number } | null {
  if (!targetText || !doc) return null;

  const occurrences: Array<{ from: number; to: number }> = [];

  // 1. Text node search
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      let startIdx = 0;
      let foundIdx = node.text.indexOf(targetText, startIdx);
      while (foundIdx !== -1) {
        occurrences.push({
          from: pos + foundIdx,
          to: pos + foundIdx + targetText.length,
        });
        startIdx = foundIdx + 1;
        foundIdx = node.text.indexOf(targetText, startIdx);
      }
    }
  });

  // 2. Block-level search for phrases spanning multiple inline nodes
  if (occurrences.length === 0) {
    doc.descendants((node: any, pos: number) => {
      if (node.isBlock && node.textContent && node.textContent.includes(targetText)) {
        const offsetInBlock = node.textContent.indexOf(targetText);
        let cumulative = 0;
        let from = -1;
        let to = -1;

        node.descendants((child: any, childPos: number) => {
          if (child.isText && child.text) {
            const childStart = cumulative;
            const childEnd = cumulative + child.text.length;
            if (from === -1 && offsetInBlock >= childStart && offsetInBlock < childEnd) {
              from = pos + 1 + childPos + (offsetInBlock - childStart);
            }
            if (from !== -1 && to === -1 && offsetInBlock + targetText.length <= childEnd) {
              to = pos + 1 + childPos + (offsetInBlock + targetText.length - childStart);
              return false;
            }
            cumulative += child.text.length;
          }
        });

        if (from !== -1 && to !== -1) {
          occurrences.push({ from, to });
        }
      }
    });
  }

  if (occurrences.length === 0) return null;

  // Closest to the user's cursor / preferred position
  occurrences.sort(
    (a, b) => Math.abs(a.from - preferredPos) - Math.abs(b.from - preferredPos)
  );

  return occurrences[0];
}
