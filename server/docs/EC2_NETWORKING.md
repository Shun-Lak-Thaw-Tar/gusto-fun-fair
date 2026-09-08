# EC2 backend networking and authentication limits

Use Node 24 and set `NODE_ENV=production`, `PORT=5001` and `CLIENT_URL` to the
final HTTPS website origin. Production binds to `127.0.0.1`; development keeps
its existing all-interface binding and does not trust forwarded headers.

Express trusts only the nearest proxy when its connection comes from an exact
loopback address. This is for Nginx on the same EC2 instance, not an ALB,
container network, or arbitrary chain of proxies. Run one backend process;
rate-limit counters are in memory and reset on restart.

Place this location in Nginx's **HTTPS server block** during deployment:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Forwarded "";
    proxy_set_header Connection "";
    client_max_body_size 8m;
    client_body_timeout 30s;
    proxy_connect_timeout 5s;
    proxy_send_timeout 180s;
    proxy_read_timeout 180s;
    proxy_intercept_errors off;
}
```

`proxy_pass` deliberately has no trailing slash so `/api/` is preserved. The
forwarding headers are overwritten, never copied from a visitor's supplied
values. Keep backend port 5001 closed in the EC2 security group. Serve the
frontend through its separate Nginx location. This snippet does not install
Nginx or configure certificates; it belongs in the eventual HTTPS setup.

Authentication limits run before database queries/password hashing:

- Shared ceiling: 600 login + registration attempts per 5 minutes per IP.
- Login: 15 failed attempts per 15 minutes per normalized name + IP; successful
  logins do not consume this tighter quota. Unknown names receive the same limit.
- Registration: 5 attempts per 15 minutes per normalized name + IP, including
  successes and failures. Other students/names have independent quotas.
- IPv6 addresses are grouped by subnet. Names are hashed for limiter keys;
  passwords are never used in keys. No authentication records are stored here.
- Rejections return HTTP 429, a friendly `error.message`, and `Retry-After`
  seconds (also `error.details.retryAfterSeconds`). The existing frontend shows
  the message. These are request controls, not protection against every DDoS.

The generous shared ceiling is intended for 300–500 students sharing campus
Wi-Fi. Authentication still consumes CPU; verify real signup/login bursts on
the selected instance before the event. Limits are in `authRateLimit.js`.
