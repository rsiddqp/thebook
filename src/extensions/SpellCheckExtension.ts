import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { spellChecker } from '../utils/spellChecker';

export interface SpellCheckOptions {
  /**
   * Enable/disable spell checking
   */
  enabled: boolean;
  
  /**
   * Enable/disable auto-correct on space/punctuation
   */
  autoCorrect: boolean;
  
  /**
   * CSS class for misspelled words
   */
  spellCheckClass: string;
  
  /**
   * Debounce delay for spell checking (ms)
   */
  debounceDelay: number;
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions>({
  name: 'spellCheck',

  addOptions() {
    return {
      enabled: true,
      autoCorrect: true,
      spellCheckClass: 'spell-error',
      debounceDelay: 300,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    let debounceTimer: NodeJS.Timeout | null = null;

    return [
      new Plugin({
        key: new PluginKey('spellCheck'),

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, oldDecorationSet) {
            if (!extension.options.enabled) {
              return DecorationSet.empty;
            }

            // Clear existing decorations if document changed
            if (tr.docChanged) {
              // Debounce decoration updates to avoid performance issues
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }

              // Return old decorations temporarily
              return oldDecorationSet.map(tr.mapping, tr.doc);
            }

            return oldDecorationSet;
          },
        },

        props: {
          decorations(state) {
            if (!extension.options.enabled) {
              return DecorationSet.empty;
            }

            return this.getState(state) || DecorationSet.empty;
          },

          handleTextInput(view, from, to, text) {
            if (!extension.options.autoCorrect) {
              return false;
            }

            // Auto-correct when user types space, period, comma, etc.
            const triggerChars = [' ', '.', ',', '!', '?', ';', ':'];
            if (!triggerChars.includes(text)) {
              return false;
            }

            const { state } = view;
            const { doc, selection } = state;
            const { $from } = selection;

            // Get word before cursor
            const textBefore = doc.textBetween(
              Math.max(0, $from.pos - 50),
              $from.pos,
              '\n',
              '\0'
            );

            const wordMatch = textBefore.match(/(\b\w+)$/);
            if (!wordMatch) {
              return false;
            }

            const word = wordMatch[1];
            const correction = spellChecker.getAutoCorrection(word);

            if (correction && correction !== word) {
              const wordStart = $from.pos - word.length;
              const wordEnd = $from.pos;

              // Replace the word with correction
              const tr = state.tr.replaceWith(
                wordStart,
                wordEnd,
                state.schema.text(correction)
              );

              // Insert the trigger character
              tr.insertText(text);

              view.dispatch(tr);
              return true;
            }

            return false;
          },
        },

        view(editorView) {
          const updateDecorations = () => {
            if (!extension.options.enabled) {
              return;
            }

            const { state } = editorView;
            const { doc } = state;
            const decorations: Decoration[] = [];

            // Check each text node for spelling errors
            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }

              const text = node.text;
              const wordRegex = /\b[a-zA-Z]+\b/g;
              let match;

              while ((match = wordRegex.exec(text)) !== null) {
                const word = match[0];
                if (!spellChecker.isCorrect(word)) {
                  const from = pos + match.index;
                  const to = from + word.length;

                  const suggestions = spellChecker.getSuggestions(word, 3);

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: extension.options.spellCheckClass,
                      'data-word': word,
                      'data-suggestions': suggestions.join(','),
                    })
                  );
                }
              }
            });

            const decorationSet = DecorationSet.create(doc, decorations);
            const tr = state.tr.setMeta('spellCheckDecorations', decorationSet);
            editorView.dispatch(tr);
          };

          // Debounced decoration update
          const debouncedUpdate = () => {
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
              updateDecorations();
            }, extension.options.debounceDelay);
          };

          // Initial decoration
          setTimeout(updateDecorations, 100);

          return {
            update(view, prevState) {
              if (view.state.doc !== prevState.doc) {
                debouncedUpdate();
              }
            },

            destroy() {
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
            },
          };
        },
      }),
    ];
  },

  addCommands() {
    return {
      toggleSpellCheck:
        () =>
        ({ commands }) => {
          this.options.enabled = !this.options.enabled;
          return true;
        },

      toggleAutoCorrect:
        () =>
        ({ commands }) => {
          this.options.autoCorrect = !this.options.autoCorrect;
          return true;
        },

      addWordToDictionary:
        (word: string) =>
        ({ commands }) => {
          spellChecker.addToCustomDictionary(word);
          return true;
        },

      removeWordFromDictionary:
        (word: string) =>
        ({ commands }) => {
          spellChecker.removeFromCustomDictionary(word);
          return true;
        },
    };
  },
});
