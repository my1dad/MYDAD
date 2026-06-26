import { CheckCircle2 } from "lucide-react";
import { useLocale } from "../../i18n/LocaleContext.jsx";
import LanguageToggle from "../layout/LanguageToggle.jsx";
import PasswordInput from "./PasswordInput.jsx";
import ProfilePhotoPicker from "./ProfilePhotoPicker.jsx";
import { formatPhoneInput } from "../../lib/phoneFormat";

export default function DadLoginPanel({
  mode,
  onSwitchMode,
  error,
  success,
  username,
  password,
  rememberMe,
  confirmPassword,
  displayName,
  profilePhotoUrl,
  email,
  phone,
  onUsernameChange,
  onPasswordChange,
  onRememberMeChange,
  onConfirmPasswordChange,
  onDisplayNameChange,
  onProfilePhotoChange,
  onPhotoError,
  onEmailChange,
  onPhoneChange,
  onSignIn,
  onCreateAccount,
  embedded = false,
}) {
  const { t } = useLocale();
  const passwordsMatch =
    confirmPassword.length > 0 && password.length > 0 && password === confirmPassword;

  const content = (
    <>
      <div className="dda-login-panel__top">
        <div className={embedded ? "dda-login-widget__header min-w-0 flex-1" : "mb-6 min-w-0 flex-1"}>
          {!embedded && (
            <p className="dda-text-kicker">{t("brand.name")}</p>
          )}
          <h1 className={`font-bold tracking-tight text-white ${embedded ? "text-lg" : "mt-1 text-xl sm:text-2xl"}`}>
            {mode === "sign-in" ? t("login.signInTitle") : t("login.createTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {mode === "sign-in" ? t("login.signInDesc") : t("login.createDesc")}
          </p>
        </div>
        <LanguageToggle className="dda-login-panel__lang shrink-0" />
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-black/30 p-1 ring-1 ring-white/5">
        {["sign-in", "create"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSwitchMode(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === tab ? "dda-btn-tab-active shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "sign-in" ? t("login.signInTab") : t("login.createTab")}
          </button>
        ))}
      </div>

      <div className={embedded ? "dda-login-widget__forms dda-login-widget__forms--scroll-hidden" : undefined}>
      {mode === "sign-in" ? (
        <form onSubmit={onSignIn} className="space-y-4">
          <div>
            <label htmlFor="dad-username" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.username")}
            </label>
            <input
              id="dad-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder={t("login.usernamePlaceholder")}
              className="dda-input"
            />
          </div>
          <div>
            <label htmlFor="dad-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.password")}
            </label>
            <PasswordInput
              id="dad-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder={t("login.passwordPlaceholder")}
            />
          </div>
          <label className="dda-login-remember flex cursor-pointer items-center gap-2.5">
            <input
              id="dad-remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => onRememberMeChange(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30 text-dda-green focus:ring-dda-green/30"
            />
            <span className="text-sm text-gray-400">{t("login.rememberMe")}</span>
          </label>
          {success ? (
            <p className="rounded-lg border border-dda-green/30 bg-dda-green/10 px-3 py-2 text-sm text-dda-green-light">
              {success}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button type="submit" className="dda-btn-primary w-full py-2.5">
            {t("login.openDashboard")}
          </button>
        </form>
      ) : (
        <form onSubmit={onCreateAccount} className="dda-login-create-form space-y-3">
          <ProfilePhotoPicker
            photoUrl={profilePhotoUrl}
            name={displayName || username}
            onPhotoChange={onProfilePhotoChange}
            onError={onPhotoError}
          />

          <div>
            <label htmlFor="dad-create-username" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.username")}
            </label>
            <input
              id="dad-create-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder={t("login.chooseUsername")}
              className="dda-input"
            />
          </div>
          <div>
            <label htmlFor="dad-full-name" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.fullName")}
            </label>
            <input
              id="dad-full-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder={t("login.fullNamePlaceholder")}
              className="dda-input"
            />
            <p className="mt-1.5 text-xs text-gray-500">{t("login.savedLocally")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dad-email" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.email")}
              </label>
              <input
                id="dad-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder={t("login.emailPlaceholder")}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="dad-phone" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.phone")}
              </label>
              <input
                id="dad-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => onPhoneChange(formatPhoneInput(event.target.value))}
                placeholder={t("login.phonePlaceholder")}
                className="dda-input"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dad-create-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.password")}
              </label>
              <PasswordInput
                id="dad-create-password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dad-confirm-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.confirm")}
              </label>
              <div className="dda-password-match-field">
                <PasswordInput
                  id="dad-confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => onConfirmPasswordChange(event.target.value)}
                  className="dda-input dda-password-match-field__input"
                />
                {passwordsMatch ? (
                  <span
                    className="dda-password-match-field__check"
                    aria-label={t("login.passwordsMatch")}
                    title={t("login.passwordsMatch")}
                  >
                    <CheckCircle2 className="h-5 w-5 text-dda-green-light" aria-hidden="true" />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <button type="submit" className="dda-btn-primary w-full py-2.5">
            {t("login.createProfile")}
          </button>
        </form>
      )}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="dda-brand-card w-full max-w-md p-6 sm:p-8">
      <div className="dda-accent-bar mb-6" />
      {content}
    </div>
  );
}
