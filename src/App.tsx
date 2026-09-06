import { PasswordGate } from './components/PasswordGate';
import { VerificationForm } from './components/VerificationForm';

export function App() {
  return (
    <PasswordGate>
      <VerificationForm />
    </PasswordGate>
  );
}
