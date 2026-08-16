import { useCallback, useEffect, useState } from 'react';

import { clearHistory, getHistory, openFolder } from '../../api';
import type { HistoryItem } from '../../types';
import { formatSize } from '../../utils/format';
import styles from './HistoryTab.module.scss';

export const HistoryTab = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);

  const refresh = useCallback(() => {
    getHistory().then((h) => setItems(h.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = async () => {
    await clearHistory();
    refresh();
  };

  const openContainingFolder = (path?: string) => {
    if (!path) return;
    const parent = path.split('/').slice(0, -1).join('/');
    openFolder(parent).catch(() => undefined);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <button className={styles.button} onClick={refresh}>Обновить</button>
        <button className={`${styles.button} ${styles.secondary}`} onClick={handleClear}>
          Очистить историю
        </button>
      </div>

      <ul className={styles.list}>
        {[...items].reverse().map((rec, i) => (
          <li key={`${rec.date}-${i}`} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={styles.date}>{rec.date}</span>
              <span className={rec.status === 'done' ? styles.ok : styles.bad}>{rec.status}</span>
              <span className={styles.quality}>{rec.quality}</span>
              {rec.size ? <span className={styles.size}>{formatSize(rec.size)}</span> : null}
              <button className={styles.folderBtn} onClick={() => openContainingFolder(rec.path)}>📂</button>
            </div>
            <div className={styles.title}>{rec.title}</div>
            <div className={styles.url}>{rec.url}</div>
            {rec.path && <div className={styles.path}>{rec.path}</div>}
          </li>
        ))}
        {items.length === 0 && <li className={styles.empty}>История пуста</li>}
      </ul>
    </div>
  );
};