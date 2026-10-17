import {describe, expect, it} from 'vitest';
import type {NextFunction, Request, Response} from 'express';
import {extractApiKey, isFeedApiPath, requestApiKey, withoutApiKey} from './apiKey';
import {generateApiKey, hashApiKey} from '../services/apiKeys';

describe('isFeedApiPath', () => {
  it.each([
    '/vmix/sponsor-names', '/vmix/sponsor-carrousel', '/vmix/sponsor-slides', '/vmix/active-production/match',
    '/vmix/active-production/staff', '/vmix/production/active/titles', '/vmix/production/12/titles',
    '/vmix/callsheet/timing', '/vmix/sync/activate-event', '/vmix/production/trigger-manual',
    '/scoreboard', '/scoreboard/clock', '/scoreboard/shotclock',
    // Express routes case-insensitively and with an optional trailing slash
    '/VMIX/Sponsor-Names', '/vmix/sponsor-names/',
  ])('%s is a feed', (path) => expect(isFeedApiPath(path)).toBe(true));

  it.each([
    '/production', '/sponsors', '/settings/vmix-url', '/organization/api-keys', '/vmix/endpoints', '/vmix/set-timer',
    '/vmix/callsheet/push', '/vmix/sponsor-rows', '/vmix/sponsor-names/../../production', '/vmix/production/1/titles/x',
    '/scoreboardx', '/admin/vmix/title-templates', '/', '',
  ])('%s is not a feed', (path) => expect(isFeedApiPath(path)).toBe(false));
});

describe('withoutApiKey', () => {
  it.each([
    ['/api/vmix/sponsor-names?key=sk_abc', '/api/vmix/sponsor-names'],
    ['/api/vmix/callsheet/timing?position=Presentatie&key=sk_abc', '/api/vmix/callsheet/timing?position=Presentatie'],
    ['/api/x?key=a&key=b&seed=1', '/api/x?seed=1'],
    ['/api/x?k%65y=sk_abc', '/api/x'],
    ['/api/x?key[]=sk_abc&key[0]=sk_def', '/api/x'],
    // qs's bracketed root: req.query.key as well
    ['/api/x?[key]=sk_abc&seed=1', '/api/x?seed=1'],
    ['/api/x?%5Bkey%5D=sk_abc', '/api/x'],
    ['/api/x?[key][x]=sk_abc&%5Bkey%5D%5B%5D=sk_def', '/api/x'],
  ])('%s → %s', (url, expected) => expect(withoutApiKey(url)).toBe(expected));

  it('leaves URLs without a key alone, encoding included', () => {
    for (const url of ['/api/x', '/api/x?position=Presentatie%20A', '/api/x?keys=1', '/api/x?monkey=1']) expect(withoutApiKey(url)).toBe(url);
  });
});

describe('extractApiKey', () => {
  function run(url: string, headers: Record<string, string> = {}, query: Record<string, unknown> = {}) {
    const req = {url, originalUrl: url, headers: {...headers}, query: {...query}} as unknown as Request;
    let called = false;
    extractApiKey(req, {} as Response, (() => { called = true; }) as NextFunction);
    expect(called).toBe(true);
    return req;
  }

  it('takes the key off the URL, the query and the headers', () => {
    const req = run('/api/vmix/sponsor-names?key=sk_abc&seed=2', {}, {key: 'sk_abc', seed: '2'});
    expect(requestApiKey(req)).toBe('sk_abc');
    expect(req.url).toBe('/api/vmix/sponsor-names?seed=2');
    expect(req.originalUrl).toBe('/api/vmix/sponsor-names?seed=2');
    expect(req.query).toEqual({seed: '2'});

    const fromHeader = run('/api/scoreboard', {'x-api-key': 'sk_header'});
    expect(requestApiKey(fromHeader)).toBe('sk_header');
    expect(fromHeader.headers['x-api-key']).toBeUndefined();
  });

  it('marks a key that isn\'t one string as invalid (null)', () => {
    expect(requestApiKey(run('/api/scoreboard?key[]=a', {}, {key: ['a']}))).toBeNull();
    expect(requestApiKey(run('/api/scoreboard?key=', {}, {key: ''}))).toBeNull();
    expect(requestApiKey(run('/api/scoreboard?key=a&key=a', {}, {key: ['a', 'a']}))).toBeNull();
  });

  it('reads the key from the URL only: qs\'s other forms of `key` are invalid and stripped', () => {
    for (const url of ['/api/scoreboard?[key]=sk_abc', '/api/scoreboard?%5Bkey%5D=sk_abc', '/api/scoreboard?key=sk_abc&[key]=sk_abc']) {
      const req = run(url, {}, {key: 'sk_abc'});
      expect(requestApiKey(req), url).toBeNull();
      expect(req.url, url).toBe('/api/scoreboard');
      expect(req.query, url).toEqual({});
    }
  });

  it('treats a key only qs saw as invalid, and drops the whole query string', () => {
    const req = run('/api/scoreboard?odd=sk_abc', {}, {key: 'sk_abc', odd: 'sk_abc'});
    expect(requestApiKey(req)).toBeNull();
    expect(req.url).toBe('/api/scoreboard');
    expect(req.originalUrl).toBe('/api/scoreboard');
    expect(req.query).toEqual({odd: 'sk_abc'});
  });

  it('leaves requests without a key untouched', () => {
    const req = run('/api/production?seed=1', {}, {seed: '1'});
    expect(requestApiKey(req)).toBeUndefined();
    expect(req.url).toBe('/api/production?seed=1');
  });
});

describe('API key format', () => {
  it('is sk_ + 32 random bytes (base64url), hashed with SHA-256', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk_[A-Za-z0-9_-]{43}$/);
    expect(generateApiKey()).not.toBe(key);
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });
});
