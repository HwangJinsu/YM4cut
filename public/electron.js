const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const sharp = require('sharp');

const PRINT_DPI = 300;
const PRINT_LONG_INCHES = 6;
const PRINT_SHORT_INCHES = 4;
const MM_PER_INCH = 25.4;
const MICRONS_PER_INCH = 25400;

const isDev = !app.isPackaged;
let mainWindow = null;

function getMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  const [win] = BrowserWindow.getAllWindows();
  return win ?? null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080, height: 1920, kiosk: true,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  if (isDev) mainWindow.loadURL('http://localhost:3000');
  else mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function resolveTemplateImage(settings = {}) {
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const candidates = [
    settings.templateImage,
    path.join(resourceRoot, 'template-default.png'),
    path.join(app.getAppPath(), 'template-default.png'),
    path.join(__dirname, 'assets', 'template-default.png'),
    path.join(__dirname, '../public/assets', 'template-default.png'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        console.log('[resolveTemplateImage] Found:', candidate);
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
    
    const layoutConfig = [
      { x: 30 / 591, y: 43 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 408 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 773 / 1746, w: 533 / 591, h: 340 / 1746 },
      { x: 30 / 591, y: 1138 / 1746, w: 533 / 591, h: 340 / 1746 },
    ];

    const compositeOperations = await Promise.all(images.map(async (image, index) => {
      const layout = layoutConfig[index];
      const targetW = Math.round(layout.w * templateMeta.width);
      const targetH = Math.round(layout.h * templateMeta.height);
      
      const brightness = settings.brightness ? parseFloat(settings.brightness) : 1.05;
      const contrast = settings.contrast ? parseFloat(settings.contrast) : 1;
      const saturation = settings.saturation ? parseFloat(settings.saturation) : 1.1;

      // No more auto-trim to avoid cutting dark subjects.
      // Use standard Fit: Cover for predictable results.
      const resizedImageBuffer = await sharp(image, { failOnError: false })
        .modulate({ brightness, contrast, saturation })
        .resize(targetW, targetH, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy,
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();
      
      return { input: resizedImageBuffer, top: Math.round(layout.y * templateMeta.height), left: Math.round(layout.x * templateMeta.width) };
    }));

    const singleCompositeBuffer = await sharp(templateBuffer).composite(compositeOperations).png().toBuffer();
    const metadata = await sharp(singleCompositeBuffer).metadata();
    const finalImageBuffer = await sharp({
      create: { width: metadata.width * 2, height: metadata.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
    .composite([{ input: singleCompositeBuffer, top: 0, left: 0 }, { input: singleCompositeBuffer, top: 0, left: metadata.width }])
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

// Helper for print preparation
async function prepareImageForPrint(imagePath) {
  const targetW = Math.round(PRINT_SHORT_INCHES * PRINT_DPI);
  const targetH = Math.round(PRINT_LONG_INCHES * PRINT_DPI);
  const metadata = await sharp(imagePath).metadata();
  const shouldRotate = metadata.width > metadata.height;

  const buffer = await sharp(imagePath, { failOnError: false })
    .rotate(shouldRotate ? 90 : 0, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .resize(targetW, targetH, { fit: sharp.fit.contain, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  const tempPath = path.join(app.getPath('temp'), `print_${Date.now()}.png`);
  fs.writeFileSync(tempPath, buffer);
  return { imagePath: tempPath, pageSize: { width: Math.round(PRINT_SHORT_INCHES * MICRONS_PER_INCH), height: Math.round(PRINT_LONG_INCHES * MICRONS_PER_INCH) } };
}

ipcMain.handle('save-image', async (event, data) => {
  const sessionId = new Date().toISOString().replace(/[-:.]/g, '');
  const sessionDir = path.join(app.getPath('userData'), 'captures', `session_${sessionId}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  const imagePath = path.join(sessionDir, `capture_${Date.now()}.png`);
  fs.writeFileSync(imagePath, Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64'));
  return imagePath;
});

ipcMain.handle('get-settings', async () => {
  const p = path.join(app.getPath('userData'), 'settings.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {};
});

ipcMain.handle('save-settings', async (event, s) => {
  fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(s, null, 2));
});

ipcMain.handle('get-printers', async () => {
  const win = getMainWindow();
  return win ? (win.webContents.getPrintersAsync ? await win.webContents.getPrintersAsync() : win.webContents.getPrinters()) : [];
});

ipcMain.handle('print-image', async (event, { imagePath, printerName, copies }) => {
  const targetPrinter = printerName;
  const requestedCopies = Math.max(1, Math.round(Number(copies) || 1));
  const prepared = await prepareImageForPrint(imagePath);
  const printWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
  const html = `<html><body style="margin:0;"><img src="${pathToFileURL(prepared.imagePath).toString()}" style="width:100%;height:100%;object-fit:contain;" /></body></html>`;
  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({ silent: true, deviceName: targetPrinter, printBackground: true, margins: { marginType: 'none' }, pageSize: prepared.pageSize, copies: requestedCopies }, (s, r) => {
      printWindow.close();
      if (fs.existsSync(prepared.imagePath)) fs.unlinkSync(prepared.imagePath);
    });
  });
});

ipcMain.handle('get-image-as-base64', async (e, f) => {
  try { return `data:image/${path.extname(f).substring(1)};base64,${fs.readFileSync(f).toString('base64')}`; } catch (e) { return null; }
});

ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('quit-app', async () => app.quit());
ipcMain.handle('open-path', async (e, p) => {
  const t = p || path.join(app.getPath('pictures'), 'YM4Cut');
  if (!fs.existsSync(t)) fs.mkdirSync(t, { recursive: true });
  shell.openPath(t);
});
ipcMain.handle('open-external', async (e, u) => shell.openExternal(u));
ipcMain.handle('open-file-dialog', async (e, d) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }], defaultPath: d });
  return canceled ? null : filePaths[0];
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
