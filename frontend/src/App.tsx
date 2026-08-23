import { useState } from "react";

import { DownloadTab } from "./components/DownloadTab";
import { HistoryTab } from "./components/HistoryTab";
import { QueueTab } from "./components/QueueTab";
import { SettingsTab } from "./components/SettingsTab";
import { useWebSocket } from "./hooks/useWebSocket";
import styles from "./App.module.scss";

type TabId = "download" | "queue" | "history" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "download", label: "Скачивание" },
  { id: "queue", label: "Очередь" },
  { id: "history", label: "История" },
  { id: "settings", label: "Настройки" },
];

function App() {
  const { events } = useWebSocket("ws://127.0.0.1:8000/ws");
  const [active, setActive] = useState<TabId>("download");

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blobGreen}`} />
        <span className={`${styles.blob} ${styles.blobPurple}`} />
      </div>

      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.logo}>
            Vidrop
          </div>
          <nav className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`${styles.tab} ${active === t.id ? styles.active : ""}`}
                onClick={() => setActive(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className={styles.content}>
          {active === "download" && <DownloadTab events={events} />}
          {active === "queue" && <QueueTab events={events} />}
          {active === "history" && <HistoryTab />}
          {active === "settings" && <SettingsTab />}
        </main>
      </div>
    </>
  );
}

export default App;
