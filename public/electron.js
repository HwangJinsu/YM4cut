const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const sharp = require('sharp');

const PRINT_DPI = 300;
const PRINT_LONG_INCHES = 6;
const PRINT_SHORT_INCHES = 4;
const MM_PER_INCH = 25.4;
const PRINT_MARGIN_MM = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
const PRINT_BLEED_MM = {
  top: 2,
  right: 2.5,
  bottom: 3,
  left: 2.5,
};
const PRINT_RIGHT_FUDGE_MM = 2.2;
const PRINT_TOP_FUDGE_MM = -2;
const MICRONS_PER_INCH = 25400;
const CAMERA_NATIVE_RATIO = 3 / 2;

let PrinterModule;
try {
  PrinterModule = require('node-printer');
} catch (error) {
  console.warn('[printer] Failed to load node-printer module:', error);
  PrinterModule = null;
}

const isDev = !app.isPackaged;
let mainWindow = null;

function getMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  const [win] = BrowserWindow.getAllWindows();
  return win ?? null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 1920,
    kiosk: true,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(__dirname, 'index.html');
    mainWindow.loadFile(indexPath);
  }
}

function mmToPx(mm) {
  return Math.max(0, Math.round((mm / MM_PER_INCH) * PRINT_DPI));
}

async function prepareImageForPrint(imagePath) {
  const desiredLongPx = PRINT_LONG_INCHES * PRINT_DPI;
  const desiredShortPx = PRINT_SHORT_INCHES * PRINT_DPI;
  const metadata = await sharp(imagePath).metadata();
  const width = metadata.width || desiredShortPx;
  const height = metadata.height || desiredLongPx;
  const shouldRotate = width > height;
  const targetWidth = desiredShortPx;
  const targetHeight = desiredLongPx;

  const marginPx = {
    top: mmToPx(PRINT_MARGIN_MM.top),
    right: mmToPx(PRINT_MARGIN_MM.right),
    bottom: mmToPx(PRINT_MARGIN_MM.bottom),
    left: mmToPx(PRINT_MARGIN_MM.left),
  };
  const bleedPx = {
    top: mmToPx(PRINT_BLEED_MM.top),
    right: mmToPx(PRINT_BLEED_MM.right),
    bottom: mmToPx(PRINT_BLEED_MM.bottom),
    left: mmToPx(PRINT_BLEED_MM.left),
  };
  const rightFudgePx = mmToPx(PRINT_RIGHT_FUDGE_MM);

  const printableWidth = Math.max(1, targetWidth - (marginPx.left + marginPx.right));
  const printableHeight = Math.max(1, targetHeight - (marginPx.top + marginPx.bottom));
  const baseWidth = Math.max(
    1,
    printableWidth - (bleedPx.left + bleedPx.right) - rightFudgePx
  );
  const baseHeight = Math.max(1, printableHeight - (bleedPx.top + bleedPx.bottom));

  const resizedBuffer = await sharp(imagePath, { failOnError: false })
    .rotate(shouldRotate ? 90 : 0, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize({
      width: baseWidth,
      height: baseHeight,
      fit: sharp.fit.contain,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const extendedBuffer = await sharp(resizedBuffer)
    .extend({
      top: bleedPx.top,
      bottom: bleedPx.bottom,
      left: bleedPx.left,
      right: bleedPx.right,
      extendWith: 'copy',
    })
    .png()
    .toBuffer();

  const extendedMeta = await sharp(extendedBuffer).metadata();
  const offsetLeft = marginPx.left;
  const offsetTop = marginPx.top;
  const topShiftPx =
    PRINT_TOP_FUDGE_MM < 0 ? Math.round((Math.abs(PRINT_TOP_FUDGE_MM) / MM_PER_INCH) * PRINT_DPI) : 0;
  const stageHeight = topShiftPx > 0 ? targetHeight + topShiftPx : targetHeight;

  let stagedBuffer = await sharp({
    create: {
      width: targetWidth,
      height: stageHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: extendedBuffer, top: offsetTop, left: offsetLeft }])
    .png()
    .toBuffer();

  if (topShiftPx > 0) {
    stagedBuffer = await sharp(stagedBuffer)
      .extract({
        left: 0,
        top: Math.min(topShiftPx, stageHeight - targetHeight),
        width: targetWidth,
        height: targetHeight,
      })
      .png()
      .toBuffer();
  }

  const pageWidthMicrons = Math.round(PRINT_SHORT_INCHES * MICRONS_PER_INCH);
  const pageHeightMicrons = Math.round(PRINT_LONG_INCHES * MICRONS_PER_INCH);

  const imageTempPath = path.join(app.getPath('temp'), `ym4cut_image_${Date.now()}.png`);
  fs.writeFileSync(imageTempPath, stagedBuffer);

  return {
    imagePath: imageTempPath,
    pageSize: { width: pageWidthMicrons, height: pageHeightMicrons },
    landscape: false,
    portrait: true,
  };
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save-image', async (event, data) => {
  const sessionId = new Date().toISOString().replace(/[-:.]/g, '');
  const sessionDir = path.join(app.getPath('userData'), 'captures', `session_${sessionId}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  const imagePath = path.join(sessionDir, `capture_${Date.now()}.png`);
  const dataBuffer = Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(imagePath, dataBuffer);
  return imagePath;
});

ipcMain.handle('get-settings', async () => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  return {};
});

ipcMain.handle('save-settings', async (event, settings) => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
});

async function enumeratePrinters() {
  const devices = new Map();
  if (PrinterModule && typeof PrinterModule.list === 'function') {
    try {
      const nativePrinters = PrinterModule.list();
      nativePrinters.forEach(name => {
        if (!name) return;
        devices.set(name, { name, displayName: name, isDefault: false, source: 'node-printer', status: null });
      });
    } catch (nativeError) {
      console.error('Failed to get printers via node-printer:', nativeError);
    }
  }
  try {
    const win = getMainWindow();
    if (win) {
      const webPrinters = win.webContents.getPrintersAsync ? await win.webContents.getPrintersAsync() : win.webContents.getPrinters();
      webPrinters.forEach(device => {
        const name = device.name || device.printerName || device.deviceName;
        if (!name) return;
        const existing = devices.get(name) || {};
        devices.set(name, {
          name,
          displayName: device.displayName || device.description || existing.displayName || name,
          isDefault: device.isDefault ?? existing.isDefault ?? false,
          source: existing.source || 'webContents',
          status: typeof device.status === 'number' ? device.status : existing.status ?? null,
        });
      });
    }
  } catch (error) {
    console.error('Failed to get printers via webContents:', error);
  }
  return Array.from(devices.values());
}

async function resolvePrinterName(preferredName) {
  if (preferredName) return preferredName;
  const printers = await enumeratePrinters();
  const defaultPrinter = printers.find(printer => printer.isDefault);
  if (defaultPrinter) return defaultPrinter.name;
  return printers[0]?.name || null;
}

const PRINTER_STATUS_OFFLINE = 0x00000080;
const PRINTER_STATUS_ERROR = 0x00000002;
const PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;

function getPrinterStatusDescription(status) {
  if (status == null) return null;
  if (status & PRINTER_STATUS_OFFLINE) return 'err_printer_offline';
  if (status & PRINTER_STATUS_ERROR) return 'err_printer_error';
  if (status & PRINTER_STATUS_NOT_AVAILABLE) return 'err_printer_not_available';
  return null;
}

async function ensurePrinterAvailable(targetPrinter) {
  const devices = await enumeratePrinters();
  const device = devices.find(d => d.name === targetPrinter);
  if (!device) throw new Error('err_printer_not_found');
  if (typeof device.status === 'number') {
    const description = getPrinterStatusDescription(device.status);
    if (description) throw new Error(description);
  }
  return device;
}

ipcMain.handle('get-printers', async () => enumeratePrinters());

ipcMain.handle('get-image-as-base64', async (event, filePath) => {
  try {
    const file = fs.readFileSync(filePath);
    const base64 = Buffer.from(file).toString('base64');
    const mimeType = path.extname(filePath).substring(1);
    return `data:image/${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to get image as base64:', error);
    return null;
  }
});

ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled) return null;
  return filePaths[0];
});

async function resolveTemplateImage(settings = {}) {
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const candidates = [
    settings.templateImage,
    path.join(resourceRoot, 'template-default.png'),
    path.join(resourceRoot, 'assets', 'template-default.png'),
    path.join(__dirname, 'assets', 'template-default.png'),
    path.join(__dirname, '../public/assets', 'template-default.png'),
    path.join(app.getAppPath(), 'template.png'),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { buffer: await sharp(candidate).ensureAlpha().toBuffer(), path: candidate };
      }
    } catch {}
  }
  throw new Error('err_template_not_found');
}

ipcMain.handle('compose-images', async (event, images) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) : {};
    const { buffer: templateBuffer } = await resolveTemplateImage(settings);
    const templateMeta = await sharp(templateBuffer).metadata();
    const tWidth = templateMeta.width;
    const tHeight = templateMeta.height;

    const layoutConfig = [
      { x: 30 / 591, y: 43 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 408 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 773 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 1138 / 1746, w: 533 / 591, h: 340 / 1746 },
    ];

    const compositeOperations = await Promise.all(images.map(async (image, index) => {
      const layout = layoutConfig[index];
      const targetW = Math.round(layout.w * tWidth);
      const targetH = Math.round(layout.h * tHeight);
      
      const brightness = settings.brightness ? parseFloat(settings.brightness) : 1.05;
      const contrast = settings.contrast ? parseFloat(settings.contrast) : 1;
      const saturation = settings.saturation ? parseFloat(settings.saturation) : 1.1;

      const resizedImageBuffer = await sharp(image, { failOnError: false })
        .modulate({ brightness, contrast, saturation })
        .resize(targetW, targetH, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy,
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();
      
      return { input: resizedImageBuffer, top: Math.round(layout.y * tHeight), left: Math.round(layout.x * tWidth) };
    }));

    const singleCompositeBuffer = await sharp(templateBuffer).composite(compositeOperations).png().toBuffer();
    const metadata = await sharp(singleCompositeBuffer).metadata();
    const { width, height } = metadata;

    const finalImageBuffer = await sharp({
      create: { width: width * 2, height: height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
    .composite([{ input: singleCompositeBuffer, top: 0, left: 0 }, { input: singleCompositeBuffer, top: 0, left: width }])
    .png()
    .toBuffer();

    const sessionId = new Date().toISOString().replace(/[-:.]/g, '');
    const outputDir = settings.outputPath || path.join(app.getPath('pictures'), 'YM4Cut');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `final_${sessionId}.png`);
    fs.writeFileSync(outputPath, finalImageBuffer);
    return outputPath;
  } catch (error) {
    console.error('[compose-images] Error:', error);
    throw error;
  }
});

ipcMain.handle('print-image', async (event, { imagePath, printerName, copies }) => {
  const requestedCopies = Math.max(1, Math.round(Number(copies) || 1));
  const targetPrinter = await resolvePrinterName(printerName);
  if (!targetPrinter) throw new Error('err_printer_not_found');
  await ensurePrinterAvailable(targetPrinter);

  const tryNativePrint = () => new Promise((resolve, reject) => {
    try {
      if (!PrinterModule) return reject(new Error('err_node_printer_unavailable'));
      const device = new PrinterModule(targetPrinter);
      let completed = 0;
      const sendJob = () => {
        const job = device.printFile(imagePath);
        if (!job) return reject(new Error('err_print_job_start_failed'));
        job.once('sent', () => {
          completed += 1;
          if (completed >= requestedCopies) resolve();
          else sendJob();
        });
        job.once('error', err => reject(new Error(err ? err.toString() : 'err_unknown')));
      };
      sendJob();
    } catch (error) { reject(error); }
  });

  const tryBrowserPrint = () => new Promise((resolve, reject) => {
    prepareImageForPrint(imagePath).then(prepared => {
      const { imagePath: pPath, pageSize } = prepared;
      const printWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
      const html = `<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#fff;"><img src="${pathToFileURL(pPath).toString()}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body></html>`;
      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print({ silent: true, deviceName: targetPrinter, printBackground: true, margins: { marginType: 'none' }, pageSize, copies: requestedCopies }, (success, reason) => {
          printWindow.close();
          if (success) resolve();
          else reject(new Error(reason || 'err_unknown'));
        });
      });
    }).catch(reject);
  });

  if (PrinterModule && process.platform !== 'win32') {
    try { await tryNativePrint(); return; } catch (e) { console.warn('Native print failed, using browser fallback'); }
  }
  await tryBrowserPrint();
});

ipcMain.handle('quit-app', async () => app.quit());
ipcMain.handle('get-default-output-path', async () => path.join(app.getPath('pictures'), 'YM4Cut'));
ipcMain.handle('open-path', async (event, dirPath) => {
  const target = dirPath || path.join(app.getPath('pictures'), 'YM4Cut');
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
});
ipcMain.handle('open-external', async (event, url) => shell.openExternal(url));
ipcMain.handle('open-file-dialog', async (event, defaultPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }], defaultPath });
  return canceled ? null : filePaths[0];
});
