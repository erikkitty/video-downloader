import { useState } from 'react';
import axios from 'axios';

import {
  cancelDownload,
  getInfo,
  startDownload,
  updateSettings,
} from '../../api';
import type { ProgressEvent, StatusEvent, VideoInfo, WSEvent } from '../../types';
import { ProgressBar } from '../ProgressBar';
import styles from './DownloadTab.module.scss';

const QUALITY_VALUES = ['Максимальное', '2160p', '1440p', '1080p', '720p', '480p', '360p'];
const CONTAINER_VALUES = ['mp4', 'mkv', 'original'];

interface DownloadTabProps {
  events: WSEvent[];
}

export const DownloadTab = ({ events }: DownloadTabProps) => {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [quality, setQuality] = useState('Максимальное');
  const [container, setContainer] = useState('mp4');
  const [audioOnly, setAudioOnly] = useState(false);
  const [filename, setFilename] = useState('');
  const [formError, setFormError] = useState('');
  const [session, setSession] = useState({ started: false, baseline: 0 });

  const sessionEvents = events.slice(session.baseline);
  const statusEvents = sessionEvents.filter((e): e is StatusEvent => e.type === 'status');
  const progressEvents = sessionEvents.filter(
    (e): e is ProgressEvent => e.type === 'progress',
  );
  const lastStatus = statusEvents[statusEvents.length - 1];
  const lastProgress = progressEvents[progressEvents.length - 1];

  const busy = session.started && !lastStatus;
  const statusText =
    lastStatus?.status === 'done'
      ? '✔ Готово'
      : lastStatus?.status === 'cancelled'
        ? 'Отменено пользователем'
        : '';
  const downloadError =
    lastStatus?.status === 'error' ? (lastStatus.message || 'Ошибка скачивания') : '';
  const error = formError || downloadError;

  const handleGetInfo = async () => {
    setFormError('');
    setInfo(null);
    try {
      const data = await getInfo(url);
      setInfo(data);
      if (data.title && !filename.trim()) {
        setFilename(data.title);
      }
    } catch (err) {
      setFormError(
        axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : 'Ошибка получения информации',
      );
    }
  };

  const handleDownload = async () => {
    setFormError('');
    setSession({ started: true, baseline: events.length });
    try {
      await startDownload({
        url,
        quality,
        container,
        audio_only: audioOnly,
        filename: filename || undefined,
      });
    } catch (err) {
      setSession({ started: false, baseline: events.length });
      setFormError(
        axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : 'Ошибка запуска скачивания',
      );
    }
  };

  const handleCancel = async () => {
    try {
      await cancelDownload();
    } catch {
      setFormError('Ошибка отмены');
    }
  };

  const enableCookies = async (browser: string) => {
    try {
      await updateSettings({ cookies_from_browser: browser });
      await handleGetInfo();
    } catch {
      setFormError('Не удалось включить cookies');
    }
  };

  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className={styles.input}
        />
        <button onClick={handleGetInfo} className={styles.button}>
          Инфо
        </button>
      </div>

      {info && (
        <div className={styles.info}>
          <div>📺 {info.title}</div>
          <div>
            ⏱ {Math.floor((info.duration || 0) / 60)} мин {(info.duration || 0) % 60} сек
          </div>
          <div>🎞 Доступно разрешений: {info.heights.length}</div>
        </div>
      )}

      <div className={styles.row}>
        <label>
          Качество:
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className={styles.select}
          >
            {QUALITY_VALUES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <label>
          Контейнер:
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className={styles.select}
          >
            {CONTAINER_VALUES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={audioOnly}
            onChange={(e) => setAudioOnly(e.target.checked)}
          />
          Только звук (mp3)
        </label>
      </div>

      <div className={styles.row}>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="Имя файла"
          className={styles.input}
        />
      </div>

      <div className={styles.row}>
        {!busy ? (
          <button onClick={handleDownload} className={styles.button}>
            Скачать
          </button>
        ) : (
          <button onClick={handleCancel} className={`${styles.button} ${styles.cancel}`}>
            Отмена
          </button>
        )}
      </div>

      {busy && lastProgress && (
        <ProgressBar
          percent={lastProgress.percent}
          merging={lastProgress.merging}
          downloaded={lastProgress.downloaded}
          total={lastProgress.total}
          speed={lastProgress.speed}
          eta={lastProgress.eta}
        />
      )}

      {statusText && <div className={styles.status}>{statusText}</div>}
      {error && <div className={styles.error}>{error}</div>}

      {downloadError.toLowerCase().includes('bot') && (
        <div className={styles.hint}>
          <p>
            YouTube требует подтверждения, что вы человек. Разрешите приложению читать
            cookies вашего браузера — это одноразовое действие, настройка сохранится.
          </p>
          <button className={styles.button} onClick={() => enableCookies('safari')}>
            🍪 Включить cookies из Safari
          </button>
          <button className={styles.button} onClick={() => enableCookies('chrome')}>
            🍪 Из Chrome
          </button>
        </div>
      )}
    </div>
  );
};