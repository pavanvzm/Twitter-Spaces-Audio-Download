import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import DownloadsPage from './components/DownloadsPage';
import Header from './components/Header';

function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="downloads" element={<DownloadsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
