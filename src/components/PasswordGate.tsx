import { useState, type FormEvent, type ReactNode } from 'react';

// 前端密碼保護（進站 gate）。
// 注意：這只是「不公開 / 擋一般人」用途，密碼會被打包進前端 bundle，
// 任何人打開 devtools 都能看到 —— 不是強資安機制。真正的機密請放後端。

const STORAGE_KEY = 'verify_unlocked';

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(isUnlocked());
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const expected = import.meta.env.VITE_APP_PASSWORD ?? 'verify2026';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value === expected) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // sessionStorage 不可用時仍讓本次 session 解鎖
      }
      setUnlocked(true);
      setError('');
    } else {
      setError('密碼錯誤，請再試一次。');
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={handleSubmit}>
        <h1>驗收單 PDF 產生器</h1>
        <p className="gate-hint">請輸入密碼進入</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="密碼"
        />
        {error && <p className="gate-error">{error}</p>}
        <button type="submit">進入</button>
        <p className="gate-note">
          此密碼僅用於避免公開瀏覽，並非強資安機制。
        </p>
      </form>
    </div>
  );
}
