import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Select: React.FC = () => {
  const [count, setCount] = useState(2);
  const navigate = useNavigate();

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
    countContainer: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '40px',
    },
    countButton: {
      width: '80px',
      height: '80px',
      fontSize: '40px',
      margin: '0 20px',
      borderRadius: '50%',
      border: '2px solid var(--primary-color)',
      backgroundColor: 'white',
      color: 'var(--primary-color)',
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s',
    },
    countDisplay: {
      fontSize: '72pt',
      fontWeight: 'bold',
      color: 'var(--primary-color)',
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
    },
    backButton: {
      position: 'absolute' as 'absolute',
      top: '20px',
      left: '20px',
      fontSize: '24px',
      color: 'var(--text-color)',
      cursor: 'pointer',
      textDecoration: 'none',
    },
  };

  const increment = () => {
    if (count < 10) {
      setCount(count + 1);
    }
  };

  const decrement = () => {
    if (count > 1) {
      setCount(count - 1);
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  const startCapture = () => {
    navigate('/camera', { state: { printCount: count } });
  };

  return (
    <div style={styles.container}>
      <Link to="/" style={styles.backButton}>뒤로가기</Link>
      <div style={styles.countContainer}>
        <button 
          style={styles.countButton} 
          onClick={decrement} 
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.color = 'white'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'var(--primary-color)'; }}
        >
          -
        </button>
        <div style={styles.countDisplay}>{count}</div>
        <button 
          style={styles.countButton} 
          onClick={increment}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; e.currentTarget.style.color = 'white'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'var(--primary-color)'; }}
        >
          +
        </button>
      </div>
      <button 
        style={styles.startButton} 
        onClick={startCapture}
        onMouseOver={handleMouseOver} 
        onMouseOut={handleMouseOut}
      >
        촬영 시작
      </button>
    </div>
  );
};

export default Select;
