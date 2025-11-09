import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './components/Home';
import Select from './components/Select';
import Camera from './components/Camera';
import Compose from './components/Compose';
import Print from './components/Print';
import Settings from './components/Settings';
import './App.css';

function ExitButton() {
  const handleExit = () => {
    window.electron.quitApp();
  };

  return (
    <button className="app-exit-button" onClick={handleExit} aria-label="앱 종료">
      X
    </button>
  );
}

function AppContent() {
  const location = useLocation();
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Home />} />
      <Route path="/select" element={<Select />} />
      <Route path="/camera" element={<Camera />} />
      <Route path="/compose" element={<Compose />} />
      <Route path="/print" element={<Print />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <div className="app-shell">
        <ExitButton />
        <AppContent />
      </div>
    </Router>
  );
}

export default App;
