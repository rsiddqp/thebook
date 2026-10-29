import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { spellChecker } from '../utils/spellChecker';

export interface SpellCheckOptions {
  enabled: boolean;
  autoCorrect: boolean;
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions>({
  name: 'spellCheck',

  addOptions() {
    return {
      enabled: true,
      autoCorrect: true,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('spellCheck'),

        props: {
          handleTextInput(view, _from, _to, text) {
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
      }),
    ];
  },
});
