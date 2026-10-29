# Assignment08 : next-room-reserve-app
## ระบบห้องประชุมและการจอง (Meeting Room and Reservation System)

โครงงานพัฒนา API และ Web Application สำหรับระบบจัดการห้องประชุมและการจองเวลาใช้งาน ด้วย Next.js (App Router), Prisma และ MySQL

---

### ข้อกำหนดฐานข้อมูล
- ฐานข้อมูล: `room_reserve_db` (MySQL)
- ตาราง:
  1. `Room` (ห้องประชุม): `id`, `roomCode`, `roomName`, `capacity`, `location`, `createdAt`, `updatedAt`
  2. `Booking` (การจอง): `id`, `bookerName`, `purpose`, `startTime`, `endTime`, `attendeeCount`, `roomId`, `createdAt`, `updatedAt`
- ความสัมพันธ์: ห้องหนึ่งมีการจองได้หลายรายการ และการจองหนึ่งรายการต้องระบุห้องเดียว (1-to-Many)

---

### รายชื่อ 15 RESTful APIs

1. `POST /api/rooms` - เพิ่มห้องประชุม (roomCode ห้ามซ้ำ, capacity > 0, ข้อความห้ามว่าง)
2. `GET /api/rooms` - แสดงรายการห้อง (รองรับ `search`, `minCapacity`)
3. `GET /api/rooms/[id]` - แสดงรายละเอียดห้องตาม ID (404 หากไม่พบ)
4. `PATCH /api/rooms/[id]` - แก้ไขข้อมูลห้อง (ห้ามลดความจุต่ำกว่าผู้เข้าร่วมของรายการจองที่ยังไม่สิ้นสุด)
5. `DELETE /api/rooms/[id]` - ลบห้อง (ลบได้เฉพาะห้องที่ไม่มีรายการจอง หากมีตอบ 409)
6. `GET /api/rooms/[id]/bookings` - รายการจองของห้องนั้น (รองรับ `from` และ `to` ตรวจเวลาทับซ้อน)
7. `GET /api/rooms/available` - ค้นหาห้องว่าง (`startTime`, `endTime`, `attendeeCount`)
8. `POST /api/bookings` - เพิ่มการจอง (ตรวจห้องมีจริง, เวลาเริ่มเป็นอนาคต, เริ่ม < สิ้นสุด, คนไม่เกินความจุ, ไม่ทับซ้อน)
9. `GET /api/bookings` - รายการจองพร้อมข้อมูลห้อง (รองรับ `search`, `roomId`, `page`, `limit`)
10. `GET /api/bookings/[id]` - รายละเอียดการจองตาม ID (404 หากไม่พบ)
11. `PATCH /api/bookings/[id]` - แก้ไขการจอง/ย้ายห้อง/เปลี่ยนเวลา (อนุญาตเฉพาะที่ยังไม่เริ่มใช้งาน)
12. `DELETE /api/bookings/[id]` - ยกเลิกการจอง (อนุญาตเฉพาะที่ยังไม่เริ่ม หากเริ่มแล้วตอบ 409)
13. `GET /api/bookings/upcoming` - รายการจองที่เริ่มตั้งแต่ปัจจุบันถึงอีก `days` วัน (1–30 วัน, ค่าเริ่มต้น 7)
14. `GET /api/bookings/stats` - สรุปการจองและชั่วโมงที่จอง แยกตามห้อง (`from` ถึงก่อน `to`)
15. `DELETE /api/bookings/expired` - ลบประวัติการจองที่หมดอายุ (`endTime < before` โดย `before <= now`)

---

### วิธีการรันโปรเจกต์

1. เริ่มการทำงานของ MySQL Server (XAMPP):
```bash
# ตรวจสอบฐานข้อมูล room_reserve_db
```

2. ซิงค์ฐานข้อมูลด้วย Prisma:
```bash
npx prisma db push
```

3. Seed ข้อมูลตัวอย่างเริ่มต้น:
```bash
node prisma/seed.mjs
```

4. รัน Dev Server:
```bash
npm run dev
```
เปิดใช้งานที่: `http://localhost:3000`

5. รันการทดสอบ 15 APIs ครบทุกเงื่อนไข:
```bash
node scripts/test-all-15-apis.mjs
```
