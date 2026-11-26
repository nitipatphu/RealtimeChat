# Realtime Chat App

โปรเจกต์เว็บแชทสำหรับทีม คล้ายๆ Slack / Discord
มีแชทเรียลไทม์ กลุ่ม Role บอร์ดงาน ปฏิทิน และหน้า Admin

## ใช้อะไรทำ
- Frontend : React + Vite + Tailwind
- Backend : Node.js + Express + Socket.io
- Database : PostgreSQL
- รันทุกอย่างด้วย Docker

## วิธีรัน
ต้องลง Docker Desktop ก่อน แล้วเปิดโปรแกรมไว้

```
git clone <ลิงก์ repo>
cd <ชื่อโฟลเดอร์>
docker compose up -d --build
```

รอสักพักประมาณ พัก  แล้วเข้าเว็บที่ http://localhost:5173

ข้อมูลในฐานข้อมูลมีมาให้แล้ว ไม่ต้องทำอะไรเพิ่ม

## บัญชีสำหรับลองใช้
รหัสผ่าน `123456` ทุกบัญชี

- admin@test.com (Admin)
- staff@test.com (Staff)
- mint@test.com (ผู้ใช้ทั่วไป)
- beam@test.com (ผู้ใช้ทั่วไป)

## ปิดเว็บ
```
docker compose down
```

## ดูฐานข้อมูล
ใช้ HeidiSQL หรือโปรแกรมอื่นก็ได้
- Host : localhost
- Port : 5433
- User : postgres
- Password : 1234
- Database : realtimecheat_app

## ก่อน push ขึ้น git
ข้อมูลจริงอยู่ใน Docker ต้อง export ออกมาเป็นไฟล์ก่อน ไม่งั้นเครื่องอื่นจะได้ข้อมูลเก่า

```
docker exec realtimecheat_app-postgres pg_dump -U postgres -d realtimecheat_app --no-owner --no-privileges > backend/database/database.sql
```

## ถ้าอยากล้างข้อมูลแล้วโหลดใหม่จากไฟล์
```
docker compose down -v
docker compose up -d
```
(คำสั่งนี้ลบข้อมูลใน Docker ทิ้งนะ)

## โฟลเดอร์
```
frontend/   หน้าเว็บ (React)
backend/    API กับ Socket.io
backend/database/schema.sql     โครงสร้างตาราง
backend/database/database.sql   ข้อมูลทั้งหมด
```
