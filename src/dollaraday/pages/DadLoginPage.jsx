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
      mainClassName="px-4 py-6 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6"
      contentClassName="dda-login-stack"
      footer={
        <div className="dda-login-contact">
          <p>{t("login.contactIntro")}</p>
          <p className="dda-login-contact__links">
            <a href="mailto:reppmio@gmail.com" className="dda-login-contact__link">
              {t("login.contactEmail")}
            </a>
            <span className="dda-login-contact__sep" aria-hidden="true">
              |
            </span>
            <a href="tel:+15613379411" className="dda-login-contact__link">
              {t("login.contactPhone")}
            </a>
          </p>
        </div>
      }
    >
      <img
        src={DOLLARADAY_LOGO_URL}
        alt="My Dollar A Day"
        className="mb-5 h-44 w-auto max-w-full object-contain sm:mb-6 sm:h-52"
        draggable={false}
      />

      <div className="dda-login-widget">
        <div className="dda-brand-card">
          <div className="dda-accent-bar" />
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
