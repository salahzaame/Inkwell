import test from 'node:test';
import assert from 'node:assert/strict';
import { pickOllamaModel } from '../src/assistant.js';

const installed = [{ name: 'nomic-embed-text:latest' }, { name: 'gemma4:12b' }, { name: 'qwen3.6:27b' }];

test('uses the model named in settings when it is installed', () => {
  assert.equal(pickOllamaModel(installed, 'qwen3.6:27b'), 'qwen3.6:27b');
});

test('falls back to the first chat model, skipping embedding models', () => {
  assert.equal(pickOllamaModel(installed), 'gemma4:12b');
  assert.equal(pickOllamaModel(installed, 'llama3.2'), 'gemma4:12b');
});

test('returns null when no chat model is pulled', () => {
  assert.equal(pickOllamaModel([]), null);
  assert.equal(pickOllamaModel([{ name: 'nomic-embed-text:latest' }]), null);
});

import { describeProviderFailures, runChain } from '../src/assistant.js';

const fail = (message) => async () => { throw new Error(message); };
const answer = (provider) => async () => ({ text: 'hi', provider });

test('when every provider fails, the error names each one and why', async () => {
  const chain = [
    { name: 'Ollama', ask: fail('blocked this site') },
    { name: 'OpenRouter', ask: fail('Rate limit exceeded: free-models-per-day') },
  ];
  await assert.rejects(runChain(chain, [], true), (err) => {
    assert.deepEqual(err.failures.map(f => f.name), ['Ollama', 'OpenRouter']);
    const text = describeProviderFailures(err);
    assert.match(text, /• Ollama — blocked this site/);
    assert.match(text, /• OpenRouter — Rate limit exceeded: free-models-per-day/);
    return true;
  });
});

test('a cloud answer after a failed local model says ollama was unavailable', async () => {
  const chain = [{ name: 'Ollama', ask: fail('not running') }, { name: 'OpenRouter', ask: answer('gemma · openrouter') }];
  const result = await runChain(chain, [], true);
  assert.equal(result.provider, 'gemma · openrouter (ollama unavailable)');
  assert.equal(result.localError, 'not running');
});

test('a cloud-first chain does not blame ollama for an earlier cloud failure', async () => {
  const chain = [{ name: 'OpenRouter', ask: fail('429') }, { name: 'Ollama', ask: answer('gemma4:12b · on-device') }];
  assert.equal((await runChain(chain, [], false)).provider, 'gemma4:12b · on-device');
});

import { OPENROUTER_DEFAULT_MODEL, openRouterModel } from '../src/assistant.js';

test('a saved OpenRouter model that was withdrawn falls back to the default', () => {
  assert.equal(openRouterModel('openai/gpt-oss-20b:free'), OPENROUTER_DEFAULT_MODEL);
  assert.equal(openRouterModel(undefined), OPENROUTER_DEFAULT_MODEL);
  assert.equal(openRouterModel('google/gemma-4-26b-a4b-it'), 'google/gemma-4-26b-a4b-it');
});
