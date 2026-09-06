import { PasswordGate } from './components/PasswordGate';
import { VerificationForm } from './components/VerificationForm';

export function App() {
  return (
    <>
      <PasswordGate>
        <VerificationForm />
      </PasswordGate>
      <footer className="app-footer">版本 v{__APP_VERSION__}</footer>
    </>
  );
}
