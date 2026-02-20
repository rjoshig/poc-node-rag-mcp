import { describe, expect, it } from 'vitest';
import { routeIntent } from '../src/agents/supervisor';

describe('routeIntent', () => {
  it('routes policy questions to retrieval', () => {
    expect(routeIntent('what is leave policy')).toBe('retrieval');
  });

  it('routes config prompts to config', () => {
    expect(routeIntent('create batch config with rules')).toBe('config');
  });

  it('routes generic prompts to chat', () => {
    expect(routeIntent('say hello')).toBe('chat');
  });
});
