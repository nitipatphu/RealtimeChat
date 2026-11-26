# เอกสารอธิบายโค้ด (Realtime Chat App)

เอกสารนี้อธิบายว่าโค้ดในโปรเจกต์แต่ละไฟล์ทำอะไร ทำงานต่อกันยังไง และข้อมูลไหลจากหน้าเว็บไปถึงฐานข้อมูลยังไง

รูป Flowchart และ ER Diagram อยู่ในไฟล์ `Diagram.md`

---

## สารบัญ
1. [ภาพรวมของระบบ](#1-ภาพรวมของระบบ)
2. [โครงสร้างโฟลเดอร์](#2-โครงสร้างโฟลเดอร์)
3. [Docker และไฟล์ตั้งค่า](#3-docker-และไฟล์ตั้งค่า)
4. [Backend](#4-backend)
5. [รายการ API ทั้งหมด](#5-รายการ-api-ทั้งหมด)
6. [Socket.io (ส่วนเรียลไทม์)](#6-socketio-ส่วนเรียลไทม์)
7. [งานเบื้องหลังที่ทำงานเอง](#7-งานเบื้องหลังที่ทำงานเอง)
8. [ฐานข้อมูล](#8-ฐานข้อมูล)
9. [Frontend](#9-frontend)
10. [การทำงานของแต่ละฟีเจอร์ตั้งแต่ต้นจนจบ](#10-การทำงานของแต่ละฟีเจอร์ตั้งแต่ต้นจนจบ)
11. [ระบบสิทธิ์](#11-ระบบสิทธิ์)
12. [ความปลอดภัย](#12-ความปลอดภัย)

---

## 1. ภาพรวมของระบบ

ระบบแบ่งเป็น 3 ส่วน รันอยู่ใน Docker คนละ container

```
 เบราว์เซอร์
     │
     ▼
 frontend (React + Vite)        พอร์ต 5173
     │  ส่งต่อ /api, /uploads, /socket.io
     ▼
 backend (Express + Socket.io)  พอร์ต 4000
     │  SQL
     ▼
 postgres (PostgreSQL 17)       พอร์ต 5433 (ในเครื่อง) → 5432 (ใน Docker)
```

หน้าเว็บคุยกับ backend 2 ทาง
- **HTTP (REST API):** ใช้กับทุกอย่างที่ต้องบันทึกหรือดึงข้อมูล เช่น login ส่งข้อความ สร้างกลุ่ม
- **Socket.io:** ใช้ให้ backend ส่งข้อมูลกลับมาหาหน้าเว็บทันทีโดยไม่ต้องรีเฟรช เช่น มีข้อความใหม่ มีคนออนไลน์ มีแจ้งเตือน

หลักการที่ใช้ทั้งโปรเจกต์คือ **หน้าเว็บส่งคำขอผ่าน API → backend เช็คสิทธิ์ → บันทึกลงฐานข้อมูล → ตอบกลับคนที่ส่ง → ส่ง Socket ไปบอกคนอื่นที่เกี่ยวข้อง**

---

## 2. โครงสร้างโฟลเดอร์

```
Project/
├── docker-compose.yml          สั่งรัน frontend, backend, postgres พร้อมกัน
├── README.md                   วิธีรันโปรเจกต์
├── Diagram.md                  Flowchart และ ER Diagram
├── Docs.md                     ไฟล์นี้
│
├── backend/
│   ├── .env                    ค่าที่ใช้ต่อฐานข้อมูล
│   ├── Dockerfile
│   ├── nodemon.json            ตั้งค่าให้รีสตาร์ต server เองเมื่อแก้โค้ด
│   ├── package.json
│   ├── database/
│   │   ├── schema.sql          โครงสร้างตาราง 42 ตาราง (ไฟล์ออกแบบ)
│   │   └── database.sql        โครงสร้าง + ข้อมูลทั้งหมด (Docker โหลดไฟล์นี้)
│   ├── uploads/                ไฟล์ที่ผู้ใช้อัปโหลด (รูปโปรไฟล์อยู่ชั้นนอก ไฟล์แนบอยู่ใน files/)
│   └── src/
│       ├── index.js            จุดเริ่มต้น เปิด server + Socket.io
│       ├── app.js              ตั้งค่า Express และผูก route
│       ├── config/             การเชื่อมต่อฐานข้อมูล, สีกลุ่ม
│       ├── middlewares/        ตัวเช็คก่อนเข้า controller (login, สิทธิ์, อัปโหลด, error)
│       ├── routes/             กำหนด URL ของ API
│       ├── controllers/        โค้ดที่ทำงานจริงของแต่ละ API
│       ├── models/             ฟังก์ชันอ่าน/เขียนฐานข้อมูลที่ใช้ซ้ำบ่อย
│       └── utils/              ฟังก์ชันช่วยเหลือต่างๆ
│
└── frontend/
    ├── Dockerfile
    ├── index.html
    ├── vite.config.js          ตั้งค่า Vite และส่งต่อ /api ไป backend
    ├── eslint.config.js
    ├── package.json
    ├── public/favicon.svg
    └── src/
        ├── main.jsx            จุดเริ่มต้น render App
        ├── App.jsx             ตัวหลักที่เก็บ state ทั้งแอปและสลับหน้า
        ├── api.js              ฟังก์ชันเรียก API
        ├── socket.js           ตัวเชื่อม Socket.io
        ├── settings.js         ตั้งค่าธีม ขนาดตัวอักษร เสียง แจ้งเตือน
        ├── blockedContext.js   ส่งรายชื่อคนที่บล็อกให้ทุก component
        ├── index.css           Tailwind + สีของแต่ละธีม
        ├── hooks/              custom hook ที่ฟัง Socket และจัดการ scroll
        ├── utils/              ฟังก์ชันช่วยเหลือ
        └── components/         หน้าจอทั้งหมด แบ่งโฟลเดอร์ตามหน้า
```

---

## 3. Docker และไฟล์ตั้งค่า

### docker-compose.yml
มี 3 service

| service | ทำอะไร | หมายเหตุ |
|---|---|---|
| `frontend` | รัน `npm run dev` ของ Vite | mount โฟลเดอร์ `frontend` เข้าไป แก้โค้ดแล้วหน้าเว็บเปลี่ยนทันที |
| `backend` | รัน `npm run dev` (nodemon) | รอให้ postgres พร้อมก่อน (`depends_on` + `healthcheck`) |
| `postgres` | ฐานข้อมูล PostgreSQL 17 | ข้อมูลเก็บใน volume `realtimecheat_app_pg_data` |

ตอนที่ volume ยังว่าง (รันครั้งแรก) postgres จะรันไฟล์ `backend/database/database.sql` ให้เอง ได้ทั้งตารางและข้อมูล ถ้ามีข้อมูลอยู่แล้วจะไม่รันซ้ำ

ตั้ง `password_encryption=md5` เพราะ HeidiSQL บางเวอร์ชันต่อแบบ scram ไม่ได้

### backend/.env
```
PORT=4000
DB_HOST=postgres      ชื่อ service ใน Docker
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=realtimecheat_app
```
ถ้าจะรัน backend นอก Docker ต้องเปลี่ยน `DB_HOST=localhost` และ `DB_PORT=5433`

### frontend/vite.config.js
- ตั้ง `proxy` ให้ request ที่ขึ้นต้นด้วย `/api`, `/uploads`, `/socket.io` ถูกส่งต่อไปที่ `http://backend:4000` หน้าเว็บจึงเรียก API แบบ `/api/...` ได้เลยโดยไม่ต้องใส่ที่อยู่ backend
- `allowedHosts: ['.trycloudflare.com', 'cyberdv.thddns.net']` อนุญาตให้เปิดเว็บผ่านโดเมนเหล่านี้ได้ (Vite จะบล็อกโดเมนที่ไม่รู้จัก)

### เปิดเว็บให้คนอื่นเข้าได้ (Cloudflare Quick Tunnel)
ใช้ได้ฟรี ไม่ต้องมีโดเมน ไม่ต้องสมัครบัญชี
1. ลงโปรแกรมครั้งเดียว: `winget install Cloudflare.cloudflared`
2. เปิด Docker ไว้ แล้วสั่ง `cloudflared tunnel --url http://localhost:5173`
3. จะได้ลิงก์ `https://xxxx.trycloudflare.com` ส่งให้คนอื่นเข้าได้เลย

ข้อจำกัด: ลิงก์เปลี่ยนทุกครั้งที่เปิดใหม่, ต้องเปิดคอมไว้ตลอด, และ Cloudflare แบบฟรีรับไฟล์อัปโหลดได้ไม่เกินประมาณ 100 MB ต่อครั้ง

### backend/nodemon.json
ดูเฉพาะโฟลเดอร์ `src` ถ้าไฟล์เปลี่ยนจะรีสตาร์ต server เอง ไม่ดูโฟลเดอร์ `uploads` (ไม่งั้นอัปโหลดไฟล์ทีไร server รีสตาร์ตทุกที)

---

## 4. Backend

### 4.1 index.js (จุดเริ่มต้น)
1. สร้าง HTTP server จาก `app` (Express)
2. สร้าง Socket.io แล้วเก็บไว้ด้วย `app.set('io', io)` ทำให้ controller ทุกตัวเรียก `req.app.get('io')` เพื่อส่ง Socket ได้
3. เก็บว่าใครออนไลน์ใน object `onlineUsers` โดย key คือ userId และ value คือจำนวนแท็บที่เปิดอยู่ (เปิด 2 แท็บ ปิด 1 แท็บ ยังนับว่าออนไลน์)
4. รับ event จากหน้าเว็บ
   - `identify` หน้าเว็บส่ง token มา → หา user จาก token → ให้ socket เข้าห้อง `user:<id>` → บอกทุกคนว่าใครออนไลน์
   - `join-group` เข้าห้อง `group:<id>` (เช็คก่อนว่าเป็นสมาชิกหรือเป็น admin)
   - `typing` ส่งต่อว่า "กำลังพิมพ์..." ไปหาคนในห้อง
   - `logout` / `disconnect` ออกจากห้อง และลดจำนวนออนไลน์
5. ทุกครั้งที่มีคน `identify` จะเรียก `recordUsage` บันทึกสถิติการใช้งาน (ดู `utils/usage.js`)
6. เช็คว่าต่อฐานข้อมูลได้ (`checkConnection`) ถ้าได้จะ
   - สร้างตารางสถิติการใช้งานถ้ายังไม่มี (`createUsageTables`)
   - อัปเดตตารางระดับ VIP ให้เป็นแบบใหม่ (`updateTierTable`)
   - เริ่มงานเบื้องหลัง (`startReminders`, `startScheduler`) แล้วเปิด server

   ถ้าต่อฐานข้อมูลไม่ได้จะปิดโปรแกรม
7. ตั้ง `server.requestTimeout` เป็น 30 นาที ให้อัปโหลดไฟล์ใหญ่ได้โดยไม่ถูกตัดกลางทาง

### 4.2 app.js (ตั้งค่า Express)
- ปิด header `x-powered-by` และเพิ่ม header ความปลอดภัย (`nosniff`, `X-Frame-Options: DENY`)
- เปิด CORS และอ่าน body แบบ JSON ได้ไม่เกิน 1 MB
- เสิร์ฟไฟล์ในโฟลเดอร์ `uploads` ที่ `/uploads`
- ผูก route ทั้งหมด ทุก route ยกเว้น `/api/users` (register/login) และ `/api/system-settings` ต้องผ่าน `requireAuth` ก่อน
- ปิดท้ายด้วย `notFound` (ไม่เจอ URL) และ `errorHandler` (จัดการ error ทุกตัว)

### 4.3 config/
| ไฟล์ | ทำอะไร |
|---|---|
| `database.js` | สร้าง connection pool ของ PostgreSQL (สูงสุด 10 connection) และมีฟังก์ชัน `query`, `getOne` (เอาแถวแรก), `getMany` (เอาทุกแถว), `transaction` (ทำหลายคำสั่งถ้าพังให้ ROLLBACK ทั้งหมด), `checkConnection` |
| `colors.js` | `pickGroupColor(index)` เลือกสีให้กลุ่มใหม่วนไปเรื่อยๆ จาก 6 สี |

`pg.types.setTypeParser(1082, ...)` ทำให้คอลัมน์ชนิด `DATE` ออกมาเป็นข้อความ `'2026-11-26'` แทนที่จะเป็น Date object (กันเวลาเลื่อนเพราะ timezone)

### 4.4 middlewares/
middleware คือฟังก์ชันที่ทำงานก่อนเข้า controller ถ้าไม่ผ่านจะ `throw new Error` แล้วไปจบที่ `errorHandler`

| ไฟล์ | ฟังก์ชัน | ทำอะไร |
|---|---|---|
| `authMiddleware.js` | `createSession(userId)` | สุ่ม token 32 byte → เก็บ **ค่าแฮช SHA-256** ลงตาราง `sessions` อายุ 30 วัน → คืน token จริงให้หน้าเว็บ |
| | `findSessionUser(token)` | แฮช token แล้วหาในตาราง sessions ที่ยังไม่หมดอายุ |
| | `requireAuth` | อ่าน header `Authorization: Bearer <token>` → หา user → ถ้าไม่เจอตอบ 401 ถ้าถูกระงับตอบ 403 → ใส่ `req.userId` ให้ controller ใช้ |
| | `requireSelf` | เช็คว่า `:id` ใน URL เป็นตัวเอง (กันแก้ข้อมูลคนอื่น) |
| | `checkLoginLimit`, `addLoginFail`, `clearLoginFails` | นับการใส่รหัสผิด เก็บไว้ใน object `loginFails` ผิดครบ 5 ครั้งใน 15 นาทีจะตอบ 429 |
| `adminMiddleware.js` | `requireStaff`, `requireAdmin` | เช็ค `system_role` ว่าเป็น staff/administrator ไหม |
| `checkProjectAccess.js` | `checkProjectAccess` | โหลดกลุ่มและ project → เช็คว่าเห็น project นี้ได้ไหม → ใส่ `req.group`, `req.project` (admin ของระบบอ่านได้อย่างเดียว) |
| `uploadMiddleware.js` | `handleAvatarUpload` | อัปโหลดรูปโปรไฟล์/ไอคอนกลุ่ม ไม่เกิน 2 MB เฉพาะ JPG PNG WEBP |
| | `handleFileUpload` | อัปโหลดไฟล์แนบในแชท ขนาดสูงสุดขึ้นกับระดับ VIP (Admin ตั้งได้ 1–1000 MB ต่อระดับ) |
| | `isRealImage` | อ่าน 12 byte แรกของไฟล์ (magic number) ว่าเป็นรูปจริงไหม กันคนเปลี่ยนนามสกุลไฟล์ |
| | `setUploadHeaders` | ไฟล์ที่ไม่ใช่รูปหรือ PDF ให้ดาวน์โหลดเท่านั้น ห้ามเปิดในเบราว์เซอร์ |
| | `deleteUploadedFile` | ลบไฟล์ (เช็คว่า path อยู่ในโฟลเดอร์ uploads จริง กันลบไฟล์อื่นในเครื่อง) |
| `errorMiddleware.js` | `errorHandler` | แปลง error เป็น JSON `{ status, message }` ถ้าเป็น error 500 จะไม่บอกรายละเอียดจริงให้ผู้ใช้ |
| | `notFound` | ตอบ 404 |

**วิธีส่ง error ในโปรเจกต์นี้:** ใน controller จะเขียน
```js
res.status(400);
throw new Error('ข้อความที่จะแสดง');
```
Express 5 จับ error จาก async function ให้เอง แล้วส่งไปที่ `errorHandler`

### 4.5 models/
ฟังก์ชันที่อ่าน/เขียนฐานข้อมูลและใช้หลาย controller

**userModel.js**
- `USER_SELECT` คือ SQL ที่ดึง user พร้อมข้อมูล VIP และห้องที่ปิดแจ้งเตือน
- `toUser(row)` แปลงชื่อคอลัมน์แบบ `snake_case` ในฐานข้อมูลเป็น `camelCase` ที่หน้าเว็บใช้ เช่น `system_role` → `systemRole`
- `findUserById`, `findUsersByIds`, `listUsers`, `findLoginByEmail` (ดึง password_hash ด้วย ใช้ตอน login เท่านั้น)
- `isSystemAdmin`, `getBlockedIds`, `isBlocked`, `getUserName`
- `toIso(value)` แปลงเวลาเป็นข้อความ ISO

**groupModel.js**
- `loadGroups(ids)` ฟังก์ชันที่ใหญ่ที่สุด ดึงข้อมูลกลุ่มทั้งหมดทีเดียว ได้แก่ สมาชิก, Role, การแบน, ลิงก์เชิญ, หมวดหมู่, อีเวนต์, Project, คอลัมน์บอร์ด, งาน, ผู้รับผิดชอบ, Checklist, คอมเมนต์ แล้วประกอบเป็น object เดียว
  - ใช้ `WHERE group_id = ANY($1)` ดึงทีละตารางครั้งเดียว แล้วใช้ `groupBy` จัดกลุ่มเอง (เร็วกว่าดึงทีละกลุ่ม)
- `loadGroup(id)`, `loadGroupOr404(id, res)`
- `getGroupIdsForUser`, `getGroupLogs`
- `listChannels(groupId)`, `getChannel(channelId)` ดึง Channel พร้อม Role ที่เข้าได้

**messageModel.js** ใช้ร่วมกันทั้งแชท Channel, แชท Project, DM, แชทกลุ่ม
- ข้อความ 1 แถวต้องอยู่ที่เดียว (`channel_id` หรือ `project_channel_id` หรือ `conversation_id`) ตัวแปร `PLACE_COLUMNS` กันไม่ให้ใส่ชื่อคอลัมน์อื่นลงใน SQL
- `hydrateMessages(rows)` เติมไฟล์แนบ, mention, reaction, โพล ให้ข้อความ
- `getMessagePage(column, placeId, before, limit)` ดึงข้อความทีละหน้า (ค่าเริ่มต้น 50 สูงสุด 100) ใช้ `before` เป็นเวลาของข้อความเก่าสุดเพื่อโหลดหน้าก่อนหน้า ดึงเกินมา 1 แถวเพื่อรู้ว่ายังมีข้อความเก่าอีกไหม (`hasMore`) และดึงข้อความตอบกลับในเธรดมาด้วย
- `createMessage(data)` บันทึกข้อความ + ไฟล์แนบ + mention + ตัวเลือกโพล ใน transaction เดียว
- `updateMessageText`, `deleteMessage` (ลบไฟล์แนบที่ไม่มีข้อความไหนใช้แล้วด้วย)
- `toggleReaction` กดอีโมจิซ้ำ = เอาออก
- `togglePin` ปักหมุด/เลิกปักหมุด
- `votePoll` โหวตซ้ำ = เอาโหวตออก ถ้าโพลเลือกได้ข้อเดียวจะลบโหวตเดิมก่อน
- `cleanPoll` ตรวจโพล (คำถามต้องมี ตัวเลือก 2-6 ข้อ)
- `findParent`, `getThreadUserIds` ใช้กับเธรด

### 4.6 utils/
| ไฟล์ | ทำอะไร |
|---|---|
| `id.js` | `makeId(prefix)` สร้าง id แบบ `m-1764123456789-a1b2c3d4`, `makeInviteCode` รหัสเชิญ 6 ตัว (ตัดตัวที่สับสนอย่าง O/0/I/1 ออก), `makeToken`, `hashToken`, `cleanEmail`, `makeAvatar` (รูปเริ่มต้นจาก ui-avatars.com) |
| `permissions.js` | รายการสิทธิ์ 16 ตัว และฟังก์ชันเช็คสิทธิ์ทั้งหมด (ดูหัวข้อ 11) |
| `groupView.js` | `viewGroupFor(group, userId)` ซ่อนรายชื่อคนถูกแบนและลิงก์เชิญจากคนที่ไม่มีสิทธิ์, `GROUP_SUMMARY_SQL` ดึงกลุ่มพร้อมจำนวนสมาชิก |
| `socketEvents.js` | ฟังก์ชันส่ง Socket: `sendGroupUpdate` (ส่งกลุ่มที่กรองตามสิทธิ์ของแต่ละคน), `sendToGroup`, `sendToUser`, `sendToUsers`, `sendToEveryone`, `removeUserFromGroupRoom` |
| `notifications.js` | `addNotification` บันทึกแจ้งเตือนลงฐานข้อมูลแล้วส่ง Socket `notification:new`, `notifyMentions` แจ้งคนที่ถูก @, `notifyThreadReply` แจ้งเจ้าของข้อความและคนที่คุยในเธรด |
| `mentions.js` | `findMentions(text, members, allowEveryone)` หาว่าข้อความแท็กใคร (เรียงชื่อยาวก่อน กันชื่อ "มิ้น" ไปโดน "มิ้นท์") และรองรับ `@everyone` / `@ทุกคน` |
| `moderation.js` | `isBanned`, `getTimeoutUntil`, `requireNotTimedOut`, `findInvite` (หาจากรหัสเชิญหลักของกลุ่มก่อน แล้วค่อยหาในลิงก์เชิญ), `isInviteUsable` |
| `attachments.js` | `cleanAttachments` ตรวจไฟล์แนบที่หน้าเว็บส่งมา `isOurFile` เช็คว่า URL ขึ้นต้นด้วย `/uploads/files/` และไม่มี `/`, `\` หรือ `..` ในชื่อไฟล์ (กันอ้างไฟล์นอกโฟลเดอร์) ต้องมีไฟล์อยู่จริง ไม่ซ้ำ ไม่เกิน 5 ไฟล์ |
| `vip.js` | ระดับ VIP อ่านจากตาราง `tier_settings` ทั้งหมด (ไม่ได้ล็อกไว้ในโค้ด) และ `updateTierTable` เพิ่มคอลัมน์ชื่อ/ไอคอน/สี/ลำดับให้ฐานข้อมูลเดิมตอนเปิด server, `getVipTier` (เช็ควันหมดอายุ), `getTierSettings` (อ่านจากตาราง tier_settings), `getPerks` (สิทธิพิเศษของ user), `canUseTheme`, `makeVipRecord` (ต่ออายุจากวันหมดอายุเดิมถ้าระดับเดียวกัน), `makeVipCode` (`VIP-XXXX-XXXX`), `formatThaiDate` (ปี พ.ศ.) |
| `logs.js` | `addGroupLog` (ประวัติในกลุ่ม), `addAdminLog` (ประวัติของ Admin/Staff) |
| `usage.js` | เก็บสถิติการใช้งาน ทุกครั้งที่มีคนต่อ Socket (`identify`) จะบันทึกว่าวันนี้คนนี้เข้าใช้ (`daily_active_users`) และถ้าจำนวนคนออนไลน์พร้อมกันมากกว่าสถิติของวันนี้จะบันทึกใหม่ (`daily_peak_online`) ตารางสองตัวนี้ถูกสร้างเองตอนเปิด server (`CREATE TABLE IF NOT EXISTS`) |
| `messages.js` | `getLastDays`, `toDateKey`, `addToDay` ใช้ทำกราฟรายวัน |
| `reactions.js` | `ALLOWED_EMOJIS` อีโมจิ 40 ตัวที่อนุญาต |
| `reminders.js` | งานเตือนงานใกล้ครบกำหนด, อีเวนต์วันนี้, VIP หมดอายุ, ลบ session เก่า, ลบไฟล์ที่ไม่ได้ใช้ (ดูหัวข้อ 7) |
| `scheduler.js` | ส่งข้อความที่ตั้งเวลาไว้ (ดูหัวข้อ 7) |
| `uploadCleanup.js` | `cleanUnusedUploads` ลบไฟล์ที่อัปโหลดเกิน 1 วันแต่ไม่มีข้อความ/รูปโปรไฟล์/ไอคอนไหนใช้ |

### 4.7 controllers/
controller คือโค้ดที่ทำงานจริงของแต่ละ API รูปแบบทุกตัวคล้ายกัน คือ **ตรวจข้อมูลที่ส่งมา → โหลดข้อมูล → เช็คสิทธิ์ → บันทึก → เขียน log → ส่ง Socket → ตอบกลับ**

#### userController.js (ผู้ใช้)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `registerUser` | ตรวจชื่อ (ไม่เกิน 50 ตัว), อีเมล (รูปแบบถูกและไม่ซ้ำ), รหัสผ่าน (อย่างน้อย 6 ตัว) → แฮชด้วย bcrypt (cost 10) → สร้าง user + read_marker → สร้าง session → ตอบ user + token |
| `loginUser` | เช็คจำนวนครั้งที่ผิด → หา user จากอีเมล → `bcrypt.compare` → เช็คถูกระงับ → สร้าง session (key ที่ใช้นับครั้งผิดคือ IP + อีเมล) |
| `logoutUser` | ลบ session ของ token นี้ |
| `getMe`, `getUsers` | ข้อมูลตัวเอง / รายชื่อผู้ใช้ทั้งหมด (ไม่มีรหัสผ่าน) |
| `updateProfile` | แก้ชื่อ ตำแหน่ง bio สีแบนเนอร์ |
| `changeAvatar`, `removeAvatar` | เปลี่ยน/ลบรูปโปรไฟล์ (ลบไฟล์เก่าทิ้งด้วย) |
| `changePassword` | ต้องใส่รหัสเดิมถูกก่อน |
| `deleteAccount` | ต้องใส่รหัสผ่าน ห้ามลบถ้ายังเป็นเจ้าของกลุ่ม หรือเป็น Administrator คนสุดท้าย |
| `saveSettings` | บันทึกการตั้งค่า (ธีม แจ้งเตือน เสียง) เฉพาะ key ที่อยู่ใน `SETTING_KEYS` และตรวจ `soundType` ต้องอยู่ใน `SOUND_TYPES` ส่วน `volume` ต้องอยู่ระหว่าง 0–100 |
| `setPresence` | สถานะ online / busy / sleep / offline |
| `markAsRead` | บันทึกว่าอ่านห้องนี้ถึงตอนนี้แล้ว (`read_markers`) |
| `getUnread` | นับข้อความที่ยังไม่อ่านและจำนวนที่ถูก mention ของทุกห้อง (Channel, Project, DM, แชทกลุ่ม) ด้วย SQL `count(*)` เทียบกับเวลาใน `read_markers` |
| `getOverview` | หน้า "ภาพรวมของฉัน" ได้แก่ กราฟจำนวนข้อความ 14 วัน, งานที่ค้าง (เรียงตามวันส่ง ไม่เอา Project ที่เก็บถาวร), อีเวนต์ที่กำลังจะมา |
| `getNotifications`, `readNotifications` | ดึง/อ่านแจ้งเตือน |
| `forgotPassword` | สุ่มรหัส 6 หลัก → เก็บแบบแฮช อายุ 15 นาที → **ระบบยังไม่มีการส่งอีเมลจริง** แสดงรหัสใน console ของ backend และถ้าไม่ใช่ production จะส่งรหัสกลับมาที่หน้าเว็บด้วย (`devCode`) |
| `resetPasswordWithCode` | เช็ครหัส 6 หลัก → ตั้งรหัสใหม่ → ลบ session เดิมทั้งหมด (ทุกเครื่องต้อง login ใหม่) |
| `setMuted` | ปิด/เปิดแจ้งเตือนของห้อง |
| `getBlocks`, `setBlocked` | บล็อกผู้ใช้ |
| `setCustomTheme` | บันทึกธีมสีที่ตั้งเอง (VIP เท่านั้น) |

#### groupController.js (กลุ่ม และ Project)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `createGroupRecords` | สร้างกลุ่มใหม่ ได้แก่ แถวในตาราง groups, เพิ่มเจ้าของเป็นสมาชิก, สร้าง Role เริ่มต้น 2 ตัว (Admin, Member), Channel `general`, Project `Main Board` ที่มีคอลัมน์ To Do / Doing / Done |
| `getGroups` | กลุ่มที่ตัวเองเป็นสมาชิก |
| `discoverGroups` | ค้นหากลุ่ม Public |
| `createGroup` | สร้างกลุ่ม (เรียก `createGroupRecords` ใน transaction) |
| `joinGroup` | เข้ากลุ่มด้วยรหัสเชิญ เช็คว่ารหัสใช้ได้, ยังไม่เป็นสมาชิก, ไม่ถูกแบน แล้วเพิ่มจำนวนการใช้ลิงก์ด้วย SQL ที่เช็คเงื่อนไขในคำสั่งเดียว (กันคนกดพร้อมกันเกินจำนวน) |
| `joinPublicGroup` | เข้ากลุ่ม Public ได้เลยโดยไม่ต้องใช้รหัส |
| `leaveGroup` | ออกจากกลุ่ม (เจ้าของออกไม่ได้ ต้องโอนก่อน) |
| `deleteGroup` | ลบกลุ่ม (เจ้าของเท่านั้น) |
| `updateGroupSettings` | แก้ชื่อ คำอธิบาย Public/Private |
| `regenerateInviteCode` | สุ่มรหัสเชิญใหม่ |
| `transferOwnership` | โอนเจ้าของ เจ้าของเดิมจะได้ Role ที่สูงที่สุดแทน |
| `uploadGroupIcon`, `removeGroupIcon` | ไอคอนกลุ่ม |
| `getGroupLogs` | ประวัติกลุ่ม (ต้องมีสิทธิ์ `view_logs`) |
| `inspectGroup` | Admin ของระบบเข้าดูกลุ่มที่ตัวเองไม่ได้เป็นสมาชิก |
| `addProjectToGroup` | สร้าง Project ใหม่ (สิทธิ์ `create_projects`) |
| `deleteProjectFromGroup`, `archiveProject` | ลบ/เก็บถาวร Project |
| `updateProjectBoard` | บันทึกบอร์ดงานทั้งบอร์ด (ดูหัวข้อ 10.4) |
| `addTaskComment` | คอมเมนต์ในงาน |

#### groupMemberController.js (สมาชิก และ Role)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `addGroupMember`, `removeGroupMember` | เพิ่ม/เอาสมาชิกออก (สิทธิ์ `manage_members`) |
| `updateMemberRole` | ให้ Role กับสมาชิก (1 คนมีได้หลาย Role) |
| `setNickname` | ตั้งชื่อเล่นของตัวเอง (`change_nickname`) หรือของคนอื่น (`manage_nicknames`) |
| `createRole`, `updateRole`, `deleteRole`, `reorderRoles` | จัดการ Role (สิทธิ์ `manage_roles`) |

กฎสำคัญ
- `requireCanGrant` **ให้ Role ที่มีสิทธิ์มากกว่าตัวเองไม่ได้** (กันคนให้สิทธิ์ Administrator กับตัวเอง)
- ลบ Role เริ่มต้น (Member) ไม่ได้
- ถ้า Role นี้เป็น Role เดียวที่เข้า Channel ส่วนตัวห้องไหนได้ จะลบไม่ได้ (ไม่งั้นห้องนั้นจะกลายเป็นห้องที่ทุกคนเห็น)

#### moderationController.js (การดูแลกลุ่ม)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `banMember`, `unbanMember` | แบน/ยกเลิกแบน คนถูกแบนจะถูกเอาออกจากกลุ่มและเข้ากลับไม่ได้ |
| `timeoutMember` | ห้ามส่งข้อความชั่วคราว (ส่ง 0 นาที = ยกเลิก) |
| `createInvite`, `deleteInvite` | ลิงก์เชิญแบบกำหนดวันหมดอายุและจำนวนคนได้ |

`requireCanModerate` ห้ามทำกับเจ้าของกลุ่ม, ห้ามทำกับตัวเอง และห้ามทำกับคนที่มีสิทธิ์เดียวกัน (ยกเว้นเจ้าของกลุ่มเป็นคนทำ)

#### channelController.js (Channel และข้อความใน Channel)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getChannels` | Channel ที่ตัวเองเห็นได้ในกลุ่ม |
| `createChannel`, `updateChannel`, `deleteChannel` | จัดการ Channel (สิทธิ์ `manage_channels`) ตั้ง Channel ย่อย, หมวดหมู่ และ Role ที่เข้าได้ |
| `getChannelMessages` | ดึงข้อความทีละหน้า |
| `addMessage` | ส่งข้อความ (ดูหัวข้อ 10.2) |
| `updateMessage` | แก้ข้อความ (ของตัวเองเท่านั้น) |
| `deleteMessage` | ลบข้อความของตัวเอง หรือของคนอื่นถ้ามีสิทธิ์ `manage_messages` |
| `reactToMessage` | กดอีโมจิ (ต้องอยู่ใน `ALLOWED_EMOJIS`) |
| `voteMessage` | โหวตโพล |
| `getChannelPins`, `pinMessage` | ข้อความที่ปักหมุด (ปักหมุดได้เฉพาะคนที่มีสิทธิ์ `manage_messages`) |

#### projectChatController.js และ projectMemberController.js
เหมือน channelController แต่เป็นแชทใน Project ทุก route ผ่าน `checkProjectAccess` ก่อน
ส่ง Socket ให้เฉพาะคนที่เห็น Project (`getProjectViewerIds`) ด้วยชื่อ event `project-message:*`
- `createProjectChannel`, `deleteProjectChannel` ห้องแชทใน Project
- `addMemberToProject`, `removeMemberFromProject` จัดการสมาชิก Project

#### dmController.js (แชทส่วนตัว 1 ต่อ 1)
- id ของห้อง DM สร้างจาก id ของ 2 คนเรียงตามตัวอักษร เช่น `dm-u-beam__u-mint` ไม่ว่าใครเริ่มคุยก่อนก็ได้ห้องเดียวกัน
- `ensureConversation` สร้างห้องตอนส่งข้อความแรก
- ส่งข้อความหาคนที่บล็อกเรา หรือคนที่เราบล็อกไม่ได้
- Socket ส่งไปทั้ง 2 คน (`dm:new`, `dm:updated`, `dm:deleted`)

#### conversationController.js (แชทกลุ่มนอกกลุ่ม)
แชทที่รวมหลายคนโดยไม่ต้องสร้างกลุ่ม
- `listConversations` รายการแชททั้ง DM และแชทกลุ่ม พร้อมข้อความล่าสุด
- `createGroupChat`, `updateGroupChat` (ตั้งชื่อ), `addGroupChatMembers`, `leaveGroupChat`
- ข้อความ: `getGroupChatMessages`, `addGroupChatMessage`, `updateGroupChatMessage`, `deleteGroupChatMessage`, `reactGroupChatMessage`

#### calendarController.js (หมวดหมู่ Channel และปฏิทิน)
- `createCategory`, `updateCategory`, `deleteCategory` หมวดหมู่ของ Channel
- `createEvent`, `updateEvent`, `deleteEvent` นัดหมายในปฏิทินกลุ่ม สมาชิกทุกคนสร้างได้ แต่แก้/ลบของคนอื่นต้องมีสิทธิ์ `manage_events`

#### scheduleController.js (ตั้งเวลาส่งข้อความ)
- `createScheduled` ตั้งเวลาได้ตั้งแต่ 1 นาทีถึง 90 วันข้างหน้า สูงสุด 50 ข้อความต่อคน ส่งไปได้ 4 แบบ: `channel`, `project`, `dm`, `gdm`
- `getScheduled`, `deleteScheduled`
- `toScheduledItem` แปลงแถวในฐานข้อมูลให้ scheduler ใช้

#### clipController.js (คลิปบอร์ดส่วนตัว)
เก็บข้อความที่ใช้บ่อยไว้แปะในแชท สูงสุด 200 รายการ ปักหมุดได้

#### searchController.js (ค้นหา)
`searchMessages` ค้นข้อความด้วย `ILIKE` (ไม่สนตัวพิมพ์เล็กใหญ่) ค้นทั้งตัวข้อความและชื่อไฟล์แนบ ค้นเฉพาะห้องที่ตัวเองมีสิทธิ์เห็น ได้สูงสุด 50 ผล
ฟังก์ชัน `likeText` ใส่ `\` หน้าตัว `%` และ `_` กันคนพิมพ์อักขระพิเศษของ LIKE
ฐานข้อมูลมี index แบบ `gin_trgm_ops` ทำให้ค้น `ILIKE '%คำ%'` ได้เร็ว

#### uploadController.js
`uploadFile` ตอบ URL ของไฟล์ที่อัปโหลดเสร็จแล้ว หน้าเว็บจะเอา URL นี้ไปแนบตอนส่งข้อความ

#### adminController.js (Admin / Staff Dashboard)
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getStats` | สถิติรวม จำนวนผู้ใช้ กลุ่ม ข้อความ กราฟรายวัน กลุ่มที่คุยกันเยอะสุด |
| `getUsers` | รายชื่อผู้ใช้แบบแบ่งหน้า หน้าละ 50 คน ค้นด้วยชื่อหรืออีเมล กรองตาม Role/สถานะ |
| `searchUsers` | ค้นผู้ใช้สำหรับช่องค้นหา (UserPicker) |
| `createUser`, `updateUser`, `deleteUser`, `resetPassword` | จัดการบัญชี (Admin) |
| `setUserStatus` | ระงับ/ปลดระงับบัญชี Staff ทำได้เฉพาะกับ Member และเมื่อระงับจะลบ session และส่ง `account:suspended` ให้ผู้ใช้ถูกเด้งออกทันที |
| `setSystemRole` | แต่งตั้ง/ถอด Staff (ห้ามลด Administrator คนสุดท้าย) |
| `getGroups`, `getGroupDetail`, `createGroup`, `updateGroup`, `deleteGroup` | จัดการกลุ่มทั้งระบบ |
| `getLogs` | Log ของ Admin/Staff (Staff เห็นเฉพาะของตัวเอง) |
| `getMyWork`, `getTeam` | ผลงานของ Staff แต่ละคน |

#### vipController.js
| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getVipOverview` | รายชื่อ VIP และรหัส VIP ทั้งหมด |
| `grantVip`, `revokeVip` | ให้/ยกเลิก VIP กับผู้ใช้ |
| `createVipCode`, `deleteVipCode` | สร้าง/ลบรหัส VIP (กำหนดระดับ จำนวนวัน จำนวนครั้งที่ใช้ได้) |
| `redeemVipCode` | ผู้ใช้กรอกรหัส เช็คว่ารหัสมีจริง, ไม่ได้ลดระดับ, ยังไม่เคยใช้, ยังไม่ครบจำนวน |
| `checkVipExpiry` | ลบ VIP ที่หมดอายุ และเตือนล่วงหน้า 3 วัน |
| `getSystemSettings` | ส่งรายการระดับ VIP ทั้งหมดให้หน้าเว็บ |
| `createTier`, `updateTier`, `moveTier`, `deleteTier` | Admin สร้างระดับ VIP ใหม่ได้เอง กำหนดชื่อ ไอคอน สี ขนาดไฟล์ ธีม และลำดับความสูง (`rank`) ระดับที่สูงกว่าใช้รหัสของระดับที่ต่ำกว่าไม่ได้ |

### 4.8 routes/
ไฟล์ใน routes ทำหน้าที่จับคู่ URL กับ controller อย่างเดียว เช่น
```js
router.post('/:id/messages', addMessage);
```
แปลว่า `POST /api/channels/<id>/messages` จะไปเรียก `addMessage`
รายการทั้งหมดอยู่ในหัวข้อ 5

---

## 5. รายการ API ทั้งหมด

ทุก URL ขึ้นต้นด้วย `/api` ถ้าไม่ได้เขียนว่าไม่ต้อง login แปลว่าต้องส่ง `Authorization: Bearer <token>`

`:id` ในหมวด `/users/:id/...` ต้องเป็น id ของตัวเองเท่านั้น (`requireSelf`)

### ผู้ใช้ `/api/users`
| Method | URL | ทำอะไร |
|---|---|---|
| POST | `/users/register` | สมัครสมาชิก (ไม่ต้อง login) |
| POST | `/users/login` | เข้าสู่ระบบ (ไม่ต้อง login) |
| POST | `/users/forgot-password` | ขอรหัสรีเซ็ต (ไม่ต้อง login) |
| POST | `/users/reset-password` | ตั้งรหัสใหม่ด้วยรหัส 6 หลัก (ไม่ต้อง login) |
| GET | `/users` | รายชื่อผู้ใช้ทั้งหมด |
| GET | `/users/me` | ข้อมูลตัวเอง |
| POST | `/users/logout` | ออกจากระบบ |
| POST | `/users/redeem-vip` | ใช้รหัส VIP |
| PUT | `/users/:id` | แก้โปรไฟล์ |
| PUT | `/users/:id/password` | เปลี่ยนรหัสผ่าน |
| DELETE | `/users/:id` | ลบบัญชี |
| PUT | `/users/:id/settings` | บันทึกการตั้งค่า |
| PUT | `/users/:id/presence` | เปลี่ยนสถานะ |
| PUT | `/users/:id/mute` | ปิด/เปิดแจ้งเตือนห้อง |
| GET / PUT | `/users/:id/blocks` | ดู/บล็อกผู้ใช้ |
| PUT | `/users/:id/custom-theme` | ธีมสีที่ตั้งเอง |
| GET / POST | `/users/:id/clips` | ดู/เพิ่มคลิป |
| PUT / DELETE | `/users/:id/clips/:clipId` | แก้/ลบคลิป |
| POST | `/users/:id/read` | บันทึกว่าอ่านห้องแล้ว |
| GET | `/users/:id/unread?groupId=` | จำนวนข้อความที่ยังไม่อ่าน |
| GET | `/users/:id/overview` | ภาพรวมของฉัน |
| GET | `/users/:id/notifications` | แจ้งเตือน |
| POST | `/users/:id/notifications/read` | อ่านแจ้งเตือน |
| POST / DELETE | `/users/:id/avatar` | เปลี่ยน/ลบรูปโปรไฟล์ |

### กลุ่ม `/api/groups`
| Method | URL | ทำอะไร |
|---|---|---|
| GET / POST | `/groups` | กลุ่มของฉัน / สร้างกลุ่ม |
| GET | `/groups/discover?q=` | ค้นกลุ่ม Public |
| POST | `/groups/join` | เข้ากลุ่มด้วยรหัสเชิญ |
| POST | `/groups/:groupId/join` | เข้ากลุ่ม Public |
| POST | `/groups/:groupId/leave` | ออกจากกลุ่ม |
| DELETE | `/groups/:id` | ลบกลุ่ม |
| GET | `/groups/:groupId/search?q=` | ค้นหาข้อความ |
| GET | `/groups/:groupId/logs` | ประวัติกลุ่ม |
| GET | `/groups/:groupId/inspect` | Admin เข้าดูกลุ่ม |
| PUT | `/groups/:groupId/settings` | แก้ข้อมูลกลุ่ม |
| POST / DELETE | `/groups/:groupId/icon` | ไอคอนกลุ่ม |
| POST | `/groups/:groupId/invite-code` | สุ่มรหัสเชิญใหม่ |
| POST | `/groups/:groupId/transfer` | โอนเจ้าของ |
| POST | `/groups/:groupId/members` | เพิ่มสมาชิก |
| DELETE | `/groups/:groupId/members/:memberId` | เอาสมาชิกออก |
| PUT | `/groups/:groupId/members/:memberId/role` | ให้ Role |
| PUT | `/groups/:groupId/members/:memberId/nickname` | ตั้งชื่อเล่น |
| PUT | `/groups/:groupId/members/:memberId/timeout` | Timeout |
| POST | `/groups/:groupId/bans` | แบน |
| DELETE | `/groups/:groupId/bans/:memberId` | ยกเลิกแบน |
| POST | `/groups/:groupId/invites` | สร้างลิงก์เชิญ |
| DELETE | `/groups/:groupId/invites/:code` | ลบลิงก์เชิญ |
| POST | `/groups/:groupId/roles` | สร้าง Role |
| PUT | `/groups/:groupId/roles-order` | เรียงลำดับ Role |
| PUT / DELETE | `/groups/:groupId/roles/:roleId` | แก้/ลบ Role |
| POST | `/groups/:groupId/categories` | สร้างหมวดหมู่ |
| PUT / DELETE | `/groups/:groupId/categories/:categoryId` | แก้/ลบหมวดหมู่ |
| POST | `/groups/:groupId/events` | สร้างนัดหมาย |
| PUT / DELETE | `/groups/:groupId/events/:eventId` | แก้/ลบนัดหมาย |
| POST | `/groups/:groupId/projects` | สร้าง Project |
| DELETE | `/groups/:groupId/projects/:projectId` | ลบ Project |
| PUT | `/groups/:groupId/projects/:projectId/archive` | เก็บถาวร/นำออก |
| PUT | `/groups/:groupId/projects/:projectId/board` | บันทึกบอร์ดงาน |
| POST | `/groups/:groupId/projects/:projectId/tasks/:taskId/comments` | คอมเมนต์งาน |

### Project `/api/groups/:groupId/projects/:projectId`
| Method | URL | ทำอะไร |
|---|---|---|
| GET / POST | `/channels` | ห้องแชทใน Project |
| DELETE | `/channels/:channelId` | ลบห้อง |
| GET / POST | `/channels/:channelId/messages` | ดู/ส่งข้อความ |
| PUT / DELETE | `/channels/:channelId/messages/:msgId` | แก้/ลบข้อความ |
| POST | `/channels/:channelId/messages/:msgId/reactions` | อีโมจิ |
| POST | `/channels/:channelId/messages/:msgId/pin` | ปักหมุด |
| POST | `/channels/:channelId/messages/:msgId/vote` | โหวต |
| GET | `/channels/:channelId/pins` | ข้อความที่ปักหมุด |
| POST | `/members` | เพิ่มสมาชิก Project |
| DELETE | `/members/:memberId` | เอาสมาชิกออก |

### Channel `/api/channels`
| Method | URL | ทำอะไร |
|---|---|---|
| GET / POST | `/channels?groupId=` | ดู/สร้าง Channel |
| PUT / DELETE | `/channels/:id` | แก้/ลบ Channel |
| GET / POST | `/channels/:id/messages` | ดู/ส่งข้อความ (`?limit=50&before=<เวลา>`) |
| PUT / DELETE | `/channels/:id/messages/:msgId` | แก้/ลบข้อความ |
| POST | `/channels/:id/messages/:msgId/reactions` | อีโมจิ |
| POST | `/channels/:id/messages/:msgId/pin` | ปักหมุด |
| POST | `/channels/:id/messages/:msgId/vote` | โหวต |
| GET | `/channels/:id/pins` | ข้อความที่ปักหมุด |

### DM `/api/dms`
| Method | URL | ทำอะไร |
|---|---|---|
| GET / POST | `/dms/:otherUserId/messages` | ดู/ส่งข้อความ |
| PUT / DELETE | `/dms/:otherUserId/messages/:msgId` | แก้/ลบ |

### แชทกลุ่ม `/api/conversations`
| Method | URL | ทำอะไร |
|---|---|---|
| GET / POST | `/conversations` | รายการแชท / สร้างแชทกลุ่ม |
| PUT | `/conversations/:id` | ตั้งชื่อแชท |
| POST | `/conversations/:id/members` | เพิ่มคน |
| POST | `/conversations/:id/leave` | ออกจากแชท |
| GET / POST | `/conversations/:id/messages` | ดู/ส่งข้อความ |
| PUT / DELETE | `/conversations/:id/messages/:msgId` | แก้/ลบ |
| POST | `/conversations/:id/messages/:msgId/reactions` | อีโมจิ |

### อื่นๆ
| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/system-settings` | ค่าของแต่ละระดับ VIP (ไม่ต้อง login) |
| POST | `/uploads` | อัปโหลดไฟล์แนบ (form-data ชื่อ `file`) |
| GET / POST | `/scheduled` | ดู/ตั้งเวลาส่งข้อความ |
| DELETE | `/scheduled/:id` | ยกเลิก |

### Admin `/api/admin` (Staff = ต้องเป็น Staff ขึ้นไป, Admin = Administrator เท่านั้น)
| Method | URL | ใครใช้ได้ | ทำอะไร |
|---|---|---|---|
| GET | `/admin/stats` | Admin | สถิติ |
| GET | `/admin/my-work` | Staff | ผลงานของตัวเอง |
| GET | `/admin/usage` | Staff | สถานะการใช้งาน: คนออนไลน์ตอนนี้, ผู้ใช้งานต่อวัน, ออนไลน์พร้อมกันสูงสุด |
| GET | `/admin/team` | Admin | ทีม Staff |
| GET | `/admin/users?page=&q=` | Staff | รายชื่อผู้ใช้แบบแบ่งหน้า |
| GET | `/admin/users/search?q=&limit=` | Staff | ค้นผู้ใช้ |
| POST | `/admin/users` | Admin | สร้างบัญชี |
| PUT | `/admin/users/:id` | Admin | แก้บัญชี |
| PUT | `/admin/users/:id/status` | Staff | ระงับ/ปลดระงับ |
| PUT | `/admin/users/:id/password` | Admin | ตั้งรหัสผ่านใหม่ |
| DELETE | `/admin/users/:id` | Admin | ลบบัญชี |
| PUT | `/admin/users/:id/system-role` | Admin | ตั้ง Staff |
| GET | `/admin/groups`, `/admin/groups/:id` | Staff | ดูกลุ่ม |
| POST / PUT / DELETE | `/admin/groups(/:id)` | Admin | จัดการกลุ่ม |
| GET | `/admin/logs` | Staff | Log |
| GET | `/admin/vip` | Staff | ภาพรวม VIP |
| POST | `/admin/vip-tiers` | Admin | สร้างระดับ VIP ใหม่ (ชื่อ ไอคอน สี ขนาดไฟล์ ธีม) |
| PUT | `/admin/vip-tiers/:tier` | Admin | แก้ไขระดับ |
| PUT | `/admin/vip-tiers/:tier/move` | Admin | เลื่อนลำดับขึ้น/ลง (`direction: up / down`) |
| DELETE | `/admin/vip-tiers/:tier` | Admin | ลบระดับ (ลบไม่ได้ถ้ายังมีคนเป็นระดับนี้ และลบระดับ "ทั่วไป" ไม่ได้) |
| PUT / DELETE | `/admin/users/:id/vip` | Staff | ให้/ยกเลิก VIP |
| POST | `/admin/vip-codes` | Staff | สร้างรหัส VIP |
| DELETE | `/admin/vip-codes/:code` | Staff | ลบรหัส VIP |

---

## 6. Socket.io (ส่วนเรียลไทม์)

### ห้อง (room)
| ห้อง | ใครอยู่ | ใช้ส่งอะไร |
|---|---|---|
| `user:<userId>` | ทุกแท็บของผู้ใช้คนนั้น | แจ้งเตือน, DM, ข้อมูลส่วนตัว |
| `group:<groupId>` | คนที่เปิดกลุ่มนั้นอยู่ | ข้อความ Channel, การเปลี่ยนแปลงในกลุ่ม |

### Event ที่หน้าเว็บส่งไป backend
| Event | ข้อมูล | ทำอะไร |
|---|---|---|
| `identify` | token | ยืนยันตัวตน เข้าห้อง `user:<id>` |
| `join-group` | groupId | เข้าห้องกลุ่ม |
| `typing` | `{ room, toUserIds, name }` | บอกว่ากำลังพิมพ์ |
| `logout` | - | ออกจากห้องทั้งหมด |

### Event ที่ backend ส่งมาหน้าเว็บ
| Event | ส่งตอนไหน |
|---|---|
| `online-users` | มีคนออนไลน์/ออฟไลน์ |
| `auth:invalid` | token ใช้ไม่ได้ |
| `typing` | มีคนกำลังพิมพ์ |
| `message:new` / `message:updated` / `message:deleted` | ข้อความใน Channel |
| `channel:created` / `channel:updated` / `channel:deleted` | Channel เปลี่ยน |
| `project-message:new` / `:updated` / `:deleted` | ข้อความใน Project |
| `project-channel:created` / `:deleted` | ห้องแชทใน Project |
| `dm:new` / `dm:updated` / `dm:deleted` | DM |
| `gdm:new` / `gdm:updated` / `gdm:deleted` / `gdm:changed` / `gdm:removed` | แชทกลุ่ม |
| `group:updated` | ข้อมูลกลุ่มเปลี่ยน (สมาชิก Role บอร์ดงาน ฯลฯ) |
| `group:added` / `group:removed` / `group:deleted` | ถูกเพิ่มเข้า/เอาออก/กลุ่มถูกลบ |
| `task:assigned` | ได้รับมอบหมายงาน |
| `notification:new` | แจ้งเตือนใหม่ |
| `user:updated` / `user:deleted` | ข้อมูลผู้ใช้เปลี่ยน/ถูกลบ |
| `account:suspended` | บัญชีถูกระงับ → หน้าเว็บ logout ทันที |
| `blocks:changed` | รายชื่อที่บล็อกเปลี่ยน (ซิงก์หลายแท็บ) |
| `scheduled:changed` | ข้อความตั้งเวลาถูกส่งแล้ว |
| `system-settings:updated` | Admin เปลี่ยนค่าระดับ VIP |

---

## 7. งานเบื้องหลังที่ทำงานเอง

เริ่มทำงานใน `index.js` หลังต่อฐานข้อมูลได้ ใช้ `setInterval` วนทำเรื่อยๆ

| งาน | ทุกๆ | ไฟล์ | ทำอะไร |
|---|---|---|---|
| ส่งข้อความตั้งเวลา | 15 วินาที | `scheduler.js` | ดึงข้อความที่ถึงเวลาด้วย `DELETE ... RETURNING` (ดึงและลบในคำสั่งเดียว กันส่งซ้ำ) แล้วเรียก controller ส่งข้อความตัวเดียวกับที่คนกดส่ง ทำให้เช็คสิทธิ์เหมือนกันทุกอย่าง ถ้าส่งไม่ได้ (เช่น ถูกเอาออกจากกลุ่มแล้ว) จะแจ้งเตือนเจ้าของ |
| เตือนงานใกล้ครบกำหนด และนัดวันนี้ | 30 นาที | `reminders.js` | หางานที่ครบกำหนดวันนี้/พรุ่งนี้ ที่ยังไม่อยู่คอลัมน์สุดท้าย แจ้งคนที่รับผิดชอบ และแจ้งนัดวันนี้ให้สมาชิกกลุ่ม ใช้คอลัมน์ `reminded_for` กันเตือนซ้ำ |
| เช็ค VIP หมดอายุ | 10 นาที | `vipController.js` | ลบ VIP ที่หมดอายุ และเตือนล่วงหน้า 3 วัน |
| ลบ session หมดอายุ | 6 ชั่วโมง | `reminders.js` | ลบ token เก่า |
| ลบไฟล์ที่ไม่ได้ใช้ | 6 ชั่วโมง | `uploadCleanup.js` | ไฟล์ที่อัปโหลดเกิน 1 วันแล้วไม่ได้แนบกับอะไร |

`scheduler.js` ใช้ตัวแปร `running` กันไม่ให้รอบใหม่เริ่มก่อนรอบเก่าเสร็จ

---

## 8. ฐานข้อมูล

ใช้ PostgreSQL 17 มี 42 ตาราง รายละเอียดทุกคอลัมน์อยู่ใน `Diagram.md` (ER Diagram) และ `backend/database/schema.sql`

| กลุ่มตาราง | ตาราง |
|---|---|
| ผู้ใช้ | users, sessions, user_blocks, muted_rooms, read_markers, notifications, clips |
| VIP | tier_settings, user_vip, vip_codes, vip_code_uses |
| กลุ่ม | groups, group_members, group_roles, member_roles, group_bans, group_invites, group_events, group_logs |
| Channel และข้อความ | channel_categories, channels, channel_allowed_roles, messages, message_attachments, message_mentions, message_reactions, poll_options, poll_votes |
| แชทส่วนตัว | conversations, conversation_participants, scheduled_messages |
| Project | projects, project_members, project_channels, board_columns, tasks, task_assignees, task_checklist_items, task_comments |
| ระบบ | admin_logs, daily_active_users, daily_peak_online |

เรื่องที่ควรรู้
- **id เป็น TEXT** ขึ้นต้นด้วยตัวบอกประเภท เช่น `u-` ผู้ใช้, `g-` กลุ่ม, `ch-` Channel, `m-` ข้อความ, `p-` Project อ่านแล้วรู้เลยว่าเป็น id ของอะไร
- **ON DELETE CASCADE** ลบกลุ่มแล้วทุกอย่างในกลุ่มหายตามไปเอง ไม่ต้องเขียนลบทีละตาราง
- **ON DELETE SET NULL** ใช้กับคนเขียนข้อความ ถ้าผู้ใช้ลบบัญชี ข้อความยังอยู่ (เก็บชื่อไว้ใน `author_name`)
- **CHECK** กันข้อมูลผิดตั้งแต่ระดับฐานข้อมูล เช่น `system_role` ต้องเป็น 3 ค่าที่กำหนด, ข้อความต้องอยู่ที่เดียว (`num_nonnulls(...) = 1`)
- **TEXT[]** เก็บรายการสิทธิ์ของ Role ไว้ในคอลัมน์เดียว
- **JSONB** เก็บการตั้งค่าของผู้ใช้และธีมสี
- **Index** ทำให้ดึงข้อความล่าสุดของห้องเร็ว และ `pg_trgm` ทำให้ค้นหาข้อความเร็ว

### บันทึก/โหลดข้อมูล
- บันทึกข้อมูลทั้งหมดลงไฟล์: `docker exec realtimecheat_app-postgres pg_dump -U postgres -d realtimecheat_app --no-owner --no-privileges > backend/database/database.sql`
- ล้างแล้วโหลดใหม่จากไฟล์: `docker compose down -v` แล้ว `docker compose up -d`

---

## 9. Frontend

### 9.1 ไฟล์หลัก
| ไฟล์ | ทำอะไร |
|---|---|
| `main.jsx` | ใช้ธีมที่บันทึกไว้ก่อน render (กันจอกระพริบเป็นสีขาว) แล้ว render `<App />` ถ้าเลือกธีม "ตามระบบ" จะเปลี่ยนตามมือถือ/คอมทันที |
| `api.js` | `apiGet(path)`, `apiSend(method, path, body)`, `apiUpload(path, formData)` ใส่ token ให้ทุก request ถ้า backend ตอบ 401 จะลบ token แล้วรีโหลดหน้า (กลับไปหน้า login) ถ้าไม่สำเร็จจะ `throw` ข้อความ error จาก backend |
| `socket.js` | สร้างการเชื่อมต่อ Socket.io ตัวเดียวใช้ทั้งแอป |
| `settings.js` | `loadSettings`, `saveSettings` (เก็บใน localStorage และส่งไป backend), `applySettings` (ใส่ class ธีมและขนาดตัวอักษรที่ `<html>`), ระบบเสียงแจ้งเตือน (`SOUND_TYPES`, `playSound`, `previewSound` ดูหัวข้อ 10.10), `showDesktopNotification` |
| `blockedContext.js` | React Context เก็บรายชื่อคนที่บล็อก ให้ ChatMessage ซ่อนข้อความของคนที่บล็อก |
| `index.css` | โหลด Tailwind และกำหนดสีของแต่ละธีม (light, dark, sakura, midnight, ocean, forest, custom) |

### 9.2 App.jsx (ตัวหลัก)
App.jsx เก็บ state ส่วนใหญ่ของแอป แล้วส่งลงไปให้ component ลูกผ่าน props

**state สำคัญ**
| state | เก็บอะไร |
|---|---|
| `currentUser` | ผู้ใช้ที่ login อยู่ (ถ้าเป็น null จะแสดงหน้า Login) |
| `view` | หน้าที่เปิดอยู่: `lobby`, `workspace`, `groupSettings`, `settings`, `overview`, `admin`, `staff`, `messages`, `clipboard` |
| `myGroups`, `currentGroup` | กลุ่มของฉัน / กลุ่มที่เปิดอยู่ |
| `channels` | Channel ของกลุ่มที่เปิดอยู่ (ข้อความของแต่ละห้องเก็บไว้ในนี้ด้วย) |
| `activeItem` | ห้องที่เลือกอยู่ `{ type: 'channel' / 'project' / 'calendar', id }` |
| `users` | รายชื่อผู้ใช้ทั้งหมด |
| `unread`, `mentionUnread` | จำนวนที่ยังไม่อ่านของแต่ละห้อง key เป็นแบบ `channel:<id>`, `project:<id>`, `dm:<userId>`, `gdm:<id>` |
| `onlineUserIds` | คนที่ออนไลน์ |
| `messagesTarget` | แชทส่วนตัวที่เปิดอยู่ |
| `inspecting` | Admin กำลังเข้าดูกลุ่มของคนอื่น (อ่านอย่างเดียว) |
| `toasts` | ป๊อปอัปแจ้งเตือนมุมจอ (สูงสุด 4 อัน หายเองใน 6 วินาที) |

**ฟังก์ชันสำคัญ**
- `handleLogin` / `handleLogout` เก็บ/ลบ token และ user ใน localStorage
- `openGroup(group)` เปิดกลุ่ม โหลด Channel บอก Socket ว่าเข้ากลุ่ม และจำกลุ่มไว้ใน localStorage (เปิดเว็บใหม่จะกลับมาที่กลุ่มเดิม)
- `handleSelectItem(type, id, channelId, tab, focusMessageId)` เปลี่ยนห้อง และกระโดดไปที่ข้อความที่ค้นเจอ
- `markRead(key)` ล้างตัวเลขที่ยังไม่อ่าน แล้วบอก backend
- `goToTarget(target)` กดแจ้งเตือนแล้วพาไปห้องนั้น
- `goBack()` จัดการปุ่มย้อนกลับ (ดูด้านล่าง)

**ปุ่มย้อนกลับบนมือถือ**
ตอน login แอปจะ `history.pushState` ไว้ 1 ครั้ง เมื่อกดปุ่ม back ของมือถือ เบราว์เซอร์จะเรียก event `popstate` แล้วแอปจะเรียก `goBack()` ซึ่งปิดตามลำดับนี้
1. หน้าต่าง (Modal) ที่เปิดอยู่บนสุด
2. เมนูด้านข้างบนมือถือ
3. จากหน้าแชทกลับไปหน้ารายการห้อง
4. จากแชทส่วนตัวกลับไปรายการแชท
5. จากตั้งค่ากลุ่มกลับไปกลุ่ม
6. กลับหน้าหลัก

ถ้า `goBack()` ปิดอะไรไปได้ จะ `pushState` ใหม่เพื่อให้กด back ได้อีก ถ้าไม่มีอะไรให้ปิดแล้วจะออกจากเว็บตามปกติ

`utils/backButton.js` มี `useCloseOnBack(onClose)` ให้ Modal ลงทะเบียนตัวเอง และ `closeTopPanel()` ปิดอันที่เปิดล่าสุด

### 9.3 hooks/
| ไฟล์ | ทำอะไร |
|---|---|
| `useUserEvents.js` | ส่ง `identify` ทุกครั้งที่ Socket ต่อติด และฟัง `online-users`, `user:updated`, `user:deleted`, `account:suspended` |
| `useGroupEvents.js` | ส่ง `join-group` และฟัง `group:updated` (อัปเดตกลุ่มทันทีเมื่อมีคนแก้), `group:removed`, `group:deleted`, `group:added` ถ้าห้องที่เปิดอยู่ถูกลบหรือเราไม่มีสิทธิ์แล้ว จะย้ายไปห้องอื่นให้ |
| `useChannelEvents.js` | ฟังข้อความและ Channel ใหม่/แก้/ลบ แล้วอัปเดต state `channels` (ไม่เพิ่มข้อความซ้ำถ้ามี id นี้แล้ว) |
| `useMessageAlerts.js` | ฟังข้อความใหม่ทุกประเภท แล้วตัดสินใจว่าจะเพิ่มตัวเลขที่ยังไม่อ่าน เล่นเสียง ขึ้นป๊อปอัป หรือแจ้งเตือนบนเดสก์ท็อปไหม ตามการตั้งค่าของผู้ใช้ ไม่แจ้งเตือนถ้าเป็นห้องที่ปิดเสียงไว้ ห้องที่เปิดอยู่ สถานะ "ไม่ว่าง" หรือคนที่บล็อก |
| `useNotifications.js` | โหลดแจ้งเตือนและฟัง `notification:new` (เล่นเสียงด้วย ยกเว้นสถานะ "ไม่ว่าง" หรือปิดแจ้งเตือนประเภทนั้นไว้) มีฟังก์ชัน `markRead`, `markAllRead` |
| `useChatScroll.js` | เลื่อนแชทลงล่างสุดเมื่อมีข้อความใหม่ แต่ถ้าผู้ใช้เลื่อนขึ้นไปอ่านข้อความเก่าอยู่จะไม่เลื่อนให้ (ยกเว้นเป็นข้อความที่ตัวเองส่ง) และ `rememberPosition` จำตำแหน่งตอนโหลดข้อความเก่า ไม่ให้จอกระโดด |
| `useJumpToMessage.js` | ค้นหาเจอแล้วกดไปที่ข้อความ ถ้าข้อความยังไม่ถูกโหลด จะโหลดหน้าเก่าเพิ่มทีละหน้า (สูงสุด 20 หน้า) จนเจอ แล้วไฮไลต์สีเหลือง 2.5 วินาที |

### 9.4 utils/
| ไฟล์ | ทำอะไร |
|---|---|
| `permissions.js` | ฟังก์ชันเช็คสิทธิ์ชุดเดียวกับ backend ใช้ซ่อน/แสดงปุ่ม (backend ยังเช็คซ้ำอีกรอบเสมอ) และ `getDisplayName` (ใช้ชื่อเล่นในกลุ่มถ้ามี) |
| `format.js` | จัดรูปแบบเวลา `formatTime`, `formatDate`, `timeAgo` ("5 นาทีที่แล้ว"), `formatSize` (KB/MB), `dayLabel` ("วันนี้", "เมื่อวาน") |
| `messages.js` | `mergeMessages` รวมข้อความเก่ากับใหม่ไม่ให้ซ้ำ, `getOldestTime`, `getLastId` |
| `vip.js` | เก็บรายการระดับ VIP ที่ได้จาก backend (`setTierSettings`), `getTierList` (เรียงตามลำดับ), `getTierInfo` / `getTierName`, `getPerks`, `canUseTheme`, `vipNameStyle` (สีชื่อแบบไล่สีตามสีของระดับ), `tierGradient`, `buildCustomPalette` (สร้างชุดสีจากสีหลักที่ผู้ใช้เลือก) |
| `presence.js` | ชื่อสถานะภาษาไทย และ `getPresence` (ถ้าไม่ได้ต่อ Socket อยู่ถือว่าออฟไลน์) |
| `constants.js` | รายการอีโมจิ และสีของความสำคัญงาน |
| `backButton.js` | ปุ่มย้อนกลับ (อธิบายไว้ใน 9.2) |
| `clipboard.js` | `copyText` คัดลอกข้อความ ถ้าเว็บเป็น https ใช้ `navigator.clipboard` ถ้าไม่ใช่ (เช่นเปิดผ่าน http) ใช้วิธีสำรองด้วย `textarea` + `document.execCommand('copy')` ถ้ายังไม่ได้อีกจะเปิดกล่องให้กด Ctrl+C เอง |
| `dialog.js` | กล่องข้อความ SweetAlert2 ใช้แทน `alert` / `confirm` / `prompt` ทั้งเว็บ: `showAlert`, `showError`, `showSuccess`, `askConfirm` (คืน true/false ถ้าข้อความมีคำว่า ลบ แบน ระงับ ฯลฯ ปุ่มจะเป็นสีแดง), `askText` (คืนข้อความหรือ null), `showCopyBox`, `isDialogOpen`, `closeDialog` |
| `tasks.js` | `getAssigneeIds` อ่านรายชื่อผู้รับผิดชอบงาน |

### 9.5 components/
แบ่งโฟลเดอร์ตามหน้าจอ

#### auth/ หน้าเข้าสู่ระบบ
| ไฟล์ | ทำอะไร |
|---|---|
| `LoginView.jsx` | ฟอร์ม Login / สมัครสมาชิก สลับกันได้ในหน้าเดียว |
| `ForgotPasswordForm.jsx` | ลืมรหัสผ่าน 2 ขั้น: กรอกอีเมล → กรอกรหัส 6 หลักกับรหัสใหม่ |

#### layout/
| ไฟล์ | ทำอะไร |
|---|---|
| `AppRail.jsx` | แถบไอคอนด้านซ้ายสุด (หน้าหลัก ข้อความ ภาพรวม คลิปบอร์ด กลุ่มของฉัน Admin โปรไฟล์) และตัวเลขที่ยังไม่อ่าน |
| `NotificationPanel.jsx` | รายการแจ้งเตือน |

#### lobby/ หน้าหลัก
| ไฟล์ | ทำอะไร |
|---|---|
| `LobbyView.jsx` | แท็บ "กลุ่มของฉัน" และ "ค้นหากลุ่ม Public" |
| `AddGroupModal.jsx` | ปุ่ม "+" เลือกสร้างกลุ่มใหม่ หรือเข้าร่วมด้วยรหัสเชิญ (วางลิงก์เชิญได้ จะดึงรหัสออกมาให้) |
| `CreateGroupModal.jsx` | ฟอร์มสร้างกลุ่ม และ `VisibilityPicker` เลือก Public/Private |

#### workspace/ หน้าในกลุ่ม
| ไฟล์ | ทำอะไร |
|---|---|
| `WorkspaceView.jsx` | วาง Sidebar + เนื้อหาตรงกลาง + รายชื่อสมาชิก บนมือถือแสดงทีละส่วน มีปุ่มย้อนกลับ เปลี่ยนแท็บ Project (แชท / บอร์ดงาน) และบันทึกบอร์ด |
| `Sidebar.jsx` | รายการ Channel แบ่งหมวดหมู่, Channel ย่อย, Project, ปฏิทิน พร้อมตัวเลขที่ยังไม่อ่าน (Channel ย่อยรวมตัวเลขขึ้นไปที่ Channel แม่) และเมนูสร้าง/แก้/ลบ Channel หมวดหมู่ Project |
| `MemberList.jsx` | รายชื่อสมาชิกเรียงตาม Role แบบ Discord (Role ที่เปิด `hoist` จะแยกหัวข้อ) แยกออนไลน์/ออฟไลน์ |
| `ProjectChat.jsx` | แชทใน Project มีหลายห้อง สร้าง/ลบห้องได้ ถ้า Project ถูกเก็บถาวรจะส่งข้อความไม่ได้ |
| `ProjectTaskBoard.jsx` | บอร์ด Kanban ลากวางด้วย `@hello-pangea/dnd` กรองงานตามคน/ความสำคัญ เพิ่ม/ลบ/เปลี่ยนชื่อคอลัมน์ได้ |
| `CalendarView.jsx` | ปฏิทินรายเดือน แสดงนัดหมายและวันส่งงาน กดวันเพื่อดู/เพิ่มนัด |
| `DirectMessageView.jsx` | หน้าแชท DM 1 ต่อ 1 |

#### chat/ ส่วนประกอบของแชท (ใช้ร่วมกันทุกแบบ)
| ไฟล์ | ทำอะไร |
|---|---|
| `ChannelChat.jsx` | แชทใน Channel โหลดข้อความ ส่ง แก้ ลบ อีโมจิ ปักหมุด โหวต เปิดเธรด |
| `MessageList.jsx` | แสดงรายการข้อความ คั่นด้วยวันที่ และจัดข้อความต่อเนื่องของคนเดียวกันให้ติดกัน |
| `ChatMessage.jsx` | ข้อความ 1 อัน: ชื่อ เวลา เนื้อหา ไฟล์แนบ โพล อีโมจิ ปุ่มเมนู (บนมือถือแตะเพื่อเปิดเมนู) |
| `MessageText.jsx` | แปลงข้อความเป็นรูปแบบ: `**ตัวหนา**`, `*ตัวเอียง*`, `~~ขีดฆ่า~~`, `` `โค้ด` ``, ` ```บล็อกโค้ด``` `, ลิงก์ และไฮไลต์ @ชื่อ เขียนเป็นตัวอ่านทีละตัวอักษร (ไม่ได้ใช้ `dangerouslySetInnerHTML` จึงปลอดภัยจาก XSS) |
| `MessageReactions.jsx` | แถบอีโมจิใต้ข้อความ |
| `ChatInput.jsx` | ช่องพิมพ์ข้อความ: ขยายตามความยาว, Enter ส่ง / Shift+Enter ขึ้นบรรทัด, พิมพ์ `@` เพื่อเลือกคน, แนบไฟล์, โพล, ตั้งเวลาส่ง, แปะจากคลิปบอร์ด, ส่ง "กำลังพิมพ์" (รองรับการพิมพ์ภาษาไทยด้วย `isComposing` ไม่ให้กด Enter ตอนกำลังเลือกคำแล้วส่งเลย) |
| `ThreadPanel.jsx` | แผงเธรดด้านขวา ตอบกลับข้อความ |
| `PinnedPanel.jsx` | รายการข้อความที่ปักหมุด |
| `TypingIndicator.jsx` | "xxx กำลังพิมพ์..." ถ้าไม่ได้รับสัญญาณใหม่เกิน 3.5 วินาทีจะหายเอง |
| `LoadOlderButton.jsx` | ปุ่มโหลดข้อความเก่า |

#### messages/ ข้อความส่วนตัว
| ไฟล์ | ทำอะไร |
|---|---|
| `MessagesView.jsx` | รายการแชทด้านซ้าย (DM + แชทกลุ่ม) และหน้าแชทด้านขวา เปลี่ยนชื่อ/เพิ่มคน/ออกจากแชทกลุ่ม ปิดเสียงได้ |
| `GroupChatView.jsx` | หน้าแชทกลุ่ม |
| `NewChatModal.jsx` | เลือกคนเพื่อเริ่มแชท เลือก 1 คน = DM เลือก 2 คนขึ้นไป = แชทกลุ่ม |

#### groupSettings/ ตั้งค่ากลุ่ม
| ไฟล์ | ทำอะไร |
|---|---|
| `GroupSettingsView.jsx` | หน้าแท็บ แสดงเฉพาะแท็บที่มีสิทธิ์ |
| `GroupGeneralTab.jsx` | ชื่อ คำอธิบาย ไอคอน Public/Private รหัสเชิญ |
| `GroupMembersTab.jsx` | รายชื่อสมาชิก เพิ่ม/เอาออก ชื่อเล่น |
| `MemberRolesEditor.jsx` | ติ๊กเลือก Role ให้สมาชิก |
| `ModerationActions.jsx` | ปุ่มแบน / Timeout |
| `GroupRolesTab.jsx` | สร้าง/แก้/ลบ/เรียง Role เลือกสี และติ๊กสิทธิ์ 16 ตัว |
| `GroupInvitesTab.jsx` | ลิงก์เชิญ กำหนดวันหมดอายุและจำนวนคน คัดลอกลิงก์ |
| `GroupLogsTab.jsx` | ประวัติการเปลี่ยนแปลงในกลุ่ม |
| `GroupDangerTab.jsx` | โอนเจ้าของ (ค้นหาสมาชิก) และลบกลุ่ม |

#### modals/ หน้าต่างป๊อปอัป
| ไฟล์ | ทำอะไร |
|---|---|
| `TaskModal.jsx` | รายละเอียดงาน: ชื่อ คำอธิบาย ผู้รับผิดชอบหลายคน ความสำคัญ วันส่ง Checklist คอมเมนต์ (ถ้าอ่านอย่างเดียวจะแก้ไม่ได้) |
| `CreateProjectModal.jsx` | สร้าง Project เลือกสมาชิก (ค้นหา, เลือกทั้งหมด) |
| `ProjectMembersModal.jsx` | จัดการสมาชิก Project |
| `PollModal.jsx` | สร้างโพล |
| `ScheduleModal.jsx` | ตั้งเวลาส่งข้อความ และดูรายการที่ตั้งไว้ |
| `SearchModal.jsx` | ค้นหาข้อความในกลุ่ม กดผลลัพธ์แล้วกระโดดไปที่ข้อความ (Esc ปิด) |
| `UserProfileModal.jsx` | โปรไฟล์ผู้ใช้ ปุ่มส่งข้อความ และบล็อก |

#### settings/ ตั้งค่าของฉัน
| ไฟล์ | ทำอะไร |
|---|---|
| `UserSettingsView.jsx` | หน้าแท็บ |
| `ProfileTab.jsx` | ชื่อ รูป ตำแหน่ง bio สีแบนเนอร์ |
| `AccountTab.jsx` | เปลี่ยนรหัสผ่าน ลบบัญชี |
| `PreferencesTabs.jsx` | `AppearanceTab` (ธีม ขนาดตัวอักษร) และ `NotificationTab` (เปิด/ปิดแจ้งเตือนแต่ละแบบ, เลือกเสียง 4 แบบ, แถบความดัง, ปุ่มทดลองเสียง, แจ้งเตือนบนเดสก์ท็อป) |
| `VipTab.jsx` | สถานะ VIP และช่องกรอกรหัส |
| `CustomThemeCard.jsx` | ตั้งสีธีมเอง (VIP) |

#### admin/ และ staff/
| ไฟล์ | ทำอะไร |
|---|---|
| `AdminView.jsx` | หน้าแท็บของ Administrator |
| `AdminStatsTab.jsx` | สถิติและกราฟ |
| `AdminUsersTab.jsx` | จัดการผู้ใช้ ค้นหาฝั่ง server แบ่งหน้า (ก่อนหน้า/ถัดไป) |
| `AdminGroupsTab.jsx` | จัดการกลุ่มทั้งระบบ |
| `AdminTeamTab.jsx` | แต่งตั้ง/ถอด Staff ดูผลงาน |
| `AdminVipTab.jsx` | ให้ VIP (ค้นหาด้วยอีเมล) สร้างรหัส VIP |
| `TierSettingsCard.jsx` | จัดการระดับ VIP: ตารางทุกระดับ, ปุ่ม "เพิ่มระดับ VIP" (ตั้งชื่อ ไอคอน สี ขนาดไฟล์ ธีม), แก้ไข, เลื่อนลำดับ ▲▼, ลบ (Staff ดูได้อย่างเดียว) |
| `AdminLogsTab.jsx` | Log |
| `UsageTab.jsx` | สถานะการใช้งาน (มีทั้งใน Admin และ Staff Dashboard): คนกำลังใช้งานตอนนี้, ผู้ใช้งานวันนี้, ออนไลน์พร้อมกันสูงสุดวันนี้/ตลอดกาล, กราฟ 14 วัน และรายชื่อคนออนไลน์ อัปเดตเองเมื่อมีคนเข้า/ออก |
| `StaffView.jsx`, `StaffWorkTab.jsx` | หน้าของ Staff และงานของตัวเอง |

#### clipboard/ และ overview/
| ไฟล์ | ทำอะไร |
|---|---|
| `ClipboardView.jsx` | จัดการคลิปบอร์ดส่วนตัว |
| `ClipPicker.jsx` | เลือกคลิปมาแปะในช่องแชท |
| `OverviewView.jsx` | ภาพรวมของฉัน กราฟข้อความ งานที่ค้าง (กดแล้วไปที่บอร์ด) นัดที่จะถึง |

#### ui/ ชิ้นส่วนที่ใช้ซ้ำทั้งแอป
| ไฟล์ | ทำอะไร |
|---|---|
| `Button.jsx` | `Button`, `IconButton` |
| `Modal.jsx` | กรอบหน้าต่าง (ปิดได้ด้วย Esc, คลิกนอกกรอบ, ปุ่ม back บนมือถือ) |
| `Card.jsx` | `Card`, `EmptyState`, `PageHeader`, `StatCard`, `Tabs` |
| `Form.jsx` | `Field`, `ErrorBox`, `Toggle`, `SegmentedControl` |
| `Avatar.jsx` | รูปโปรไฟล์ + จุดสถานะ, `GroupAvatar` |
| `Badge.jsx` | ป้าย Role, VIP, Public/Private |
| `Icon.jsx` | ไอคอน SVG ทั้งหมดของแอป |
| `BarChart.jsx` | กราฟแท่ง (เขียนเองไม่ใช้ library) |
| `EmojiPicker.jsx` | เลือกอีโมจิ |
| `LogList.jsx` | รายการ Log |
| `UserPicker.jsx` | ช่องค้นหาผู้ใช้ด้วยชื่อหรืออีเมล ค้นจากรายชื่อที่มี หรือค้นจาก server (หน่วง 250 ms หลังหยุดพิมพ์) |

---

## 10. การทำงานของแต่ละฟีเจอร์ตั้งแต่ต้นจนจบ

### 10.1 Login
1. `LoginView` เรียก `apiSend('POST', '/users/login', { email, password })`
2. backend `loginUser` เช็คจำนวนครั้งที่ผิด → เช็ครหัสด้วย bcrypt → สร้าง session → ตอบ `{ user, token }`
3. `App.handleLogin` เก็บ token และ user ไว้ใน localStorage แล้วเปลี่ยน `currentUser`
4. `useUserEvents` ส่ง `identify` ทาง Socket → backend ให้เข้าห้อง `user:<id>` → ทุกคนเห็นว่าออนไลน์
5. App โหลดรายชื่อผู้ใช้ กลุ่ม รายชื่อที่บล็อก และเปิดกลุ่มล่าสุดที่เคยเปิด

เปิดเว็บใหม่ App อ่าน user และ token จาก localStorage ได้เลยไม่ต้อง login ซ้ำ ถ้า token หมดอายุ API จะตอบ 401 แล้ว `api.js` จะพากลับหน้า login

### 10.2 ส่งข้อความใน Channel
1. ผู้ใช้กด Enter ใน `ChatInput` (ถ้ามีไฟล์ จะอัปโหลดผ่าน `/api/uploads` ก่อนแล้วได้ URL)
2. `ChannelChat` เรียก `POST /api/channels/<id>/messages` ส่ง `{ text, attachments, parentId, poll }`
3. backend `addMessage`
   - ตรวจว่ามีข้อความ/ไฟล์/โพล
   - `requireChannelAccess` มีสิทธิ์เห็น Channel นี้ไหม
   - `requireNotTimedOut` โดน Timeout ไหม
   - `findMentions` หาคนที่ถูก @
   - `createMessage` บันทึกลงฐานข้อมูล
   - `notifyMentions` / `notifyThreadReply` สร้างแจ้งเตือน
   - `sendChannelEvent` ส่ง `message:new` ให้เฉพาะคนที่เห็น Channel นี้
4. หน้าเว็บของทุกคน `useChannelEvents` รับ `message:new` แล้วเพิ่มข้อความลงจอ
5. `useMessageAlerts` เพิ่มตัวเลขที่ยังไม่อ่าน/เล่นเสียง ให้คนที่ไม่ได้เปิดห้องนี้อยู่

### 10.3 ตัวเลขข้อความที่ยังไม่อ่าน
- ตาราง `read_markers` เก็บว่าแต่ละคนอ่านแต่ละห้องถึงเวลาไหน
- เปิดห้อง = เรียก `markRead` → `POST /users/<id>/read` บันทึกเวลาปัจจุบัน
- ตอนเปิดกลุ่ม App เรียก `GET /users/<id>/unread` ได้ตัวเลขของทุกห้อง
- ระหว่างใช้งาน ข้อความใหม่ทาง Socket จะ +1 ให้เองโดยไม่ต้องถาม backend

### 10.4 บอร์ดงาน
1. ลากการ์ดใน `ProjectTaskBoard` → `onDragEnd` คำนวณตำแหน่งใหม่
2. `WorkspaceView` ส่ง **ทั้งบอร์ด** (`columns` และ `tasks`) ไปที่ `PUT /groups/<g>/projects/<p>/board`
3. backend `updateProjectBoard` ทำใน transaction เดียว
   - บันทึกคอลัมน์และงานด้วย `INSERT ... ON CONFLICT DO UPDATE` (มีอยู่แล้วแก้ ไม่มีสร้างใหม่)
   - ลบงานและคอลัมน์ที่ไม่อยู่ในรายการที่ส่งมา
   - ถ้าเปลี่ยนวันส่ง จะล้าง `reminded_for` ให้เตือนใหม่ได้
   - คนที่เพิ่งถูกมอบหมายจะได้แจ้งเตือน
4. ส่ง `group:updated` ให้ทุกคนในกลุ่ม บอร์ดของทุกคนเปลี่ยนตาม

ที่ส่งทั้งบอร์ดแทนการส่งทีละงาน เพราะการลากงานเปลี่ยนลำดับของงานหลายอันพร้อมกัน

### 10.5 ตั้งเวลาส่งข้อความ
1. `ScheduleModal` → `POST /api/scheduled` เก็บลงตาราง `scheduled_messages`
2. ทุก 15 วินาที `scheduler.js` ดึงอันที่ถึงเวลา แล้วเรียก `addMessage` (หรือ `addDmMessage` ฯลฯ) เหมือนผู้ใช้กดส่งเอง
3. ถ้าส่งไม่สำเร็จจะได้แจ้งเตือนบอกเหตุผล

### 10.6 อัปโหลดไฟล์
1. `ChatInput` → `POST /api/uploads` (form-data)
2. `handleFileUpload` เช็คนามสกุล, ขนาดตามระดับ VIP, ถ้าเป็นรูปเช็ค magic number → ตั้งชื่อไฟล์ใหม่แบบสุ่ม
3. ตอบ URL กลับมา แล้วหน้าเว็บค่อยส่งข้อความพร้อม URL นั้น
4. `cleanAttachments` ตรวจซ้ำว่า URL เป็นไฟล์ที่ระบบสร้างจริง
5. ไฟล์ที่อัปโหลดแล้วไม่ได้ส่ง จะถูกลบใน 1 วัน

### 10.7 VIP
- **ระดับ VIP สร้างเองได้:** ระบบเริ่มต้นมี ทั่วไป (5 MB), VIP 💎 (25 MB), SUPER VIP 👑 (50 MB) และ Admin เพิ่มระดับใหม่ได้ที่ Admin Dashboard > VIP > "เพิ่มระดับ VIP"
  - แต่ละระดับมี ชื่อ, ไอคอน, สี, ลำดับ (`rank`), ขนาดไฟล์แนบ 1–1000 MB, ธีมสำเร็จรูป, ออกแบบธีมเองได้ไหม
  - ทุกอย่างเก็บในตาราง `tier_settings` แก้แล้วส่ง `system-settings:updated` ให้ทุกคน หน้าเว็บเปลี่ยนทันที
  - ลบระดับที่ยังมีคนใช้อยู่ไม่ได้ และลบระดับ "ทั่วไป" ไม่ได้
- Staff/Admin ให้ VIP ตรงๆ หรือสร้างรหัสให้ผู้ใช้กรอกเอง
- ใช้รหัสระดับเดียวกันซ้ำ = ต่ออายุจากวันหมดอายุเดิม และคนที่อยู่ระดับสูงกว่าใช้รหัสของระดับที่ต่ำกว่าไม่ได้
- ป้ายข้างชื่อและสีชื่อใช้ไอคอนและสีของระดับนั้น
- หมดอายุแล้วระบบลบเองและแจ้งเตือน (เตือนล่วงหน้า 3 วัน)

### 10.8 สถานะการใช้งาน (Admin / Staff Dashboard)
1. ทุกครั้งที่มีคนเปิดเว็บและ Socket ส่ง `identify` → `recordUsage` บันทึก
   - ลงตาราง `daily_active_users` ว่าวันนี้คนนี้เข้าใช้ (1 คนนับวันละ 1 ครั้ง)
   - ถ้าจำนวนคนออนไลน์พร้อมกันตอนนี้มากกว่าสถิติของวันนี้ จะบันทึกลง `daily_peak_online` พร้อมเวลา
2. `GET /api/admin/usage` ส่งกลับ
   - คนที่กำลังใช้งานตอนนี้ (อ่านจาก `onlineUsers` ใน `index.js`)
   - ผู้ใช้งานแต่ละวันย้อนหลัง 14 วัน (นับจากการเปิดเว็บ, การ login และการส่งข้อความ)
   - ออนไลน์พร้อมกันสูงสุดของแต่ละวัน และสถิติสูงสุดตลอดกาล
3. `UsageTab.jsx` แสดงเป็นการ์ดตัวเลข กราฟ และรายชื่อคนออนไลน์ อัปเดตเองเมื่อได้ event `online-users` และทุก 1 นาที

### 10.9 กล่องข้อความ (SweetAlert2)
ทุกที่ที่ต้องแจ้งเตือนหรือถามยืนยันใช้ `utils/dialog.js` ซึ่งเรียก SweetAlert2 กล่องแบบนี้ไม่หยุดรอเหมือน `confirm` ของเบราว์เซอร์ จึงต้องรอคำตอบด้วย `await`
```js
const confirmed = await askConfirm('ยืนยันการลบข้อความนี้?');
if (!confirmed) return;
```
กด Esc หรือปุ่มย้อนกลับบนมือถือตอนกล่องเปิดอยู่ จะปิดแค่กล่อง ไม่ปิดหน้าต่างที่อยู่ข้างหลัง

### 10.10 เสียงแจ้งเตือน
เสียงไม่ได้ใช้ไฟล์เสียง เบราว์เซอร์สร้างเสียงเองด้วย Web Audio API โค้ดทั้งหมดอยู่ใน `frontend/src/settings.js`

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `SOUND_TYPES` | รายชื่อเสียง: ติ๊ง (`ding`), ป๊อป (`pop`), กระดิ่ง (`bell`), กริ๊ง (`chime`) |
| `getAudio()` | สร้าง `AudioContext` ครั้งเดียวแล้วใช้ซ้ำ (ถ้าสร้างใหม่ทุกครั้ง เบราว์เซอร์อาจหยุดเล่นเสียง) |
| `playTone(frequency, endFrequency, start, length, volume, wave)` | สร้างโทน 1 เสียง ค่อยๆ ดังขึ้นแล้วเบาลงเพื่อไม่ให้มีเสียงแตก |
| `playPattern(type, volume, start)` | กำหนดว่าแต่ละเสียงประกอบจากโทนอะไร ถ้าจะแก้เสียงให้แก้ที่นี่ |
| `previewSound(type, volumePercent, isMention)` | เล่นเสียงทันที ใช้กับปุ่มทดลองเสียง |
| `playSound(kind)` | เล่นเสียงตามการตั้งค่าของผู้ใช้ (`sound`, `soundType`, `volume`) ถ้า `kind` เป็น `'mention'` จะดัง 2 ครั้ง |

แต่ละเสียงทำจากอะไร
- ติ๊ง: 880 Hz ยาว 0.25 วินาที
- ป๊อป: ลดจาก 700 Hz ลงไป 180 Hz
- กระดิ่ง: 660 Hz กับ 1320 Hz พร้อมกัน แล้วค่อยๆ เบาลง
- กริ๊ง: 784 Hz แล้วต่อด้วย 1047 Hz

เล่นเสียงตอนไหน
- `useMessageAlerts.js`: ข้อความใหม่ (DM, แชทกลุ่ม, ได้รับมอบหมายงาน, ข้อความใน Channel ถ้าเปิดไว้) ถ้าถูกแท็กเรียก `playSound('mention')`
- `useNotifications.js`: แจ้งเตือนใหม่ทุกประเภท เช่น ตอบในเธรด งานใกล้ครบกำหนด นัดวันนี้ VIP

ไม่เล่นเสียงเมื่อ สถานะเป็น "ไม่ว่าง", ห้องถูกปิดเสียง, ข้อความจากคนที่บล็อก, หรือเปิดห้องนั้นดูอยู่
`playSound` จะไม่เล่นซ้ำภายใน 0.4 วินาที เพราะบางเหตุการณ์ (เช่นถูกแท็ก) ได้ทั้งข้อความและแจ้งเตือนพร้อมกัน

ค่าที่บันทึก: `settings.soundType` และ `settings.volume` (0–100) เก็บใน localStorage และในคอลัมน์ `users.settings` (JSONB)

ข้อควรรู้: เบราว์เซอร์ไม่ยอมเล่นเสียงจนกว่าผู้ใช้จะคลิกหน้าเว็บอย่างน้อย 1 ครั้ง

ถ้าอยากใช้ไฟล์เสียงจริง วางไฟล์ที่ `frontend/public/sounds/` แล้วเล่นด้วย
```js
const sound = new Audio('/sounds/ding.mp3');
sound.volume = volumePercent / 100;
sound.play();
```

---

## 11. ระบบสิทธิ์

### สิทธิ์ในระบบ (`users.system_role`)
| Role | ทำอะไรได้ |
|---|---|
| `administrator` | ทุกอย่างใน Admin Dashboard เข้าดูทุกกลุ่มได้ (อ่านอย่างเดียว) |
| `staff` | ระงับบัญชี Member, จัดการ VIP, ดูผู้ใช้และกลุ่ม, ดู Log ของตัวเอง |
| `member` | ผู้ใช้ทั่วไป |

### สิทธิ์ในกลุ่ม (16 ตัว)
`administrator`, `manage_group`, `manage_roles`, `manage_members`, `manage_nicknames`, `change_nickname`, `manage_channels`, `create_projects`, `manage_projects`, `manage_messages`, `ban_members`, `timeout_members`, `create_invites`, `manage_events`, `mention_everyone`, `view_logs`

### วิธีคิดสิทธิ์ (`utils/permissions.js`)
1. ไม่ใช่สมาชิก → ไม่มีสิทธิ์อะไรเลย
2. เป็นเจ้าของกลุ่ม → มีทุกสิทธิ์
3. รวมสิทธิ์จากทุก Role ที่ได้ (Role เริ่มต้น `Member` ทุกคนได้อัตโนมัติ) ถ้ามี `administrator` = มีทุกสิทธิ์
4. ชื่อและสีที่แสดงใช้ Role แรกที่ไม่ใช่ Role เริ่มต้น

**Channel ส่วนตัว:** ถ้า Channel กำหนด `allowedRoleIds` ไว้ จะเห็นได้เฉพาะคนที่มี Role นั้น เจ้าของ หรือคนที่มีสิทธิ์ `manage_channels`

**Project:** เห็นได้เฉพาะสมาชิก Project เจ้าของกลุ่ม หรือคนที่มีสิทธิ์ `manage_projects`

frontend ใช้ฟังก์ชันชุดเดียวกันเพื่อซ่อนปุ่มที่กดไม่ได้ แต่ **backend เช็คซ้ำทุกครั้ง** ต่อให้มีคนแก้โค้ดหน้าเว็บก็ทำสิ่งที่ไม่มีสิทธิ์ไม่ได้

---

## 12. ความปลอดภัย

| เรื่อง | ทำยังไง |
|---|---|
| รหัสผ่าน | แฮชด้วย bcrypt ไม่เก็บรหัสจริง |
| Token | สุ่ม 32 byte เก็บในฐานข้อมูลเป็นแฮช SHA-256 ถ้าฐานข้อมูลหลุดก็เอา token ไปใช้ไม่ได้ อายุ 30 วัน |
| เดารหัสผ่าน | ผิด 5 ครั้งใน 15 นาที ล็อกชั่วคราว (ทั้ง login และรีเซ็ตรหัส) |
| ปลอมตัวเป็นคนอื่น | backend รู้ว่าใครเป็นคนส่งจาก token เท่านั้น ทุก controller ใช้ `req.userId` ที่ `requireAuth` ใส่ให้ ไม่อ่าน userId จากสิ่งที่หน้าเว็บส่งมาเลย |
| แก้ข้อมูลคนอื่น | `requireSelf` และการเช็คสิทธิ์ทุก controller |
| SQL Injection | ใช้ `$1, $2` (parameterized query) ทุกที่ ส่วนชื่อคอลัมน์ที่ต่อเข้า SQL ต้องอยู่ใน `PLACE_COLUMNS` |
| XSS | React escape ข้อความให้เอง และ `MessageText` สร้าง element เองไม่ใช้ HTML ดิบ |
| ไฟล์อันตราย | จำกัดนามสกุล, เช็ค magic number ของรูป, สุ่มชื่อไฟล์, ไฟล์ที่ไม่ใช่รูป/PDF บังคับให้ดาวน์โหลด, ใส่ `Content-Security-Policy: sandbox` |
| ข้อมูลรั่วตามสิทธิ์ | `viewGroupFor` ซ่อนรายชื่อคนถูกแบนและลิงก์เชิญจากคนไม่มีสิทธิ์ และ Socket ส่งข้อมูลกลุ่มที่กรองแล้วให้แต่ละคน |
| Error | error 500 ไม่บอกรายละเอียดของระบบให้ผู้ใช้ |
| คลิกแฝง (Clickjacking) | `X-Frame-Options: DENY` |
