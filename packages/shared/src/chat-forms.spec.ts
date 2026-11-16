import { describe, expect, it } from 'vitest';

import { CHAT_FORM_FIELDS } from './chat-forms.js';
import { Resource } from './permissions.js';

describe('CHAT_FORM_FIELDS', () => {
  it('describes the form of every resource, with a label and help for each field', () => {
    for (const resource of Object.values(Resource)) {
      const fields = Object.values(CHAT_FORM_FIELDS[resource]);
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(field.label).not.toBe('');
        expect(field.help).not.toBe('');
      }
    }
  });
});
