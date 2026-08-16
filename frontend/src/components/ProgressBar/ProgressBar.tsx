import { formatSize, formatTime } from '../../utils/format';
import styles from './ProgressBar.module.scss';

interface ProgressBarProps {
  percent: number | null;
  merging?: boolean;
  downloaded?: number;
  total?: number;
  speed?: number;
  eta?: number;
}

export const ProgressBar = ({ percent, merging, downloaded, total, speed, eta }: ProgressBarProps) => {
  const percentage = percent !== null ? Math.min(percent * 100, 100) : 0;

  return (
    <div className={styles.progressContainer}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${percentage}%` }} />
      </div>
      <div className={styles.progressInfo}>
        {merging ? (
          <span>Склеиваю потоки...</span>
        ) : (
          <>
            <span>{percentage.toFixed(1)}%</span>
            {downloaded !== undefined && total !== undefined && (
              <span>{formatSize(downloaded)} / {total > 0 ? formatSize(total) : '...'}</span>
            )}
            {speed !== undefined && speed > 0 && <span>{formatSize(speed)}/s</span>}
            {eta !== undefined && eta > 0 && <span>ETA {formatTime(eta)}</span>}
          </>
        )}
      </div>
    </div>
  );
};