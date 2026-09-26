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
