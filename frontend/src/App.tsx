import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { StatusPage } from './pages/StatusPage';
import { EscapePage } from './pages/EscapePage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/escape" element={<EscapePage />} />
        <Route path="/escape/:roomId" element={<EscapePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
