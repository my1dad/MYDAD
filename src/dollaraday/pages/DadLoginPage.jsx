import { useState } from "react";
import { cn } from "@/lib/utils";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import DadLoginPanel from "../components/auth/DadLoginPanel.jsx";
import MobileShell from "../components/layout/MobileShell.jsx";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext.jsx";
import {
  getRememberLoginPrefs,
  setRememberLoginPrefs,
} from "../lib/dadProfileStorage";

export default function DadLoginPage() {
  const { login, register } = useDadAuth();
  const { t } = useLocale();
  const savedLoginPrefs = getRememberLoginPrefs();

  const [mode, setMode] = useState("sign-in");
  const [scrollKey, setScrollKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [username, setUsername] = useState(savedLoginPrefs.username);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(savedLoginPrefs.rememberMe);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const resetForm = (nextMode = "sign-in") => {
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setProfilePhotoUrl("");
    setEmail("");
    setPhone("");

    if (nextMode === "sign-in") {
      const prefs = getRememberLoginPrefs();
      setRememberMe(prefs.rememberMe);
      setUsername(prefs.rememberMe ? prefs.username : "");
    } else {
      setRememberMe(false);
      setUsername("");
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    resetForm(nextMode);
    setScrollKey((tick) => tick + 1);
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const result = await login(username, password, { rememberMe });
    if (!result.ok) {
      setError(
        result.error === "suspended"
          ? t("login.suspendedError")
          : result.error === "pendingApproval"
            ? t("login.pendingApprovalError")
            : result.error === "denied"
              ? t("login.deniedError")
              : result.error,
      );
      return;
    }

    setRememberLoginPrefs({
      rememberMe,
      username: rememberMe ? username.trim() : "",
    });
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("login.passwordMismatch"));
      return;
    }

    const result = await register({
      username,
      password,
      displayName,
      email,
      phone,
      profilePhotoUrl,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.pendingApproval) {
      const savedUsername = username.trim();
      setMode("sign-in");
      setError("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
      setProfilePhotoUrl("");
      setEmail("");
      setPhone("");
      setUsername(savedUsername);
      setSuccess(t("login.pendingApprovalSuccess"));
      setScrollKey((tick) => tick + 1);
    }
  };

  const handlePhotoError = (message) => {
    if (message) {
      setError(message);
    }
  };

  return (
    <MobileShell
      variant="login"
      scrollKey={scrollKey}
      shellClassName={mode === "create" ? "dda-mobile-shell--login-create" : undefined}
      mainClassName={cn(
        "dda-mobile-shell__main--login px-4 py-6 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6",
        mode === "create" && "dda-mobile-shell__main--login-create",
      )}
      contentClassName={cn("dda-login-stack", mode === "create" && "dda-login-stack--create")}
      footer={
        mode === "sign-in" ? (
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
              <span className="dda-login-contact__sep" aria-hidden="true">
                |
              </span>
              <a href="#terms" className="dda-login-contact__link">
                {t("login.termsOfService")}
              </a>
            </p>
          </div>
        ) : null
      }
    >
      <img
        src={DOLLARADAY_LOGO_URL}
        alt="My Dollar A Day"
        className={cn(
          "dda-login-logo mb-3 h-44 w-auto max-w-full object-contain sm:mb-4 sm:h-52",
          mode === "create" && "dda-login-logo--compact",
        )}
        draggable={false}
      />

      <p
        className={cn("dda-login-slogan", mode === "create" && "dda-login-slogan--compact")}
        aria-label={t("login.sloganAria")}
      >
        <span className="dda-login-slogan__word">{t("login.sloganEducate")}</span>
        <span className="dda-login-slogan__sep" aria-hidden="true">
          |
        </span>
        <span className="dda-login-slogan__word">{t("login.sloganDiscipline")}</span>
        <span className="dda-login-slogan__sep" aria-hidden="true">
          |
        </span>
        <span className="dda-login-slogan__word">{t("login.sloganUnity")}</span>
      </p>

      <div className={cn("dda-login-widget", mode === "create" && "dda-login-widget--create")}>
        <div className="dda-brand-card">
          <div className="dda-accent-bar" />
          <div className="p-5 sm:p-6">
            <DadLoginPanel
              embedded
              mode={mode}
              onSwitchMode={switchMode}
              error={error}
              success={success}
              username={username}
              password={password}
              rememberMe={rememberMe}
              confirmPassword={confirmPassword}
              displayName={displayName}
              profilePhotoUrl={profilePhotoUrl}
              email={email}
              phone={phone}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onRememberMeChange={setRememberMe}
              onConfirmPasswordChange={setConfirmPassword}
              onDisplayNameChange={setDisplayName}
              onProfilePhotoChange={setProfilePhotoUrl}
              onPhotoError={handlePhotoError}
              onEmailChange={setEmail}
              onPhoneChange={setPhone}
              onSignIn={handleSignIn}
              onCreateAccount={handleCreateAccount}
            />
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
