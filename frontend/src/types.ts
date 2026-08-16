export interface VideoInfo {
  title: string;
  duration: number;
  heights: number[];
  formats_count: number;
}

export interface DownloadRequest {
  url: string;
  quality: string;
  container: string;
  audio_only: boolean;
  filename?: string;
  out_dir?: string;
  cookies_from_browser?: string;
}

export interface ProgressEvent {
  type: 'progress';
  merging: boolean;
  percent: number | null;
  downloaded?: number;
  total?: number;
  speed?: number;
  eta?: number;
}

export interface StatusEvent {
  type: 'status';
  url: string;
  title: string;
  status: 'done' | 'cancelled' | 'error';
  message?: string;
}

export interface QueueItem {
  url: string;
  name?: string;
  quality: string;
  status: string;
  cookies_from_browser?: string;
}

export interface HistoryItem {
  date: string;
  url: string;
  title: string;
  quality: string;
  container: string;
  status: string;
  path?: string;
  size?: number;
}

export interface Settings {
  output_dir: string;
  container: string;
  cookies_from_browser: string | null;
  subtitles: boolean;
  subtitle_langs: string;
  embed_metadata: boolean;
  embed_thumbnail: boolean;
  skip_existing: boolean;
}

export type WSEvent = ProgressEvent | StatusEvent | { type: 'queue' } | { type: 'queue_done' };