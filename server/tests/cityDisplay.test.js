const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCityLabelForQuery, detectQueryScript } = require('../utils/cityDisplay');

const telAviv = {
  name: 'Tel Aviv',
  asciiname: 'Tel Aviv',
  alternatenames:
    'Lungsod ng Tel Aviv-Yafo,TLV,Tel Aviv-Yafo,Тель-Авив,Τελ Αβίβ,תֵּל־אָבִיב–יָפוֹ,תל אביב,תל אביב-יפו,تل أبيب,تل أبيب يافا,テルアビブ,特拉维夫,텔아비브',
};

test('detectQueryScript', () => {
  assert.equal(detectQueryScript('תל אביב'), 'hebrew');
  assert.equal(detectQueryScript('تل'), 'arabic');
  assert.equal(detectQueryScript('Тель'), 'cyrillic');
  assert.equal(detectQueryScript('Τελ'), 'greek');
  assert.equal(detectQueryScript('テル'), 'cjk');
  assert.equal(detectQueryScript('Tel'), null);
  assert.equal(detectQueryScript(''), null);
});

test('Hebrew query -> name + Hebrew alternate (no niqqud)', () => {
  assert.deepEqual(formatCityLabelForQuery(telAviv, 'תל אביב'), {
    label: 'Tel Aviv - תל אביב-יפו',
    local_name: 'תל אביב-יפו',
  });
});

test('Latin query -> name only', () => {
  assert.deepEqual(formatCityLabelForQuery(telAviv, 'Tel'), { label: 'Tel Aviv', local_name: null });
});

test('Cyrillic / Arabic / Greek / Japanese queries pick their own script', () => {
  assert.equal(formatCityLabelForQuery(telAviv, 'Тель').local_name, 'Тель-Авив');
  assert.equal(formatCityLabelForQuery(telAviv, 'تل').local_name, 'تل أبيب يافا');
  assert.equal(formatCityLabelForQuery(telAviv, 'Τελ').local_name, 'Τελ Αβίβ');
  assert.equal(formatCityLabelForQuery(telAviv, 'テル').local_name, 'テルアビブ');
});

test('no alternate in the typed script -> name only', () => {
  const row = { name: 'Smalltown', asciiname: 'Smalltown', alternatenames: 'Foo,Bar' };
  assert.deepEqual(formatCityLabelForQuery(row, 'סמול'), { label: 'Smalltown', local_name: null });
});

test('empty row / missing alternatenames are safe', () => {
  assert.deepEqual(formatCityLabelForQuery({}, 'תל'), { label: '', local_name: null });
  assert.deepEqual(formatCityLabelForQuery({ name: 'X' }, 'תל'), { label: 'X', local_name: null });
});
