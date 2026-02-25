import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type CameraLocationState = {
  baseImages?: string[];
  reshootImages?: string[];
  printCount?: number;
};

const TARGET_RATIO = 533 / 340;

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
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
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
    },
    errorText: {
      position: 'absolute' as 'absolute',
      color: '#ff4d4d',
      fontSize: '24pt',
      textAlign: 'center' as 'center',
      maxWidth: '80%',
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
      fontWeight: 'bold' as 'bold',
      transition: 'background 0.2s',
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
      backgroundColor: 'rgba(0,0,0,0.3)',
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
      pointerEvents: 'auto' as 'auto',
      fontWeight: 'bold' as 'bold',
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
    if (video) {
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }
    return () => {
      if (video) video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const getRedLineStyle = () => {
    if (videoDimensions.width === 0) return { display: 'none' };
    
    const vW = videoDimensions.width;
    const vH = videoDimensions.height;
    const vRatio = vW / vH;
    
    const cW = window.innerWidth;
    const cH = window.innerHeight;
    const cRatio = cW / cH;
    
    let scale;
    if (vRatio > cRatio) {
      scale = cH / vH;
    } else {
      scale = cW / vW;
    }
    
    let captureW, captureH;
    if (vRatio > TARGET_RATIO) {
      captureH = vH;
      captureW = vH * TARGET_RATIO;
    } else {
      captureW = vW;
      captureH = captureW / TARGET_RATIO;
    }
    
    return {
      position: 'absolute' as 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${captureW * scale}px`,
      height: `${captureH * scale}px`,
      border: '6px solid #ff3b30',
      boxShadow: '0 0 0 5000px rgba(0,0,0,0.5)',
      zIndex: 5,
      pointerEvents: 'none' as 'none',
      borderRadius: '4px',
    };
  };

  useEffect(() => {
    const state = location.state as CameraLocationState | null;
    if (state?.baseImages && Array.isArray(state.baseImages) && state.baseImages.length === 4) {
      baseImagesRef.current = state.baseImages;
    } else {
      baseImagesRef.current = [];
    }
    if (typeof state?.printCount === 'number' && Number.isFinite(state.printCount)) {
      printCountRef.current = Math.max(1, Math.round(state.printCount));
    }
  }, [location.state]);

  useEffect(() => {
    const getCamera = async () => {
      try {
        const settings = await window.electron.getSettings();
        if (settings.isCameraFlipped) setIsFlipped(true);
        if (settings.shutterTimer) {
          setShutterInterval(Math.min(10, Math.max(5, parseInt(settings.shutterTimer, 10))));
        }
        
        const videoConstraints: MediaStreamConstraints['video'] = {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };
        if (settings.selectedCamera) {
          videoConstraints.deviceId = { exact: settings.selectedCamera };
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setCameraError(t('camera_not_found'));
      }
    };

    getCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (capturedImages.length === 4) {
      const baseImages = baseImagesRef.current;
      const sharedState = { printCount: printCountRef.current };
      navigate('/compose', {
        state: {
          ...sharedState,
          baseImages: baseImages.length > 0 ? [...baseImages] : [...capturedImages],
          reshootImages: baseImages.length > 0 ? [...capturedImages] : undefined,
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

      let sx, sy, sw, sh;
      if (vRatio > TARGET_RATIO) {
        sw = vH * TARGET_RATIO;
        sh = vH;
        sx = (vW - sw) / 2;
        sy = 0;
      } else {
        sw = vW;
        sh = vW / TARGET_RATIO;
        sx = 0;
        sy = (vH - sh) / 2;
      }

      canvas.width = 1066; // Standardized width
      canvas.height = 680; // Standardized height (1066 / TARGET_RATIO)
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      const imagePath = await window.electron.saveImage(dataUrl);
      setCapturedImages(prev => [...prev, imagePath]);
    }
  };

  const startCaptureSequence = () => {
    let captureCount = 0;
    const sequence = () => {
      let count = shutterInterval;
      setCountdown(count);
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(countdownInterval);
          setCountdown(null);
          capture();
          captureCount += 1;
          if (captureCount < 4) setTimeout(sequence, 800);
        } else {
          setCountdown(count);
        }
      }, 1000);
    };
    sequence();
  };

  return (
    <div style={styles.container}>
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>
      
      <Link to="/select" style={styles.backButton}>{t('back')}</Link>
      
      <div style={styles.videoWrapper}>
        {cameraError ? (
          <div style={styles.errorText}>{cameraError}</div>
        ) : (
          <video ref={videoRef} style={styles.video} autoPlay playsInline />
        )}
        <div style={getRedLineStyle()} />
      </div>

      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={{...styles.shutter, opacity: shutter ? 1 : 0}}></div>
      
      {countdown !== null && <div style={styles.countdown}>{countdown}</div>}
      
      {capturedImages.length === 0 && countdown === null && !cameraError && (
        <div style={styles.startOverlay}>
          <button style={styles.startButton} onClick={startCaptureSequence}>{t('take_photo')}</button>
        </div>
      )}
    </div>
  );
};

export default Camera;
