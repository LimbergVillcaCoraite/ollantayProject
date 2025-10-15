import json
import http.cookiejar
import urllib.request

BASE = 'http://localhost:8002'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

login_data = json.dumps({"username": "admin", "password": ""}).encode('utf-8')
req = urllib.request.Request(BASE + '/auth/login', data=login_data, headers={'Content-Type': 'application/json'})
print('POST', req.full_url)
try:
    resp = opener.open(req)
    body = resp.read().decode('utf-8')
    print('Status:', resp.getcode())
    print('Headers:')
    for k, v in resp.getheaders():
        print(f'  {k}: {v}')
    print('Body:', body)
    print('\nSaved cookies:')
    for cookie in cj:
        print(' ', cookie)
except urllib.error.HTTPError as e:
    print('HTTPError', e.code)
    try:
        print(e.read().decode('utf-8'))
    except Exception:
        pass

# call /auth/me using same opener (reuses cookies)
req2 = urllib.request.Request(BASE + '/auth/me')
print('\nGET', req2.full_url)
try:
    resp2 = opener.open(req2)
    body2 = resp2.read().decode('utf-8')
    print('Status:', resp2.getcode())
    print('Headers:')
    for k, v in resp2.getheaders():
        print(f'  {k}: {v}')
    print('Body:', body2)
except urllib.error.HTTPError as e:
    print('HTTPError', e.code)
    try:
        print(e.read().decode('utf-8'))
    except Exception:
        pass
