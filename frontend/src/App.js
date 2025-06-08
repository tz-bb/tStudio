import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainView from './components/MainView';
import './App.css';

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
