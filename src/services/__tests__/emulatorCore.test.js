import { describe, expect, it } from 'vitest';
import { detectConsoleProfile } from '../emulatorCore';

describe('detectConsoleProfile', () => {
  it('maps supported console extensions to cores', () => {
    expect(detectConsoleProfile('contra.nes')).toMatchObject({ consoleName: 'NES', core: 'fceumm' });
    expect(detectConsoleProfile('metroid.gba')).toMatchObject({ consoleName: 'GBA', core: 'mgba' });
    expect(detectConsoleProfile('sonic.md')).toMatchObject({ consoleName: 'Genesis', core: 'genesis_plus_gx' });
  });

  it('marks nds as experimental', () => {
    expect(detectConsoleProfile('mario.nds')).toMatchObject({ consoleName: 'NDS', experimental: true });
  });
});
