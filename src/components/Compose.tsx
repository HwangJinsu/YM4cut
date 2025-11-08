import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Compose: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [composing, setComposing] = useState(true);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const hasComposed = useRef(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { images } = location.state as { images: string[] };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--background-color)',
      textAlign: 'center' as 'center',
    },
    loadingText: {
      fontSize: 'var(--headline-font-size)',
      color: 'var(--primary-color)',
    },
    errorText: {
      fontSize: 'var(--button-font-size)',
      color: 'red',
      maxWidth: '80%',
    },
    previewContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '10px',
      maxWidth: '90%',
      maxHeight: '60%',
      marginBottom: '20px',
    },
    previewImage: {
      height: '100%',
      maxWidth: '24%',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
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

  useEffect(() => {
    const processImages = async () => {
      if (hasComposed.current || !images || images.length !== 4) {
        if (!images || images.length !== 4) navigate('/');
        return;
      }
      hasComposed.current = true;

      // Load previews first
      const previews = await Promise.all(
        images.map(imagePath => window.electron.getImageAsBase64(imagePath))
      );
      setImagePreviews(previews.filter((p): p is string => p !== null));

      // Then compose in the background
      try {
        const finalImagePath = await window.electron.composeImages(images);
        setFinalImage(finalImagePath);
      } catch (error: any) {
        console.error('Error composing images:', error);
        setComposeError(`이미지 합성에 실패했습니다: ${error.message}. 템플릿 이미지 파일이 올바른지 확인해주세요.`);
      } finally {
        setComposing(false);
      }
    };

    processImages();
  }, [images, navigate]);

  const goToPrint = () => {
    if (finalImage) {
      navigate('/print', { state: { finalImage } });
    } else {
      // Handle case where composition is not finished or failed
      alert('아직 이미지가 준비되지 않았습니다. 잠시만 기다려주세요.');
    }
  };

  const handleRetake = () => {
    navigate('/camera');
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  const renderContent = () => {
    if (composing) {
      return <div style={styles.loadingText}>사진을 꾸미는 중...</div>;
    }
    if (composeError) {
      return (
        <>
          <div style={styles.errorText}>{composeError}</div>
          <button style={styles.button} onClick={handleRetake}>재촬영</button>
        </>
      );
    }
    return (
      <>
        <div style={styles.previewContainer}>
          {imagePreviews.map((preview, index) => (
            <img key={index} src={preview} style={styles.previewImage} alt={`촬영 이미지 ${index + 1}`} />
          ))}
        </div>
        <div style={styles.buttonContainer}>
          <button 
            style={{...styles.button, backgroundColor: 'var(--secondary-color)'}} 
            onClick={handleRetake}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            재촬영
          </button>
          <button 
            style={styles.button} 
            onClick={goToPrint} 
            disabled={!finalImage}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            인쇄하기
          </button>
        </div>
      </>
    );
  };

  return (
    <div style={styles.container}>
      {renderContent()}
    </div>
  );
};

export default Compose;
