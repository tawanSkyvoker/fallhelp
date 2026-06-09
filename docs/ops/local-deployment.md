# Local Deployment Guide

# คู่มือการ Deploy ในสภาพแวดล้อมท้องถิ่น

## Doc Meta

- Audience: Backend/DevOps, QA
- Source of Truth: [apps/backend-api/](../../apps/backend-api) + infra config
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

คู่มือนี้อธิบายขั้นตอนการเตรียม Backend, Admin, MQTT broker, และ mobile config สำหรับ Production/UAT โดยยึดโครง monorepo ปัจจุบันเป็นหลัก

---

## สถาปัตยกรรม Deployment (tawanlab.site)

```
                    Cloudflare (tawanlab.site)
                    ┌─────────────────────────────────┐
                    │  DNS + CDN + SSL (Free Plan)    │
                    │                                 │
  Mobile App ──────►│  api.fallhelp.tawanlab.site ────┼──► Cloudflare Tunnel ──► localhost:3000 (Backend)
                    │                                 │
  Browser ─────────►│  admin.fallhelp.tawanlab.site ──┼──► Cloudflare Tunnel ──► localhost:5173 (Admin)
                    │                                 │           หรือ Cloudflare Pages (static)
                    └─────────────────────────────────┘

  ESP32 ────────────► mqtt.fallhelp.tawanlab.site:8883 ──► HiveMQ Cloud (Free)
                      (DNS Only, ไม่ผ่าน Cloudflare proxy)
```

> **หมายเหตุ:** MQTT ใช้ protocol เฉพาะ (ไม่ใช่ HTTP) จึงไม่สามารถ proxy ผ่าน Cloudflare ได้
> ESP32 ต้องเชื่อมตรงไปที่ MQTT broker

---

## Checklist ก่อน Deploy

- [ ] ตั้งค่า Environment Variables
- [ ] Setup MQTT Broker (HiveMQ Cloud หรือ self-hosted)
- [ ] Setup Cloudflare Tunnel
- [ ] Setup Database
- [ ] Configure SSL/TLS (จัดการโดย Cloudflare อัตโนมัติ)

---

## Quick Start — 2 วิธีรัน Backend

### วิธีที่ 1: Terminal (ติดตั้งเอง)

ต้อง install PostgreSQL + Mosquitto service เองบนเครื่อง (ดู [MQTT Broker Setup](#3-mqtt-broker-setup))

```bash
cd apps/backend-api
cp .env.example .env       # แก้ไข DATABASE_URL, JWT_SECRET ตามต้องการ
npm install
npm run prisma:migrate     # สร้าง tables
npm run prisma:seed        # สร้าง admin account
npm run dev                # เริ่ม server + MQTT
```

### วิธีที่ 2: Docker (Backend + Admin)

ต้องการ Docker Desktop และ PostgreSQL ที่เข้าถึงได้จาก `DATABASE_URL_DOCKER`

หมายเหตุ:

- backend container ปัจจุบันรันจากไฟล์ build `dist/server.js`
- runtime image จะติดตั้งเฉพาะ production dependencies ของ backend เพื่อลดขนาด image
- ยังใช้ `npx prisma migrate deploy` ใน container ได้ตามปกติ

```bash
# รัน Docker build mode
docker compose up -d --build --pull always    # รัน Backend + Admin (Mosquitto รันเป็น native service แยกต่างหาก)
docker compose exec backend npx prisma migrate deploy  # สร้าง tables
docker compose exec backend npx prisma db seed         # สร้าง admin

# cleanup เมื่อ build cache/image เริ่มกินพื้นที่มาก
docker builder prune -f
docker image prune -f

# ดู footprint ปัจจุบันของ Docker
docker image ls fallhelp-backend fallhelp-admin
docker system df
```

| คำสั่ง                            | ใช้ทำอะไร                                 |
| --------------------------------- | ----------------------------------------- |
| `docker compose up -d --build --pull always` | รัน `backend` + `admin` แบบ containerized พร้อม refresh base image |
| `docker compose down`                        | หยุดทั้งหมด                                                  |
| `docker compose down -v`                     | หยุดและลบ data ทั้งหมด                                       |
| `docker compose logs -f backend`             | ดู logs                                                      |
| `docker builder prune -f`                    | ล้าง build cache ที่ไม่ได้ใช้                                |
| `docker image prune -f`                      | ล้าง dangling images                                         |

ค่าเริ่มต้นของ Admin ใน Docker จะเรียก backend ผ่าน `http://localhost:3000/api`
และเปิดหน้าเว็บที่ `http://localhost:5173`

หลังปรับ image ให้ lean ขึ้นแล้ว ถ้าทดลอง build หลายรอบ
พื้นที่ที่โตเร็วที่สุดมักเป็น build cache มากกว่า image ที่รันอยู่จริง
ดังนั้น `docker builder prune -f` มักช่วยได้มากที่สุดในงานประจำวัน

---

## ~~1. ลบ Simulator Code~~ (เสร็จแล้ว)

> Simulator code ถูกลบออกจาก codebase แล้ว ไม่ต้องทำขั้นตอนนี้
>
> ESP32 จริงใช้ MQTT topics โดยตรง: `device/{deviceId}/fall`, `device/{deviceId}/heartrate`, `device/{deviceId}/status`

---

## 2. Environment Variables

สร้างไฟล์ `.env.production`:

```env
# Database
DATABASE_URL="postgresql://user:password@your-db-host:5432/fallhelp"

# Server
PORT=3000
NODE_ENV=production

# Authentication
JWT_SECRET="your-very-long-secret-key-here-min-32-chars"
JWT_EXPIRES_IN="7d"

# CORS — ใส่ domain จริงที่ใช้
FRONTEND_URL="https://fallhelp.tawanlab.site"
ADMIN_URL="https://admin.fallhelp.tawanlab.site"

# MQTT (HiveMQ Cloud)
MQTT_BROKER_URL="mqtts://your-cluster-id.hivemq.cloud:8883"
MQTT_USERNAME="fallhelp-backend"
MQTT_PASSWORD="your-mqtt-password"

# Email (Resend — ใช้ domain ที่ verify แล้ว)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="FallHelp <support@fallhelp.tawanlab.site>"
DISABLE_EMAIL=false

# Admin Seed
ADMIN_EMAIL="admin@fallhelp.com"
ADMIN_PASSWORD="CHANGE_ME_STRONG_PASSWORD"
```

---

## 3. MQTT Broker Setup

### ตัวเลือก A: Local Mosquitto Service (Dev/Lab)

Mosquitto รันเป็น **native service** บน host machine

**Windows:**

```powershell
# ติดตั้ง (ต้องการ Chocolatey)
choco install mosquitto

# copy dev config
Copy-Item "config\mosquitto\mosquitto.conf" "C:\Program Files\mosquitto\mosquitto.conf"

# start service
net stop mosquitto; net start mosquitto

# ตรวจสอบ
npm run mqtt:check
```

**Linux (Debian/Ubuntu):**

```bash
sudo apt install mosquitto mosquitto-clients
sudo cp config/mosquitto/mosquitto.conf /etc/mosquitto/conf.d/fallhelp.conf
sudo systemctl enable --now mosquitto

# ตรวจสอบ
npm run mqtt:check
```

**ตั้งค่าใน `.env`:**

```env
MQTT_BROKER_URL="mqtt://localhost:1883"
MQTT_USERNAME=""
MQTT_PASSWORD=""
```

**ESP32:** ตั้ง `HIVEMQ_HOST` ใน `mqtt_secrets.h` เป็น **LAN IP จริงของเครื่อง** (ไม่ใช่ localhost)
— Mosquitto bind `0.0.0.0` แล้ว ESP32 เชื่อมตรงได้เลย ไม่ต้องผ่าน proxy

**Firewall (เปิด inbound 1883 สำหรับ LAN):**

```powershell
# Windows (PowerShell as Admin)
New-NetFirewallRule -DisplayName "Mosquitto MQTT" -Direction Inbound -Protocol TCP -LocalPort 1883 -RemoteAddress LocalSubnet -Action Allow
```

```bash
# Linux
sudo ufw allow from 192.168.0.0/16 to any port 1883
```

### ตัวเลือก B: HiveMQ Cloud (UAT/Production)

**ข้อดี:** ฟรี, มี TLS, ไม่ต้อง manage server, ESP32 เชื่อมได้เลย

1. สมัครที่ [hivemq.com/cloud](https://www.hivemq.com/mqtt-cloud-broker/)
2. สร้าง **Serverless Cluster** (Free tier: 100 connections, 10 GB/mo)
3. สร้าง Credentials → จะได้ hostname, username, password
4. ตั้งค่าใน `.env`:

```env
MQTT_BROKER_URL="mqtts://your-cluster-id.hivemq.cloud:8883"
MQTT_USERNAME="fallhelp-backend"
MQTT_PASSWORD="your-password"
```

1. ตั้ง DNS ใน Cloudflare (optional, สำหรับ ESP32 ให้จำง่าย):

```
mqtt.fallhelp.tawanlab.site → CNAME → your-cluster-id.hivemq.cloud
(DNS Only — ปิด Proxy, ใช้ icon สีเทา)
```

1. แก้ ESP32 firmware:

```cpp
// mqtt_secrets.h
#define HIVEMQ_HOST  "your-cluster-id.hivemq.cloud"  // หรือ mqtt.fallhelp.tawanlab.site
#define HIVEMQ_PORT  8883  // TLS
```

> **สำคัญ:** Free tier มีข้อจำกัด — พอสำหรับ dev/UAT (อุปกรณ์ไม่กี่ตัว)

### ตัวเลือก C: Self-hosted Mosquitto + TLS (Production VPS)

```bash
# บน VPS (DigitalOcean/Vultr $4-6/mo)
sudo apt install mosquitto mosquitto-clients
sudo mosquitto_passwd -c /etc/mosquitto/passwd fallhelp-backend
sudo mosquitto_passwd /etc/mosquitto/passwd fallhelp-esp32

# /etc/mosquitto/conf.d/fallhelp.conf
listener 8883
certfile /etc/letsencrypt/live/mqtt.fallhelp.tawanlab.site/fullchain.pem
keyfile /etc/letsencrypt/live/mqtt.fallhelp.tawanlab.site/privkey.pem
allow_anonymous false
password_file /etc/mosquitto/passwd
```

### MQTT Topics

อุปกรณ์ IoT จะส่งข้อมูลผ่าน Topics เหล่านี้:

| Topic                         | Payload                                      | Description    |
| ----------------------------- | -------------------------------------------- | -------------- |
| `device/{deviceId}/event`     | Unified event payload (`suspected_fall`, `fall_confirmed`, `fall_cancelled`, `heart_rate`) | Canonical topic |
| `device/{deviceId}/fall`      | Legacy fall payload (compatibility)                                                  | Backward compatibility |
| `device/{deviceId}/heartrate` | Legacy heart-rate payload (compatibility)                                            | Backward compatibility |
| `device/{deviceId}/status`    | `{ "timestamp": 1710000000000, "online": true }`                                     | Device Status |

---

## 4. Cloudflare Tunnel Setup

Cloudflare Tunnel ให้ expose local server ผ่าน HTTPS โดย**ไม่ต้องเปิด port** และได้ SSL ฟรี

### 4.1 ติดตั้ง cloudflared

```bash
# Linux (Debian/Ubuntu)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# macOS
brew install cloudflared

# ตรวจสอบ
cloudflared --version
```

### 4.2 Login & สร้าง Tunnel

```bash
# Login — จะเปิด browser ให้ authorize
cloudflared tunnel login

# สร้าง tunnel ชื่อ fallhelp
cloudflared tunnel create fallhelp

# จะได้ Tunnel ID เช่น: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4.3 ตั้งค่า config

สร้างไฟล์ `~/.cloudflared/config.yml`:

```yaml
tunnel: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx # ← Tunnel ID
credentials-file: /home/tawan/.cloudflared/a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  # Backend API
  - hostname: api.fallhelp.tawanlab.site
    service: http://localhost:3000

  # Admin Panel (dev server)
  - hostname: admin.fallhelp.tawanlab.site
    service: http://localhost:5173

  # Catch-all (required)
  - service: http_status:404
```

### 4.4 ตั้ง DNS

```bash
# สร้าง CNAME records อัตโนมัติ
cloudflared tunnel route dns fallhelp api.fallhelp.tawanlab.site
cloudflared tunnel route dns fallhelp admin.fallhelp.tawanlab.site
```

หรือตั้งใน Cloudflare Dashboard:

```
api.fallhelp.tawanlab.site   → CNAME → a1b2c3d4-xxxx.cfargotunnel.com (Proxied)
admin.fallhelp.tawanlab.site → CNAME → a1b2c3d4-xxxx.cfargotunnel.com (Proxied)
```

### 4.5 รัน Tunnel

```bash
# รัน foreground (สำหรับ test)
cloudflared tunnel run fallhelp

# รัน background (systemd)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

### 4.6 ทดสอบ

```bash
curl https://api.fallhelp.tawanlab.site/internal/health
# ควรได้: { "status": "ok" }
```

> **Cloudflare Free Plan ให้:**
>
> - SSL/TLS อัตโนมัติ (ไม่ต้อง Let's Encrypt)
> - DDoS protection
> - CDN caching (สำหรับ static assets)
> - WebSocket support (Socket.io ทำงานได้)

---

## 5. Deploy Commands

### Backend — Build และ Start

```bash
cd apps/backend-api

# Build
npm run build

# Start with PM2 (recommended)
pm2 start dist/server.js --name fallhelp-api

# หรือ Start ธรรมดา
npm start
```

### Admin Panel — ตัวเลือก Deploy

#### ตัวเลือก A: Cloudflare Pages (แนะนำ - ฟรี, static hosting)

```bash
cd apps/admin
npm run build  # → dist/

# Deploy ผ่าน CLI
npx wrangler pages deploy dist --project-name=fallhelp-admin

# หรือเชื่อม GitHub repo → auto deploy ทุก push
# Cloudflare Dashboard → Pages → Create project → Connect GitHub
# Build command: npm run build
# Output directory: dist
```

#### ตัวเลือก B: ผ่าน Cloudflare Tunnel (ใช้ dev server)

ใส่ใน `config.yml` ตามหัวข้อ 4.3 (เหมาะสำหรับ UAT ไม่ใช่ production)

### ตรวจสอบ

```bash
# Backend Health Check
curl https://api.fallhelp.tawanlab.site/internal/health

# ดู Logs
pm2 logs fallhelp-api

# Admin Panel
# เปิด https://admin.fallhelp.tawanlab.site ใน browser
```

### Mobile App — EAS Build (Expo Application Services)

ใช้ EAS Build สำหรับ build APK/AAB บน cloud ไม่ต้อง install Android Studio

**Prerequisites:**

```bash
cd apps/mobile
npm install
npm exec eas login          # Login ด้วย Expo account
```

**Build Profiles:**

| Profile       | ใช้ทำอะไร                                   | Output | คำสั่ง                                               |
| ------------- | ------------------------------------------- | ------ | ---------------------------------------------------- |
| `development` | Debug + Dev Client (ใช้กับ Expo dev server) | APK    | `npm exec eas build --profile development --platform android` |
| `preview`     | Internal testing — **แจกทีม/อาจารย์ทดสอบ**  | APK    | `npm exec eas build --profile preview --platform android`     |
| `production`  | Production release (Play Store)             | AAB    | `npm exec eas build --profile production --platform android`  |

**สำหรับ UAT/Demo ใช้ `preview`:**

```bash
cd apps/mobile

# Build APK สำหรับ Android
npm exec eas build --profile preview --platform android
# → รอ build เสร็จ (~10 นาที) → ได้ link ดาวน์โหลด APK

# ดาวน์โหลด APK จาก link → ส่งให้ทีม/อาจารย์ติดตั้งบนมือถือ Android
```

**ตั้งค่า API URL ก่อน build:**

แก้ไฟล์ `apps/mobile/constants/Config.ts` ให้ชี้ไป API จริง:

```typescript
// สำหรับ UAT/Production — ชี้ไป Cloudflare Tunnel
const API_URL = "https://api.fallhelp.tawanlab.site";
```

หรือใช้ Environment Variable ใน EAS:

```bash
# ตั้ง env var ที่ EAS
npm exec eas env:create --name EXPO_PUBLIC_API_URL --value https://api.fallhelp.tawanlab.site --environment preview
```

**Config ที่มีอยู่แล้ว (`eas.json`):**

- `development` — developmentClient + internal distribution
- `preview` — internal distribution (APK ติดตั้งตรง)
- `production` — autoIncrement version
- Google Services (`google-services.json`) — รองรับ Push Notification บน Android
- BLE permissions — สำหรับ ESP32 WiFi setup
- Camera permission — สำหรับ QR Code scanning

> **หมายเหตุ:** iOS ยังไม่ต้อง build — โปรเจคนี้เน้น Android เป็นหลัก (ESP32 + BLE)

---

## 6. SSL/TLS

### ผ่าน Cloudflare (อัตโนมัติ)

เมื่อใช้ Cloudflare Tunnel หรือ Pages ได้ SSL ฟรีโดยไม่ต้องตั้งค่าอะไร:

- Client ↔ Cloudflare: SSL อัตโนมัติ
- Cloudflare ↔ Origin: ผ่าน Tunnel (encrypted)

### ผ่าน Nginx (ถ้าไม่ใช้ Cloudflare Tunnel)

```nginx
server {
    listen 443 ssl;
    server_name api.fallhelp.tawanlab.site;

    ssl_certificate /etc/letsencrypt/live/api.fallhelp.tawanlab.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fallhelp.tawanlab.site/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## คำเตือนสำคัญ

> **อย่าลืม:**
>
> - เปลี่ยน `JWT_SECRET` ใน Production (ยาวอย่างน้อย 32 ตัวอักษร)
> - ตั้ง `JWT_EXPIRES_IN="7d"` (ไม่ใช่ 15d)
> - ใช้ HTTPS สำหรับทุก endpoint
> - ตั้งค่า Rate Limiting (มีอยู่แล้วใน codebase)
> - Backup Database อย่างสม่ำเสมอ
> - MQTT ต้องใช้ TLS (port 8883) เสมอ
> - อย่า commit `.env.production` — ใช้ `.env` + `.gitignore`

---

## Related Docs

- [Cross-Platform Development](cross-platform-development.md)
- [API Verification](api-verification.md)
- [Project Structure](../architecture/project-structure.md)
- [Backend AI Context](../ai/backend.md)
