import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type ComposeState = {
  baseImages?: string[];
  reshootImages?: string[];
};

type ImageMeta = {
  src: string;
  aspectRatio: number;
};

const MAX_SELECTION = 4;

const Compose: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ComposeState | undefined;

  const baseImagesRef = useRef<string[]>(state?.baseImages ?? []);
  const reshootImagesRef = useRef<string[]>(state?.reshootImages ?? []);
  const baseImages = baseImagesRef.current;
  const reshootImages = reshootImagesRef.current;
  const [allImages] = useState<string[]>(() => [...baseImages, ...reshootImages]);

  useEffect(() => {
    if (baseImages.length < MAX_SELECTION) {
      navigate('/');
    }
  }, [baseImages, navigate]);

  const initialSelection =
    reshootImages.length > 0 ? [] : Array.from({ length: MAX_SELECTION }, (_, index) => index);

  const [selectedIndexes, setSelectedIndexes] = useState<number[]>(initialSelection);
  const [imageMeta, setImageMeta] = useState<ImageMeta[]>(() =>
    allImages.map(() => ({ src: '', aspectRatio: 3 / 4 }))
  );
  const [composing, setComposing] = useState<boolean>(initialSelection.length === MAX_SELECTION);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const lastSelectionKey = useRef<string>('');

  useEffect(() => {
    let isActive = true;
    const loadPreviews = async () => {
      const previews = await Promise.all(
        allImages.map(async imagePath => {
          try {
            const dataUrl = await window.electron.getImageAsBase64(imagePath);
            if (!dataUrl) {
              return { src: '', aspectRatio: 3 / 4 };
            }
            const ratio = await new Promise<number>(resolve => {
              const img = new Image();
              img.onload = () => {
                if (img.height === 0) {
                  resolve(3 / 4);
                } else {
                  resolve(img.width / img.height);
                }
              };
              img.onerror = () => resolve(3 / 4);
              img.src = dataUrl;
            });
            return { src: dataUrl, aspectRatio: ratio };
          } catch (error) {
            console.error('Failed to load preview:', error);
            return { src: '', aspectRatio: 3 / 4 };
          }
        })
      );
      if (isActive) {
        setImageMeta(previews);
      }
    };

    loadPreviews();
    return () => {
      isActive = false;
    };
  }, [allImages]);

  useEffect(() => {
    if (selectedIndexes.length !== MAX_SELECTION) {
      setComposing(false);
      setFinalImage(null);
      lastSelectionKey.current = '';
      return;
    }

    const selectionKey = selectedIndexes.join('-');
    if (selectionKey === lastSelectionKey.current) {
      return;
    }
    lastSelectionKey.current = selectionKey;

    setComposing(true);
    setComposeError(null);

    const compose = async () => {
      try {
        const selectedPaths = selectedIndexes.map(index => allImages[index]);
        const finalImagePath = await window.electron.composeImages(selectedPaths);
        setFinalImage(finalImagePath);
      } catch (error: any) {
        console.error('Error composing images:', error);
        setComposeError(`이미지 합성에 실패했습니다: ${error.message ?? error}`);
        setFinalImage(null);
        lastSelectionKey.current = '';
      } finally {
        setComposing(false);
      }
    };

    compose();
  }, [selectedIndexes, allImages]);

  const toggleSelection = (index: number) => {
    setSelectedIndexes(prev => {
      const existing = prev.indexOf(index);
      if (existing !== -1) {
        const next = [...prev];
        next.splice(existing, 1);
        return next;
      }
      if (prev.length >= MAX_SELECTION) {
        return prev;
      }
      return [...prev, index];
    });
  };

  const goToPrint = () => {
    if (!finalImage) {
      alert('선택한 사진을 합성 중입니다. 잠시만 기다려주세요.');
      return;
    }
    navigate('/print', { state: { finalImage } });
  };

  const handleRetake = () => {
    navigate('/camera', { state: { baseImages: [...baseImages] } });
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    if ((e.currentTarget as HTMLButtonElement).disabled) return;
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  const isPrintDisabled =
    selectedIndexes.length !== MAX_SELECTION || composing || !finalImage;

  const styles = {
    container: {
      position: 'relative' as const,
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--background-color)',
      color: 'var(--text-color)',
      overflow: 'hidden' as const,
    },
    content: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      height: '100%',
      width: '100%',
      padding: '40px 60px 200px',
      boxSizing: 'border-box' as const,
      overflowY: 'auto' as const,
    },
    instructions: {
      fontSize: 'var(--body-font-size)',
      color: 'var(--text-color)',
      marginBottom: '16px',
      textAlign: 'center' as const,
    },
    selectionCount: {
      color: 'var(--primary-color)',
      fontWeight: 600,
      marginLeft: '8px',
    },
    previewTitle: {
      fontSize: 'var(--button-font-size)',
      fontWeight: 600,
      marginBottom: '24px',
    },
    imageGrid: (columns: number) => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(260px, 1fr))`,
      gap: '28px',
      width: '100%',
      maxWidth: '1400px',
    }),
    imageCard: {
      position: 'relative' as const,
      borderRadius: '18px',
      overflow: 'hidden' as const,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      cursor: 'pointer',
      border: '5px solid transparent',
      transition: 'transform 0.2s ease-out, border 0.2s ease-out',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageCardSelected: {
      border: '5px solid var(--primary-color)',
      transform: 'translateY(-8px)',
    },
    imageFrame: (ratio: number) => ({
      position: 'relative' as const,
      width: '100%',
      maxWidth: '520px',
      aspectRatio: ratio || 3 / 4,
      backgroundColor: '#fff',
      borderRadius: '12px',
      overflow: 'hidden' as const,
      boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
      transform: 'scale(1.3)',
      transformOrigin: 'center',
    }),
    orderBadge: {
      position: 'absolute' as const,
      top: '16px',
      left: '16px',
      width: '52px',
      height: '52px',
      borderRadius: '50%',
      backgroundColor: 'rgba(0,0,0,0.75)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '22px',
      zIndex: 2,
    },
    previewImage: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain' as const,
      backgroundColor: '#000',
    },
    imagePlaceholder: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#999',
      fontSize: '20px',
      background: 'linear-gradient(135deg, #f0f0f0, #fafafa)',
    },
    buttonRow: {
      position: 'absolute' as const,
      top: '75%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      gap: '32px',
      flexWrap: 'wrap' as const,
      justifyContent: 'center',
    },
    button: {
      width: '260px',
      height: '90px',
      backgroundColor: 'var(--primary-color)',
      color: 'white',
      fontSize: 'var(--button-font-size)',
      border: 'none',
      borderRadius: '18px',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
      transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    },
    secondaryButton: {
      backgroundColor: 'var(--secondary-color)',
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    statusMessage: {
      position: 'absolute' as const,
      top: '88%',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: 'var(--body-font-size)',
      color: 'var(--primary-color)',
      textAlign: 'center' as const,
      width: '80%',
    },
    errorText: {
      fontSize: 'var(--body-font-size)',
      color: 'var(--error-color)',
      maxWidth: '80%',
      marginTop: '20px',
      textAlign: 'center' as const,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.instructions}>
          {reshootImages.length > 0
            ? '총 8장의 사진이 준비되었습니다. 마음에 드는 4장을 순서대로 선택해 주세요.'
            : '촬영된 사진을 확인하고 필요하면 재촬영을 진행하세요.'}
          <span style={styles.selectionCount}>
            {selectedIndexes.length}/{MAX_SELECTION}
          </span>
        </div>

        <div style={styles.previewTitle}>
          {allImages.length > MAX_SELECTION ? '8컷 미리보기' : '4컷 미리보기'}
        </div>

        <div style={styles.imageGrid(allImages.length > MAX_SELECTION ? 4 : 2)}>
          {allImages.map((imagePath, index) => {
            const meta = imageMeta[index] ?? { src: '', aspectRatio: 3 / 4 };
            const preview = meta.src;
            const selectionOrder = selectedIndexes.indexOf(index);
            const isSelected = selectionOrder !== -1;
            return (
              <div
              key={imagePath}
              style={{
                ...styles.imageCard,
                ...(isSelected ? styles.imageCardSelected : {}),
              }}
              onClick={() => toggleSelection(index)}
              role="button"
              aria-pressed={isSelected}
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleSelection(index);
                }
              }}
              >
                <div style={styles.imageFrame(meta.aspectRatio)}>
                  {isSelected && (
                    <div style={styles.orderBadge}>{selectionOrder + 1}</div>
                  )}
                  {preview ? (
                    <img
                      src={preview}
                      style={styles.previewImage}
                      alt={`촬영 이미지 ${index + 1}`}
                    />
                  ) : (
                    <div style={styles.imagePlaceholder}>미리보기 준비 중...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {composeError && <div style={styles.errorText}>{composeError}</div>}
      </div>

      <div style={styles.buttonRow}>
        <button
          style={{ ...styles.button, ...styles.secondaryButton }}
          onClick={handleRetake}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          재촬영
        </button>
        <button
          style={{
            ...styles.button,
            ...(isPrintDisabled ? styles.buttonDisabled : {}),
          }}
          onClick={goToPrint}
          disabled={isPrintDisabled}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          인쇄하기
        </button>
      </div>

      {composing && (
        <div style={styles.statusMessage}>선택한 사진을 합성 중입니다...</div>
      )}
      {!composing && selectedIndexes.length === MAX_SELECTION && finalImage && (
        <div style={styles.statusMessage}>합성이 완료되었습니다. 인쇄하기를 눌러주세요.</div>
      )}
    </div>
  );
};

export default Compose;
