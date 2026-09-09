# September preorder fairness update

- Per StallFood per order: 2 if remaining stock > 5; 1 if remaining stock is 1–5; none if sold out. Duplicate items and legacy aliases are combined.
- Per account: 3 placed orders in a rolling hour, including cancelled, expired and rejected orders. Failed checkout attempts do not consume this quota. Counts survive restarts.
- New reservations: maximum 30 minutes. The existing EventConfig value is capped automatically; no production database edit is required. Existing order deadlines are preserved. The separate receipt-upload grace period is unchanged.
- Signup: 100 attempts per IP/subnet per 15 minutes, in addition to existing name/IP and shared authentication limits. These lightweight IP counters reset on API restart.
- Expiry runs every 30 seconds and during menu/order requests. Order creation and cancellation/expiry release are transactional. Final rejection restores stock; approval moves reservations to sold stock. Orders awaiting organiser review or a requested replacement proof remain held.
- Customer payment note: `fun fair`. Unique order references and collection codes remain intact for tracking and redemption.
- Approved-order help directs students to the Coding Club counter for physical tokens, then to the corresponding stalls.

## Deploy through SSM

Run backend first, then customer frontend. The separately developed Admin and stall owner portals do not need rebuilding for these changes. Keep existing .env files. Do not run seed commands.

```sh
cd /home/ssm-user/app/gusto-fun-fair
git pull --ff-only
cd server
npm ci --omit=dev && sudo systemctl restart funfair-api
curl -fsS http://127.0.0.1:5001/api/health

cd /home/ssm-user/app/gusto-fun-fair-frontend
git pull --ff-only
npm ci --include=dev && npm run build && sudo systemctl restart funfair-web

sudo systemctl status funfair-api funfair-web --no-pager
curl -I https://funfair.gustocollegeprojects.com
```

Stop if a pull or build fails. Do not force-reset local EC2 changes. No Nginx or certificate changes are required. If a service fails, inspect `sudo journalctl -u funfair-api -u funfair-web -n 60 --no-pager`.

## Validation

`npm test` in server uses a temporary MongoDB replica set, never Atlas. It covers racing orders at the low-stock boundary, parallel attempts against the hourly cap, duplicate and legacy IDs, insert failures, concurrent expiry and failed multi-item releases. Existing payment review tests verify rejection restores inventory and approval does not release sold food.
