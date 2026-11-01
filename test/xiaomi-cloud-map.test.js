const test = require('node:test');
const assert = require('node:assert/strict');
const { XiaomiCloudMapClient } = require('../build/lib/xiaomi-cloud-map.js');

function response(body = '{}', status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

function validOptions() {
  return {
    username: 'account@example.test',
    password: 'not-a-real-password',
    country: 'de',
    token: '0123456789abcdef0123456789abcdef',
    mapName: '0',
  };
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
      return response('', 302, { location: 'https://sts.example/second', 'set-cookie': 'userId=123; Path=/' });
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
    if (String(url).startsWith('https://de.api.io.mi.com/app/home/device_list')) {
      // Invalid encrypted response is intentional: reaching this endpoint proves
      // authentication completed and all required session values were accepted.
      return response('not-valid-base64');
    }
    throw new Error('Unexpected mocked URL: ' + String(url).split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap(validOptions()),
    /unreadable encrypted response/,
  );
  assert.ok(calls.some(c => c.url === 'https://sts.example/second'));
  const secondHop = calls.find(c => c.url === 'https://sts.example/final');
  assert.ok(secondHop.cookie?.includes('userId=123'));
  assert.ok(secondHop.cookie?.includes('cUserId=456'));
  assert.ok(calls.some(c => c.url.startsWith('https://de.api.io.mi.com/app/home/device_list')));
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
    if (String(url).includes('/identity/list')) return response('&&&START&&&{"code":0,"flag":8}');
    throw new Error('Unexpected mocked URL: ' + String(url).split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap(validOptions()),
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
      return response('&&&START&&&{"code":0,"flag":8}', 200, { 'set-cookie': 'identity_session=identity-secret; Path=/' });
    }
    if (String(url).includes('/identity/auth/verifyEmail')) {
      return response('&&&START&&&{"maskedEmail":"a***@example.test"}');
    }
    if (String(url).includes('/identity/auth/sendEmailTicket')) {
      return response('&&&START&&&{"code":0}');
    }
    throw new Error('Unexpected mocked URL: ' + String(url).split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap(validOptions()),
    /Bestätigungscode wurde an a\*\*\*@example\.test gesendet/,
  );
  assert.ok(calls.some(c => c.url.includes('/identity/auth/verifyEmail')));
  const sendCall = calls.find(c => c.url.includes('/identity/auth/sendEmailTicket'));
  assert.ok(sendCall && sendCall.method === 'POST');
  assert.equal(sendCall.url, 'https://account.xiaomi.com/identity/auth/sendEmailTicket?_json=true');
  assert.match(sendCall.body, /_flag=8/);
  assert.match(sendCall.body, /retry=0/);
  assert.match(sendCall.body, /_json=true/);
  assert.equal(sendCall.cookie, 'identity_session=identity-secret');
  assert.ok(calls.every(c => !c.body.includes('identity-secret')));
});


test('Xiaomi cloud session can be exported and restored without another login', async (t) => {
  const originalFetch = global.fetch;
  let loginRequests = 0;
  global.fetch = async (url) => {
    if (String(url).includes('/pass/serviceLogin')) loginRequests++;
    if (String(url).startsWith('https://de.api.io.mi.com/app/home/device_list')) return response('not-valid-base64');
    throw new Error('Unexpected network request: ' + String(url).split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });
  const first = new XiaomiCloudMapClient();
  // Restore a valid serialized session directly, as it would be loaded from encrypted adapter config.
  first.restoreSession(JSON.stringify({
    cookies: [['userId', '123'], ['serviceToken', 'svc']],
    ssecurity: 'c2VjdXJpdHk=', userId: '123', serviceToken: 'svc', cUserId: '456', passToken: 'pass'
  }));
  const saved = first.exportSession();
  const second = new XiaomiCloudMapClient();
  second.restoreSession(saved);
  assert.equal(second.hasSession(), true);
  await assert.rejects(() => second.fetchMap(validOptions()), /unreadable encrypted response/);
  assert.equal(loginRequests, 0);
});
