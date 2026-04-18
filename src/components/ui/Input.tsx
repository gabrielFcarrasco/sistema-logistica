import { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Input.module.css';

// A interface herda tudo de um input padrão e adiciona "label" e "icone"
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icone?: ReactNode; // Aceita nossos SVGs do lucide-react
}

export default function Input({ label, icone, ...props }: InputProps) {
  return (
    <div className={styles.inputGroup}>
      <label className={styles.label}>{label}</label>
      
      <div className={styles.inputWrapper}>
        {/* Se a pessoa passar um ícone, nós o desenhamos aqui */}
        {icone && <div className={styles.icone}>{icone}</div>}
        
        {/* O input repassa todas as outras propriedades (value, onChange, type) */}
        <input className={styles.input} {...props} />
      </div>
    </div>
  );
}