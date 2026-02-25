import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'sv', label: 'Svenska' },
  { code: 'fi', label: 'Suomi' },
  { code: 'no', label: 'Norsk' },
  { code: 'da', label: 'Dansk' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'cs', label: 'Čeština' },
  { code: 'ro', label: 'Română' },
  { code: 'uk', label: 'Українська' },
  { code: 'hu', label: 'Magyar' },
  { code: 'bg', label: 'Български' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'fa', label: 'فارسی' },
  { code: 'mn', label: 'Монгол' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'tl', label: 'Filipino' },
  { code: 'kk', label: 'Қазақша' },
  { code: 'uz', label: 'Oʻzbekcha' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ur', label: 'اردو' },
  { code: 'tr', label: 'Türkçe' },
];

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [templateImagePreview, setTemplateImagePreview] = useState<string | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<string>(i18n.language.split('-')[0] || 'ko');

  const [brightness, setBrightness] = useState<number>(1.05);
  const [contrast, setContrast] = useState<number>(1);
  const [saturation, setSaturation] = useState<number>(1.1);
  const [isCameraFlipped, setIsCameraFlipped] = useState<boolean>(false);
  const [shutterTimer, setShutterTimer] = useState<number>(5);
  const electronAPI = typeof window !== 'undefined' ? window?.electron : undefined;

  const [isDirty, setIsDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [initialSettings, setInitialSettings] = useState<any>(null);

  // Initial load
  useEffect(() => {
    const fetchDevicesAndSettings = async () => {
      if (!electronAPI) return;
      try {
        const settings = await electronAPI.getSettings();
        setInitialSettings(settings);
        
        if (settings.mainImage) {
          setMainImage(settings.mainImage);
          const preview = await electronAPI.getImageAsBase64(settings.mainImage);
          setMainImagePreview(preview);
        }
        if (settings.templateImage) {
          setTemplateImage(settings.templateImage);
          const preview = await electronAPI.getImageAsBase64(settings.templateImage);
          setTemplateImagePreview(preview);
        }
        if (settings.selectedCamera) setSelectedCamera(settings.selectedCamera);
        if (settings.selectedPrinter) setSelectedPrinter(settings.selectedPrinter);
        if (settings.outputPath) setOutputPath(settings.outputPath);
        if (settings.brightness) setBrightness(parseFloat(settings.brightness));
        if (settings.contrast) setContrast(parseFloat(settings.contrast));
        if (settings.saturation) setSaturation(parseFloat(settings.saturation));
        if (settings.isCameraFlipped) setIsCameraFlipped(settings.isCameraFlipped);
        if (settings.shutterTimer) setShutterTimer(Number(settings.shutterTimer));
        
        if (settings.language) {
          setCurrentLanguage(settings.language);
          if (i18n.language !== settings.language) {
            i18n.changeLanguage(settings.language);
          }
        }

        // Fetch cameras
        let videoDevices: MediaDeviceInfo[] = [];
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            videoDevices = devices.filter(device => device.kind === 'videoinput');
          } catch (deviceError) {
            console.warn('[Settings] Failed to enumerate camera devices', deviceError);
          }
        }
        setCameras(videoDevices);
        if (videoDevices.length > 0 && !settings.selectedCamera) {
          setSelectedCamera(videoDevices[0].deviceId);
        }

        // Fetch printers
        const printerList = await electronAPI.getPrinters();
        setPrinters(printerList);
      } catch (err) {
        console.error('[Settings] Error fetching settings:', err);
      }
    };
    fetchDevicesAndSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update printers periodically
  useEffect(() => {
    const refreshPrinters = async () => {
      if (!electronAPI) return;
      try {
        const printerList = await electronAPI.getPrinters();
        setPrinters(printerList);
      } catch (err) {
        console.warn('[Settings] Failed to refresh printers', err);
      }
    };
    const interval = setInterval(refreshPrinters, 10000);
    return () => clearInterval(interval);
  }, [electronAPI]);

  // Track changes
  useEffect(() => {
    if (!initialSettings) return;
    const hasChanged = 
      mainImage !== (initialSettings.mainImage || null) ||
      templateImage !== (initialSettings.templateImage || null) ||
      selectedCamera !== (initialSettings.selectedCamera || '') ||
      selectedPrinter !== (initialSettings.selectedPrinter || '') ||
      outputPath !== (initialSettings.outputPath || '') ||
      brightness !== (parseFloat(initialSettings.brightness) || 1.05) ||
      contrast !== (parseFloat(initialSettings.contrast) || 1) ||
      saturation !== (parseFloat(initialSettings.saturation) || 1.1) ||
      isCameraFlipped !== (!!initialSettings.isCameraFlipped) ||
      shutterTimer !== (Number(initialSettings.shutterTimer) || 5) ||
      currentLanguage !== (initialSettings.language || 'ko');
    setIsDirty(hasChanged);
  }, [
    mainImage, templateImage, selectedCamera, selectedPrinter, 
    outputPath, brightness, contrast, saturation, 
    isCameraFlipped, shutterTimer, currentLanguage, initialSettings
  ]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setCurrentLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
  };

  const handleSave = async () => {
    if (!electronAPI) return;
    const newSettings = {
      mainImage,
      templateImage,
      selectedCamera,
      selectedPrinter,
      outputPath,
      brightness,
      contrast,
      saturation,
      isCameraFlipped,
      shutterTimer,
      language: currentLanguage,
    };
    await electronAPI.saveSettings(newSettings);
    setInitialSettings(newSettings);
    setIsDirty(false);
    alert(t('settings_saved'));
  };

  const handleBackToHome = () => {
    if (isDirty) {
      setShowExitModal(true);
    } else {
      navigate('/');
    }
  };

  const handleInfoClick = () => {
    if (!electronAPI) return;
    electronAPI.openExternal('https://www.youtube.com/playlist?list=PLs36bSFfggCD1LTDmTPm8M7O89RdjbcJ-');
  };

  const styles = {
    container: {
      padding: '40px',
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      overflowY: 'auto' as 'auto',
      height: 'calc(100vh - 80px)',
    },
    title: {
      fontSize: 'var(--headline-font-size)',
      color: 'var(--text-color)',
      marginBottom: '40px',
    },
    infoButton: {
      position: 'absolute' as 'absolute',
      top: '40px',
      left: '40px',
      fontSize: '32px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      opacity: 0.6,
      transition: 'opacity 0.2s',
    },
    settingItem: {
      marginBottom: '40px',
      width: '100%',
      maxWidth: '800px',
    },
    settingHeader: {
      fontSize: 'var(--button-font-size)',
      marginBottom: '20px',
    },
    pathDisplay: {
      fontSize: '18px',
      color: '#555',
      marginTop: '10px',
      padding: '10px',
      backgroundColor: '#f0f0f0',
      borderRadius: '8px',
      wordBreak: 'break-all' as 'break-all',
    },
    imagePreview: {
      maxWidth: '100%',
      maxHeight: '300px',
      marginTop: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    },
    button: {
      width: '100%',
      padding: '20px',
      backgroundColor: 'var(--secondary-color)',
      color: 'white',
      fontSize: '24px',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'transform 0.2s ease-out',
      marginBottom: '10px',
    },
    select: {
      width: '100%',
      padding: '30px 20px',
      fontSize: '24px',
      borderRadius: '12px',
      border: '1px solid #ccc',
      backgroundColor: 'white',
      appearance: 'none' as 'none',
    },
    sliderContainer: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      marginTop: '10px',
    },
    sliderInline: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginTop: '16px',
    },
    sliderValue: {
      fontSize: '22px',
      minWidth: '80px',
    },
    sliderLabel: {
      fontSize: '20px',
      marginBottom: '5px',
    },
    slider: {
      width: '100%',
    },
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      marginTop: '10px',
    },
    checkbox: {
      width: '24px',
      height: '24px',
      marginRight: '10px',
    },
    saveButton: {
      width: '100%',
      padding: '20px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: '28px',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      marginTop: '40px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s ease-out',
    },
    licenseButton: {
      marginTop: '20px',
      padding: '8px 16px',
      backgroundColor: 'transparent',
      color: '#888',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      cursor: 'pointer',
    },
    backLink: {
      marginTop: '20px',
      fontSize: '24px',
      color: 'var(--text-color)',
      textDecoration: 'none',
      fontWeight: 'bold' as 'bold',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
    },
    modalOverlay: {
      position: 'fixed' as 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '12px',
      maxWidth: '600px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto' as 'auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      position: 'relative' as 'relative',
    },
    modalTitle: {
      fontSize: '24px',
      marginBottom: '20px',
      borderBottom: '1px solid #eee',
      paddingBottom: '10px',
    },
    modalCloseButton: {
      position: 'absolute' as 'absolute',
      top: '15px',
      right: '15px',
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#666',
    },
    licenseItem: {
      marginBottom: '15px',
      borderBottom: '1px solid #f5f5f5',
      paddingBottom: '10px',
    },
    licenseName: {
      fontWeight: 'bold' as 'bold',
      fontSize: '18px',
    },
    licenseType: {
      color: '#666',
      fontSize: '14px',
      marginTop: '4px',
    },
  };

  const LICENSES = [
    { name: 'React', type: 'MIT License' },
    { name: 'React DOM', type: 'MIT License' },
    { name: 'React Router', type: 'MIT License' },
    { name: 'Redux Toolkit', type: 'MIT License' },
    { name: 'React Redux', type: 'MIT License' },
    { name: 'Electron', type: 'MIT License' },
    { name: 'Electron Builder', type: 'MIT License' },
    { name: 'Node Printer', type: 'MIT License' },
    { name: 'Sharp', type: 'Apache License 2.0' },
    { name: 'TypeScript', type: 'Apache License 2.0' },
  ];

  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const handleSelectMainImage = async () => {
    if (!electronAPI) return;
    const path = await electronAPI.openFileDialog();
    if (path) {
      setMainImage(path);
      const preview = await electronAPI.getImageAsBase64(path);
      setMainImagePreview(preview);
    }
  };

  const handleDeselectMainImage = () => {
    setMainImage(null);
    setMainImagePreview(null);
  };

  const handleSelectTemplateImage = async () => {
    if (!electronAPI) return;
    const path = await electronAPI.openFileDialog();
    if (path) {
      setTemplateImage(path);
      const preview = await electronAPI.getImageAsBase64(path);
      setTemplateImagePreview(preview);
    }
  };

  const handleDeselectTemplateImage = () => {
    setTemplateImage(null);
    setTemplateImagePreview(null);
  };

  const handleSelectOutputPath = async () => {
    if (!electronAPI) return;
    const path = await electronAPI.openDirectoryDialog();
    if (path) {
      setOutputPath(path);
    }
  };

  const handleOpenOutputPath = async () => {
    if (!electronAPI) return;
    await electronAPI.openPath(outputPath);
  };

  const handleReprint = async () => {
    if (!electronAPI) return;
    let targetPath = outputPath;
    if (!targetPath) {
      targetPath = await electronAPI.getDefaultOutputPath();
    }
    const path = await electronAPI.openFileDialog(targetPath);
    if (path) {
      try {
        await electronAPI.printImage({ imagePath: path, printerName: selectedPrinter, copies: 1 });
        alert(t('print_sent'));
      } catch (error: any) {
        const msg = error.message || '';
        const matchedKey = msg.match(/err_[a-z_]+/)?.[0];
        const translatedMsg = matchedKey ? t(matchedKey) : (msg || t('print_failed'));
        alert(`${t('print_failed')}: ${translatedMsg}`);
      }
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.02)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <div style={styles.container}>
      <button 
        style={styles.infoButton} 
        onClick={handleInfoClick}
        onMouseOver={e => e.currentTarget.style.opacity = '1'}
        onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
        title={t('help_youtube')}
      >
        ℹ️
      </button>
      <h1 style={styles.title}>⚙️ {t('settings')}</h1>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🌐 Language (언어 설정)</h2>
        <select style={styles.select} value={currentLanguage} onChange={handleLanguageChange}>
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🎨 {t('image_effects')}</h2>
        <div style={styles.sliderContainer}>
          <label style={styles.sliderLabel}>{t('brightness')}: {brightness.toFixed(2)}</label>
          <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.05" 
            value={brightness} 
            onChange={e => setBrightness(parseFloat(e.target.value))}
            style={styles.slider}
          />
        </div>
        <div style={styles.sliderContainer}>
          <label style={styles.sliderLabel}>{t('contrast')}: {contrast.toFixed(2)}</label>
          <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.05" 
            value={contrast} 
            onChange={e => setContrast(parseFloat(e.target.value))}
            style={styles.slider}
          />
        </div>
        <div style={styles.sliderContainer}>
          <label style={styles.sliderLabel}>{t('saturation')}: {saturation.toFixed(2)}</label>
          <input 
            type="range" 
            min="0.5" 
            max="1.5" 
            step="0.05" 
            value={saturation} 
            onChange={e => setSaturation(parseFloat(e.target.value))}
            style={styles.slider}
          />
        </div>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>📷 {t('camera_settings')}</h2>
        <select style={styles.select} value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
          <option value="">{t('select_camera')}</option>
          {cameras.map((camera, index) => {
            const label =
              camera.label && camera.label.trim().length > 0
                ? camera.label
                : `${t('camera')} ${index + 1} (${camera.deviceId.slice(0, 6)})`;
            return (
              <option key={camera.deviceId} value={camera.deviceId}>
                {label}
              </option>
            );
          })}
        </select>
        <div style={styles.checkboxContainer}>
          <input 
            type="checkbox" 
            id="cameraFlip" 
            checked={isCameraFlipped} 
            onChange={e => setIsCameraFlipped(e.target.checked)}
            style={styles.checkbox}
          />
          <label htmlFor="cameraFlip" style={styles.sliderLabel}>{t('camera_flip')}</label>
        </div>
        <div style={styles.sliderInline}>
          <label style={styles.sliderLabel}>{t('shutter_timer')}</label>
          <input
            type="range"
            min="5"
            max="10"
            step="1"
            value={shutterTimer}
            onChange={e => setShutterTimer(parseInt(e.target.value, 10))}
            style={{ ...styles.slider, maxWidth: '280px' }}
          />
          <span style={styles.sliderValue}>{shutterTimer}{t('seconds')}</span>
        </div>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🖨️ {t('printer_device')}</h2>
        <select style={styles.select} value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}>
          <option value="">{t('select_printer')}</option>
          {printers.map(printer => {
            if (typeof printer === 'string') {
              return (
                <option key={printer} value={printer}>
                  {printer}
                </option>
              );
            }
            const name = printer?.name || printer?.printerName || printer?.deviceName;
            if (!name) {
              return null;
            }
            const label = printer.displayName || printer.description || name;
            return (
              <option key={name} value={name}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🗂️ {t('storage_path')}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.button} onClick={handleSelectOutputPath} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            {t('select_path')}
          </button>
          <button style={{ ...styles.button, backgroundColor: '#555' }} onClick={handleOpenOutputPath} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
            {t('open_folder')}
          </button>
        </div>
        <div style={styles.pathDisplay}>{outputPath || t('not_set_default')}</div>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🖼️ {t('main_image')}</h2>
        <button style={styles.button} onClick={handleSelectMainImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          {t('select_image')}
        </button>
        <button style={{...styles.button, backgroundColor: '#888'}} onClick={handleDeselectMainImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          {t('deselect')}
        </button>
        {mainImagePreview && <img src={mainImagePreview} style={styles.imagePreview} alt="Main" />}
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🧩 {t('template_image')}</h2>
        <button style={styles.button} onClick={handleSelectTemplateImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          {t('template_image')}
        </button>
        <button style={{...styles.button, backgroundColor: '#888'}} onClick={handleDeselectTemplateImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          {t('deselect')}
        </button>
        {templateImagePreview && <img src={templateImagePreview} style={styles.imagePreview} alt="Template" />}
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🔁🖨️ {t('reprint')}</h2>
        <button style={styles.button} onClick={handleReprint} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          {t('select_file_print')}
        </button>
      </div>

      <button style={styles.saveButton} onClick={handleSave} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
        {t('save_settings')}
      </button>

      <button onClick={handleBackToHome} style={styles.backLink}>
        {t('back_to_home')}
      </button>

      {showExitModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>{t('unsaved_changes')}</h2>
            <p style={{fontSize: '20px', marginBottom: '30px', color: 'var(--text-color)'}}>{t('unsaved_changes_msg')}</p>
            <div style={{display: 'flex', gap: '20px'}}>
              <button 
                style={{...styles.button, backgroundColor: 'var(--primary-color)'}} 
                onClick={async () => {
                  await handleSave();
                  navigate('/');
                }}
              >
                {t('save')}
              </button>
              <button 
                style={{...styles.button, backgroundColor: 'var(--secondary-color)'}} 
                onClick={() => navigate('/')}
              >
                {t('exit')}
              </button>
              <button 
                style={{...styles.button, backgroundColor: '#888'}} 
                onClick={() => setShowExitModal(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <button style={styles.licenseButton} onClick={() => setShowLicenseModal(true)}>
        {t('open_source_licenses')}
      </button>

      {showLicenseModal && (
        <div style={styles.modalOverlay} onClick={() => setShowLicenseModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button style={styles.modalCloseButton} onClick={() => setShowLicenseModal(false)}>×</button>
            <h2 style={styles.modalTitle}>{t('open_source_licenses')}</h2>
            <div>
              {LICENSES.map((license, index) => (
                <div key={index} style={styles.licenseItem}>
                  <div style={styles.licenseName}>{license.name}</div>
                  <div style={styles.licenseType}>{license.type}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
