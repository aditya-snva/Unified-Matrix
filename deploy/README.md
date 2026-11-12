# Deploying Unified Matrix

| Part | Where | Cost |
|---|---|---|
| Angular PWA | **Vercel** (Hobby) | Free |
| Express backend (Telegram, Gmail, webhooks, Socket.IO) | **Always-free VM**: Oracle Cloud *Always Free* or Google Cloud *e2-micro* | Free (a card is needed at sign-up) |
| Database | **MongoDB Atlas** M0 | Free |
| HTTPS for the backend | Caddy + `<ip>.sslip.io` (no domain needed) | Free |

```
phone (httpSMS) ─┐
Meta (WhatsApp) ─┼─► https://<ip>.sslip.io ─► Caddy ─► Node :4000 ─► Atlas
Telegram/Gmail ◄─┘          ▲  API + Socket.IO
                            │
          https://<app>.vercel.app  (PWA)
```

Do the steps in this order: **1 → 2 → 3 → 4 → 5**.

## 1. MongoDB Atlas

1. At [cloud.mongodb.com](https://cloud.mongodb.com), create a free **M0** cluster. Pick the region closest to your VM.
2. **Database Access**: add a database user with a password made only of letters and digits, so it doesn't need URL-escaping.
3. **Network Access**: add your VM's public IP once you have it (step 2). Temporarily you can use `0.0.0.0/0`, but remove that afterwards.
4. **Connect → Drivers**: copy the connection string and add the database name before `?`:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/unified_matrix?retryWrites=true&w=majority`

## 2. The VM

**Oracle Cloud** (recommended: India regions and more RAM)
- Create Instance → image **Ubuntu 24.04**. Shape: **VM.Standard.A1.Flex** (1 OCPU / 6 GB is plenty), or **VM.Standard.E2.1.Micro** if A1 says "out of capacity".
- Download the SSH key it offers.
- Open the instance's **Subnet → Security List → Add Ingress Rules**: source `0.0.0.0/0`, TCP, destination ports `80,443`.

**Google Cloud** (alternative)
- Compute Engine → Create instance, **e2-micro**, region `us-central1`, `us-west1` or `us-east1` (only those are free), Ubuntu 24.04, 30 GB standard disk.
- Tick **Allow HTTP** and **Allow HTTPS traffic**.

Note the VM's **public IP** and add it to Atlas Network Access.

## 3. Install the backend on the VM

```bash
ssh ubuntu@<VM_IP>            # Oracle: ssh -i key.pem ubuntu@<VM_IP>

# Get the code (the repo is private, so use a read-only deploy key):
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub     # GitHub repo → Settings → Deploy keys → Add (read-only)
git clone git@github.com:aditya-snva/Unified-Matrix.git
cd Unified-Matrix

bash deploy/setup.sh
```

The script installs Node 24 and Caddy, opens ports 80/443, creates the `unified-matrix` service, and prints:
- the **backend URL** (`https://<ip-with-dashes>.sslip.io`)
- your new **login password** (save it)

Then fill in the two missing settings:

```bash
sudo nano /etc/unified-matrix.env
#   MONGO_URI=<Atlas string from step 1>
#   CLIENT_ORIGIN=https://<your-app>.vercel.app     (from step 4; can be filled later)
sudo systemctl restart unified-matrix
curl https://<ip-with-dashes>.sslip.io/api/health   # → {"status":"ok",...}
```

`/etc/unified-matrix.env` overrides `backend/.env` from the repo. Keep server-only secrets there.

## 4. Frontend on Vercel

1. Push the repo to GitHub.
2. At [vercel.com](https://vercel.com), **Add New → Project →** import the repo.
   - **Root Directory: `frontend`**. The other settings come from `frontend/vercel.json`.
   - **Environment Variables:** `API_URL` = the backend URL from step 3 (`https://….sslip.io`).
3. Deploy. You get `https://<your-app>.vercel.app`.
4. Put that address in `CLIENT_ORIGIN` on the VM (step 3) and restart the service.

Open the Vercel URL in Chrome or Edge on your phone, log in, then **Install app / Add to Home screen**.

## 5. Connect the sources

| Source | Where it runs | What to do |
|---|---|---|
| **SMS (httpSMS)** | webhook | httpsms.com → Settings → Webhooks → URL `https://<backend>/webhooks/httpsms`, signing key = `HTTPSMS_SIGNING_KEY` |
| **WhatsApp** | webhook | Meta app → WhatsApp → Configuration → callback `https://<backend>/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`. Put `WHATSAPP_APP_SECRET` in `/etc/unified-matrix.env` |
| **Telegram** | on your PC once | `npm run telegram:login` in `backend/`, then put `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION` in `/etc/unified-matrix.env` |
| **Gmail** | on your PC once | `npm run gmail:auth` in `backend/`, then put `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` in `/etc/unified-matrix.env` |

After editing: `sudo systemctl restart unified-matrix`. The app's **Settings** page shows each source's state.

## Day-to-day

```bash
bash deploy/update.sh                 # git pull + reinstall + restart
journalctl -u unified-matrix -f       # live logs
sudo systemctl status unified-matrix
```

Vercel redeploys the frontend automatically on every push to `main`.

**If the VM's IP ever changes** (e.g. after recreating it): the sslip.io address changes with it. Re-run `bash deploy/setup.sh`, update `API_URL` in Vercel (then redeploy), and update the webhook URLs in httpSMS and Meta.
