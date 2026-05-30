import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLangChainModelSettings } from '../src/adapters/langchain-runtime.js';

test('resolveLangChainModelSettings uses OpenAI for BigModel compatible Anthropic misconfiguration', () => {
  const settings = resolveLangChainModelSettings({
    provider: 'anthropic-messages',
    model: 'anthropic:GLM-4.7',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  });

  assert.equal(settings.provider, 'openai');
  assert.equal(settings.modelIdentifier, 'openai:GLM-4.7');
  assert.match(settings.providerCorrectionReason ?? '', /OpenAI-compatible/);
});

test('resolveLangChainModelSettings preserves real Anthropic Messages configuration', () => {
  const settings = resolveLangChainModelSettings({
    provider: 'anthropic-messages',
    model: 'claude-sonnet-4-6',
    baseURL: 'https://api.anthropic.com/v1',
  });

  assert.equal(settings.provider, 'anthropic');
  assert.equal(settings.modelIdentifier, 'anthropic:claude-sonnet-4-6');
  assert.equal(settings.providerCorrectionReason, undefined);
});
