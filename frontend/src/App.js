import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainView from './components/MainView';
import './App.css';

// 设置默认上方向为Z轴，这符合机器人学的惯例
THREE.Object3D.DefaultUp.set(0, 0, 1);

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<MainView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
