import { describe, expect, it } from 'vitest';
import { parseHtmlBlocks } from '../htmlBlocks';
import { separatorHtml } from '../../ornaments';

describe('the scene break the editor inserts', () => {
  it('is exactly one break in an export, whatever its ornament', () => {
    for (const id of ['stars', 'plain', 'fleuron', 'seal']) {
      const blocks = parseHtmlBlocks(`<p>One.</p>${separatorHtml(id)}<p>Two.</p>`);
      expect(blocks.map(b => b.kind), id).toEqual(['p', 'break', 'p']);
    }
  });
});
