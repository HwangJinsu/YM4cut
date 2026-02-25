import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import defaultMainImage from '../assets/images/main-default.png';

const Home: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [mainImage, setMainImage] = useState<string>(defaultMainImage);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!window.electron) return;
      
      const settings = await window.electron.getSettings();
      
      // Load main image
      if (settings.mainImage) {
        const dataUrl = await window.electron.getImageAsBase64(settings.mainImage);
        if (dataUrl) setMainImage(dataUrl);
      }
      
      // Only change language if it's different from current
      if (settings.language && i18n.language !== settings.language) {
        console.log('[Home] Initializing language from settings:', settings.language);
        i18n.changeLanguage(settings.language);
      }
    };
    fetchSettings();
    // Run only once on mount to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--background-color)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundImage: `url(${mainImage})`,
      position: 'relative' as 'relative',
    },
    startButton: {
      width: '300px',
      height: '100px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: 'var(--button-font-size)',
      border: 'none',
      borderRadius: '16px',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      transition: 'transform 0.2s ease-out',
      animation: 'pulse 2s infinite',
    },
    settingsButton: {
      position: 'absolute' as 'absolute',
      bottom: '20px',
      left: '20px',
      width: '60px',
      height: '60px',
      backgroundColor: 'var(--secondary-color)',
      color: 'white',
      fontSize: '24px',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s ease-out',
    },
    copyright: {
      position: 'absolute' as 'absolute',
      bottom: '20px',
      width: '100%',
      textAlign: 'center' as 'center',
      color: 'white',
      fontSize: '20px',
      textShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
      pointerEvents: 'none' as 'none',
      opacity: 0.9,
    },
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return (
    <div style={styles.container}>
      <Link to="/select">
        <button 
          style={styles.startButton} 
          onMouseOver={handleMouseOver} 
          onMouseOut={handleMouseOut}
        >
          {t('start')}
        </button>
      </Link>
      <Link to="/settings">
        <button 
          style={styles.settingsButton} 
          onMouseOver={handleMouseOver} 
          onMouseOut={handleMouseOut}
          title={t('settings')}
        >
          ⚙️
        </button>
      </Link>
      <div style={styles.copyright}>
        © 2025 용중네컷(YM4cut) · Hwang Jinsu. All rights reserved.
      </div>
    </div>
  );
};

export default Home;
