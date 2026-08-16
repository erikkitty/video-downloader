import { useEffect, useState } from "react";
import axios from "axios";

import {
  addToQueue,
  clearQueue,
  getQueue,
  removeFromQueue,
  startQueue,
} from "../../api";
import type { QueueItem, WSEvent } from "../../types";
import styles from "./QueueTab.module.scss";

const QUALITY_VALUES = [
  "Максимальное",
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
];

interface QueueTabProps {
  events: WSEvent[];
}

export const QueueTab = ({ events }: QueueTabProps) => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [quality, setQuality] = useState("Максимальное");
  const [error, setError] = useState("");

  const queueEventsCount = events.filter(
    (e) => e.type === "queue" || e.type === "queue_done",
  ).length;

  useEffect(() => {
    let alive = true;
    getQueue()
      .then((q) => {
        if (alive) {
          setItems(q.items);
          setBusy(q.busy);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [queueEventsCount]);

  const handleAdd = async () => {
    setError("");
    try {
      await addToQueue(url, name || undefined, quality);
      setUrl("");
      setName("");
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : "Ошибка добавления",
      );
    }
  };

  const handleStart = async () => {
    setError("");
    try {
      await startQueue();
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : "Ошибка запуска очереди",
      );
    }
  };

  const handleRemove = async (index: number) => {
    await removeFromQueue(index);
  };

  const handleClear = async () => {
    await clearQueue();
  };

  return (
    <div className={styles.tab}>
      <div className={styles.row}>
        <input
          className={styles.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя файла (необязательно)"
        />
        <select
          className={styles.select}
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
        >
          {QUALITY_VALUES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <button className={styles.button} onClick={handleAdd}>
          Добавить
        </button>
      </div>

      <ul className={styles.list}>
        {items.map((item, i) => (
          <li key={`${item.url}-${i}`} className={styles.listItem}>
            <span className={styles.itemStatus}>[{item.status}]</span>
            <span className={styles.itemUrl}>{item.url}</span>
            {item.name && (
              <span className={styles.itemName}>→ {item.name}</span>
            )}
            <button
              className={styles.removeBtn}
              onClick={() => handleRemove(i)}
            >
              ✕
            </button>
          </li>
        ))}
        {items.length === 0 && <li className={styles.empty}>Очередь пуста</li>}
      </ul>

      <div className={styles.row}>
        <button className={styles.button} onClick={handleStart} disabled={busy}>
          ▶ Начать очередь
        </button>
        <button
          className={`${styles.button} ${styles.secondary}`}
          onClick={handleClear}
        >
          Очистить всё
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};
