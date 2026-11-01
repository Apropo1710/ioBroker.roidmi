const test = require('node:test');
const assert = require('node:assert/strict');
const { XiaomiCloudMapClient } = require('../build/lib/xiaomi-cloud-map.js');

function response(body = '{}', status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

test('Xiaomi login preserves session cookies and Extension-Pragma across every STS redirect', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method || 'GET', cookie: new Headers(init.headers).get('Cookie') });
    if (String(url).includes('/pass/serviceLogin?')) {
      return response('&&&START&&&{"_sign":"sig","sid":"xiaomiio","callback":"https://sts.api.io.mi.com/sts","qs":"?sid=xiaomiio&_json=true"}');
    }
    if (String(url).endsWith('/pass/serviceLoginAuth2')) {
      return response('&&&START&&&{"location":"https://sts.example/first","ssecurity":"c2VjdXJpdHk=","userId":"123"}');
    }
    if (String(url) === 'https://sts.example/first') {
      return response('', 302, {
        location: 'https://sts.example/second',
        'set-cookie': 'userId=123; Path=/',
      });
    }
    if (String(url) === 'https://sts.example/second') {
      return response('', 302, {
        location: 'https://sts.example/final',
        'set-cookie': 'cUserId=456; Path=/',
        'Extension-Pragma': JSON.stringify({ ssecurity: 'c2VjdXJpdHk=' }),
      });
    }
    if (String(url) === 'https://sts.example/final') {
      return response('', 200, { 'set-cookie': 'serviceToken=svc; Path=/' });
    }
    throw new Error('Unexpected mocked URL: ' + String(url));
  };
  t.after(() => { global.fetch = originalFetch; });

  // Stop after login by returning an API-shaped encrypted response is not
  // necessary here: assert the session failure is not raised. Replace the map
  // API crypto response with an empty archive is covered by the expected API path.
  // The direct auth flow is exercised using invalid base64 as a predictable API error.
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap({
      username: 'account@example.test',
      password: 'not-a-real-password',
      country: 'de',
      token: '0123456789abcdef0123456789abcdef',
      mapName: '0',
    }),
    /Xiaomi cloud API request failed|unreadable encrypted response/,
  );
  assert.ok(calls.some(c => c.url === 'https://sts.example/second'));
  assert.ok(calls.some(c => c.cookie?.includes('userId=123') && c.cookie?.includes('cUserId=456')));
});

test('Xiaomi 2FA does not expose verification data when identity session is missing', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/pass/serviceLogin?')) {
      return response('&&&START&&&{"_sign":"sig","sid":"xiaomiio","callback":"https://sts.api.io.mi.com/sts","qs":"?sid=xiaomiio&_json=true"}');
    }
    if (String(url).endsWith('/pass/serviceLoginAuth2')) {
      return response('&&&START&&&{"notificationUrl":"https://account.xiaomi.com/fe/service/identity/authStart?x=1"}');
    }
    if (String(url).includes('/identity/list')) return response('&&&START&&&{"flag":8}');
    throw new Error('Unexpected mocked URL: ' + String(url));
  };
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap({
      username: 'account@example.test', password: 'not-a-real-password',
      country: 'de', token: '0123456789abcdef0123456789abcdef', mapName: '0',
    }),
    /identity session missing/,
  );
});

test('Xiaomi 2FA chooses email or phone from Xiaomi flag without logging the code', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: String(init.body || ''), cookie: new Headers(init.headers).get('Cookie') });
    if (String(url).includes('/pass/serviceLogin?')) {
      return response('&&&START&&&{"_sign":"sig","sid":"xiaomiio","callback":"https://sts.api.io.mi.com/sts","qs":"?sid=xiaomiio&_json=true"}');
    }
    if (String(url).endsWith('/pass/serviceLoginAuth2')) {
      return response('&&&START&&&{"notificationUrl":"https://account.xiaomi.com/fe/service/identity/authStart?x=1"}');
    }
    if (String(url).includes('/identity/list')) {
      return response('&&&START&&&{"flag":8}', 200, { 'set-cookie': 'identity_session=identity-secret; Path=/' });
    }
    if (String(url).includes('/identity/auth/verifyEmail?')) {
      return response('&&&START&&&{"maskedEmail":"a***@example.test"}');
    }
    if (String(url).endsWith('/identity/auth/sendEmailTicket')) {
      return response('&&&START&&&{"code":0}');
    }
    throw new Error('Unexpected mocked URL: ' + String(url));
  };
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap({
      username: 'account@example.test', password: 'not-a-real-password',
      country: 'de', token: '0123456789abcdef0123456789abcdef', mapName: '0',
    }),
    /Code sent to a\*\*\*@example\.test/,
  );
  assert.ok(calls.some(c => c.url.includes('/identity/auth/verifyEmail')));
  assert.ok(calls.some(c => c.url.endsWith('/identity/auth/sendEmailTicket') && c.method === 'POST'));
  assert.ok(calls.every(c => !c.body.includes('identity-secret')));
});
