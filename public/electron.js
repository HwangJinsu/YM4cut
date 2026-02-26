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
  // Packaging structure: template-default.png is placed in the 'resources' root by extraResources
  const candidates = [
    settings.templateImage,
    path.join(process.resourcesPath, 'template-default.png'), // Packaged location
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

      // Smart Crop: Remove black side bars common in virtual cameras like EOS Utility
      let img = sharp(image, { failOnError: false });
      
      // Auto-trim edges with a tolerance to remove black bars
      const resizedImageBuffer = await img
        .trim({ threshold: 30 }) // Remove black borders
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

// ... rest of the IPC handlers (print-image, get-printers, etc.) keep same logic as before but ensured they exist
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

ipcMain.handle('get-printers', async () => {
  const win = getMainWindow();
  if (!win) return [];
  return win.webContents.getPrintersAsync ? await win.webContents.getPrintersAsync() : win.webContents.getPrinters();
});

ipcMain.handle('print-image', async (event, { imagePath, printerName, copies }) => {
  const targetPrinter = printerName;
  const requestedCopies = Math.max(1, Math.round(Number(copies) || 1));
  const printWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
  const html = `<html><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#fff;"><img src="${pathToFileURL(imagePath).toString()}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body></html>`;
  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({ 
      silent: true, 
      deviceName: targetPrinter, 
      printBackground: true, 
      margins: { marginType: 'none' }, 
      copies: requestedCopies 
    }, (success, reason) => {
      printWindow.close();
      if (!success) console.error('Print failed:', reason);
    });
  });
});

ipcMain.handle('get-image-as-base64', async (event, filePath) => {
  try {
    const file = fs.readFileSync(filePath);
    return `data:image/${path.extname(filePath).substring(1)};base64,${file.toString('base64')}`;
  } catch (e) { return null; }
});

ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('quit-app', async () => app.quit());
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
