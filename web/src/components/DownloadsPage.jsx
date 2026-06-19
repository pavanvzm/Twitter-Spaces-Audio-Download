import { Download, Trash2, Share2, Play } from 'lucide-react';
import { useDownloadStore } from '../hooks/useDownload';

function DownloadsPage() {
  const { downloads, deleteDownload, downloadFile } = useDownloadStore();

  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const activeDownloads = downloads.filter(d => 
    d.status === 'pending' || d.status === 'downloading' || d.status === 'processing'
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Download Library</h1>

      {/* Active downloads */}
      {activeDownloads.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
            In Progress
          </h2>
          <div className="space-y-3">
            {activeDownloads.map((download) => (
              <ActiveDownloadCard key={download.id} download={download} />
            ))}
          </div>
        </div>
      )}

      {/* Completed downloads */}
      {completedDownloads.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
            Completed ({completedDownloads.length})
          </h2>
          <div className="space-y-3">
            {completedDownloads.map((download) => (
              <CompletedDownloadCard 
                key={download.id} 
                download={download}
                onDelete={() => deleteDownload(download.id)}
                onDownload={() => downloadFile(download.id)}
              />
            ))}
          </div>
        </div>
      ) : activeDownloads.length === 0 ? (
        <div className="text-center py-16">
          <Download className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            No downloads yet
          </h3>
          <p className="text-sm text-gray-500">
            Your downloaded Space recordings will appear here
          </p>
        </div>
      ) : null}

      {/* Empty state for completed when only active exist */}
      {completedDownloads.length === 0 && activeDownloads.length > 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Completed downloads will appear here
        </div>
      )}
    </div>
  );
}

function ActiveDownloadCard({ download }) {
  return (
    <div className="card flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
        <Download className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">
          {download.metadata?.title || 'Space'}
        </p>
        <p className="text-sm text-gray-400">
          {download.status === 'processing' ? 'Processing...' : `${download.progress}%`}
        </p>
      </div>
      <div className="w-32">
        <div className="progress-bar">
          <div 
            className="progress-fill animate-pulse"
            style={{ width: `${download.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function CompletedDownloadCard({ download, onDelete, onDownload }) {
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card flex items-center gap-4 hover:border-gray-700 transition-colors">
      {/* Thumbnail/Icon */}
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center flex-shrink-0">
        {download.metadata?.host?.avatarUrl ? (
          <img
            src={download.metadata.host.avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <Play className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">
          {download.metadata?.title || 'Untitled Space'}
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
          <span>by @{download.metadata?.host?.username || 'unknown'}</span>
          <span className="text-gray-600">•</span>
          <span>{download.format?.toUpperCase()}</span>
          {download.fileSize && (
            <>
              <span className="text-gray-600">•</span>
              <span>{formatSize(download.fileSize)}</span>
            </>
          )}
          {download.metadata?.duration && (
            <>
              <span className="text-gray-600">•</span>
              <span>{formatDuration(download.metadata.duration)}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Download file"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default DownloadsPage;
