# Deploy SEPEX Black Friday to production (aaPanel + nginx + Supervisor)

You are deploying the Next.js app in this repo (`arianemun/black-friday-sepex`) to an Ubuntu server managed by **aaPanel**. You have a terminal on the server (SSH). Work step by step, show me the output of every check, and **stop and ask me** whenever a value below is marked `ASK ARIAN` or something doesn't match what this prompt expects.

## Fill these in first (ask me for anything missing)

| Placeholder | Value |
|---|---|
| `DOMAIN` | ASK ARIAN (e.g. `bf.sepex.net`) |
| `APP_DIR` | `/www/wwwroot/sepex-bf` |
| `DATA_DIR` | `/www/sepex-bf-data` (outside `APP_DIR`, never inside it) |
| `PORT` | `3250` (must be free; Spinex already uses `3246`) |
| `ADMIN_PASSWORD` | ASK ARIAN (at least 12 characters) |
| SMS.ir API key and 3 template IDs | ASK ARIAN. If not ready yet, deploy with `SMS_DRY_RUN=1` and tell me. |
| `FETCH_PROXY_URL` | ASK ARIAN (HTTP proxy on a server outside Iran). Optional; leave empty if not ready. |
| Is the domain behind Cloudflare / ArvanCloud? | ASK ARIAN (changes the nginx real-IP setup in step 7) |

## Ground rules

- **Do not touch other sites or programs on this server** (Spinex at raffle.sepex.net and others). Don't edit global nginx files (`/www/server/nginx/conf/nginx.conf`, `proxy.conf`), other vhosts or other Supervisor programs. Only create or edit files for this site.
- **Never print secrets** (`.env` values, API keys, passwords) in the chat or in logs. Show `.env` only with values masked.
- **Never commit** anything from the server. If a code change is truly needed, stop and tell me; any commit must be authored `Arian <arianp78@gmail.com>`.
- Back up any existing file before editing it (`cp file file.bak.$(date +%F-%H%M)`), and always run `nginx -t` before reloading nginx.
- If a step fails, stop, show the error and propose a fix. Don't improvise around it.

---

## 1. Preflight (read-only)

Run and show me:

```bash
lsb_release -a; uname -m; df -h /www; free -h
which node npm git supervisorctl nginx sqlite3 openssl
node -v; npm -v
ss -ltnp | grep -E ':3250\b' || echo "port 3250 free"
supervisorctl status
nginx -t
ls /www/server/panel/vhost/nginx/ | head -50
```

Requirements:
- **Node.js ≥ 20.9** (22 LTS preferred). If older or missing, install Node 22 with aaPanel's Node.js manager or NodeSource, without breaking the Node version other sites use. Show me the plan first if Node is shared.
- `git`, `sqlite3`, `openssl` installed. `build-essential` and `python3` may be needed for `better-sqlite3`: `apt-get install -y build-essential python3 sqlite3` if missing.
- Note the **absolute path of `node`** (`readlink -f "$(which node)"`). Supervisor needs it.
- Port 3250 must be free. If it's taken, pick the next free port and use it everywhere.

## 2. Directories and user

The app runs as the `www` user (aaPanel's web user; confirm it exists with `id www`).

```bash
mkdir -p /www/sepex-bf-data/uploads
chown -R www:www /www/sepex-bf-data
chmod 750 /www/sepex-bf-data /www/sepex-bf-data/uploads
```

## 3. Get the code

The repo is private. Use a **read-only deploy key**:

```bash
sudo -u www mkdir -p /home/www/.ssh 2>/dev/null || true
sudo -u www ssh-keygen -t ed25519 -N "" -f /home/www/.ssh/sepex_bf_deploy -C "sepex-bf deploy"
cat /home/www/.ssh/sepex_bf_deploy.pub
```

If `www` has no home directory, use `/www/.ssh` or a root-owned key and clone as root, then `chown -R www:www "$APP_DIR"`. Tell me which one you used.

**Stop and ask me** to add the public key at GitHub → repo → Settings → Deploy keys (read-only). Then:

```bash
cat >> /home/www/.ssh/config <<'EOF'
Host github-sepex-bf
  HostName github.com
  User git
  IdentityFile /home/www/.ssh/sepex_bf_deploy
  IdentitiesOnly yes
EOF
sudo -u www git clone git@github-sepex-bf:arianemun/black-friday-sepex.git /www/wwwroot/sepex-bf
cd /www/wwwroot/sepex-bf && git log --oneline -3
```

If GitHub is unreachable from this server (Iran network), stop and tell me. Don't route around it on your own.

## 4. Environment file

Create `/www/wwwroot/sepex-bf/.env` from `.env.example`. Do **not** put `NODE_ENV` in it.

```bash
cd /www/wwwroot/sepex-bf
cp .env.example .env
SECRET=$(openssl rand -hex 32)
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
unset SECRET
```

Then set (edit with `nano`; don't echo values back):

```
NEXT_PUBLIC_SITE_URL=https://DOMAIN
DATA_DIR=/www/sepex-bf-data
TRUST_PROXY=1
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<ASK ARIAN>
SMSIR_API_KEY=<ASK ARIAN or empty>
SMS_DRY_RUN=<0 if SMS.ir is ready, otherwise 1>
SMSIR_OTP_TEMPLATE_ID=<ASK ARIAN>
SMSIR_CUSTOMER_TEMPLATE_ID=<ASK ARIAN>
SMSIR_EXPERT_TEMPLATE_ID=<ASK ARIAN>
FETCH_PROXY_URL=<ASK ARIAN or empty>
```

Keep the `SMSIR_*_PARAM*` names at their defaults unless I give you different parameter names.

```bash
chown www:www .env && chmod 600 .env
sed -E 's/=(.+)/=***set***/' .env    # show me which keys are set, masked
```

## 5. Install, verify, build

```bash
cd /www/wwwroot/sepex-bf
sudo -u www npm ci
sudo -u www npm run lint
sudo -u www npm run typecheck
sudo -u www npm test
sudo -u www npm run build
```

- `NEXT_PUBLIC_SITE_URL` must be in `.env` **before** the build: robots.txt, the sitemap and canonical URLs are fixed at build time.
- The build must **not** create or touch anything in `DATA_DIR`. Run `ls -la /www/sepex-bf-data` before and after the build; it should still be empty except `uploads/`.
- If `better-sqlite3` or `sharp` fail to install, show me the error. Usually it's the missing `build-essential`/`python3`, or a Node version mismatch.

## 6. Supervisor

Create `/etc/supervisor/conf.d/sepex-bf.conf`. If aaPanel's Supervisor plugin keeps its configs somewhere else (e.g. `/www/server/panel/plugin/supervisor/profile/`), use that location so the program shows up in the panel, and tell me which one. Replace `/ABS/PATH/TO/node` with the path from step 1:

```ini
[program:sepex-bf]
directory=/www/wwwroot/sepex-bf
command=/ABS/PATH/TO/node /www/wwwroot/sepex-bf/node_modules/next/dist/bin/next start -p 3250 -H 127.0.0.1
user=www
environment=NODE_ENV="production",HOME="/home/www"
autostart=true
autorestart=true
startsecs=5
stopwaitsecs=20
stopasgroup=true
killasgroup=true
stdout_logfile=/var/log/sepex-bf.out.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=5
stderr_logfile=/var/log/sepex-bf.err.log
stderr_logfile_maxbytes=20MB
stderr_logfile_backups=5
```

- `-H 127.0.0.1`: the app listens only locally; nginx is the only way in.
- Fix `HOME` if www's home is different.

```bash
supervisorctl reread && supervisorctl update
sleep 5; supervisorctl status sepex-bf
tail -n 50 /var/log/sepex-bf.err.log
curl -sI http://127.0.0.1:3250/ | head -5
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3250/admin/login
ls -la /www/sepex-bf-data     # app.db should exist now, owned by www
```

## 7. nginx site (aaPanel)

1. In aaPanel → Website → Add site: domain `DOMAIN`, **no database, no FTP**, PHP = static. (Or show me the equivalent CLI steps.)
2. Request a **Let's Encrypt** certificate for `DOMAIN` in the site's SSL tab and enable **Force HTTPS**.
3. Edit the site's vhost (`/www/server/panel/vhost/nginx/DOMAIN.conf`). Back it up first. Then:
   - **Remove** aaPanel's default static-file regex blocks (`location ~ .*\.(gif|jpg|jpeg|png|bmp|swf)$`, `location ~ .*\.(js|css)?$`) and any `include enable-php-*.conf` / rewrite includes. They would serve `/_next/static`, `/brand/*` and `/media/*` from disk instead of the app.
   - Keep the `.well-known` location (needed for certificate renewal) and the SSL lines.
   - Add, inside the HTTPS `server {}`:

```nginx
client_max_body_size 12m;

location / {
    proxy_pass http://127.0.0.1:3250;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_cache off;          # aaPanel's global proxy_cache otherwise serves stale pages
    proxy_buffering on;
    proxy_read_timeout 60s;
}
```

4. **If the domain is behind Cloudflare/ArvanCloud** (ask me): `$remote_addr` would be the CDN's IP and every visitor would share one rate limit. In that case add `set_real_ip_from` lines for the CDN's published IP ranges plus `real_ip_header CF-Connecting-IP;` (Cloudflare) or the header ArvanCloud documents. Use only official ranges and show me the diff.
5. `nginx -t && nginx -s reload` (or reload from aaPanel).

Show me the final vhost diff.

## 8. Smoke tests (show every output)

```bash
D=https://DOMAIN
curl -sI $D/ | head -15                              # 200, CSP + security headers present
curl -s $D/ | grep -o '<title>[^<]*' | head -1
curl -s $D/robots.txt                                # Sitemap: https://DOMAIN/sitemap.xml ; Disallow /admin
curl -s $D/sitemap.xml | head -20                    # URLs use https://DOMAIN
curl -sI $D/og.png | head -3                         # 200 image/png
curl -sI $D/brand/sepex-logo.svg | head -3           # 200 image/svg+xml
curl -s -o /dev/null -w "%{http_code}\n" $D/admin/login     # 200
curl -s -o /dev/null -w "%{http_code}\n" $D/media/doesnotexist000   # 404
curl -s -o /dev/null -w "%{http_code}\n" http://DOMAIN/     # 301 to https
curl -s -o /dev/null -w "%{http_code}\n" http://DOMAIN:3250/ --max-time 5 || echo "3250 not public: OK"
# static assets go through Next, not disk:
curl -s $D/ | grep -o '/_next/static/[^"]*\.css' | head -1 | xargs -I{} curl -sI $D{} | head -3
# an OTP request from a non-browser client should be accepted or rate limited, never a 500:
curl -s -X POST $D/api/otp/send -H 'Content-Type: application/json' -d '{"phone":"123"}'   # {"ok":false,"error":"شماره موبایل معتبر نیست."}
tail -n 30 /var/log/sepex-bf.err.log
```

Then tell me to check by hand, on a real phone:
- the landing on mobile and desktop
- a full order with a real OTP (if SMS is live)
- `/track` with that tracking code
- in the panel: login → **change the admin password** (کارشناس‌ها → edit) → add the experts with mobile numbers and "پیامک درخواست جدید" on → Settings: set the campaign start/end and footer contacts → check «وضعیت سرویس‌ها».
- share the URL in Telegram/WhatsApp and check the preview image.

## 9. Daily backup

Create `/www/sepex-bf-backup.sh` (owned by root, `chmod 700`):

```bash
#!/usr/bin/env bash
set -euo pipefail
DEST=/www/backup/sepex-bf
STAMP=$(date +%F-%H%M)
mkdir -p "$DEST"
sqlite3 /www/sepex-bf-data/app.db ".backup '$DEST/app-$STAMP.db'"
tar -czf "$DEST/uploads-$STAMP.tar.gz" -C /www/sepex-bf-data uploads
find "$DEST" -type f -mtime +14 -delete
```

Run it once and show me the files. Then add a root cron (aaPanel → Cron, or `crontab -e`): `20 4 * * * /www/sepex-bf-backup.sh >> /var/log/sepex-bf-backup.log 2>&1`.

## 10. Update script

Create `/www/wwwroot/sepex-bf/deploy/update.sh` **on the server only** (don't commit it) for future releases:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /www/wwwroot/sepex-bf
PREV=$(git rev-parse HEAD)
echo "previous: $PREV"
/www/sepex-bf-backup.sh
sudo -u www git pull --ff-only
sudo -u www npm ci
sudo -u www npm test
sudo -u www npm run build
supervisorctl restart sepex-bf
sleep 5
code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3250/)
if [ "$code" != "200" ]; then
  echo "health check failed ($code); rolling back to $PREV"
  sudo -u www git checkout "$PREV" && sudo -u www npm ci && sudo -u www npm run build && supervisorctl restart sepex-bf
  exit 1
fi
echo "deployed $(git rev-parse --short HEAD)"
```

## 11. Report back

Give me a short summary with:
- node version and path, port, Supervisor config location, vhost path
- which secrets are set (masked) and whether SMS is live or dry-run
- results of every smoke test in step 8
- anything you skipped, assumed or couldn't do
