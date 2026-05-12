# 🏥 Astique Clinic — Mounjaro Tracker
## คู่มือ Deploy ทีละขั้นตอน

---

## ขั้นตอนที่ 1 — สร้าง Firebase (ฟรี)

1. ไปที่ **https://console.firebase.google.com**
2. กด **"Create a project"** → ตั้งชื่อ เช่น `astique-mounjaro`
3. ปิด Google Analytics → กด **Create project**
4. เมื่อเสร็จ กด **Continue**

### สร้าง Firestore Database
5. เมนูซ้าย → **Build → Firestore Database**
6. กด **Create database**
7. เลือก **Start in test mode** → กด Next
8. เลือก Region: **asia-southeast1 (Singapore)** → กด Enable

### เอา Config
9. กดไอคอน ⚙️ (Project settings) มุมบนซ้าย
10. เลื่อนลงหา **"Your apps"** → กด **</>** (Web)
11. ตั้งชื่อ app → กด **Register app**
12. **copy ค่า firebaseConfig** ทั้งหมด จะได้หน้าตาแบบนี้:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "astique-mounjaro.firebaseapp.com",
  projectId: "astique-mounjaro",
  storageBucket: "astique-mounjaro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

13. **เปิดไฟล์ `src/firebase.js`** แล้วแทนที่ค่า YOUR_xxx ด้วยค่าที่ copy มา

---

## ขั้นตอนที่ 2 — Deploy บน Vercel (ฟรี)

### วิธีที่ง่ายที่สุด — ผ่าน GitHub

1. ไปที่ **https://github.com** → สมัครหรือ login
2. กด **New repository** → ตั้งชื่อ `astique-mounjaro` → กด Create
3. **Upload ไฟล์ทั้งหมดในโฟลเดอร์นี้** ขึ้น GitHub
   - กด **uploading an existing file**
   - ลากโฟลเดอร์ทั้งหมดวาง
   - กด **Commit changes**

4. ไปที่ **https://vercel.com** → สมัครด้วย GitHub
5. กด **Add New Project** → เลือก repo `astique-mounjaro`
6. กด **Deploy** — รอประมาณ 1-2 นาที
7. ได้ link เช่น **`https://astique-mounjaro.vercel.app`** ✅

---

## ขั้นตอนที่ 3 — ส่ง Link ให้คนไข้

ส่ง link นี้ใน Line ให้คนไข้ได้เลยครับ:
```
https://astique-mounjaro.vercel.app
```

**คนไข้:** กดลิงก์ → กรอกชื่อ → บันทึกได้เลย
**หมอทิพย์:** กดลิงก์ → กด 🔒 มุมขวาบน → ใส่ PIN → ดูคนไข้ทั้งหมด

---

## เปลี่ยน PIN หมอ

เปิดไฟล์ `src/App.js` บรรทัด:
```js
const DOCTOR_PIN = "1234"; // ← เปลี่ยนตรงนี้
```

---

## ถ้าติดปัญหา

ส่งรูป error มาใน Claude ได้เลยครับ จะช่วยแก้ให้
