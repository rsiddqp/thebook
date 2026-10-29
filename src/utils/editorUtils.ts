/**
 * Normalizes text for fuzzy matching by collapsing whitespace
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Finds the exact text range for a target phrase within a TipTap ProseMirror document.
 * If multiple occurrences exist, selects the one closest to preferredPos (e.g. current cursor).
 * Supports fuzzy matching with normalized whitespace.
 */
export function findTextRangeInDoc(
  doc: any,
  targetText: string,
  preferredPos = 0
): { from: number; to: number } | null {
  if (!targetText || !doc) return null;

  const occurrences: Array<{ from: number; to: number }> = [];
  const normalizedTarget = normalizeText(targetText);

  // Strategy 1: Exact text match within single text nodes
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

  // Strategy 2: Block-level search for phrases spanning multiple inline nodes (exact match)
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

  // Strategy 3: Fuzzy match with normalized whitespace (single text nodes)
  if (occurrences.length === 0) {
    doc.descendants((node: any, pos: number) => {
      if (node.isText && node.text) {
        const normalizedNode = normalizeText(node.text);
        const fuzzyIdx = normalizedNode.indexOf(normalizedTarget);
        
        if (fuzzyIdx !== -1) {
          // Map normalized position back to actual text position
          // Count actual characters up to the match
          let actualPos = 0;
          let normalizedPos = 0;
          
          for (let i = 0; i < node.text.length; i++) {
            if (normalizedPos === fuzzyIdx) {
              actualPos = i;
              break;
            }
            if (node.text[i].match(/\S/)) {
              normalizedPos++;
            } else if (node.text[i].match(/\s/)) {
              // Only count one space in normalized version
              if (i === 0 || !node.text[i - 1].match(/\s/)) {
                normalizedPos++;
              }
            }
          }
          
          occurrences.push({
            from: pos + actualPos,
            to: pos + actualPos + targetText.length,
          });
        }
      }
    });
  }

  // Strategy 4: Block-level fuzzy search with normalized whitespace
  if (occurrences.length === 0) {
    doc.descendants((node: any, pos: number) => {
      if (node.isBlock && node.textContent) {
        const normalizedBlock = normalizeText(node.textContent);
        const fuzzyIdx = normalizedBlock.indexOf(normalizedTarget);
        
        if (fuzzyIdx !== -1) {
          // Find the actual character positions in the block
          let actualCharCount = 0;
          let normalizedCharCount = 0;
          let startPos = -1;
          let endPos = -1;
          
          // Build a map of actual positions
          const textContent = node.textContent;
          for (let i = 0; i < textContent.length; i++) {
            if (normalizedCharCount === fuzzyIdx && startPos === -1) {
              startPos = actualCharCount;
            }
            if (normalizedCharCount === fuzzyIdx + normalizedTarget.length && endPos === -1) {
              endPos = actualCharCount;
              break;
            }
            
            actualCharCount++;
            if (textContent[i].match(/\S/)) {
              normalizedCharCount++;
            } else if (textContent[i].match(/\s/)) {
              if (i === 0 || !textContent[i - 1].match(/\s/)) {
                normalizedCharCount++;
              }
            }
          }
          
          if (endPos === -1) endPos = actualCharCount;
          
          if (startPos !== -1 && endPos !== -1) {
            // Convert block-relative positions to document positions
            let cumulative = 0;
            let from = -1;
            let to = -1;
            
            node.descendants((child: any, childPos: number) => {
              if (from !== -1 && to !== -1) return false;
              
              if (child.isText && child.text) {
                const childStart = cumulative;
                const childEnd = cumulative + child.text.length;
                
                if (from === -1 && startPos >= childStart && startPos < childEnd) {
                  from = pos + 1 + childPos + (startPos - childStart);
                }
                if (from !== -1 && to === -1 && endPos <= childEnd) {
                  to = pos + 1 + childPos + (endPos - childStart);
                  return false;
                }
                
                cumulative += child.text.length;
              }
            });
            
            if (from !== -1 && to !== -1) {
              occurrences.push({ from, to });
            }
          }
        }
      }
    });
  }

  if (occurrences.length === 0) return null;

  // Return the occurrence closest to the user's cursor / preferred position
  occurrences.sort(
    (a, b) => Math.abs(a.from - preferredPos) - Math.abs(b.from - preferredPos)
  );

  return occurrences[0];
}
