export interface IElectronAPI {
  saveImage: (data: string) => Promise<string>;
  composeImages: (images: string[]) => Promise<string>;
  printImage: (args: { imagePath: string; printerName?: string; copies?: number }) => Promise<void>;
  openFileDialog: () => Promise<string | null>;
  openDirectoryDialog: () => Promise<string | null>;
  saveSettings: (settings: any) => Promise<void>;
  getSettings: () => Promise<any>;
  getPrinters: () => Promise<any[]>;
  getImageAsBase64: (filePath: string) => Promise<string | null>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
