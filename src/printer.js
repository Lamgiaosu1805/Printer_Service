const net = require('net');
const fs = require('fs');

const PRINTER_IP = process.env.PRINTER_IP;
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT) || 9100;

function checkStatus() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.destroy();
      resolve({ online: true, ip: PRINTER_IP, port: PRINTER_PORT });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ online: false, error: 'Timeout sau 3 giây' });
    });
    socket.on('error', (err) => {
      resolve({ online: false, error: err.message });
    });
  });
}

function parsePageRange(str, total) {
  const pages = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      for (let i = s; i <= Math.min(e, total); i++) if (i >= 1) pages.add(i);
    } else {
      const n = Number(part);
      if (n >= 1 && n <= total) pages.add(n);
    }
  });
  return [...pages].sort((a, b) => a - b);
}

async function applyPageRange(pdfBuffer, pageRange) {
  if (!pageRange || pageRange === 'all') return pdfBuffer;
  const { PDFDocument } = require('pdf-lib');
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const total = srcDoc.getPageCount();
  const pages = parsePageRange(pageRange, total);
  if (pages.length === 0 || pages.length === total) return pdfBuffer;
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, pages.map(p => p - 1));
  copied.forEach(page => newDoc.addPage(page));
  return Buffer.from(await newDoc.save());
}

const PAPER_MAP = { a4: 'A4', a3: 'A3', a5: 'A5', letter: 'LETTER' };

function buildPjlHeader({ copies, duplex, paperSize, orientation, jobName }) {
  const paper = PAPER_MAP[(paperSize || 'a4').toLowerCase()] || 'A4';
  const orient = (orientation || 'portrait').toUpperCase();

  const lines = [
    '\x1B%-12345X@PJL',
    `@PJL JOB NAME="${jobName}"`,
    `@PJL SET COPIES=${copies}`,
    `@PJL SET PAPER=${paper}`,
    `@PJL SET ORIENTATION=${orient}`,
    `@PJL SET DUPLEX=${duplex ? 'ON' : 'OFF'}`,
  ];

  if (duplex) {
    lines.push(`@PJL SET BINDING=${orientation === 'landscape' ? 'SHORTEDGE' : 'LONGEDGE'}`);
  }

  lines.push('@PJL ENTER LANGUAGE=PDF');
  return Buffer.from(lines.join('\r\n') + '\r\n');
}

async function print(pdfPath, {
  copies = 1,
  duplex = false,
  paperSize = 'A4',
  orientation = 'portrait',
  pageRange = 'all',
  jobName = 'PrintJob',
} = {}) {
  let fileData = fs.readFileSync(pdfPath);
  fileData = await applyPageRange(fileData, pageRange);

  const pjlHeader = buildPjlHeader({ copies, duplex, paperSize, orientation, jobName });

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(30000);
    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      socket.write(pjlHeader);
      socket.write(fileData);
      socket.end();
    });
    socket.on('close', resolve);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Timeout khi gửi file tới máy in'));
    });
    socket.on('error', reject);
  });
}

module.exports = { checkStatus, print };
