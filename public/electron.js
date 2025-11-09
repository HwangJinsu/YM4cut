const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const sharp = require('sharp');
const printer = require('node-printer');

function createWindow() {
  const win = new BrowserWindow({
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
    win.loadURL('http://localhost:3000');
  } else {
    const indexPath = path.join(__dirname, 'index.html');
    win.loadFile(indexPath);
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

ipcMain.handle('get-printers', async () => {
  try {
    console.log('Available printer object:', JSON.stringify(printer));
    const printers = printer.getPrinters();
    return printers;
  } catch (error) {
    console.error('Failed to get printers:', error);
    return [];
  }
});

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
  return new Promise((resolve, reject) => {
    let targetPrinter = printerName;
    if (!targetPrinter) {
      try {
        const printers = printer.getPrinters();
        const defaultPrinter = printers.find(p => p.isDefault);
        if (defaultPrinter) {
          targetPrinter = defaultPrinter.name;
        } else if (printers.length > 0) {
          targetPrinter = printers[0].name;
        }
      } catch (error) {
        console.error('Failed to get default printer:', error);
        return reject(error);
      }
    }

    if (!targetPrinter) {
      const errorMsg = "프린터를 찾을 수 없습니다. 시스템에 프린터가 설치되어 있는지 확인해주세요.";
      console.log(errorMsg);
      return reject(new Error(errorMsg));
    }

    printer.printFile({
      filename: imagePath,
      printer: targetPrinter,
      success: function (jobID) {
        console.log(`Sent to printer ${targetPrinter} with job ID: ${jobID}`);
        resolve();
      },
      error: function (err) {
        console.log("Error printing: " + err);
        reject(err);
      },
    });
  });
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
