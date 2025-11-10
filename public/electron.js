const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let PrinterModule;
try {
  // node-printer offers access to native printers for actual print jobs
  // but can fail to load if drivers are missing; guard the require.
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('save-image', async (event, data) => {
  const sessionId = new Date().toISOString().replace(/[-:.]/g, '');
  const sessionDir = path.join(app.getPath('userData'), 'captures', `session_${sessionId}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const imagePath = path.join(sessionDir, `capture_${Date.now()}.png`);
  const dataBuffer = Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(imagePath, dataBuffer);
  return imagePath;
});

ipcMain.handle('get-settings', async () => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return settings;
  }
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
        devices.set(name, {
          name,
          displayName: name,
          isDefault: false,
          source: 'node-printer',
          status: null,
        });
      });
    } catch (nativeError) {
      console.error('Failed to get printers via node-printer:', nativeError);
    }
  }

  try {
    const win = getMainWindow();
    if (win) {
      const webPrinters = win.webContents.getPrintersAsync
        ? await win.webContents.getPrintersAsync()
        : win.webContents.getPrinters();

      webPrinters.forEach(device => {
        const name = device.name || device.printerName || device.deviceName;
        if (!name) {
          return;
        }
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
  if (preferredName) {
    return preferredName;
  }
  const printers = await enumeratePrinters();
  const defaultPrinter = printers.find(printer => printer.isDefault);
  if (defaultPrinter) {
    return defaultPrinter.name;
  }
  return printers[0]?.name || null;
}

const PRINTER_STATUS_OFFLINE = 0x00000080;
const PRINTER_STATUS_ERROR = 0x00000002;
const PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;

function getPrinterStatusDescription(status) {
  if (status == null) return null;
  if (status & PRINTER_STATUS_OFFLINE) return '프린터가 오프라인 상태입니다.';
  if (status & PRINTER_STATUS_ERROR) return '프린터에 오류가 발생했습니다.';
  if (status & PRINTER_STATUS_NOT_AVAILABLE) return '프린터를 사용할 수 없습니다.';
  return null;
}

async function ensurePrinterAvailable(targetPrinter) {
  const devices = await enumeratePrinters();
  const device = devices.find(d => d.name === targetPrinter);
  if (!device) {
    throw new Error('선택한 프린터를 찾을 수 없습니다. 연결 상태와 드라이버를 확인해주세요.');
  }
  console.log('[print-image] Printer status', { name: device.name, status: device.status, source: device.source });
  if (typeof device.status === 'number') {
    const description = getPrinterStatusDescription(device.status);
    if (description) {
      throw new Error(description);
    }
  }
}

function createImageDataUrl(imagePath) {
  const extension = path.extname(imagePath).toLowerCase();
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  const mimeType = mimeMap[extension] || 'image/png';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
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
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (canceled) {
    return null;
  }
  return filePaths[0];
});

ipcMain.handle('compose-images', async (event, images) => {
  console.log('[compose-images] Received request.');
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    console.log('[compose-images] Settings path:', settingsPath);
    const settings = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      : {};
    console.log('[compose-images] Loaded settings:', settings);

    let templatePath;
    if (settings.templateImage && fs.existsSync(settings.templateImage)) {
      templatePath = settings.templateImage;
    } else {
      templatePath = path.join(__dirname, '../src/assets/images/template-default.png');
    }
    console.log('[compose-images] Template path:', templatePath);

    const photoLayout = [
      { x: 30, y: 46, width: 533, height: 357 },
      { x: 30, y: 435, width: 533, height: 356 },
      { x: 30, y: 823, width: 533, height: 356 },
      { x: 30, y: 1211, width: 533, height: 356 },
    ];

    console.log('[compose-images] Starting image resize operations.');
    const compositeOperations = await Promise.all(images.map(async (image, index) => {
      const layout = photoLayout[index];
      
      const brightness = settings.brightness ? parseFloat(settings.brightness) : 1.05;
      const contrast = settings.contrast ? parseFloat(settings.contrast) : 1;
      const saturation = settings.saturation ? parseFloat(settings.saturation) : 1.1;

      console.log(`[compose-images] Resizing image ${index}: ${image} with brightness: ${brightness}, contrast: ${contrast}, saturation: ${saturation}`);
      const resizedImageBuffer = await sharp(image)
        .modulate({ brightness, contrast, saturation })
        .resize(layout.width, layout.height)
        .toBuffer();
      
      return {
        input: resizedImageBuffer,
        top: layout.y,
        left: layout.x,
      };
    }));
    console.log('[compose-images] All images resized.');

    console.log('[compose-images] Creating single 1x3 composite in buffer.');
    const singleCompositeBuffer = await sharp(templatePath)
      .composite(compositeOperations)
      .toBuffer();
    
    const metadata = await sharp(singleCompositeBuffer).metadata();
    const { width, height } = metadata;

    console.log(`[compose-images] Single image dimensions: ${width}x${height}. Creating 2x3 final image.`);
    const finalImageBuffer = await sharp({
      create: {
        width: width * 2,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
    .composite([
      { input: singleCompositeBuffer, top: 0, left: 0 },
      { input: singleCompositeBuffer, top: 0, left: width },
    ])
    .png()
    .toBuffer();

    const sessionId = new Date().toISOString().replace(/[-:.]/g, '');
    let outputDir;
    if (settings.outputPath) {
      outputDir = settings.outputPath;
    } else {
      if (isDev) {
        outputDir = path.join(app.getAppPath(), 'output');
      } else {
        outputDir = path.join(app.getPath('pictures'), 'YM4Cut');
      }
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `final_${sessionId}.png`);
    console.log('[compose-images] Output path:', outputPath);

    fs.writeFileSync(outputPath, finalImageBuffer);
    console.log('[compose-images] Composition finished successfully.');

    return outputPath;
  } catch (error) {
    console.error('[compose-images] Error during composition:', error);
    throw error;
  }
});

ipcMain.handle('print-image', async (event, { imagePath, printerName }) => {
  console.log('[print-image] Request received', { imagePath, printerName });
  const targetPrinter = await resolvePrinterName(printerName);
  if (!targetPrinter) {
    throw new Error('프린터를 찾을 수 없습니다. 시스템에 프린터가 설치되어 있는지 확인해주세요.');
  }

  await ensurePrinterAvailable(targetPrinter);
  console.log('[print-image] Using printer', targetPrinter);

  const tryNativePrint = () => new Promise((resolve, reject) => {
    try {
      const Printer = PrinterModule;
      if (!Printer || typeof Printer !== 'function') {
        return reject(new Error('node-printer 모듈을 사용할 수 없습니다.'));
      }
      const device = new Printer(targetPrinter);
      const job = device.printFile(imagePath);
      if (!job || typeof job.once !== 'function') {
        return reject(new Error('프린터 작업을 시작하지 못했습니다.'));
      }
      job.once('error', err => reject(new Error(err ? err.toString() : '알 수 없는 오류')));
      job.once('sent', () => {
        console.log('[print-image] Native print sent to spooler');
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });

  const tryBrowserPrint = () => new Promise((resolve, reject) => {
    let dataUrl;
    try {
      dataUrl = createImageDataUrl(imagePath);
    } catch (fileError) {
      return reject(new Error(`인쇄 이미지를 불러오지 못했습니다: ${fileError.message}`));
    }

    const printWindow = new BrowserWindow({
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: { offscreen: true },
    });

    const cleanup = () => {
      if (!printWindow.isDestroyed()) {
        printWindow.close();
      }
    };

    const html = `
      <html>
        <head>
          <style>
            @page { margin: 0; }
            html, body {
              margin: 0;
              height: 100%;
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
        </body>
      </html>
    `;
    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    printWindow.webContents.once('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: true,
          deviceName: targetPrinter,
          printBackground: true,
          margins: { marginType: 'none' },
          scaleFactor: 100,
        },
        (success, failureReason) => {
          cleanup();
          if (success) {
            console.log('[print-image] Browser print job forwarded to printer');
            resolve();
          } else {
            reject(new Error(failureReason || '인쇄에 실패했습니다.'));
          }
        }
      );
    });

    printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`인쇄 미리보기 로드 실패: ${errorDescription || errorCode}`));
    });
  });

  let lastError = null;
  if (PrinterModule && process.platform !== 'win32') {
    try {
      await tryNativePrint();
      return;
    } catch (nativeError) {
      lastError = nativeError;
      console.warn('Native print failed, attempting browser fallback:', nativeError);
    }
  }

  try {
    await tryBrowserPrint();
    console.log('[print-image] Print request completed');
  } catch (browserError) {
    if (lastError) {
      console.error('Fallback print error:', browserError);
      throw lastError;
    }
    throw browserError;
  }
});

ipcMain.handle('quit-app', async () => {
  app.quit();
});

ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
  });
  if (canceled) {
    return null;
  }
  return filePaths[0];
});
