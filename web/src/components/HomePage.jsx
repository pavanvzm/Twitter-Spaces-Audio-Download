import { useState, useEffect, useRef } from 'react';
import { Download, Link as LinkIcon, Loader2, AlertCircle, Info } from 'lucide-react';
import { useDownloadStore } from '../hooks/useDownload';
import { useSpaceFetcher } from '../hooks/useSpaceFetcher';
import toast from 'react-hot-toast';

function HomePage() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp3');
  const [isValidating, setIsValidating] = useState(false);
  const [spaceInfo, setSpaceInfo] = useState(null);
  const [error, setError] = useState(null);
  const [validationStatus, setValidationStatus] = useState('idle'); // idle, validating, valid, error
  
  const { startDownload, activeDownload, isDownloading } = useDownloadStore();
  const { fetchSpace, loading: fetcherLoading } = useSpaceFetcher();

  // Use ref for debounce timer - proper pattern
  const debounceTimerRef = useRef(null);

  // Extract Space ID from URL
  const extractSpaceId = (inputUrl) => {
    const urlPatterns = [
      /twitter\.com\/i\/spaces\/([A-Za-z0-9]+)/,
      /x\.com\/i\/spaces\/([A-Za-z0-9]+)/,
    ];
    
    for (const pattern of urlPatterns) {
      const match = inputUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Validate and parse URL - fetches directly from Twitter in browser
  const validateUrl = async (spaceUrl) => {
    if (!spaceUrl.trim()) {
      setSpaceInfo(null);
      setError(null);
      setValidationStatus('idle');
      return;
    }

    const spaceId = extractSpaceId(spaceUrl);
    if (!spaceId) {
      setError('Invalid Space URL. Use format: twitter.com/i/spaces/XXXXX');
      setSpaceInfo(null);
      setValidationStatus('error');
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationStatus('validating');

    try {
      // Fetch directly from Twitter using browser's authentication
      const metadata = await fetchSpace(spaceId);
      setSpaceInfo(metadata);
      setValidationStatus('valid');
      setError(null);
    } catch (err) {
      const errorMessage = err.message;
      
      if (errorMessage.includes('Not logged in')) {
        setError('Please log in to X in another tab first, then try again.');
      } else if (errorMessage.includes('private')) {
        setError('This Space is private and cannot be accessed.');
      } else if (errorMessage.includes('not found') || errorMessage.includes('invalid')) {
        setError('Space not found or does not exist.');
      } else if (errorMessage.includes('rate')) {
        setError('Too many requests. Please wait a moment.');
      } else {
        setError(errorMessage || 'Failed to fetch Space. Please try again.');
      }
      setSpaceInfo(null);
      setValidationStatus('error');
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced URL validation
  const handleUrlChange = (e) => {
    const value = e.target.value;
    setUrl(value);
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Clear error when typing
    if (error) {
      setError(null);
      setValidationStatus('idle');
    }
    
    // Don't validate empty input
    if (!value.trim()) {
      setSpaceInfo(null);
      setValidationStatus('idle');
      return;
    }

    // Quick pattern check for immediate feedback
    const quickCheck = /twitter\.com\/i\/spaces\/[A-Za-z0-9]+|x\.com\/i\/spaces\/[A-Za-z0-9]+/.test(value);
    if (!quickCheck) {
      setValidationStatus('error');
      setError('Invalid URL format');
      return;
    }

    setValidationStatus('validating');
    
    // Debounce the actual API call
    debounceTimerRef.current = setTimeout(() => {
      validateUrl(value);
    }, 800);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Start download - uses browser to download directly from X
  const handleDownload = async () => {
    if (!spaceInfo || !spaceInfo.streamUrl) {
      toast.error('No audio available for this Space');
      return;
    }

    if (spaceInfo.status === 'live') {
      toast.error('Cannot download live Spaces');
      return;
    }

    toast.loading('Downloading audio...', { id: 'download' });

    try {
      // Download directly in browser using the stream URL
      const response = await fetch(spaceInfo.streamUrl, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${spaceInfo.title || 'space'}.m4a`.replace(/[^a-zA-Z0-9._-]/g, '_');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Download complete!', { id: 'download' });
      
      setUrl('');
      setSpaceInfo(null);
    } catch (err) {
      console.error('Download error:', err);
      toast.error(err.message || 'Download failed', { id: 'download' });
    }
  };

  // Get status icon for validation feedback
  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400 animate-spin" />;
      case 'valid':
        return (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
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
                className={`input-field pl-12 pr-12 ${
                  validationStatus === 'error' ? 'border-red-500' : 
                  validationStatus === 'valid' ? 'border-green-500' : ''
                }`}
                disabled={isDownloading}
              />
              {getStatusIcon()}
            </div>
            {/* Validation hint */}
            {url && validationStatus === 'validating' && !spaceInfo && !error && (
              <p className="text-xs text-gray-500 mt-1">Checking Space...</p>
            )}
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
              <div>
                <p className="text-red-400 text-sm font-medium">Error</p>
                <p className="text-red-400/80 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Space info */}
          {spaceInfo && (
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="flex items-start gap-3">
                {spaceInfo.host?.avatarUrl ? (
                  <img
                    src={spaceInfo.host.avatarUrl}
                    alt={spaceInfo.host.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-lg">👤</span>
                  </div>
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
                disabled={isDownloading || spaceInfo.status === 'live' || !spaceInfo.streamUrl}
                className="btn-x w-full mt-4"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Downloading...
                  </>
                ) : spaceInfo.status === 'live' ? (
                  <>
                    <span className="text-lg">🔴</span>
                    Live Spaces cannot be downloaded
                  </>
                ) : !spaceInfo.streamUrl ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Recording not available
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Download M4A
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
