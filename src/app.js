require('dotenv').config();

const express    = require('express');
const morgan     = require('morgan');
const helmet     = require('helmet');
const auth       = require('./middleware/auth');
const printRoute = require('./routes/print');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.LOG_FORMAT || 'dev'));
app.use(express.json());

// ── Health check (không cần auth) ─────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'print-service', printer: 'DocuCentre-IV 3065', time: new Date().toISOString() });
});

// ── Print API (cần auth) ───────────────────────────────────
app.use('/api', auth, printRoute);

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint không tồn tại' });
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ ok: false, error: err.message });
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Print Service đang chạy`);
  console.log(`  Port    : ${PORT}`);
  console.log(`  Máy in  : ${process.env.PRINTER_IP}:${process.env.PRINTER_PORT}`);
  console.log(`========================================\n`);
  console.log(`Endpoints:`);
  console.log(`  GET  /health         — health check`);
  console.log(`  GET  /api/status     — trạng thái máy in`);
  console.log(`  POST /api/print      — gửi lệnh in\n`);
});

module.exports = app;
