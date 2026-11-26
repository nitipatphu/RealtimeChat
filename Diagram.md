# Flowchart และ ER Diagram


---

## Flowchart

### 1. ภาพรวมการใช้งานระบบ

```mermaid
flowchart TD
    A([เปิดเว็บ]) --> B{มี Token อยู่แล้วไหม}
    B -- ไม่มี --> C[หน้า Login / สมัครสมาชิก]
    C --> D[เข้าสู่ระบบ]
    B -- มี --> E[หน้าแรก]
    D --> E

    E --> F{ผู้ใช้เลือกทำอะไร}
    F --> G[กด + สร้างกลุ่ม หรือเข้าร่วมกลุ่ม]
    F --> H[เลือกกลุ่ม]
    F --> I[ข้อความส่วนตัว DM / แชทกลุ่ม]
    F --> J[ภาพรวมของฉัน]
    F --> K{เป็น Admin หรือ Staff ไหม}

    G --> H
    H --> L{เลือกเมนูในกลุ่ม}
    L --> M[แชทใน Channel]
    L --> N[Project บอร์ดงาน]
    L --> O[ปฏิทินกลุ่ม]
    L --> P[ตั้งค่ากลุ่ม Role และสิทธิ์]

    K -- ใช่ --> Q[Admin / Staff Dashboard]
    K -- ไม่ใช่ --> E

    M --> R([ออกจากระบบ])
    N --> R
    O --> R
    P --> R
    I --> R
    J --> R
    Q --> R
```

### 2. การเข้าสู่ระบบ (Login)

```mermaid
flowchart TD
    A([กรอกอีเมลและรหัสผ่าน]) --> B{ใส่รหัสผิดเกิน 5 ครั้ง ใน 15 นาทีไหม}
    B -- ใช่ --> C[แจ้งว่าถูกล็อกชั่วคราว ให้รอก่อน]
    C --> Z([จบ])
    B -- ไม่ใช่ --> D[หาผู้ใช้จากอีเมล]
    D --> E{เจอผู้ใช้ และ bcrypt เช็ครหัสผ่านตรงไหม}
    E -- ไม่ตรง --> F[นับครั้งที่ใส่ผิด +1]
    F --> G[แจ้งว่าอีเมลหรือรหัสผ่านไม่ถูกต้อง]
    G --> Z
    E -- ตรง --> H{บัญชีถูกระงับไหม}
    H -- ใช่ --> I[แจ้งว่าบัญชีถูกระงับ]
    I --> Z
    H -- ไม่ใช่ --> J[ล้างจำนวนครั้งที่ใส่ผิด]
    J --> K[สร้าง Token อายุ 30 วัน เก็บแบบแฮชลงตาราง sessions]
    K --> L[ส่ง Token กลับไปให้หน้าเว็บ]
    L --> M([เข้าหน้าแรก])
```

### 3. การส่งข้อความในแชท (เรียลไทม์)

```mermaid
flowchart TD
    A([พิมพ์ข้อความแล้วกดส่ง]) --> B{มีข้อความ ไฟล์ หรือโพลไหม}
    B -- ไม่มี --> C[แจ้งว่ากรุณาพิมพ์ข้อความ]
    C --> Z([จบ])
    B -- มี --> D{มีสิทธิ์เข้า Channel นี้ไหม}
    D -- ไม่มี --> E[แจ้งว่าไม่มีสิทธิ์]
    E --> Z
    D -- มี --> F{โดน Timeout อยู่ไหม}
    F -- ใช่ --> G[แจ้งว่าส่งข้อความไม่ได้ชั่วคราว]
    G --> Z
    F -- ไม่ใช่ --> H[บันทึกข้อความลงตาราง messages]
    H --> I{มี @mention หรือเป็นการตอบในเธรดไหม}
    I -- มี --> J[สร้างแจ้งเตือนลงตาราง notifications]
    I -- ไม่มี --> K
    J --> K[Socket.io ส่งข้อความไปให้ทุกคนใน Channel]
    K --> L([ข้อความขึ้นหน้าจอทุกคนทันที])
```

---

## ER Diagram

ทั้งหมดมี 40 ตาราง แบ่งเป็น 5 ส่วนให้ดูง่าย

PK = Primary Key, FK = Foreign Key

### ส่วนที่ 1 ผู้ใช้ และ VIP

```mermaid
erDiagram
    users ||--o{ sessions : "login"
    users ||--o{ user_blocks : "บล็อก"
    users ||--o{ muted_rooms : "ปิดแจ้งเตือน"
    users ||--o{ read_markers : "อ่านถึงตรงไหน"
    users ||--o| user_vip : "เป็น VIP"
    users ||--o{ vip_codes : "สร้างรหัส"
    vip_codes ||--o{ vip_code_uses : "ถูกใช้"
    users ||--o{ vip_code_uses : "ใช้รหัส"
    users ||--o{ clips : "เก็บคลิป"
    users ||--o{ notifications : "ได้รับ"
    users ||--o{ admin_logs : "ทำรายการ"

    users {
        text id PK
        text name
        text email
        text password_hash
        text system_role
        text account_status
        text suspend_reason
        text avatar
        text title
        text bio
        text banner_color
        text presence
        jsonb settings
        jsonb custom_theme
        text reset_code
        timestamptz reset_expires
        timestamptz created_at
        timestamptz last_login_at
    }
    sessions {
        text token PK
        text user_id FK
        timestamptz created_at
        timestamptz expires_at
    }
    user_blocks {
        text user_id PK, FK
        text blocked_user_id PK, FK
        timestamptz created_at
    }
    muted_rooms {
        text user_id PK, FK
        text room_key PK
    }
    read_markers {
        text user_id PK, FK
        text room_key PK
        timestamptz last_read_at
    }
    tier_settings {
        text tier PK
        int file_mb
        text_array preset_themes
        boolean custom_theme
    }
    user_vip {
        text user_id PK, FK
        text tier
        timestamptz since
        timestamptz expires_at
        text granted_by FK
        text source
        timestamptz warned_for
    }
    vip_codes {
        text code PK
        text tier
        int days
        int max_uses
        text note
        text created_by FK
        timestamptz created_at
    }
    vip_code_uses {
        text code PK, FK
        text user_id PK, FK
        timestamptz used_at
    }
    clips {
        text id PK
        text user_id FK
        text title
        text text
        boolean pinned
        text source
        timestamptz created_at
        timestamptz updated_at
    }
    notifications {
        text id PK
        text user_id FK
        text type
        text title
        text body
        jsonb target
        boolean is_read
        timestamptz created_at
    }
    admin_logs {
        text id PK
        text action
        text actor_id FK
        text text
        timestamptz created_at
    }
```

`tier_settings` ไม่ได้ต่อกับตารางไหน เป็นตารางตั้งค่าว่า VIP แต่ละระดับอัปโหลดไฟล์ได้กี่ MB และใช้ธีมอะไรได้

### ส่วนที่ 2 กลุ่ม Role และการดูแลกลุ่ม

```mermaid
erDiagram
    users ||--o{ groups : "เป็นเจ้าของ"
    groups ||--o{ group_members : "มีสมาชิก"
    users ||--o{ group_members : "อยู่ในกลุ่ม"
    groups ||--o{ group_roles : "มี Role"
    group_members ||--o{ member_roles : "ได้ Role"
    group_roles ||--o{ member_roles : "ให้กับสมาชิก"
    groups ||--o{ group_bans : "แบน"
    users ||--o{ group_bans : "ถูกแบน"
    groups ||--o{ group_invites : "ลิงก์เชิญ"
    groups ||--o{ group_events : "อีเวนต์"
    groups ||--o{ group_logs : "ประวัติ"

    users {
        text id PK
        text name
    }
    groups {
        text id PK
        text name
        text description
        text visibility
        text color
        text icon
        text owner_id FK
        text invite_code
        timestamptz created_at
    }
    group_members {
        text group_id PK, FK
        text user_id PK, FK
        text nickname
        timestamptz timeout_until
        timestamptz joined_at
    }
    group_roles {
        text id PK
        text group_id FK
        text name
        text color
        text_array permissions
        boolean hoist
        boolean is_default
        int position
    }
    member_roles {
        text group_id PK, FK
        text user_id PK, FK
        text role_id PK, FK
    }
    group_bans {
        text group_id PK, FK
        text user_id PK, FK
        text reason
        text banned_by FK
        timestamptz created_at
    }
    group_invites {
        text code PK
        text group_id FK
        text created_by FK
        timestamptz created_at
        timestamptz expires_at
        int max_uses
        int uses
    }
    group_events {
        text id PK
        text group_id FK
        text title
        date event_date
        time event_time
        text description
        text created_by FK
        timestamptz created_at
        date reminded_for
    }
    group_logs {
        text id PK
        text group_id FK
        text action
        text actor_id FK
        text text
        timestamptz created_at
    }
```

### ส่วนที่ 3 Channel และข้อความ

```mermaid
erDiagram
    groups ||--o{ channel_categories : "มีหมวดหมู่"
    groups ||--o{ channels : "มี Channel"
    channel_categories ||--o{ channels : "จัดกลุ่ม"
    channels ||--o{ channels : "Channel ย่อย"
    channels ||--o{ channel_allowed_roles : "จำกัดสิทธิ์"
    group_roles ||--o{ channel_allowed_roles : "เข้าได้"
    channels ||--o{ messages : "มีข้อความ"
    users ||--o{ messages : "เขียน"
    messages ||--o{ messages : "ตอบในเธรด"
    messages ||--o{ message_attachments : "แนบไฟล์"
    messages ||--o{ message_mentions : "แท็กชื่อ"
    messages ||--o{ message_reactions : "อีโมจิ"
    messages ||--o{ poll_options : "ตัวเลือกโพล"
    poll_options ||--o{ poll_votes : "ถูกโหวต"
    users ||--o{ poll_votes : "โหวต"

    groups {
        text id PK
        text name
    }
    group_roles {
        text id PK
        text name
    }
    users {
        text id PK
        text name
    }
    channel_categories {
        text id PK
        text group_id FK
        text name
        int position
    }
    channels {
        text id PK
        text group_id FK
        text parent_id FK
        text category_id FK
        text name
        int position
        timestamptz created_at
    }
    channel_allowed_roles {
        text channel_id PK, FK
        text role_id PK, FK
    }
    messages {
        text id PK
        text channel_id FK
        text project_channel_id FK
        text conversation_id FK
        text parent_id FK
        text author_id FK
        text author_name
        text author_avatar
        text text
        boolean is_edited
        timestamptz pinned_at
        text pinned_by FK
        text poll_question
        boolean poll_multiple
        timestamptz created_at
    }
    message_attachments {
        bigserial id PK
        text message_id FK
        text url
        text name
        text type
        int size
    }
    message_mentions {
        text message_id PK, FK
        text user_id PK, FK
    }
    message_reactions {
        text message_id PK, FK
        text user_id PK, FK
        text emoji PK
        timestamptz created_at
    }
    poll_options {
        text message_id PK, FK
        text id PK
        text text
        int position
    }
    poll_votes {
        text message_id PK, FK
        text option_id PK, FK
        text user_id PK, FK
    }
```

ข้อความ 1 ข้อความจะอยู่ได้แค่ที่เดียว คือ Channel หรือ Channel ของ Project หรือแชทส่วนตัว (ต้องมีค่าใน `channel_id`, `project_channel_id`, `conversation_id` แค่ช่องเดียว)

### ส่วนที่ 4 แชทส่วนตัว และตั้งเวลาส่งข้อความ

```mermaid
erDiagram
    users ||--o{ conversations : "สร้างแชท"
    conversations ||--o{ conversation_participants : "มีคนในแชท"
    users ||--o{ conversation_participants : "อยู่ในแชท"
    conversations ||--o{ messages : "มีข้อความ"
    users ||--o{ scheduled_messages : "ตั้งเวลาส่ง"
    channels ||--o{ scheduled_messages : "ส่งไป Channel"
    project_channels ||--o{ scheduled_messages : "ส่งไป Project"
    conversations ||--o{ scheduled_messages : "ส่งไปแชท"

    users {
        text id PK
        text name
    }
    channels {
        text id PK
        text name
    }
    project_channels {
        text id PK
        text name
    }
    messages {
        text id PK
        text conversation_id FK
        text text
    }
    conversations {
        text id PK
        text type
        text name
        text owner_id FK
        timestamptz created_at
    }
    conversation_participants {
        text conversation_id PK, FK
        text user_id PK, FK
        timestamptz joined_at
    }
    scheduled_messages {
        text id PK
        text user_id FK
        text text
        text target_type
        text channel_id FK
        text project_channel_id FK
        text conversation_id FK
        text dm_user_id FK
        text target_name
        timestamptz send_at
        timestamptz created_at
    }
```

### ส่วนที่ 5 Project และบอร์ดงาน

```mermaid
erDiagram
    groups ||--o{ projects : "มี Project"
    projects ||--o{ project_members : "มีสมาชิก"
    users ||--o{ project_members : "อยู่ใน Project"
    projects ||--o{ project_channels : "มีห้องแชท"
    projects ||--o{ board_columns : "มีคอลัมน์"
    projects ||--o{ tasks : "มีงาน"
    board_columns ||--o{ tasks : "อยู่ในคอลัมน์"
    tasks ||--o{ task_assignees : "มอบหมายให้"
    users ||--o{ task_assignees : "รับผิดชอบ"
    tasks ||--o{ task_checklist_items : "Checklist"
    tasks ||--o{ task_comments : "คอมเมนต์"
    users ||--o{ task_comments : "เขียนคอมเมนต์"

    groups {
        text id PK
        text name
    }
    users {
        text id PK
        text name
    }
    projects {
        text id PK
        text group_id FK
        text name
        timestamptz archived_at
        timestamptz created_at
    }
    project_members {
        text project_id PK, FK
        text user_id PK, FK
    }
    project_channels {
        text id PK
        text project_id FK
        text name
        timestamptz created_at
    }
    board_columns {
        text id PK
        text project_id FK
        text title
        int position
    }
    tasks {
        text id PK
        text project_id FK
        text column_id FK
        text title
        text description
        text priority
        date due_date
        int position
        text reminded_for
        timestamptz created_at
    }
    task_assignees {
        text task_id PK, FK
        text user_id PK, FK
    }
    task_checklist_items {
        text id PK
        text task_id FK
        text text
        boolean done
        int position
    }
    task_comments {
        text id PK
        text task_id FK
        text author_id FK
        text text
        timestamptz created_at
    }
```
