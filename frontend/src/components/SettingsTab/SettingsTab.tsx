import { useEffect, useState } from 'react';

import { getSettings, updateSettings } from '../../api';
import type { Settings } from '../../types';
import styles from './SettingsTab.module.scss';

const CONTAINER_VALUES = ['mp4', 'mkv', 'original'];

const BROWSER_VALUES = [
  { value: '', label: 'Не использовать' },
  { value: 'safari', label: 'Safari' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'brave', label: 'Brave' },
];

export const SettingsTab = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => setError('Не удалось загрузить настройки'));
  }, []);

  if (!settings) {
    return <div className={styles.loading}>Загрузка…</div>;
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    setError('');
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch {
      setError('Не удалось сохранить настройки');
    }
  };

  return (
    <div className={styles.tab}>
      <label className={styles.label}>
        Cookies из браузера (нужны для YouTube):
        <select
          className={styles.select}
          value={settings.cookies_from_browser ?? ''}
          onChange={(e) => set('cookies_from_browser', e.target.value || null)}
        >
          {BROWSER_VALUES.map((browser) => (
            <option key={browser.value} value={browser.value}>
              {browser.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.label}>
        Контейнер по умолчанию:
        <select
          className={styles.select}
          value={settings.container}
          onChange={(e) => set('container', e.target.value)}
        >
          {CONTAINER_VALUES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.subtitles}
          onChange={(e) => set('subtitles', e.target.checked)}
        />
        Субтитры
      </label>

      {settings.subtitles && (
        <label className={styles.label}>
          Языки субтитров:
          <input
            className={styles.input}
            value={settings.subtitle_langs}
            onChange={(e) => set('subtitle_langs', e.target.value)}
          />
        </label>
      )}

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.embed_metadata}
          onChange={(e) => set('embed_metadata', e.target.checked)}
        />
        Метаданные (название, автор, дата)
      </label>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.embed_thumbnail}
          onChange={(e) => set('embed_thumbnail', e.target.checked)}
        />
        Обложка
      </label>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={settings.skip_existing}
          onChange={(e) => set('skip_existing', e.target.checked)}
        />
        Не скачивать уже существующие файлы
      </label>

      <div className={styles.row}>
        <button className={styles.button} onClick={handleSave}>
          Сохранить настройки
        </button>
        {saved && <span className={styles.saved}>✔ Сохранено</span>}
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};