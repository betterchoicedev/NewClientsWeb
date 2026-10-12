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
  assert.equal(detectQueryScript('テル'), 'kana');
  assert.equal(detectQueryScript('서울'), 'hangul');
  assert.equal(detectQueryScript('東京'), 'han');
  assert.equal(detectQueryScript('กรุงเทพ'), 'thai');
  assert.equal(detectQueryScript('मुंबई'), 'devanagari');
  assert.equal(detectQueryScript('თბილისი'), 'georgian');
  assert.equal(detectQueryScript('Երևան'), 'armenian');
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
  assert.equal(formatCityLabelForQuery(telAviv, 'تل').local_name, 'تل أبيب');
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

// Regressions found against the live cities500 data: the picker must prefer the alternate
// that matches what was typed, not a longer variant / another language in the same script.
test('prefers the alternate matching the typed text (live-data regressions)', () => {
  const moscow = { name: 'Moscow', asciiname: 'Moscow', alternatenames: 'Moskva,Москова,Москва,Moskau' };
  assert.equal(formatCityLabelForQuery(moscow, 'Москва').local_name, 'Москва');

  const kyiv = { name: 'Kyiv', asciiname: 'Kyiv', alternatenames: 'Kiev,Киев ош,Киев,Київ' };
  assert.equal(formatCityLabelForQuery(kyiv, 'Київ').local_name, 'Київ');

  const dubai = { name: 'Dubai', asciiname: 'Dubai', alternatenames: 'دۇبائى,دبي,دبی' };
  assert.equal(formatCityLabelForQuery(dubai, 'دبي').local_name, 'دبي');

  const tokyo = { name: 'Tokyo', asciiname: 'Tokyo', alternatenames: '東京都,東京,とうきょう,도쿄' };
  assert.equal(formatCityLabelForQuery(tokyo, '東京').local_name, '東京');

  const seoul = { name: 'Seoul', asciiname: 'Seoul', alternatenames: 'ソウル特別市,서울,首尔' };
  assert.equal(formatCityLabelForQuery(seoul, '서울').local_name, '서울');

  const taipei = { name: 'Taipei', asciiname: 'Taipei', alternatenames: '타이베이 시,台北' };
  assert.equal(formatCityLabelForQuery(taipei, '台北').local_name, '台北');
});

test('Thai / Hindi / Georgian / Armenian queries get a local name', () => {
  assert.equal(formatCityLabelForQuery({ name: 'Bangkok', alternatenames: 'กรุงเทพ' }, 'กรุงเทพ').label, 'Bangkok - กรุงเทพ');
  assert.equal(formatCityLabelForQuery({ name: 'Mumbai', alternatenames: 'मुंबई' }, 'मुंबई').label, 'Mumbai - मुंबई');
  assert.equal(formatCityLabelForQuery({ name: 'Tbilisi', alternatenames: 'თბილისი' }, 'თბილისი').label, 'Tbilisi - თბილისი');
  assert.equal(formatCityLabelForQuery({ name: 'Yerevan', alternatenames: 'Երևան' }, 'Երևան').label, 'Yerevan - Երևան');
});
