# YM4cut - Life4Cut Style Photo Booth

**YM4cut** is a desktop application designed for self-service photo booths, inspired by the popular "Life4Cut" style. 
Built with **Electron** and **React**, it allows anyone to easily create their own "Life4Cut" booth using just a laptop and a Canon Selphy photo printer. 
The app provides a one-stop experience: taking 4 consecutive photos, compositing them into your own custom template, and automatically printing the result.

## 📸 Key Features

*   **Touch-Friendly UI:** Intuitive interface optimized for kiosk touchscreens (mouse operation supported).
*   **Auto-Capture Workflow:** Automatic countdown and capture for 4 sequential shots.
*   **Live Preview:** Real-time camera feed with a countdown overlay.
*   **Instant Composition:** Fast processing to combine photos with a custom template (1:3 ratio) and generate a 2-up print layout (2:3 ratio).
*   **Auto Printing:** Seamless integration with printers (optimized for Canon Selphy CP series) for immediate output.
*   **Customizable:** Easily update the main screen image and photo template via settings. (Reprinting is also supported).

## 🛠 Tech Stack

*   **Runtime:** [Electron](https://www.electronjs.org/) (Desktop integration)
*   **Frontend:** [React](https://reactjs.org/) (UI), [Redux Toolkit](https://redux-toolkit.js.org/) (State Management)
*   **Image Processing:** [Sharp](https://sharp.pixelplumbing.com/) (High-performance image manipulation)
*   **Hardware Control:** `node-printer` (Printing), HTML5 Media Devices API (Camera)
*   **Language:** TypeScript

## 📋 Prerequisites

### Hardware
*   **OS & Performance:** Windows 10 or 11 (Core i5 8th Gen, 8GB RAM or higher recommended).
*   **Camera:** USB Webcam (1080p, 30fps support recommended) or built-in laptop webcam.
*   **Printer:** Canon Selphy CP1300/1500 series connected via USB or wireless network.

### Software
*   **Node.js:** v18.x or higher.
*   **Git:** For version control.
*   **Printer Driver:** Ensure the official driver for your printer is installed and set as the default printer in Windows.

## 🚀 Quick Start for Users

If you have received the **YM4cut_setup.exe** installation file, follow these steps:

1.  **Run the Installer:** Double-click `YM4cut_setup.exe` to begin the installation. Follow the on-screen instructions.
2.  **Connect Hardware:** Ensure your camera and photo printer are connected to the PC and powered on.
3.  **Launch the App:** Open **YM4cut** from your desktop or Start menu.
4.  **Initial Setup:**
    *   Click the **Gear Icon** (Settings) on the bottom left of the Home screen.
    *   Verify the camera preview and printer status.
    *   Upload your desired background and template (1:3 ratio).
5.  **Start Shooting:** Return to the Home screen and click **Start**!

---

## 🛠 For Developers (Build from Source)

If you want to contribute or build the application yourself, follow these steps:

### 1. Prerequisites
*   **Node.js:** v18.x or higher.
*   **Build Tools:** Windows Build Tools (required for native modules like `sharp` and `node-printer`).
*   **Git:** For version control.

### 2. Installation
```bash
git clone https://github.com/your-username/ym4cut.git
cd ym4cut
npm install
```

### 3. Run in Development Mode
```bash
npm run electron:start
```

### 4. Build the Installer (`YM4cut_setup.exe`)
To create the distributable installer:
```bash
npm run electron:build
```
The generated `YM4cut_setup.exe` will be located in the `dist` folder.

## 📂 Project Structure

```
YM4cut/
├── captures/           # Temporary storage for raw camera captures
├── config/             # Configuration files (settings.json)
├── output/             # Storage for final composited images
├── public/             # Static assets & Electron main process
│   ├── electron.js     # Electron Main Process entry point
│   └── preload.js      # Preload script for IPC
├── src/                # React Source Code
│   ├── components/     # UI Components (Camera, Print, etc.)
│   ├── assets/         # App assets (icons, default images)
│   └── ...
└── ...
```

## ⚙️ Configuration

The application allows basic configuration through the **Settings** screen (accessible via the gear icon on the Home screen).

*   **Main Image:** Change the background/promotional image displayed on the start screen.
*   **Template:** Upload a new frame template.
    *   You can edit the templates in the provided 'ym4cut_template.pptx', then save them as images to use in the app.

## ⚠️ Troubleshooting

*   **Camera not working:** Check privacy settings in Windows to ensure apps are allowed to access the camera. Verify the USB connection.
*   **Printer not printing:** Ensure the printer is online, has paper/ink, and is set as the default printer in Windows. Check the "Printers & Scanners" system menu.

## 📜 Open Source Licenses

This project utilizes the following open-source software:

*   **Electron, React, Redux Toolkit, React Router, electron-is-dev, node-printer, concurrently, electron-builder**: Licensed under the [MIT License](https://opensource.org/licenses/MIT).
*   **Sharp, TypeScript**: Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

## 📝 License

This project is for personal or educational use.