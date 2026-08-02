import { memo, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import DadLoginPanel from "../components/auth/DadLoginPanel.jsx";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext.jsx";
import {
  getRememberLoginPrefs,
  setRememberLoginPrefs,
} from "../lib/dadProfileStorage";

const LoginChrome = memo(function LoginChrome({ compact, sloganAria, educate, discipline, unity }) {
  return (
    <>
      <img
        src={DOLLARADAY_LOGO_URL}
        alt="My Dollar A Day"
        width={208}
        height={208}
        decoding="async"
        fetchPriority="low"
        className={cn(
          "dda-login-logo mb-3 h-28 w-auto max-w-full object-contain sm:mb-4 sm:h-36",
          compact && "dda-login-logo--compact",
        )}
        draggable={false}
      />
      <p
        className={cn("dda-login-slogan", compact && "dda-login-slogan--compact")}
        aria-label={sloganAria}
      >
        <span className="dda-login-slogan__inner">
          <span className="dda-login-slogan__word">{educate}</span>
          <span className="dda-login-slogan__sep" aria-hidden="true">
            |
          </span>
          <span className="dda-login-slogan__word">{discipline}</span>
          <span className="dda-login-slogan__sep" aria-hidden="true">
            |
          </span>
          <span className="dda-login-slogan__word">{unity}</span>
        </span>
      </p>
    </>
  );
});

export default function DadLoginPage() {
  const { login, register } = useDadAuth();
  const { t } = useLocale();
  const savedLoginPrefs = useMemo(() => getRememberLoginPrefs(), []);

  const [mode, setMode] = useState("sign-in");
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
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback((nextMode = "sign-in") => {
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
  }, []);

  const switchMode = useCallback(
    (nextMode) => {
      setMode(nextMode);
      resetForm(nextMode);
    },
    [resetForm],
  );

  const handleSignIn = useCallback(
    async (event) => {
      event.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError("");
      setSuccess("");

      try {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [login, password, rememberMe, submitting, t, username],
  );

  const handleCreateAccount = useCallback(
    async (event) => {
      event.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError("");

      try {
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      confirmPassword,
      displayName,
      email,
      password,
      phone,
      profilePhotoUrl,
      register,
      submitting,
      t,
      username,
    ],
  );

  const handlePhotoError = useCallback((message) => {
    if (message) setError(message);
  }, []);

  const compact = mode === "create";

  return (
    <div className={cn("dda-mobile-shell dda-mobile-shell--login dda-login-fast", compact && "dda-mobile-shell--login-create")}>
      <main
        className={cn(
          "dda-mobile-shell__main dda-scroll dda-mobile-shell__main--login px-4 py-6 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6",
          compact && "dda-mobile-shell__main--login-create",
        )}
      >
        <div className={cn("dda-page-stack dda-login-stack", compact && "dda-login-stack--create")}>
          <LoginChrome
            compact={compact}
            sloganAria={t("login.sloganAria")}
            educate={t("login.sloganEducate")}
            discipline={t("login.sloganDiscipline")}
            unity={t("login.sloganUnity")}
          />

          <div className={cn("dda-login-widget", compact && "dda-login-widget--create")}>
            <div className="dda-brand-card dda-brand-card--login">
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
        </div>
      </main>

      {mode === "sign-in" ? (
        <footer className="dda-mobile-shell__footer">
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
        </footer>
      ) : null}
    </div>
  );
}
