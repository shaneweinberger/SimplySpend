import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import UnderConstruction from './components/UnderConstruction';
import DashboardLayout from './components/DashboardLayout';
import Overview from './components/dashboard/Overview';
import Analysis from './components/dashboard/Analysis';
import Processing from './components/dashboard/Processing';
import AIProcessing from './components/dashboard/AIProcessing';
import Budgeting from './components/dashboard/Budgeting';
import GettingStarted from './components/dashboard/GettingStarted';
import ThemeProvider from './components/ThemeProvider';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/under-construction" element={<UnderConstruction />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="getting-started" element={<GettingStarted />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="budgeting" element={<Budgeting />} />
            <Route path="processing" element={<Processing />} />
            <Route path="ai-processing" element={<AIProcessing />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
