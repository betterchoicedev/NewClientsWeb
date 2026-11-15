// Picks where each AI call goes: BetterProxy (the company's OpenAI-compatible
// endpoint) or the provider the call used before ("legacy").
//
// Off by default. Set AI_PROVIDER=betterproxy plus BETTERPROXY_BASE_URL and
// BETTERPROXY_API_KEY to switch every role. A role can be pinned on its own
// with AI_PROVIDER_FOOD / AI_PROVIDER_ACTIVITY / AI_PROVIDER_MEAL_PLAN
// (betterproxy | legacy). Set it back to legacy (or unset it) to switch back.
// If BetterProxy is chosen but not configured, the call stays on legacy and
// logs a warning, so a missing env var never takes a feature down.

const { randomUUID } = require('crypto');

const ROLES = {
  food: 'FOOD',             // food photo / text analysis, macro lookup, plan match
  activity: 'ACTIVITY',     // onboarding activity classification + meal structure
  mealPlan: 'MEAL_PLAN',    // meal-plan edit by request + "change my plan" notes pass
};

const DEFAULT_MODELS = {
  text: 'gpt-4o',
  vision: 'gpt-4o',
  mini: 'gpt-4o-mini',
};

const CACHE_BYPASS_HEADERS = {
  'Cache-Control': 'no-cache, no-store',
  'x-betterproxy-cache': 'bypass',
};

const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

function providerFor(role, env = process.env) {
  const suffix = ROLES[role];
  if (!suffix) throw new Error(`Unknown AI role: ${role}`);
  const raw = env[`AI_PROVIDER_${suffix}`] || env.AI_PROVIDER || 'legacy';
  return String(raw).trim().toLowerCase() === 'betterproxy' ? 'betterproxy' : 'legacy';
}

function betterProxyConfig(env = process.env) {
  const baseUrl = String(env.BETTERPROXY_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = String(env.BETTERPROXY_API_KEY || '').trim();
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

function betterProxyModel(kind, env = process.env) {
  if (kind === 'vision') return (env.BETTERPROXY_VISION_MODEL || env.BETTERPROXY_MODEL || DEFAULT_MODELS.vision).trim();
  if (kind === 'mini') return (env.BETTERPROXY_MINI_MODEL || DEFAULT_MODELS.mini).trim();
  return (env.BETTERPROXY_MODEL || DEFAULT_MODELS.text).trim();
}

// gpt-5*, o1/o3/o4* take reasoning_effort and max_completion_tokens only.
function isReasoningModel(model) {
  return /^(gpt-5|o\d)/i.test(String(model || '').replace(/^openai\//i, ''));
}

/** BetterProxy when chosen and configured for this role, otherwise null. */
function useBetterProxy(role, env = process.env) {
  if (providerFor(role, env) !== 'betterproxy') return null;
  const config = betterProxyConfig(env);
  if (!config) {
    warnOnce(`missing:${role}`, `[AI] AI_PROVIDER says betterproxy for ${role}, but BETTERPROXY_BASE_URL / BETTERPROXY_API_KEY are not set. Using the legacy provider.`);
    return null;
  }
  return config;
}

/**
 * Where to POST a chat completion for this role.
 * `legacy` is today's target: { url, headers, model? } (model omitted for Azure
 * deployment URLs), or null when the legacy env vars are missing.
 * Returns { provider, url, headers, model } or null when nothing is configured.
 */
function chatTarget({ role, kind = 'text', legacy, env = process.env }) {
  const proxy = useBetterProxy(role, env);
  if (proxy) {
    return {
      provider: 'betterproxy',
      url: `${proxy.baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxy.apiKey}`,
        ...CACHE_BYPASS_HEADERS,
      },
      model: betterProxyModel(kind, env),
    };
  }
  return legacy ? { provider: 'legacy', ...legacy } : null;
}

/** Request body for `target`. Legacy bodies are sent exactly as before. */
function chatBody(target, body) {
  if (target.provider !== 'betterproxy') {
    return target.model ? { model: target.model, ...body } : { ...body };
  }
  const out = { ...body, model: target.model, user: `ncw-nocache-${randomUUID()}` };
  if (!isReasoningModel(target.model)) {
    delete out.reasoning_effort;
    if (out.max_completion_tokens != null && out.max_tokens == null) {
      out.max_tokens = out.max_completion_tokens;
      delete out.max_completion_tokens;
    }
  }
  return out;
}

/** POST a chat completion for `role`; returns the fetch Response (callers keep their error handling). */
async function postChatCompletion({ role, kind, legacy, body, fetchImpl = fetch, env = process.env }) {
  const target = chatTarget({ role, kind, legacy, env });
  if (!target) return null;
  return fetchImpl(target.url, {
    method: 'POST',
    headers: target.headers,
    body: JSON.stringify(chatBody(target, body)),
  });
}

/**
 * Options for `new OpenAI(...)` plus the model to send, for SDK-based callers.
 * `legacy` is { apiKey, baseURL?, model } or null. Returns null when nothing is configured.
 */
function openAIClientConfig({ role, kind = 'mini', legacy, env = process.env }) {
  const proxy = useBetterProxy(role, env);
  if (proxy) {
    return {
      provider: 'betterproxy',
      options: { apiKey: proxy.apiKey, baseURL: proxy.baseUrl, defaultHeaders: { ...CACHE_BYPASS_HEADERS } },
      model: betterProxyModel(kind, env),
    };
  }
  if (!legacy || !legacy.apiKey) return null;
  return {
    provider: 'legacy',
    options: { apiKey: legacy.apiKey, ...(legacy.baseURL ? { baseURL: legacy.baseURL } : {}) },
    model: legacy.model,
  };
}

/** SDK params for the chosen provider (same body rules as chatBody). */
function openAIParams(config, params) {
  if (config.provider !== 'betterproxy') return params;
  return chatBody({ provider: 'betterproxy', model: config.model }, params);
}

module.exports = {
  providerFor,
  betterProxyConfig,
  betterProxyModel,
  isReasoningModel,
  chatTarget,
  chatBody,
  postChatCompletion,
  openAIClientConfig,
  openAIParams,
  CACHE_BYPASS_HEADERS,
};
