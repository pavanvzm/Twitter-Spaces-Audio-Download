import { useState } from 'react';
import { Download, Link as LinkIcon, Loader2, AlertCircle, Info } from 'lucide-react';
import { useDownloadStore } from '../hooks/useDownload';
import api from '../utils/api';
import toast from 'react-hot-toast';

function HomePage() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp3');
  const [isValidating, setIsValidating] = useState(false);
  const [spaceInfo, setSpaceInfo] = useState(null);
  const [error, setError] = useState(null);
  
  const { startDownload, activeDownload, isDownloading } = useDownloadStore();

  // Validate and parse URL
  const validateUrl = async (spaceUrl) => {
    if (!spaceUrl.trim()) {
      setSpaceInfo(null);
      setError(null);
      return;
    }

    // Basic URL validation - supports multiple formats
    const urlPatterns = [
      /twitter\.com\/i\/spaces\/([A-Za-z0-9]+)/,
      /x\.com\/i\/spaces\/([A-Za-z0-9]+)/,
      /twitter\.com\/.*\/status\/\d+\/spaces/,
    ];
    
    let spaceId = null;
    for (const pattern of urlPatterns) {
      const match = spaceUrl.match(pattern);
      if (match && match[1]) {
        spaceId = match[1];
        break;
      }
    }

    if (!spaceId) {
      setError('Invalid Space URL. Use format: twitter.com/i/spaces/XXXXX');
      setSpaceInfo(null);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Fetch space metadata directly
      const metadataResponse = await api.get(`/spaces/${spaceId}`);
      setSpaceInfo(metadataResponse.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Space not found, private, or still live');
      } else if (err.response?.status === 429) {
        setError('Too many requests. Please wait a moment.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch Space');
      }
      setSpaceInfo(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced URL validation
  const debounceTimerRef = { current: null };
  
  const handleUrlChange = (e) => {
    const value = e.target.value;
    setUrl(value);
    setError(null);
    
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => validateUrl(value), 800);
  };

  // Start download
  const handleDownload = async () => {
    if (!spaceInfo) return;

    try {
      await startDownload(spaceInfo.id, format);
      setUrl('');
      setSpaceInfo(null);
    } catch (err) {
      toast.error('Failed to start download');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Download X Spaces
        </h1>
        <p className="text-gray-400">
          Paste any X Space link below to download the recording
        </p>
      </div>

      {/* Download Card */}
      <div className="card mb-8">
        {/* URL Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              X Space URL
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://twitter.com/i/spaces/1RDxlkAORPVJL"
                className="input-field pl-12"
                disabled={isDownloading}
              />
              {isValidating && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Output Format
            </label>
            <div className="flex gap-3">
              {['mp3', 'wav', 'm4a'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  disabled={isDownloading}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm uppercase
                    transition-all
                    ${format === fmt
                      ? 'bg-white text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }
                    disabled:opacity-50
                  `}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-900/20 border border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Space info */}
          {spaceInfo && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                {spaceInfo.host?.avatarUrl && (
                  <img
                    src={spaceInfo.host.avatarUrl}
                    alt={spaceInfo.host.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {spaceInfo.title || 'Untitled Space'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    by @{spaceInfo.host?.username || 'unknown'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className={`
                      px-2 py-0.5 rounded-full
                      ${spaceInfo.status === 'live' 
                        ? 'bg-red-900/50 text-red-400 live-indicator' 
                        : spaceInfo.status === 'ended'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                      }
                    `}>
                      {spaceInfo.status === 'live' ? '🔴 LIVE' : spaceInfo.status === 'ended' ? '✓ Ended' : spaceInfo.status}
                    </span>
                    {spaceInfo.duration && (
                      <span>⏱️ {Math.floor(spaceInfo.duration / 60)}:{(spaceInfo.duration % 60).toString().padStart(2, '0')}</span>
                    )}
                    {spaceInfo.participantCount > 0 && (
                      <span>👥 {spaceInfo.participantCount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={isDownloading || spaceInfo.status === 'live'}
                className="btn-x w-full mt-4"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Downloading...
                  </>
                ) : spaceInfo.status === 'live' ? (
                  'Cannot download live Spaces'
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download {format.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Downloads */}
      {activeDownload && (
        <div className="card mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            Current Download
          </h3>
          <DownloadProgress download={activeDownload} />
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-gray-900/50">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              How to get a Space URL
            </h3>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>Open X and find the Space you want to download</li>
              <li>Tap the share icon (🔗) on the Space</li>
              <li>Select "Copy link"</li>
              <li>Paste the link in the field above</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Limitations notice */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-600">
          Guest mode has limited access. Some private Spaces may not be available.
        </p>
      </div>
    </div>
  );
}

function DownloadProgress({ download }) {
  const { downloadFile } = useDownloadStore();

  const statusLabels = {
    pending: 'Starting...',
    downloading: 'Downloading...',
    processing: 'Processing audio...',
    completed: 'Complete',
    failed: 'Failed',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 truncate">
          {download.metadata?.title || 'Space'}
        </span>
        <span className="text-sm text-gray-400">
          {statusLabels[download.status] || download.status}
        </span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${download.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{download.progress}%</span>
        {download.status === 'completed' && (
          <button
            onClick={() => downloadFile(download.id)}
            className="text-white hover:underline"
          >
            Save file
          </button>
        )}
      </div>
    </div>
  );
}

export default HomePage;
