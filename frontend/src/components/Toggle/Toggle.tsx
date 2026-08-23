import styles from "./Toggle.module.scss";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

export const Toggle = ({ checked, onChange, label }: ToggleProps) => {
  return (
    <label className={styles.toggle}>
      {label && <span className={styles.toggleLabel}>{label}</span>}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`${styles.track} ${checked ? styles.on : ""}`}>
        <span className={styles.thumb} />
      </span>
    </label>
  );
};
