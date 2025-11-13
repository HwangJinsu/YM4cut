const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const sharp = require('sharp');

const PRINT_DPI = 300;
const PRINT_LONG_INCHES = 6;
const PRINT_SHORT_INCHES = 4;
const MM_PER_INCH = 25.4;
const PRINT_MARGIN_MM = {
  top: 2,
  right: 6,
  bottom: 12,
  left: 0,
};
const MICRONS_PER_INCH = 25400;

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

  const safeWidth = Math.max(1, targetWidth - (marginPx.left + marginPx.right));
  const safeHeight = Math.max(1, targetHeight - (marginPx.top + marginPx.bottom));
  console.log('[print-image] Preparing image for print', {
    sourceWidth: width,
    sourceHeight: height,
    targetWidth,
    targetHeight,
    safeWidth,
    safeHeight,
    marginsPx: marginPx,
    safeWidth,
    safeHeight,
    rotate: shouldRotate ? 90 : 0,
  });

  const processedImage = await sharp(imagePath, { failOnError: false })
    .rotate(shouldRotate ? 90 : 0, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize({
      width: safeWidth,
      height: safeHeight,
      fit: sharp.fit.contain,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  const offsetLeft = marginPx.left;
  const offsetTop = marginPx.top;

  const imageBuffer = await sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: processedImage, top: offsetTop, left: offsetLeft }])
    .png()
    .toBuffer();

  const pageWidthMicrons = Math.round(PRINT_SHORT_INCHES * MICRONS_PER_INCH);
  const pageHeightMicrons = Math.round(PRINT_LONG_INCHES * MICRONS_PER_INCH);

  const imageTempPath = path.join(app.getPath('temp'), `ym4cut_image_${Date.now()}.png`);
  fs.writeFileSync(imageTempPath, imageBuffer);
  console.log('[print-image] Temp image written', imageTempPath, 'bytes', imageBuffer.length);

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
  return device;
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
  console.log('[print-image] Reading file', imagePath, 'as', mimeType);
  const imageBuffer = fs.readFileSync(imagePath);
  console.log('[print-image] Read bytes', imageBuffer.length);
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

async function resolveTemplateImage(settings = {}) {
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const candidates = [
    settings.templateImage,
    path.join(resourceRoot, 'template-default.png'),
    path.join(resourceRoot, 'assets', 'template-default.png'),
    path.join(__dirname, 'assets', 'template-default.png'),
    path.join(__dirname, '../src/assets/images/template-default.png'),
    path.join(app.getAppPath(), 'template.png'),
  ];

  const tried = new Set();
  for (const candidate of candidates) {
    if (!candidate || tried.has(candidate)) {
      continue;
    }
    tried.add(candidate);
    let stats;
    try {
      stats = fs.statSync(candidate);
    } catch {
      continue;
    }
    if (!stats.isFile() || stats.size === 0) {
      console.log('[compose-images] Skipping template candidate (missing or empty):', candidate);
      continue;
    }
    try {
      const buffer = await sharp(candidate).ensureAlpha().toBuffer();
      console.log('[compose-images] Template resolved to:', candidate);
      return { buffer, path: candidate };
    } catch (error) {
      console.warn('[compose-images] Failed to load template candidate:', candidate, error);
    }
  }

  throw new Error('사용 가능한 템플릿 이미지를 찾을 수 없습니다. 설정에서 템플릿 파일을 확인해주세요.');
}

ipcMain.handle('compose-images', async (event, images) => {
  console.log('[compose-images] Received request.');
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    console.log('[compose-images] Settings path:', settingsPath);
    const settings = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      : {};
    console.log('[compose-images] Loaded settings:', settings);

    const { buffer: templateBuffer, path: templatePath } = await resolveTemplateImage(settings);

    const photoLayout = [
      { x: 30, y: 44, width: 533, height: 335 },
      { x: 30, y: 409, width: 533, height: 340 },
      { x: 30, y: 774, width: 533, height: 340 },
      { x: 30, y: 1139, width: 533, height: 340 },
    ];

    console.log('[compose-images] Starting image resize operations.');
    const compositeOperations = await Promise.all(images.map(async (image, index) => {
      const layout = photoLayout[index];
      
      const brightness = settings.brightness ? parseFloat(settings.brightness) : 1.05;
      const contrast = settings.contrast ? parseFloat(settings.contrast) : 1;
      const saturation = settings.saturation ? parseFloat(settings.saturation) : 1.1;
      const targetRatio = layout.width / layout.height;

      console.log(`[compose-images] Resizing image ${index}: ${image} with brightness: ${brightness}, contrast: ${contrast}, saturation: ${saturation}`);
      const metadata = await sharp(image, { failOnError: false }).metadata();

      let cropRegion = null;
      if (metadata.width && metadata.height) {
        const sourceRatio = metadata.width / metadata.height;
        if (Math.abs(sourceRatio - targetRatio) > 0.01) {
          if (sourceRatio > targetRatio) {
            const desiredWidth = Math.round(metadata.height * targetRatio);
            const left = Math.max(0, Math.floor((metadata.width - desiredWidth) / 2));
            cropRegion = {
              left,
              top: 0,
              width: Math.min(desiredWidth, metadata.width - left),
              height: metadata.height,
            };
          } else {
            const desiredHeight = Math.round(metadata.width / targetRatio);
            const top = Math.max(0, Math.floor((metadata.height - desiredHeight) / 2));
            cropRegion = {
              left: 0,
              top,
              width: metadata.width,
              height: Math.min(desiredHeight, metadata.height - top),
            };
          }
          console.log('[compose-images] Cropping before resize', { index, cropRegion, sourceRatio, targetRatio });
        }
      }

      let pipeline = sharp(image, { failOnError: false });
      if (cropRegion) {
        pipeline = pipeline.extract(cropRegion);
      }
      const resizedImageBuffer = await pipeline
        .modulate({ brightness, contrast, saturation })
        .resize(layout.width, layout.height, {
          fit: sharp.fit.cover,
          position: sharp.strategy.attention,
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();
      
      return {
        input: resizedImageBuffer,
        top: layout.y,
        left: layout.x,
      };
    }));
    console.log('[compose-images] All images resized.');

    console.log('[compose-images] Creating single 1x3 composite in buffer.');
    const singleCompositeBuffer = await sharp(templateBuffer)
      .composite(compositeOperations)
      .png()
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
    prepareImageForPrint(imagePath)
      .then(prepared => {
        const { imagePath: preparedImagePath, pageSize, landscape, portrait } = prepared;
        const imageFileUrl = pathToFileURL(preparedImagePath).toString();
        console.log('[print-image] Prepared image payload', { preparedImagePath, pageSize, landscape, portrait });

        const printWindow = new BrowserWindow({
          show: false,
          backgroundColor: '#ffffff',
          webPreferences: {
            offscreen: true,
            webSecurity: false,
            sandbox: false,
          },
        });

        const cleanup = () => {
          try {
            if (fs.existsSync(preparedImagePath)) {
              fs.unlinkSync(preparedImagePath);
            }
          } catch (err) {
            console.warn('[print-image] Failed to delete temp image', err);
          }
          if (!printWindow.isDestroyed()) {
            printWindow.close();
          }
        };

        const orientationStyle = `@page { size: ${PRINT_SHORT_INCHES}in ${PRINT_LONG_INCHES}in; margin: 0; }`;
        const scale = 'none';
        const html = `
          <html>
            <head>
              <style>
                ${orientationStyle}
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
                  transform: ${scale};
                  transform-origin: center;
                }
              </style>
            </head>
            <body>
              <img id="photo" src="${imageFileUrl}" />
            </body>
          </html>
        `;

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        const waitForImage = () =>
          printWindow.webContents.executeJavaScript(`
            new Promise(resolve => {
              const img = document.getElementById('photo');
              if (!img) return resolve(false);
              if (img.complete && img.naturalWidth > 0) return resolve(true);
              img.onload = () => resolve(true);
              img.onerror = () => resolve(false);
            });
          `);

        const submitPrint = () => {
          console.log('[print-image] Submitting print job via webContents.print', { pageSize, landscape, portrait });
          printWindow.webContents.print(
            {
              silent: true,
              deviceName: targetPrinter,
              printBackground: true,
              margins: { marginType: 'none' },
              scaleFactor: 100,
              pageSize,
              landscape: false,
              dpi: { horizontal: PRINT_DPI, vertical: PRINT_DPI },
            },
            (success, failureReason) => {
              cleanup();
              if (success) {
                console.log('[print-image] Browser print job forwarded to printer');
                resolve();
              } else {
                console.error('[print-image] Browser print failed', failureReason);
                reject(new Error(failureReason || '인쇄에 실패했습니다.'));
              }
            }
          );
        };

        const loadTimeout = setTimeout(() => {
          console.warn('[print-image] BrowserWindow load timeout, forcing print');
          submitPrint();
        }, 5000);

        printWindow.webContents.on('did-start-loading', () => {
          console.log('[print-image] BrowserWindow started loading image');
        });

        printWindow.webContents.once('did-finish-load', async () => {
          clearTimeout(loadTimeout);
          console.log('[print-image] BrowserWindow load finished, waiting for image');
          const ready = await waitForImage();
          if (!ready) {
            cleanup();
            return reject(new Error('인쇄 이미지를 로드하지 못했습니다.'));
          }
          submitPrint();
        });

        printWindow.webContents.on('did-stop-loading', () => {
          console.log('[print-image] BrowserWindow stop loading');
        });

        printWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
          clearTimeout(loadTimeout);
          console.error('[print-image] BrowserWindow failed to load', { errorCode, errorDescription });
          cleanup();
          reject(new Error(`인쇄 미리보기 로드 실패: ${errorDescription || errorCode}`));
        });

        printWindow.webContents.on('render-process-gone', (_event, details) => {
          clearTimeout(loadTimeout);
          console.error('[print-image] Render process gone during print', details);
          cleanup();
          reject(new Error('인쇄용 렌더러가 종료되었습니다.'));
        });

        printWindow.webContents.on('console-message', (_event, level, message) => {
          console.log('[print-image][window]', level, message);
        });

        printWindow.on('unresponsive', () => {
          console.error('[print-image] BrowserWindow became unresponsive during print');
        });
      })
      .catch(fileError => {
        reject(new Error(`인쇄 이미지를 준비하는 중 오류가 발생했습니다: ${fileError.message}`));
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
