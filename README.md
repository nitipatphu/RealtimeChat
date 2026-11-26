# Realtime Chat App

โปรเจกต์เว็บแชทสำหรับทีม คล้ายๆ Slack / Discord

## ทำอะไรได้บ้าง
- แชทเรียลไทม์ใน Channel, เธรด, อีโมจิ, โพล, ปักหมุด, @mention, แนบไฟล์
- DM และแชทกลุ่ม
- กลุ่ม Public / Private, Role และสิทธิ์ที่ตั้งเองได้, ลิงก์เชิญ, แบน / Timeout
- Project พร้อมบอร์ดงาน Kanban และปฏิทินกลุ่ม
- ตั้งเวลาส่งข้อความ, คลิปบอร์ดส่วนตัว, ภาพรวมของฉัน
- ระบบ VIP (สร้างระดับเองได้ ตั้งขนาดไฟล์และธีมได้)
- Admin / Staff Dashboard พร้อมสถานะการใช้งาน (คนออนไลน์ตอนนี้ และสถิติรายวัน)
- เสียงแจ้งเตือน เลือกได้ 4 เสียง ปรับความดังได้ ถูกแท็กชื่อจะดัง 2 ครั้ง

## ใช้อะไรทำ
- Frontend : React + Vite + Tailwind + SweetAlert2
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

รอประมาณ 1-2 นาที แล้วเข้าเว็บที่ http://localhost:5173

ข้อมูลในฐานข้อมูลมีมาให้แล้ว ไม่ต้องทำอะไรเพิ่ม

## บัญชีสำหรับลองใช้
รหัสผ่าน `123456` ทุกบัญชี

- admin@test.com (Admin)
- staff@test.com (Staff)
- mint@test.com (ผู้ใช้ทั่วไป)
- beam@test.com (ผู้ใช้ทั่วไป)

## เปิดให้คนอื่นเข้าเว็บได้ (ฟรี ไม่ต้องมีโดเมน)
ลงโปรแกรมครั้งเดียว
```
winget install Cloudflare.cloudflared
```
เปิด Docker ไว้ แล้วสั่ง
```
cloudflared tunnel --url http://localhost:5173
```
จะได้ลิงก์ `https://xxxx.trycloudflare.com` ส่งให้เพื่อนเข้าได้เลย (ลิงก์เปลี่ยนทุกครั้งที่เปิดใหม่ และต้องเปิดคอมไว้)

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
Docs.md                         อธิบายโค้ดทั้งหมด
Diagram.md                      Flowchart และ ER Diagram
```
