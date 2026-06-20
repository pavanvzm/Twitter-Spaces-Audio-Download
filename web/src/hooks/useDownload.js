/**
 * Download Hook
 * 
 * Manages Space download operations including progress tracking.
 */

import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useDownloadStore = create((set, get) => ({
  downloads: [],
  activeDownload: null,
  isDownloading: false,

  // Parse a Space URL
  parseUrl: async (url) => {
    try {
      const { data } = await api.post('/spaces/parse', { url });
      return data;
    } catch (error) {
      toast.error('Invalid Space URL');
      throw error;
    }
  },

  // Start a download
  startDownload: async (spaceId, format = 'mp3') => {
    try {
      set({ isDownloading: true });
      
      const { data } = await api.post('/download/start', {
        spaceId,
        format,
      });

      const download = {
        id: data.taskId,
        spaceId,
        metadata: data.metadata,
        status: 'pending',
        progress: 0,
        format,
      };

      set((state) => ({
        downloads: [download, ...state.downloads],
        activeDownload: download,
      }));

      // Start polling for progress
      get().pollProgress(data.taskId);

      return data;
    } catch (error) {
      set({ isDownloading: false });
      
      // Extract useful error message
      const errorMsg = error.response?.data?.error || 
                       error.response?.data?.details ||
                       error.message ||
                       'Failed to start download';
      
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
  },

  // Poll for download progress
  pollProgress: async (taskId, maxAttempts = 120) => {
    let attempts = 0;
    const poll = async () => {
      try {
        attempts++;
        const { data } = await api.get(`/download/${taskId}`);
        
        set((state) => ({
          downloads: state.downloads.map((d) =>
            d.id === taskId
              ? { ...d, status: data.status, progress: data.progress, error: data.error }
              : d
          ),
          activeDownload:
            state.activeDownload?.id === taskId
              ? { ...state.activeDownload, status: data.status, progress: data.progress, error: data.error }
              : state.activeDownload,
          isDownloading: data.status === 'downloading' || data.status === 'processing',
        }));

        // Handle completion or failure
        if (data.status === 'completed') {
          toast.success('Download complete! Click to save the file.');
          set({ isDownloading: false });
        } else if (data.status === 'failed') {
          const errorMsg = data.error || 'Download failed';
          toast.error(errorMsg);
          set({ isDownloading: false });
        } else if (data.status === 'pending' || data.status === 'downloading' || data.status === 'processing') {
          // Continue polling (max 2 minutes)
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            toast.error('Download timed out');
            set({ isDownloading: false });
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
        // Don't stop polling on network errors, just continue
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Longer interval on error
        }
      }
    };

    poll();
  },

  // Download the completed file
  downloadFile: async (taskId) => {
    try {
      const response = await api.get(`/download/${taskId}/file`, {
        responseType: 'blob',
      });

      // Get filename from Content-Disposition
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 'space.mp3';

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('File downloaded');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to download file';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }
  },

  // Delete a download
  deleteDownload: async (taskId) => {
    try {
      await api.delete(`/download/${taskId}`);
      
      set((state) => ({
        downloads: state.downloads.filter((d) => d.id !== taskId),
        activeDownload: state.activeDownload?.id === taskId ? null : state.activeDownload,
      }));

      toast.success('Download deleted');
    } catch (error) {
      toast.error('Failed to delete download');
      throw error;
    }
  },

  // Clear all downloads
  clearDownloads: () => set({ downloads: [], activeDownload: null }),
}));
