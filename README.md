# Print Service

Service Node.js Express độc lập, nhận lệnh in từ hệ thống HRM/CRM nội bộ và gửi tới máy in qua cổng 9100.

## Cấu trúc

```
print-service/
├── index.js
├── .env                  ← cấu hình IP máy in, secret key
├── package.json
└── src/
    ├── app.js            ← Express app chính
    ├── printer.js        ← Kết nối máy in qua RAW port 9100
    ├── converter.js      ← Convert Word/Excel/ảnh → PDF
    ├── middleware/
    │   └── auth.js       ← Xác thực x-api-secret header
    └── routes/
        └── print.js      ← Các API endpoint
```

---

## Chạy local (test)

```bash
npm install
npm run dev
```

---

## Deploy lên server

### 1. Yêu cầu server
- Node.js >= 18
- LibreOffice (để in Word/Excel)
- Cùng mạng LAN với máy in

### 2. Cài đặt

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs libreoffice

# Copy project lên server
scp -r print-service/ user@server:/opt/print-service
cd /opt/print-service && npm install
```

### 3. Cấu hình .env

```env
PORT=3000
PRINTER_IP=192.168.100.223
PRINTER_PORT=9100
API_SECRET=your-secret-key-change-this
```

### 4. Chạy với PM2

```bash
npm install -g pm2
pm2 start index.js --name print-service
pm2 save && pm2 startup
```

---

## API

Tất cả endpoints (trừ /health) đều cần header:
```
x-api-secret: your-secret-key
```

### GET /health
Kiểm tra service còn sống.

### GET /api/status
Kiểm tra máy in online.

```json
{
  "ok": true,
  "printer": { "ip": "192.168.100.223", "port": 9100, "status": "online" }
}
```

### POST /api/print
Gửi lệnh in.

**Request:** `multipart/form-data`

| Field | Type | Mô tả |
|-------|------|-------|
| `file` | File | File cần in (PDF, Word, Excel, ảnh) |
| `copies` | number | Số bản in (mặc định: 1) |
| `user` | string | Tên người in (để log) |
| `jobName` | string | Tên job in |

**Response:**
```json
{
  "ok": true,
  "message": "Gửi lệnh in thành công",
  "file": "baocao.docx",
  "copies": 2,
  "user": "nguyen.van.a"
}
```

---

## Tích hợp từ HRM/CRM (ví dụ Node.js)

```js
const FormData = require('form-data');
const axios    = require('axios');
const fs       = require('fs');

async function printFile(filePath, fileName, user, copies = 1) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), fileName);
  form.append('user', user);
  form.append('copies', copies);

  const res = await axios.post('http://PRINT-SERVER-IP:3000/api/print', form, {
    headers: {
      ...form.getHeaders(),
      'x-api-secret': 'your-secret-key',
    },
  });
  return res.data;
}
```

---

## Test bằng Postman

```
POST http://localhost:3000/api/print
Headers:
  x-api-secret: your-secret-key
Body: form-data
  file   → [chọn file]
  copies → 1
  user   → nguyen.van.a
```
