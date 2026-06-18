import { useState } from "react";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import DadLoginPanel from "../components/auth/DadLoginPanel.jsx";
import MobileShell from "../components/layout/MobileShell.jsx";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext.jsx";

export default function DadLoginPage() {
  const { login, register } = useDadAuth();
  const { t } = useLocale();

  const [mode, setMode] = useState("sign-in");
  const [scrollKey, setScrollKey] = useState(0);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const resetForm = () => {
    setError("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    resetForm();
    setScrollKey((tick) => tick + 1);
  };

  const handleSignIn = (event) => {
    event.preventDefault();
    setError("");

    const result = login(username, password);
    if (!result.ok) {
      setError(result.error);
    }
  };

  const handleCreateAccount = (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("login.passwordMismatch"));
      return;
    }

    const result = register({ username, password, displayName });
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <MobileShell
      variant="login"
      scrollKey={scrollKey}
      mainClassName="px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6"
      contentClassName="mx-auto flex w-full max-w-xl flex-col items-center"
    >
      <img
        src={DOLLARADAY_LOGO_URL}
        alt="My Dollar A Day"
        className="mb-4 h-auto w-full max-w-[220px] sm:max-w-[280px]"
        draggable={false}
      />

      <div className="w-full">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-xl shadow-emerald-500/5 ring-1 ring-white/5">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
          <div className="p-5 sm:p-6">
            <DadLoginPanel
              embedded
              mode={mode}
              onSwitchMode={switchMode}
              error={error}
              username={username}
              password={password}
              confirmPassword={confirmPassword}
              displayName={displayName}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onDisplayNameChange={setDisplayName}
              onSignIn={handleSignIn}
              onCreateAccount={handleCreateAccount}
            />
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
