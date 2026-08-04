# Deploying Tasker

## What this app needs from a host

A **Node process that stays running**. Tasker is server-rendered — every page
is built on request, Server Actions handle every write, and Route Handlers
serve PDFs and file downloads. There is no static export.

That rules out shared/web hosting, whatever the PHP-shaped control panel
suggests. On Hostinger it means a **VPS**, or a plan that gives you real
Node.js hosting with SSH.

It also needs a **persistent disk**. `STORAGE_PROVIDER=local` writes uploaded
files to the filesystem. On anything that resets between deploys — serverless,
ephemeral containers — every file a client attached disappears the next time
you ship.

---

## 1. The server

```bash
# Node 20+ and a process manager
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm i -g pm2
```

## 2. The code

```bash
sudo mkdir -p /var/www/tasker && sudo chown $USER /var/www/tasker
git clone <your-repo-url> /var/www/tasker
cd /var/www/tasker
npm ci
```

## 3. Uploads live outside the checkout

This one matters more than it looks. `STORAGE_ROOT` defaults to `./storage`,
which is *inside* the repo — fine on a laptop, wrong on a server, where a
`git pull` or a fresh clone sits on top of it. Put it somewhere deploys never
touch:

```bash
sudo mkdir -p /var/lib/tasker/storage
sudo chown $USER /var/lib/tasker/storage
```

## 4. Environment

```bash
cp .env.example .env.local
nano .env.local
```

What must differ from your laptop:

| Variable | Value | Why |
| --- | --- | --- |
| `PREVIEW_MODE` | `false` | Otherwise the whole site serves fixtures |
| `APP_URL` | `https://your-domain.com` | Invite links, invoice links and emails are built from it. Left as localhost, every invite you send points at the recipient's own machine |
| `STORAGE_ROOT` | `/var/lib/tasker/storage` | See above |
| `NEXT_PUBLIC_SUPABASE_URL` | same as local | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as local | |
| `SUPABASE_SERVICE_ROLE_KEY` | same as local | Never in git. Only ever in this file, `chmod 600` |

```bash
chmod 600 .env.local
npm run check:env    # confirms the keys are the right way round
```

## 5. Tell Supabase about the domain

Auth → URL Configuration in the Supabase dashboard:

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: add `https://your-domain.com/**`

Skip this and sign-in links, invite links and password resets all bounce to
localhost. It is the most common reason a working app appears broken the
moment it has a domain.

## 6. Build and run

```bash
npm run build
pm2 start npm --name tasker -- start
pm2 save
pm2 startup        # prints a command to run so it survives a reboot
```

## 7. nginx and TLS

```nginx
server {
  server_name your-domain.com;

  # Uploads and PDFs go through the app, so don't cap the body at nginx's
  # 1MB default — a client attaching a photo would get a 413 with no
  # explanation.
  client_max_body_size 25M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tasker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

---

## Shipping a change

```bash
cd /var/www/tasker
git pull
npm ci
npm run build
pm2 reload tasker
```

New migrations are separate and are **not** applied by a deploy. Run them
against Supabase first — the app expects a schema that already exists, and a
build that ships ahead of its migration fails at the first query.

---

## Before you call it live

- [ ] `npm run check:env` passes on the server
- [ ] Supabase Site URL and redirect URLs include the domain
- [ ] Sign in as the admin over the real domain
- [ ] Attach a file to a task, then download it — proves `STORAGE_ROOT` is
      writable and served
- [ ] `pm2 reload tasker`, then check the file is still there — proves it
      survives a deploy
- [ ] Create an invite link and open it in a private window

## Known, deliberate gaps

**Email doesn't send.** `EMAIL_PROVIDER=console` prints to the server log
instead. Invoices marked "sent" reach nobody until you set
`EMAIL_PROVIDER=resend` with `RESEND_API_KEY` and a verified `EMAIL_FROM`.
Supabase's own invite mail has a low rate limit and is meant for testing, so
that wants custom SMTP too.

**Latency.** The Supabase project is in `ap-northeast-2` (Seoul). Each round
trip from India is ~200ms, and a page is a handful of them. Put the VPS in a
region close to the *database*, not close to you — the browser talks to the VPS
once, the VPS talks to Supabase repeatedly. A Mumbai VPS with a Seoul database
is the worst of both.

**Not responsive yet.** The layout is desktop-only; the sidebar is a fixed
256px and only 18 of 121 components carry a breakpoint.
