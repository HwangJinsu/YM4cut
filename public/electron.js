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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  if (isDev) mainWindow.loadURL('http://localhost:3000');
  else mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function resolveTemplateImage(settings = {}) {
  // Packaging: template-default.png is copied to the root resources dir via extraResources in package.json
  const candidates = [
    settings.templateImage,
    path.join(process.resourcesPath, 'template-default.png'), // Windows packaged root
    path.join(app.getAppPath(), 'template-default.png'),
    path.join(__dirname, 'assets', 'template-default.png'),
    path.join(__dirname, '../public/assets', 'template-default.png'),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        console.log('[resolveTemplateImage] Loaded:', candidate);
        return { buffer: await sharp(candidate).ensureAlpha().toBuffer() };
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

      // No trim() here. Rely on Camera.tsx precise 533:340 extraction.
      const resizedImageBuffer = await sharp(image, { failOnError: false })
        .modulate({ brightness, contrast, saturation })
        .resize(targetW, targetH, { fit: sharp.fit.cover, position: sharp.strategy.entropy })
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

    const outputDir = settings.outputPath || path.join(app.getPath('pictures'), 'YM4Cut');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `final_${new Date().toISOString().replace(/[-:.]/g, '')}.png`);
    fs.writeFileSync(outPath, finalImageBuffer);
    return outPath;
  } catch (error) { throw error; }
});

ipcMain.handle('print-image', async (event, { imagePath, printerName, copies }) => {
  const targetPrinter = printerName;
  const requestedCopies = Math.max(1, Math.round(Number(copies) || 1));
  const metadata = await sharp(imagePath).metadata();
  const shouldRotate = metadata.width > metadata.height;
  const buffer = await sharp(imagePath).rotate(shouldRotate ? 90 : 0).resize(Math.round(PRINT_SHORT_INCHES * PRINT_DPI), Math.round(PRINT_LONG_INCHES * PRINT_DPI), { fit: 'contain', background: '#fff' }).png().toBuffer();
  const tempPath = path.join(app.getPath('temp'), `ym4cut_print_${Date.now()}.png`);
  fs.writeFileSync(tempPath, buffer);
  const printWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;"><img src="${pathToFileURL(tempPath).toString()}" style="width:100%;height:100%;object-fit:contain;" /></body></html>`)}`);
  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({ silent: true, deviceName: targetPrinter, printBackground: true, margins: { marginType: 'none' }, pageSize: { width: Math.round(PRINT_SHORT_INCHES * MICRONS_PER_INCH), height: Math.round(PRINT_LONG_INCHES * MICRONS_PER_INCH) }, copies: requestedCopies }, () => {
      printWindow.close();
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    });
  });
});

ipcMain.handle('save-image', async (event, data) => {
  const dir = path.join(app.getPath('userData'), 'captures');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `cap_${Date.now()}.png`);
  fs.writeFileSync(p, Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64'));
  return p;
});
ipcMain.handle('get-settings', async () => {
  const p = path.join(app.getPath('userData'), 'settings.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {};
});
ipcMain.handle('save-settings', async (event, s) => fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(s, null, 2)));
ipcMain.handle('get-printers', async () => {
  const win = getMainWindow();
  return win ? (win.webContents.getPrintersAsync ? await win.webContents.getPrintersAsync() : win.webContents.getPrinters()) : [];
});
ipcMain.handle('get-image-as-base64', async (e, f) => { try { return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`; } catch (e) { return null; } });
ipcMain.handle('open-directory-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});
ipcMain.handle('quit-app', async () => app.quit());
ipcMain.handle('open-path', async (e, p) => shell.openPath(p || path.join(app.getPath('pictures'), 'YM4Cut')));
ipcMain.handle('open-external', async (e, u) => shell.openExternal(u));
ipcMain.handle('open-file-dialog', async (e, d) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }], defaultPath: d });
  return canceled ? null : filePaths[0];
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
