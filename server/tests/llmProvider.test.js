// Run: node --test server/tests/llmProvider.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  providerFor,
  chatTarget,
  chatBody,
  postChatCompletion,
  openAIClientConfig,
  openAIParams,
  isReasoningModel,
} = require('../services/llmProvider');
const { applyClientNotesToMealPlan } = require('../services/ai.service');

const PROXY_ENV = {
  AI_PROVIDER: 'betterproxy',
  BETTERPROXY_BASE_URL: 'https://proxy.test/openai/v1/',
  BETTERPROXY_API_KEY: 'proxy-key',
};
const LEGACY = {
  url: 'https://legacy.test/chat/completions',
  headers: { 'Content-Type': 'application/json', 'api-key': 'legacy-key' },
  model: 'legacy-model',
};

test('legacy is the default for every role', () => {
  for (const role of ['food', 'activity', 'mealPlan']) {
    assert.equal(providerFor(role, {}), 'legacy');
  }
  const target = chatTarget({ role: 'food', legacy: LEGACY, env: {} });
  assert.equal(target.provider, 'legacy');
  assert.equal(target.url, LEGACY.url);
});

test('AI_PROVIDER=betterproxy routes to BetterProxy with cache bypass', () => {
  const target = chatTarget({ role: 'food', kind: 'vision', legacy: LEGACY, env: PROXY_ENV });
  assert.equal(target.provider, 'betterproxy');
  assert.equal(target.url, 'https://proxy.test/openai/v1/chat/completions');
  assert.equal(target.headers.Authorization, 'Bearer proxy-key');
  assert.equal(target.headers['x-betterproxy-cache'], 'bypass');
  assert.equal(target.headers['api-key'], undefined);
  assert.equal(target.model, 'gpt-4o');
});

test('per-role override wins over AI_PROVIDER', () => {
  const env = { ...PROXY_ENV, AI_PROVIDER_MEAL_PLAN: 'legacy' };
  assert.equal(providerFor('food', env), 'betterproxy');
  assert.equal(providerFor('mealPlan', env), 'legacy');
  assert.equal(providerFor('food', { AI_PROVIDER_FOOD: 'BetterProxy' }), 'betterproxy');
});

test('betterproxy without a key stays on legacy', () => {
  const env = { AI_PROVIDER: 'betterproxy', BETTERPROXY_BASE_URL: 'https://proxy.test/v1' };
  assert.equal(chatTarget({ role: 'food', legacy: LEGACY, env }).provider, 'legacy');
  assert.equal(chatTarget({ role: 'food', legacy: null, env }), null);
});

test('model env vars pick the BetterProxy model per kind', () => {
  const env = { ...PROXY_ENV, BETTERPROXY_MODEL: 'gpt-4.1', BETTERPROXY_VISION_MODEL: 'gpt-5', BETTERPROXY_MINI_MODEL: 'gpt-4.1-mini' };
  assert.equal(chatTarget({ role: 'food', kind: 'text', legacy: LEGACY, env }).model, 'gpt-4.1');
  assert.equal(chatTarget({ role: 'food', kind: 'vision', legacy: LEGACY, env }).model, 'gpt-5');
  assert.equal(chatTarget({ role: 'activity', kind: 'mini', legacy: LEGACY, env }).model, 'gpt-4.1-mini');
});

test('legacy bodies are unchanged; BetterProxy bodies drop reasoning-only fields for gpt-4o', () => {
  const body = { max_completion_tokens: 4000, reasoning_effort: 'medium', messages: [] };
  assert.deepEqual(chatBody({ provider: 'legacy', model: 'm' }, body), { model: 'm', ...body });
  assert.deepEqual(chatBody({ provider: 'legacy' }, body), body);

  const proxied = chatBody({ provider: 'betterproxy', model: 'gpt-4o' }, body);
  assert.equal(proxied.model, 'gpt-4o');
  assert.equal(proxied.reasoning_effort, undefined);
  assert.equal(proxied.max_tokens, 4000);
  assert.equal(proxied.max_completion_tokens, undefined);
  assert.match(proxied.user, /^ncw-nocache-/);

  const reasoning = chatBody({ provider: 'betterproxy', model: 'gpt-5' }, body);
  assert.equal(reasoning.reasoning_effort, 'medium');
  assert.equal(reasoning.max_completion_tokens, 4000);
  assert.ok(isReasoningModel('o4-mini'));
  assert.ok(!isReasoningModel('gpt-4o-mini'));
});

test('postChatCompletion sends to the chosen target', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push({ url, init }); return { ok: true }; };
  await postChatCompletion({ role: 'food', legacy: LEGACY, body: { messages: [] }, fetchImpl, env: {} });
  await postChatCompletion({ role: 'food', legacy: LEGACY, body: { messages: [] }, fetchImpl, env: PROXY_ENV });
  assert.equal(sent[0].url, LEGACY.url);
  assert.equal(JSON.parse(sent[0].init.body).model, 'legacy-model');
  assert.equal(sent[1].url, 'https://proxy.test/openai/v1/chat/completions');
  assert.equal(JSON.parse(sent[1].init.body).model, 'gpt-4o');
  assert.equal(await postChatCompletion({ role: 'food', legacy: null, body: {}, fetchImpl, env: {} }), null);
});

test('SDK config: legacy keeps its base URL, BetterProxy sets base, key and headers', () => {
  const legacy = { apiKey: 'k', baseURL: '', model: 'gpt-4o-mini' };
  const plain = openAIClientConfig({ role: 'activity', legacy, env: {} });
  assert.deepEqual(plain.options, { apiKey: 'k' });
  assert.equal(plain.model, 'gpt-4o-mini');
  assert.equal(openAIClientConfig({ role: 'activity', legacy: { apiKey: '' }, env: {} }), null);

  const proxied = openAIClientConfig({ role: 'activity', legacy, env: PROXY_ENV });
  assert.equal(proxied.options.baseURL, 'https://proxy.test/openai/v1');
  assert.equal(proxied.options.apiKey, 'proxy-key');
  assert.equal(proxied.options.defaultHeaders['x-betterproxy-cache'], 'bypass');
  const params = openAIParams(proxied, { model: proxied.model, max_completion_tokens: 200, messages: [] });
  assert.equal(params.max_tokens, 200);
  assert.deepEqual(openAIParams(plain, { model: 'x' }), { model: 'x' });
});

test('client-notes pass goes to Azure by default and to BetterProxy when switched', async () => {
  const azureEnv = { AZURE_OPENAI_API_BASE: 'https://azure.test', AZURE_OPENAI_API_KEY: 'az', AZURE_OPENAI_DEPLOYMENT: 'dep' };
  const plan = { meals: [{ meal: 'Breakfast' }] };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(plan) } }] }) };
  };
  const input = { mealPlan: plan, clientNotes: 'no fish', language: 'en' };

  await applyClientNotesToMealPlan(input, { fetchImpl, env: azureEnv });
  assert.equal(calls[0].url, 'https://azure.test/openai/deployments/dep/chat/completions?api-version=2024-08-01-preview');
  assert.equal(calls[0].body.model, undefined);
  assert.equal(calls[0].headers['api-key'], 'az');

  await applyClientNotesToMealPlan(input, { fetchImpl, env: { ...azureEnv, ...PROXY_ENV } });
  assert.equal(calls[1].url, 'https://proxy.test/openai/v1/chat/completions');
  assert.equal(calls[1].body.model, 'gpt-4o');
  assert.equal(calls[1].body.response_format.json_schema.name, 'regenerated_meal_plan');

  await assert.rejects(applyClientNotesToMealPlan(input, { fetchImpl, env: {} }), /not configured/);
});

test('food vision call: DEEPSEEK_* by default, BetterProxy when switched', async () => {
  const { callFoodVisionLLM } = require('../services/ai.service');
  const keys = ['DEEPSEEK_ENDPOINT', 'DEEPSEEK_API_KEY', 'DEEPSEEK_DEPLOYMENT', ...Object.keys(PROXY_ENV)];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const savedFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"is_food": true}' } }] }) };
  };
  try {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, { DEEPSEEK_ENDPOINT: 'https://vision.test/v1/', DEEPSEEK_API_KEY: 'v', DEEPSEEK_DEPLOYMENT: 'vision-dep' });
    assert.deepEqual(await callFoodVisionLLM(Buffer.from('jpeg'), 'prompt'), { is_food: true });
    assert.equal(calls[0].url, 'https://vision.test/v1/chat/completions');
    assert.equal(calls[0].body.model, 'vision-dep');
    assert.equal(calls[0].body.reasoning_effort, 'medium');

    Object.assign(process.env, PROXY_ENV);
    await callFoodVisionLLM(Buffer.from('jpeg'), 'prompt');
    assert.equal(calls[1].url, 'https://proxy.test/openai/v1/chat/completions');
    assert.equal(calls[1].body.model, 'gpt-4o');
    assert.equal(calls[1].body.messages[0].content[1].type, 'image_url');

    for (const k of keys) delete process.env[k];
    await assert.rejects(callFoodVisionLLM(Buffer.from('jpeg'), 'prompt'), /not configured/);
  } finally {
    global.fetch = savedFetch;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
