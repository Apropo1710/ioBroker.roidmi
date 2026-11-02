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
  const verifyCall = calls.find(c => c.url.includes('/identity/auth/verifyEmail'));
  assert.ok(verifyCall && verifyCall.method === 'GET');
  assert.equal(verifyCall.url, 'https://account.xiaomi.com/identity/auth/verifyEmail?_flag=8&_json=true');
  const sendCall = calls.find(c => c.url.includes('/identity/auth/sendEmailTicket'));
  assert.ok(sendCall && sendCall.method === 'POST');
  assert.equal(sendCall.url, 'https://account.xiaomi.com/identity/auth/sendEmailTicket');
  assert.match(sendCall.body, /_flag=8/);
  assert.match(sendCall.body, /icode=/);
  assert.match(sendCall.body, /retry=0/);
  assert.match(sendCall.body, /_json=true/);
  assert.equal(sendCall.cookie, 'identity_session=identity-secret');
  assert.ok(calls.every(c => !c.body.includes('identity-secret')));
});


test('Xiaomi 2FA reports sanitized server tips without exposing response data', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/pass/serviceLogin?')) {
      return response('&&&START&&&{"_sign":"sig","sid":"xiaomiio","callback":"https://sts.api.io.mi.com/sts","qs":"?sid=xiaomiio&_json=true"}');
    }
    if (String(url).endsWith('/pass/serviceLoginAuth2')) {
      return response('&&&START&&&{"notificationUrl":"https://account.xiaomi.com/fe/service/identity/authStart?x=1"}');
    }
    if (String(url).includes('/identity/list')) {
      return response('&&&START&&&{"code":0,"flag":8}', 200, { 'set-cookie': 'identity_session=identity-secret; Path=/' });
    }
    if (String(url).includes('/identity/auth/verifyEmail')) return response('&&&START&&&{"maskedEmail":"a***@example.test"}');
    if (String(url).includes('/identity/auth/sendEmailTicket')) {
      return response('&&&START&&&{"code":70022,"tips":"Please try again later <b>soon</b>"}');
    }
    throw new Error('Unexpected mocked URL: ' + String(url).split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    () => new XiaomiCloudMapClient().fetchMap(validOptions()),
    /code 70022\): Please try again later soon/,
  );
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


test('cloud actions require a restored or authenticated session before sending requests', async () => {
  const client = new XiaomiCloudMapClient();
  await assert.rejects(
    () => client.callAction('de', { did: 'robot-did', siid: 8, aiid: 8 }),
    /Xiaomi Cloud session is unavailable/,
  );
});

test('cloud action sends MIoT action to the encrypted action endpoint when session exists', async (t) => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: new Headers(init.headers) });
    // Deliberately malformed encrypted response: endpoint/request can be verified
    // without authenticating against Xiaomi or making a live robot action.
    return response('not-valid-base64');
  };
  t.after(() => { global.fetch = originalFetch; });

  const client = new XiaomiCloudMapClient();
  client.restoreSession(JSON.stringify({
    cookies: [['userId', '123'], ['serviceToken', 'test-service-token']],
    ssecurity: Buffer.from('test-security').toString('base64'),
    userId: '123',
    serviceToken: 'test-service-token',
    cUserId: '456',
    passToken: 'test-pass',
  }));

  await assert.rejects(
    () => client.callAction('de', { did: 'robot-did', siid: 8, aiid: 8, in: [] }),
    /unreadable encrypted response/,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/de\.api\.io\.mi\.com\/app\/miotspec\/action\?/);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.get('MIOT-ENCRYPT-ALGORITHM'), 'ENCRYPT-RC4');
  // The action arguments are encrypted; sensitive/session data is not logged or
  // exposed in a plain URL query parameter.
  assert.doesNotMatch(calls[0].url, /robot-did/);
  assert.doesNotMatch(calls[0].url, /test-service-token/);
});


test('completed Xiaomi 2FA session survives export and restore without another verification', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET' });
    if (u.includes('/pass/serviceLogin?')) {
      return response('&&&START&&&{"_sign":"sig","sid":"xiaomiio","callback":"https://sts.api.io.mi.com/sts","qs":"?sid=xiaomiio&_json=true"}');
    }
    if (u.endsWith('/pass/serviceLoginAuth2')) {
      return response('&&&START&&&{"notificationUrl":"https://account.xiaomi.com/fe/service/identity/authStart?sid=xiaomiio"}');
    }
    if (u.includes('/identity/list')) {
      return response('&&&START&&&{"code":0,"flag":8,"trustCheckBox":true}', 200, { 'set-cookie': 'identity_session=identity-test; Path=/' });
    }
    if (u.includes('/identity/auth/verifyEmail?')) {
      return response('&&&START&&&{"maskedEmail":"a***@example.test"}');
    }
    if (u.endsWith('/identity/auth/sendEmailTicket')) {
      return response('&&&START&&&{"code":0}');
    }
    if (u.endsWith('/identity/auth/verifyEmail')) {
      assert.match(String(init.body || ''), /ticket=123456/);
      assert.match(String(init.body || ''), /trust=true/);
      return response('&&&START&&&{"location":"https://sts.example/first"}');
    }
    if (u === 'https://sts.example/first') {
      return response('', 302, {
        location: 'https://sts.example/final',
        'set-cookie': 'userId=789; Path=/',
        'Extension-Pragma': JSON.stringify({ ssecurity: 'c2VjdXJpdHk=' }),
      });
    }
    if (u === 'https://sts.example/final') {
      return response('', 200, { 'set-cookie': 'serviceToken=service-test; Path=/' });
    }
    if (u.startsWith('https://de.api.io.mi.com/app/home/device_list')) {
      return response('not-valid-base64');
    }
    throw new Error('Unexpected mocked URL: ' + u.split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });

  const first = new XiaomiCloudMapClient();
  await assert.rejects(() => first.fetchMap(validOptions()), /Bestätigungscode wurde an a\*\*\*@example\.test gesendet/);
  await assert.rejects(() => first.fetchMap(validOptions(), '123456'), /unreadable encrypted response/);
  assert.equal(first.hasSession(), true);

  const saved = first.exportSession();
  const restored = new XiaomiCloudMapClient();
  restored.restoreSession(saved);
  assert.equal(restored.hasSession(), true);

  const loginCallsBefore = calls.filter(c => c.url.includes('/pass/serviceLogin')).length;
  await assert.rejects(() => restored.fetchMap(validOptions()), /unreadable encrypted response/);
  const loginCallsAfter = calls.filter(c => c.url.includes('/pass/serviceLogin')).length;
  assert.equal(loginCallsAfter, loginCallsBefore, 'restored session should not trigger a new password/2FA login');
});


test('expired Xiaomi serviceToken renews with passToken without password login or 2FA', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  let mapCalls = 0;
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    const headers = new Headers(init.headers);
    calls.push({ url: u, cookie: headers.get('Cookie') || '' });
    if (u.startsWith('https://de.api.io.mi.com/app/home/device_list')) {
      mapCalls++;
      if (mapCalls === 1) return response('unauthorized', 401);
      return response('not-valid-base64');
    }
    if (u === 'https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true') {
      assert.match(headers.get('Cookie') || '', /userId=123/);
      assert.match(headers.get('Cookie') || '', /passToken=long-lived-pass/);
      return response('&&&START&&&{"location":"https://sts.example/renew","ssecurity":"c2VjdXJpdHk=","userId":"123"}');
    }
    if (u === 'https://sts.example/renew') {
      return response('', 302, {
        location: 'https://sts.example/renew-final',
        'set-cookie': 'userId=123; Path=/',
        'Extension-Pragma': JSON.stringify({ ssecurity: 'c2VjdXJpdHk=' }),
      });
    }
    if (u === 'https://sts.example/renew-final') {
      return response('', 200, { 'set-cookie': 'serviceToken=fresh-service-token; Path=/' });
    }
    throw new Error('Unexpected mocked URL: ' + u.split('?')[0]);
  };
  t.after(() => { global.fetch = originalFetch; });

  const client = new XiaomiCloudMapClient();
  client.restoreSession(JSON.stringify({
    cookies: [['userId', '123'], ['serviceToken', 'old-service-token']],
    ssecurity: 'c2VjdXJpdHk=', userId: '123', serviceToken: 'old-service-token',
    cUserId: '456', passToken: 'long-lived-pass'
  }));

  await assert.rejects(() => client.fetchMap(validOptions()), /unreadable encrypted response/);
  assert.equal(mapCalls, 2, 'API request should be retried exactly once after session renewal');
  assert.equal(calls.filter(c => c.url.includes('/pass/serviceLoginAuth2')).length, 0,
    'renewal must not submit password or start a new 2FA login');
  assert.equal(calls.filter(c => c.url.includes('/pass/serviceLogin?sid=xiaomiio')).length, 1);
  assert.ok(client.exportSession().includes('fresh-service-token'));
});
