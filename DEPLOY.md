# CodBooks — Deployment & Production Operations Guide

This guide details how to deploy CodBooks on a Linux Virtual Private Server (VPS) using Docker Compose, set up Nginx with HTTPS (Let's Encrypt), configure automated SQLite backups, and perform disaster recovery.

---

## 1. System Requirements

- **Operating System:** Ubuntu 22.04 LTS / 24.04 LTS or Debian 12
- **Hardware:** 1 vCPU, 1 GB RAM minimum (2 GB recommended)
- **Disk:** 10 GB+ SSD storage
- **Software:** Docker Engine & Docker Compose Plugin (`docker compose`)

### Installing Docker on Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

---

## 2. Deploying with Docker Compose

1. **Clone the repository on the VPS:**
   ```bash
   git clone https://github.com/OfferPk/codbooks.git /opt/codbooks
   cd /opt/codbooks
   ```

2. **Launch the container stack:**
   ```bash
   docker compose up -d --build
   ```

3. **Verify the container health:**
   ```bash
   docker compose ps
   curl -s http://127.0.0.1:3000/api/health | jq .
   ```

---

## 3. Reverse Proxy & HTTPS (Nginx + Certbot)

Install Nginx and Certbot for SSL termination:
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Configure `/etc/nginx/sites-available/codbooks`:
```nginx
server {
    server_name codbooks.example.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and acquire SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/codbooks /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d codbooks.example.com
```

---

## 4. Scheduled SQLite Backups & Retention

CodBooks uses SQLite in WAL mode. Hot, atomic backups are performed via `scripts/backup.sh` using the SQLite Online Backup API (`.backup`), with pre- and post-integrity checks (`PRAGMA integrity_check`) and SHA256 verification.

### Running a Manual Backup
```bash
docker compose exec codbooks sh /app/scripts/backup.sh
```

### Scheduling Daily Backups via Host Cron
Add an automated backup job running daily at 02:00 AM:
```bash
sudo crontab -e
```
Add the following line:
```cron
0 2 * * * docker exec codbooks-app sh /app/scripts/backup.sh >> /var/log/codbooks_backup.log 2>&1
```

Backups are stored inside `/app/data/backups` and retained for **14 days** by default.

---

## 5. Disaster Recovery & Database Restoration

To restore a backup into a fresh or recovered instance:

1. **Stop the running application:**
   ```bash
   docker compose stop codbooks
   ```

2. **Verify backup file integrity:**
   ```bash
   sqlite3 /opt/codbooks/data/backups/codbooks_backup_YYYYMMDD_HHMMSS.db "PRAGMA integrity_check;"
   # Expected output: ok
   ```

3. **Restore the database file:**
   ```bash
   cp /opt/codbooks/data/backups/codbooks_backup_YYYYMMDD_HHMMSS.db /opt/codbooks/data/codbooks.db
   rm -f /opt/codbooks/data/codbooks.db-wal /opt/codbooks/data/codbooks.db-shm
   ```

4. **Restart the application:**
   ```bash
   docker compose start codbooks
   curl http://127.0.0.1:3000/api/health
   ```
