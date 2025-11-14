import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [templateImagePreview, setTemplateImagePreview] = useState<string | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('');

  const [brightness, setBrightness] = useState<number>(1.05);
  const [contrast, setContrast] = useState<number>(1);
  const [saturation, setSaturation] = useState<number>(1.1);
  const [isCameraFlipped, setIsCameraFlipped] = useState<boolean>(false);
  const [shutterTimer, setShutterTimer] = useState<number>(5);
  const electronAPI = typeof window !== 'undefined' ? window?.electron : undefined;

  useEffect(() => {
    const fetchDevicesAndSettings = async () => {
      // Fetch settings
      if (!electronAPI) {
        console.warn('[Settings] electron API unavailable; running in browser context');
        return;
      }
      const settings = await electronAPI.getSettings();
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
      if (settings.selectedCamera) {
        setSelectedCamera(settings.selectedCamera);
      }
      if (settings.selectedPrinter) {
        setSelectedPrinter(settings.selectedPrinter);
      }
      if (settings.outputPath) {
        setOutputPath(settings.outputPath);
      }
      if (settings.brightness) {
        setBrightness(parseFloat(settings.brightness));
      }
      if (settings.contrast) {
        setContrast(parseFloat(settings.contrast));
      }
      if (settings.saturation) {
        setSaturation(parseFloat(settings.saturation));
      }
      if (settings.isCameraFlipped) {
        setIsCameraFlipped(settings.isCameraFlipped);
      }
      if (settings.shutterTimer) {
        setShutterTimer(Number(settings.shutterTimer));
      }

      // Fetch cameras
      let videoDevices: MediaDeviceInfo[] = [];
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length === 0 && navigator.mediaDevices.getUserMedia) {
            try {
              const tempStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
              const refreshed = await navigator.mediaDevices.enumerateDevices();
              videoDevices = refreshed.filter(device => device.kind === 'videoinput');
              tempStream.getTracks().forEach(track => track.stop());
            } catch (permissionError) {
              console.warn('[Settings] getUserMedia fallback failed', permissionError);
            }
          }
        } catch (deviceError) {
          console.warn('[Settings] Failed to enumerate camera devices', deviceError);
        }
      }
      setCameras(videoDevices);

      // Fetch printers
      const printerList = await electronAPI.getPrinters();
      setPrinters(printerList);
    };
    fetchDevicesAndSettings();
  }, [electronAPI]);

  useEffect(() => {
    const refreshPrinters = async () => {
      if (!electronAPI) {
        return;
      }
      try {
        const printerList = await electronAPI.getPrinters();
        setPrinters(printerList);
      } catch (err) {
        console.warn('[Settings] Failed to refresh printers', err);
      }
    };
    refreshPrinters();
    const interval = setInterval(refreshPrinters, 10000);
    return () => clearInterval(interval);
  }, [electronAPI]);

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
      padding: '20px',
      fontSize: '24px',
      borderRadius: '12px',
      border: '1px solid #ccc',
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
    backLink: {
      marginTop: '20px',
      fontSize: '20px',
      color: 'var(--text-color)',
      textDecoration: 'none',
    },
  };

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

  const handleReprint = async () => {
    if (!electronAPI) return;
    const path = await electronAPI.openFileDialog();
    if (path) {
      try {
        console.log('[Settings] Reprint requested', { path, printer: selectedPrinter });
        await electronAPI.printImage({ imagePath: path, printerName: selectedPrinter, copies: 1 });
        alert('인쇄 요청을 보냈습니다.');
      } catch (error: any) {
        alert(`인쇄 실패: ${error.message}`);
      }
    }
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
    };
    await electronAPI.saveSettings(newSettings);
    alert('설정이 저장되었습니다!');
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.02)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>⚙️ 설정</h1>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🎨 이미지 효과</h2>
        <div style={styles.sliderContainer}>
          <label style={styles.sliderLabel}>밝기: {brightness.toFixed(2)}</label>
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
          <label style={styles.sliderLabel}>대비: {contrast.toFixed(2)}</label>
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
          <label style={styles.sliderLabel}>채도: {saturation.toFixed(2)}</label>
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
        <h2 style={styles.settingHeader}>📷 카메라 설정</h2>
        <select style={styles.select} value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
          <option value="">카메라를 선택하세요</option>
          {cameras.map(camera => (
            <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>
          ))}
        </select>
        <div style={styles.checkboxContainer}>
          <input 
            type="checkbox" 
            id="cameraFlip" 
            checked={isCameraFlipped} 
            onChange={e => setIsCameraFlipped(e.target.checked)}
            style={styles.checkbox}
          />
          <label htmlFor="cameraFlip" style={styles.sliderLabel}>카메라 좌우반전</label>
        </div>
        <div style={styles.sliderInline}>
          <label style={styles.sliderLabel}>셔터 타이머</label>
          <input
            type="range"
            min="5"
            max="10"
            step="1"
            value={shutterTimer}
            onChange={e => setShutterTimer(parseInt(e.target.value, 10))}
            style={{ ...styles.slider, maxWidth: '280px' }}
          />
          <span style={styles.sliderValue}>{shutterTimer}초</span>
        </div>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🖨️ 프린터 장치</h2>
        <select style={styles.select} value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}>
          <option value="">프린터를 선택하세요</option>
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
        <h2 style={styles.settingHeader}>🗂️ 네컷 이미지 저장 경로</h2>
        <button style={styles.button} onClick={handleSelectOutputPath} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          경로 선택
        </button>
        <div style={styles.pathDisplay}>{outputPath || '미설정 (기본 경로에 저장됩니다)'}</div>
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🖼️ 메인 화면 이미지</h2>
        <button style={styles.button} onClick={handleSelectMainImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          이미지 선택
        </button>
        <button style={{...styles.button, backgroundColor: '#888'}} onClick={handleDeselectMainImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          선택 해제
        </button>
        {mainImagePreview && <img src={mainImagePreview} style={styles.imagePreview} alt="Main" />}
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🧩 사진 템플릿 이미지</h2>
        <button style={styles.button} onClick={handleSelectTemplateImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          템플릿 선택
        </button>
        <button style={{...styles.button, backgroundColor: '#888'}} onClick={handleDeselectTemplateImage} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          선택 해제
        </button>
        {templateImagePreview && <img src={templateImagePreview} style={styles.imagePreview} alt="Template" />}
      </div>

      <div style={styles.settingItem}>
        <h2 style={styles.settingHeader}>🔁🖨️ 이미지 파일 재인쇄</h2>
        <button style={styles.button} onClick={handleReprint} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
          파일 선택하여 인쇄
        </button>
      </div>

      <button style={styles.saveButton} onClick={handleSave} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
        설정 저장
      </button>
      <Link to="/" style={styles.backLink}>홈으로 돌아가기</Link>
    </div>
  );
};

export default Settings;
