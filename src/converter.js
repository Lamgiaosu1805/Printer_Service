const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/print-service';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const OFFICE_EXTS = ['.doc', '.docx', '.odt', '.rtf', '.xls', '.xlsx', '.ods', '.csv', '.ppt', '.pptx', '.odp'];
const IMAGE_EXTS  = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'];

function getLibreOffice() {
  const candidates = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/libreoffice',
    '/usr/bin/soffice',
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

async function imageToPdf(srcPath, outPath) {
  const sharp = require('sharp');
  const meta  = await sharp(srcPath).metadata();
  const A4_W  = 595, A4_H = 842, margin = 40;
  const scale = Math.min((A4_W - margin * 2) / meta.width, (A4_H - margin * 2) / meta.height, 1);
  const imgW  = Math.round(meta.width  * scale);
  const imgH  = Math.round(meta.height * scale);
  const imgX  = margin + Math.round(((A4_W - margin * 2) - imgW) / 2);
  const imgY  = margin + Math.round(((A4_H - margin * 2) - imgH) / 2);

  const imgBuf = await sharp(srcPath).resize(imgW, imgH).jpeg({ quality: 90 }).toBuffer();
  const content = `q\n${imgW} 0 0 ${imgH} ${imgX} ${A4_H - imgY - imgH} cm\n/Img Do\nQ\n`;

  const header =
    `%PDF-1.4\n` +
    `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n` +
    `2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n` +
    `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${A4_W} ${A4_H}]/Contents 4 0 R/Resources<</XObject<</Img 5 0 R>>>>>>\nendobj\n` +
    `4 0 obj\n<</Length ${content.length}>>\nstream\n${content}\nendstream\nendobj\n` +
    `5 0 obj\n<</Type/XObject/Subtype/Image/Width ${imgW}/Height ${imgH}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${imgBuf.length}>>\nstream\n`;
  const footer = `\nendstream\nendobj\ntrailer\n<</Size 6/Root 1 0 R>>\n%%EOF\n`;

  const fd = fs.openSync(outPath, 'w');
  fs.writeSync(fd, header);
  fs.writeSync(fd, imgBuf);
  fs.writeSync(fd, footer);
  fs.closeSync(fd);
}

async function toPdf(srcPath, originalName) {
  const ext     = path.extname(originalName).toLowerCase();
  const outPath = srcPath + '.pdf';

  if (ext === '.pdf') {
    fs.renameSync(srcPath, outPath);
    return outPath;
  }

  if (IMAGE_EXTS.includes(ext)) {
    await imageToPdf(srcPath, outPath);
    return outPath;
  }

  if (OFFICE_EXTS.includes(ext)) {
    const soffice = getLibreOffice();
    if (!soffice) throw new Error('LibreOffice chưa được cài trên server');

    const srcWithExt = srcPath + ext;
    fs.renameSync(srcPath, srcWithExt);

    execSync(`"${soffice}" --headless --convert-to pdf --outdir "${TEMP_DIR}" "${srcWithExt}"`, {
      timeout: 60000,
    });

    const base = path.basename(srcWithExt, ext);
    const converted = path.join(TEMP_DIR, base + '.pdf');
    if (!fs.existsSync(converted)) throw new Error('LibreOffice convert thất bại');

    fs.renameSync(converted, outPath);
    fs.unlinkSync(srcWithExt);
    return outPath;
  }

  throw new Error(`Định dạng không hỗ trợ: ${ext}`);
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

module.exports = { toPdf, cleanup, TEMP_DIR, OFFICE_EXTS, IMAGE_EXTS };
