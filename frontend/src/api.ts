import axios from 'axios';
import type { VideoInfo, DownloadRequest, QueueItem, HistoryItem, Settings } from './types';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});

export const getInfo = async (url: string, cookies?: string): Promise<VideoInfo> => {
  const params: Record<string, string> = { url };
  if (cookies) params.cookies_from_browser = cookies;
  const { data } = await API.get('/api/info', { params });
  return data;
};

export const startDownload = async (req: DownloadRequest): Promise<void> => {
  await API.post('/api/download', req);
};

export const cancelDownload = async (): Promise<void> => {
  await API.post('/api/cancel');
};

export const getQueue = async (): Promise<{ items: QueueItem[]; busy: boolean }> => {
  const { data } = await API.get('/api/queue');
  return data;
};

export const addToQueue = async (url: string, name?: string, quality?: string): Promise<void> => {
  await API.post('/api/queue/add', { url, name, quality });
};

export const startQueue = async (): Promise<void> => {
  await API.post('/api/queue/start');
};

export const removeFromQueue = async (index: number): Promise<void> => {
  await API.delete(`/api/queue/${index}`);
};

export const clearQueue = async (): Promise<void> => {
  await API.post('/api/queue/clear');
};

export const getHistory = async (): Promise<{ items: HistoryItem[] }> => {
  const { data } = await API.get('/api/history');
  return data;
};

export const clearHistory = async (): Promise<void> => {
  await API.post('/api/history/clear');
};

export const getSettings = async (): Promise<Settings> => {
  const { data } = await API.get('/api/settings');
  return data;
};

export const updateSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const { data } = await API.put('/api/settings', patch);
  return data;
};

export const openFolder = async (path: string): Promise<void> => {
  await API.post('/api/open-folder', { path });
};