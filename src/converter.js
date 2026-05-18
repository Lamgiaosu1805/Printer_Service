const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/print-service';
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const OFFICE_EXTS = ['.doc', '.docx', '.odt', '.rtf', '.xls', '.xlsx', '.ods', '.csv', '.ppt', '.pptx', '.odp'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp', '.heic'];

function getLibreOffice() {
  const candidates = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/libreoffice',
    '/usr/bin/soffice',
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function isMac() {
  return os.platform() === 'darwin';
}

function hasImageMagick() {
  try {
    execSync('convert --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const EXCEL_EXTS = ['.xlsx', '.ods'];

async function setFitToPage(filePath) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    workbook.worksheets.forEach(sheet => {
      sheet.pageSetup.fitToPage = true;
      sheet.pageSetup.fitToWidth = 1;
      sheet.pageSetup.fitToHeight = 0;
    });
    await workbook.xlsx.writeFile(filePath);
  } catch (e) {
    console.warn('[Converter] Không set được fitToPage:', e.message);
  }
}

async function imageToPdf(srcPath, outPath) {
  if (isMac()) {
    // Mac: dùng sips (có sẵn, không cần cài)
    execSync(`sips -s format pdf "${srcPath}" --out "${outPath}"`, { timeout: 30000 });
  } else if (hasImageMagick()) {
    // Ubuntu: dùng ImageMagick
    execSync(`convert "${srcPath}" "${outPath}"`, { timeout: 30000 });
  } else {
    // Fallback: cài ImageMagick tự động
    throw new Error('Cần cài ImageMagick: sudo apt-get install -y imagemagick');
  }

  if (!fs.existsSync(outPath)) {
    throw new Error('Convert ảnh sang PDF thất bại');
  }
}

async function toPdf(srcPath, originalName, { fitToPage = false } = {}) {
  const ext = path.extname(originalName).toLowerCase();
  const outPath = srcPath + '.pdf';

  // Đã là PDF
  if (ext === '.pdf') {
    fs.renameSync(srcPath, outPath);
    return outPath;
  }

  // Ảnh
  if (IMAGE_EXTS.includes(ext)) {
    const srcWithExt = srcPath + ext;
    fs.renameSync(srcPath, srcWithExt);
    let imgPath = srcWithExt;
    let heicTmp = null;
    try {
      // HEIC trên Linux: convert sang JPG trước bằng heif-convert
      if (ext === '.heic' && !isMac()) {
        heicTmp = srcPath + '.jpg';
        execSync(`heif-convert "${srcWithExt}" "${heicTmp}"`, { timeout: 30000 });
        imgPath = heicTmp;
      }
      await imageToPdf(imgPath, outPath);
    } finally {
      if (fs.existsSync(srcWithExt)) fs.unlinkSync(srcWithExt);
      if (heicTmp && fs.existsSync(heicTmp)) fs.unlinkSync(heicTmp);
    }
    return outPath;
  }

  // Word / Excel / PowerPoint
  if (OFFICE_EXTS.includes(ext)) {
    const soffice = getLibreOffice();
    if (!soffice) throw new Error('LibreOffice chưa được cài trên server');

    const srcWithExt = srcPath + ext;
    fs.renameSync(srcPath, srcWithExt);

    if (fitToPage && EXCEL_EXTS.includes(ext)) {
      await setFitToPage(srcWithExt);
    }

    execSync(`"${soffice}" --headless --convert-to pdf --outdir "${TEMP_DIR}" "${srcWithExt}"`, {
      timeout: 60000,
    });

    const base = path.basename(srcWithExt, ext);
    const converted = path.join(TEMP_DIR, base + '.pdf');
    if (!fs.existsSync(converted)) throw new Error('LibreOffice convert thất bại');

    fs.renameSync(converted, outPath);
    if (fs.existsSync(srcWithExt)) fs.unlinkSync(srcWithExt);
    return outPath;
  }

  throw new Error(`Định dạng không hỗ trợ: ${ext}`);
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch { }
  }
}

module.exports = { toPdf, cleanup, TEMP_DIR, OFFICE_EXTS, IMAGE_EXTS };