const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub heavy deps before loading the controller.
function stub(rel, exports) {
  const id = require.resolve(path.join(__dirname, '..', rel));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
let rowsToReturn = [];
const builder = {
  select: () => builder, or: () => builder, order: () => builder, limit: () => builder,
  eq: () => builder, in: () => builder,
  then: (resolve) => resolve({ data: rowsToReturn, error: null }),
};
stub('config/db.js', { clientDB: {}, adminDB: { from: () => builder } });
stub('services/ai.service.js', {});
const Module = require('node:module');
const origLoad = Module._load;
Module._load = function (req, ...a) { return req === 'openai' ? function OpenAI() {} : origLoad.call(this, req, ...a); };

const { searchCities } = require('../modules/profile/profile.controller');

function call(query) {
  return new Promise((resolve) => {
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code || 200, body: b }); } };
    searchCities({ query }, res);
  });
}

const tlv = { geonameid: 1, name: 'Tel Aviv', asciiname: 'Tel Aviv', country_code: 'IL', population: 400000,
  alternatenames: 'Tel Aviv-Yafo,תֵּל־אָבִיב–יָפוֹ,תל אביב,תל אביב-יפו' };

test('endpoint: Hebrew query returns Hebrew local name', async () => {
  rowsToReturn = [tlv];
  const { body } = await call({ country: 'IL', q: 'תל אביב' });
  assert.equal(body.data[0].display_label, 'Tel Aviv - תל אביב-יפו');
  assert.equal(body.data[0].local_name, 'תל אביב-יפו');
});

test('endpoint: English query returns name only', async () => {
  rowsToReturn = [tlv];
  const { body } = await call({ country: 'IL', q: 'Tel' });
  assert.equal(body.data[0].display_label, 'Tel Aviv');
  assert.equal(body.data[0].local_name, null);
});

test('endpoint: country required', async () => {
  const { code } = await call({ q: 'Tel' });
  assert.equal(code, 400);
});
