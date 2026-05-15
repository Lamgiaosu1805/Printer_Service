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

function print(pdfPath, { copies = 1, duplex = false, jobName = 'PrintJob' } = {}) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(pdfPath);
    const socket = new net.Socket();
    socket.setTimeout(30000);

    socket.connect(PRINTER_PORT, PRINTER_IP, () => {
      if (duplex) {
        // Dùng PJL chỉ khi in 2 mặt
        const pjlHeader = Buffer.from(
          `\x1B%-12345X@PJL\r\n` +
          `@PJL SET DUPLEX=ON\r\n` +
          `@PJL SET BINDING=LONGEDGE\r\n` +
          `@PJL ENTER LANGUAGE=PDF\r\n`
        );
        socket.write(pjlHeader);
        socket.write(fileData);
        socket.end();
      } else {
        // In 1 mặt: gửi thẳng PDF như nc
        socket.write(fileData);
        socket.end();
      }
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