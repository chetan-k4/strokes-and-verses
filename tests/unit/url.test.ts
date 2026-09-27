import { describe, it, expect } from 'vitest';
import { joinBase } from '../../src/lib/url';

describe('joinBase', () => {
  it('root base', () => expect(joinBase('/', '/workshops')).toBe('/workshops'));
  it('project base', () => expect(joinBase('/sv/', 'workshops')).toBe('/sv/workshops'));
  it('home', () => expect(joinBase('/sv/', '/')).toBe('/sv/'));
});
