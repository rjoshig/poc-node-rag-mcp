import { describe, expect, it } from 'vitest';
import { routeIntent } from '../src/agents/supervisor';

describe('routeIntent', () => {
  it('routes policy questions to retrieval', () => {
    expect(routeIntent('what is leave policy')).toBe('retrieval');
  });

  it('routes legal act/pass-holder query to retrieval', () => {
    expect(routeIntent('Can you give me information about the rights of pass-holder for Aizawl revenue act?')).toBe(
      'retrieval'
    );
  });

  it('routes legal rules query to retrieval (not config)', () => {
    expect(routeIntent('what are the land revenue rules under the mizoram act')).toBe('retrieval');
  });

  it('routes config prompts to config', () => {
    expect(routeIntent('create batch config with rules')).toBe('config');
  });

  it('routes generic prompts to chat', () => {
    expect(routeIntent('say hello')).toBe('chat');
  });

  it('routes small talk question to chat', () => {
    expect(routeIntent('Hello how are you?')).toBe('chat');
  });
});
