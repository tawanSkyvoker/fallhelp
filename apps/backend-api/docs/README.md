# Backend Documentation

# เอกสาร Backend

> **หมายเหตุ:** เอกสารถูกรวมไว้ที่ส่วนกลางแล้ว

เอกสารทั้งหมดอยู่ที่: **[docs/README.md](../../../docs/README.md)**

---

## Quick Links

- [Project Structure](../../../docs/architecture/project-structure.md)
- [System Design](../../../docs/architecture/system-design.md)
- [Local Deployment](../../../docs/ops/local-deployment.md)
- [API Verification](../../../docs/ops/api-verification.md)

---

## API Documentation

- [Postman Collection](api/postman_collection.json) - API testing

---

## Quick Start

```bash
cd apps/backend-api
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Server runs at: `http://localhost:3000`
