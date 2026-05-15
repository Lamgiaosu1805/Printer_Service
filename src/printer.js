const net = require('net');
const fs  = require('fs');

const PRINTER_IP   = process.env.PRINTER_IP;
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT) || 9100;

/**
 * Kiểm tra máy in online
 */
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

/**
 * Gửi file PDF tới máy in qua RAW/JetDirect port 9100
 */
function print(pdfPath, { copies = 1, jobName = 'PrintJob' } = {}) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(pdfPath);
    const socket   = new net.Socket();
    socket.setTimeout(30000);

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      const header = Buffer.from(
        `\x1B%-12345X@PJL\r\n` +
        `@PJL JOB NAME="${jobName}"\r\n` +
        `@PJL SET COPIES=${copies}\r\n` +
        `@PJL ENTER LANGUAGE=PDF\r\n`
      );
      const footer = Buffer.from(`\r\n\x1B%-12345X@PJL EOJ\r\n\x1B%-12345X`);
      socket.write(header);
      socket.write(fileData);
      socket.write(footer);
      socket.end();
    });

    socket.on('close', () => resolve());
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Timeout khi gửi file tới máy in'));
    });
    socket.on('error', reject);
  });
}

module.exports = { checkStatus, print };
