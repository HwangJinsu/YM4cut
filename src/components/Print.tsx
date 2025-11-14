import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Print: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { finalImage?: string; printCount?: number } | null;
  const finalImage = state?.finalImage ?? '';
  const printCount = Math.max(1, Math.round(state?.printCount ?? 1));
  const copies = Math.max(1, Math.ceil(printCount / 2));
  const [printing, setPrinting] = useState(true);
  const [printError, setPrintError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--background-color)',
    },
    finalImage: {
      maxWidth: '80%',
      maxHeight: '60%',
      borderRadius: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      marginBottom: '20px',
    },
    message: {
      fontSize: 'var(--button-font-size)',
      marginTop: '20px',
      color: 'var(--text-color)',
    },
    error: {
      fontSize: 'var(--button-font-size)',
      marginTop: '20px',
      color: 'red',
    },
    buttonContainer: {
      display: 'flex',
      marginTop: '30px',
    },
    button: {
      width: '250px',
      height: '80px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: 'var(--button-font-size)',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      margin: '0 20px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s ease-out',
    },
  };

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    setPrintError(null);
    try {
      const settings = await window.electron.getSettings();
      await window.electron.printImage({
        imagePath: finalImage,
        printerName: settings.selectedPrinter,
        copies,
      });
    } catch (error: any) {
      console.error('Error printing image:', error);
      setPrintError(error.message || '인쇄 중 오류가 발생했습니다.');
    } finally {
      setPrinting(false);
    }
  }, [finalImage, copies]);

  useEffect(() => {
    const loadImageAndPrint = async () => {
      if (finalImage) {
        const dataUrl = await window.electron.getImageAsBase64(finalImage);
        setImagePreview(dataUrl);
        handlePrint(); // Automatically print on load
      } else {
        navigate('/');
      }
    };
    loadImageAndPrint();
  }, [finalImage, navigate, handlePrint]);

  const handleGoHome = () => {
    navigate('/');
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <div style={styles.container}>
      {imagePreview && <img src={imagePreview} style={styles.finalImage} alt="최종 결과" />}
      
      {printing && <div style={styles.message}>📄 사진을 인쇄하고 있습니다...</div>}
      {!printing && !printError && <div style={styles.message}>✅ 인쇄 요청을 보냈습니다.</div>}
      {printError && <div style={styles.error}>⚠️ {printError}</div>}

      <div style={styles.buttonContainer}>
        <button 
          style={styles.button} 
          onClick={handlePrint} 
          disabled={printing}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          다시 인쇄
        </button>
        <button 
          style={{...styles.button, backgroundColor: 'var(--secondary-color)'}} 
          onClick={handleGoHome}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          홈으로
        </button>
      </div>
    </div>
  );
};

export default Print;
