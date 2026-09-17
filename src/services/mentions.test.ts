import { describe, expect, it } from 'vitest';
import { markMention, mentionState } from './mentions';

const empty = { values: [], prompted: [] };

describe('markMention', () => {
  it('records an item raised unprompted as mentioned, and not prompted', () => {
    const next = markMention(empty, 'harvest', 'unprompted');
    expect(next.values).toEqual(['harvest']);
    expect(next.prompted).toEqual([]);
    expect(mentionState(next, 'harvest')).toBe('unprompted');
  });

  it('records an item raised after prompting as both mentioned and prompted', () => {
    // Both count as "mentioned" for comparison with the online form.
    const next = markMention(empty, 'harvest', 'prompted');
    expect(next.values).toEqual(['harvest']);
    expect(next.prompted).toEqual(['harvest']);
  });

  it('moves an item between states without listing it twice', () => {
    const once = markMention(empty, 'harvest', 'unprompted');
    const moved = markMention(once, 'harvest', 'prompted');
    expect(moved.values).toEqual(['harvest']);
    expect(mentionState(moved, 'harvest')).toBe('prompted');
    const back = markMention(moved, 'harvest', 'unprompted');
    expect(back.prompted).toEqual([]);
    expect(back.values).toEqual(['harvest']);
  });

  it('clears an item when its current state is clicked again', () => {
    const marked = markMention(empty, 'harvest', 'prompted');
    const cleared = markMention(marked, 'harvest', 'prompted');
    expect(cleared).toEqual(empty);
  });

  it('leaves other items alone', () => {
    const two = markMention(markMention(empty, 'harvest', 'unprompted'), 'skills', 'prompted');
    const cleared = markMention(two, 'harvest', 'unprompted');
    expect(cleared.values).toEqual(['skills']);
    expect(cleared.prompted).toEqual(['skills']);
  });
});
