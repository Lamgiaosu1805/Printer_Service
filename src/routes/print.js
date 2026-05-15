const express = require('express');
const multer = require('multer');
const path = require('path');
const printer = require('../printer');
const { toPdf, cleanup, TEMP_DIR } = require('../converter');

const router = express.Router();

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Định dạng không hỗ trợ: ${ext}`));
    }
  },
});

// GET /api/status
router.get('/status', async (req, res) => {
  const status = await printer.checkStatus();
  res.json({
    ok: status.online,
    service: 'print-service',
    printer: {
      ip: process.env.PRINTER_IP,
      port: process.env.PRINTER_PORT,
      status: status.online ? 'online' : 'offline',
      error: status.error || null,
    },
  });
});

// POST /api/print
// form-data fields:
//   file    (required) — file cần in
//   copies  (optional) — số bản in, mặc định 1
//   duplex  (optional) — in 2 mặt: "true" hoặc "false", mặc định false
//   user    (optional) — tên người in
//   jobName (optional) — tên job
router.post('/print', upload.single('file'), async (req, res) => {
  const uploadedPath = req.file?.path;
  let pdfPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Thiếu file. Dùng field name: file' });
    }

    const { originalname, size } = req.file;
    const copies = Math.max(1, parseInt(req.body.copies) || 1);
    const duplex = req.body.duplex === 'true';
    const user = req.body.user || 'anonymous';
    const jobName = req.body.jobName || originalname;

    console.log(`[Print] ${user} → ${originalname} (${(size / 1024).toFixed(1)}KB) x${copies} duplex=${duplex}`);

    pdfPath = await toPdf(uploadedPath, originalname);
    await printer.print(pdfPath, { copies, duplex, jobName });

    console.log(`[Print] ✓ ${originalname}`);
    res.json({
      ok: true,
      message: 'Gửi lệnh in thành công',
      file: originalname,
      copies,
      duplex,
      user,
    });

  } catch (err) {
    console.error(`[Print] Lỗi:`, err.message);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    cleanup(uploadedPath, pdfPath !== uploadedPath ? pdfPath : null);
  }
});

module.exports = router;