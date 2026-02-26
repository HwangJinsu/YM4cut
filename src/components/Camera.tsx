import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type CameraLocationState = {
  baseImages?: string[];
  reshootImages?: string[];
  printCount?: number;
};

// Precisely defined based on the slot dimensions in the reference template
const SLOT_WIDTH = 533;
const SLOT_HEIGHT = 340;
const TARGET_RATIO = SLOT_WIDTH / SLOT_HEIGHT;

const Camera: React.FC = () => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [shutter, setShutter] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const baseImagesRef = useRef<string[]>([]);
  const printCountRef = useRef<number>(1);
  const [shutterInterval, setShutterInterval] = useState<number>(5);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#000',
      position: 'relative' as 'relative',
      overflow: 'hidden',
    },
    progressBarContainer: {
      position: 'absolute' as 'absolute',
      top: '30px',
      width: '60%',
      height: '12px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: '6px',
      overflow: 'hidden' as 'hidden',
      zIndex: 20,
    },
    progressBar: {
      width: `${(capturedImages.length / 4) * 100}%`,
      height: '100%',
      backgroundColor: 'var(--primary-color)',
      transition: 'width 0.5s ease-in-out',
    },
    videoWrapper: {
      position: 'absolute' as 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    video: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as 'cover',
      transform: isFlipped ? 'scaleX(-1)' : 'none',
    },
    canvas: {
      display: 'none',
    },
    countdown: {
      position: 'absolute' as 'absolute',
      color: 'white',
      fontSize: '180pt',
      fontWeight: 'bold',
      textShadow: '0 0 30px rgba(0,0,0,0.8)',
      zIndex: 15,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    },
    errorText: {
      position: 'absolute' as 'absolute',
      color: '#ff4d4d',
      fontSize: '24pt',
      textAlign: 'center' as 'center',
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '20px',
      borderRadius: '16px',
    },
    backButton: {
      position: 'absolute' as 'absolute',
      top: '40px',
      left: '40px',
      fontSize: '28px',
      color: 'white',
      cursor: 'pointer',
      textDecoration: 'none',
      zIndex: 20,
      background: 'rgba(0,0,0,0.5)',
      padding: '12px 24px',
      borderRadius: '16px',
    },
    startOverlay: {
      position: 'absolute' as 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    startButton: {
      width: '320px',
      height: '130px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: '36pt',
      border: 'none',
      borderRadius: '24px',
      cursor: 'pointer',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      animation: 'pulse 2s infinite',
    },
    shutter: {
      position: 'absolute' as 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'white',
      opacity: 0,
      transition: 'opacity 0.1s ease-out',
      pointerEvents: 'none' as 'none',
      zIndex: 30,
    },
  };

  useEffect(() => {
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setVideoDimensions({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
      }
    };
    const video = videoRef.current;
    if (video) video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      if (video) video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const getRedLineStyle = () => {
    if (videoDimensions.width === 0) return { display: 'none' };
    
    // Virtual cameras like EOS Utility often send 16:9 frame but actual image is 3:2 centered.
    // We assume the user wants to see the 533:340 area relative to the VISIBLE center.
    const vRatio = videoDimensions.width / videoDimensions.height;
    
    // Reference: If stream is 16:9 (1.77) and content is 3:2 (1.5), we should zoom in slightly.
    const isWiderThan32 = vRatio > 1.6; 
    
    const cW = window.innerWidth;
    const cH = window.innerHeight;
    const cRatio = cW / cH;
    
    let scale;
    if (vRatio > cRatio) scale = cH / videoDimensions.height;
    else scale = cW / videoDimensions.width;
    
    // Calculate Capture Area in stream pixels
    let captureW, captureH;
    if (vRatio > TARGET_RATIO) {
      captureH = videoDimensions.height;
      captureW = captureH * TARGET_RATIO;
    } else {
      captureW = videoDimensions.width;
      captureH = captureW / TARGET_RATIO;
    }

    // Apply extra zoom for EOS Utility if it has black bars
    const zoomFactor = isWiderThan32 ? 1.15 : 1.0; 

    return {
      position: 'absolute' as 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${(captureW * scale) / zoomFactor}px`,
      height: `${(captureH * scale) / zoomFactor}px`,
      border: '6px solid #ff3b30',
      boxShadow: `0 0 0 5000px rgba(0,0,0,${isWiderThan32 ? '0.7' : '0.5'})`,
      zIndex: 5,
      pointerEvents: 'none' as 'none',
      borderRadius: '4px',
    };
  };

  useEffect(() => {
    const state = location.state as CameraLocationState | null;
    if (state?.baseImages) baseImagesRef.current = state.baseImages;
    if (state?.printCount) printCountRef.current = state.printCount;
  }, [location.state]);

  useEffect(() => {
    const getCamera = async () => {
      try {
        const settings = await window.electron.getSettings();
        if (settings.isCameraFlipped) setIsFlipped(true);
        if (settings.shutterTimer) setShutterInterval(parseInt(settings.shutterTimer, 10));
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: settings.selectedCamera ? { deviceId: { exact: settings.selectedCamera } } : true 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setCameraError(t('camera_not_found'));
      }
    };
    getCamera();
    return () => {
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, [t]);

  useEffect(() => {
    if (capturedImages.length === 4) {
      navigate('/compose', {
        state: {
          printCount: printCountRef.current,
          baseImages: baseImagesRef.current.length > 0 ? [...baseImagesRef.current] : [...capturedImages],
          reshootImages: baseImagesRef.current.length > 0 ? [...capturedImages] : undefined,
        },
      });
    }
  }, [capturedImages, navigate]);

  const capture = async () => {
    setShutter(true);
    setTimeout(() => setShutter(false), 150);

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const vRatio = vW / vH;

      // Smart Crop for EOS Utility (If wider than 1.6, assume it's 16:9 with bars and crop to 3:2 first)
      let sourceW = vW;
      let sourceH = vH;
      let sourceX = 0;
      let sourceY = 0;

      if (vRatio > 1.6) {
        // Force crop to 3:2 first to remove black side bars
        sourceW = vH * 1.5;
        sourceX = (vW - sourceW) / 2;
      }

      let sx, sy, sw, sh;
      const currentRatio = sourceW / sourceH;
      
      if (currentRatio > TARGET_RATIO) {
        sw = sourceH * TARGET_RATIO;
        sh = sourceH;
        sx = sourceX + (sourceW - sw) / 2;
        sy = sourceY;
      } else {
        sw = sourceW;
        sh = sourceW / TARGET_RATIO;
        sx = sourceX;
        sy = sourceY + (sourceH - sh) / 2;
      }

      canvas.width = 1066;
      canvas.height = 680;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const imagePath = await window.electron.saveImage(canvas.toDataURL('image/png'));
      setCapturedImages(prev => [...prev, imagePath]);
    }
  };

  const startCaptureSequence = () => {
    let captureCount = 0;
    const sequence = () => {
      let count = shutterInterval;
      setCountdown(count);
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          capture();
          captureCount += 1;
          if (captureCount < 4) setTimeout(sequence, 1000);
        } else setCountdown(count);
      }, 1000);
    };
    sequence();
  };

  return (
    <div style={styles.container}>
      <div style={styles.progressBarContainer}><div style={styles.progressBar}></div></div>
      <Link to="/select" style={styles.backButton}>{t('back')}</Link>
      <div style={styles.videoWrapper}>
        {cameraError ? <div style={styles.errorText}>{cameraError}</div> : <video ref={videoRef} style={styles.video} autoPlay playsInline />}
        <div style={getRedLineStyle()} />
      </div>
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={{...styles.shutter, opacity: shutter ? 1 : 0}}></div>
      {countdown !== null && <div style={styles.countdown}>{countdown}</div>}
      {capturedImages.length === 0 && countdown === null && !cameraError && (
        <div style={styles.startOverlay}><button style={styles.startButton} onClick={startCaptureSequence}>{t('take_photo')}</button></div>
      )}
    </div>
  );
};

export default Camera;
