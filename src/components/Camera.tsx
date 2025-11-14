import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type CameraLocationState = {
  baseImages?: string[];
  reshootImages?: string[];
  printCount?: number;
};

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [shutter, setShutter] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
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
    },
    progressBarContainer: {
      position: 'absolute' as 'absolute',
      top: '20px',
      width: '80%',
      height: '10px',
      backgroundColor: '#555',
      borderRadius: '5px',
      overflow: 'hidden' as 'hidden',
      zIndex: 10,
    },
    progressBar: {
      width: `${(capturedImages.length / 4) * 100}%`,
      height: '100%',
      backgroundColor: 'var(--primary-color)',
      transition: 'width 0.5s ease-in-out',
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
      fontSize: '120pt',
      fontWeight: 'bold',
      textShadow: '0 0 20px rgba(0,0,0,0.5)',
    },
    errorText: {
      position: 'absolute' as 'absolute',
      color: 'red',
      fontSize: '24pt',
      textAlign: 'center' as 'center',
      maxWidth: '80%',
    },
    backButton: {
      position: 'absolute' as 'absolute',
      top: '40px',
      left: '20px',
      fontSize: '20px',
      color: 'white',
      cursor: 'pointer',
      textDecoration: 'none',
      zIndex: 10,
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
      zIndex: 5,
    },
    startButton: {
      width: '260px',
      height: '110px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: '28pt',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      animation: 'pulse 2s infinite',
      pointerEvents: 'auto' as 'auto',
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
    },
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
        if (settings.isCameraFlipped) {
          setIsFlipped(true);
        }
        if (settings.shutterTimer) {
          setShutterInterval(Math.min(10, Math.max(5, parseInt(settings.shutterTimer, 10))));
        }
        const desiredAspectRatio = 533 / 340;
        const videoConstraints: MediaStreamConstraints['video'] = {
          aspectRatio: desiredAspectRatio,
          width: { ideal: 1920 },
          height: { ideal: Math.round(1920 / desiredAspectRatio) },
        };
        if (settings.selectedCamera) {
          videoConstraints.deviceId = { exact: settings.selectedCamera };
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
        setCameraError('카메라를 찾을 수 없거나 접근 권한이 없습니다. 앱 설정과 카메라 연결을 확인해주세요.');
      }
    };

    getCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (capturedImages.length === 4) {
      const baseImages = baseImagesRef.current;
      const sharedState = { printCount: printCountRef.current };
      if (baseImages.length > 0) {
        navigate('/compose', {
          state: {
            ...sharedState,
            baseImages: [...baseImages],
            reshootImages: [...capturedImages],
          },
        });
      } else {
        navigate('/compose', {
          state: {
            ...sharedState,
            baseImages: [...capturedImages],
          },
        });
      }
    }
  }, [capturedImages, navigate]);

  const triggerShutter = () => {
    setShutter(true);
    setTimeout(() => setShutter(false), 200);
  };

  const capture = async () => {
    triggerShutter();
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const targetRatio = 533 / 340;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const videoRatio = videoWidth / videoHeight;

      let sx = 0;
      let sy = 0;
      let sw = videoWidth;
      let sh = videoHeight;

      if (videoRatio > targetRatio) {
        sw = Math.round(videoHeight * targetRatio);
        sx = Math.max(0, Math.round((videoWidth - sw) / 2));
      } else if (videoRatio < targetRatio) {
        sh = Math.round(videoWidth / targetRatio);
        sy = Math.max(0, Math.round((videoHeight - sh) / 2));
      }

      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const imagePath = await window.electron.saveImage(dataUrl);
        setCapturedImages(prev => [...prev, imagePath]);
      }
    }
  };

  const startCaptureSequence = () => {
    let captureCount = 0;
    const intervalSeconds = Math.min(10, Math.max(5, Math.round(shutterInterval)));

    const sequence = () => {
      let count = intervalSeconds;
      setCountdown(count);
      const countdownInterval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(countdownInterval);
          setCountdown(null);
          capture();
          captureCount += 1;
          if (captureCount < 4) {
            setTimeout(sequence, 500);
          }
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
      <Link to="/select" style={styles.backButton}>뒤로가기</Link>
      {cameraError ? (
        <div style={styles.errorText}>{cameraError}</div>
      ) : (
        <video ref={videoRef} style={styles.video} autoPlay playsInline />
      )}
      <canvas ref={canvasRef} style={styles.canvas} />
      <div style={{...styles.shutter, opacity: shutter ? 1 : 0}}></div>
      {countdown !== null && countdown > 0 && (
        <div style={styles.countdown}>{countdown}</div>
      )}
      {capturedImages.length === 0 && countdown === null && !cameraError && (
        <div style={styles.startOverlay}>
          <button style={styles.startButton} onClick={startCaptureSequence}>촬영 시작</button>
        </div>
      )}
    </div>
  );
};

export default Camera;
