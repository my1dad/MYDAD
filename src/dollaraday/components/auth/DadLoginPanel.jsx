import { useLocale } from "../../i18n/LocaleContext.jsx";

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export default function DadLoginPanel({
  mode,
  onSwitchMode,
  error,
  username,
  password,
  confirmPassword,
  displayName,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onDisplayNameChange,
  onSignIn,
  onCreateAccount,
  embedded = false,
}) {
  const { t } = useLocale();

  const content = (
    <>
      <div className="mb-6">
        {!embedded && (
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">{t("brand.name")}</p>
        )}
        <h1 className={`font-bold tracking-tight text-white ${embedded ? "text-lg" : "mt-1 text-xl sm:text-2xl"}`}>
          {mode === "sign-in" ? t("login.signInTitle") : t("login.createTitle")}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {mode === "sign-in" ? t("login.signInDesc") : t("login.createDesc")}
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-black/30 p-1">
        {["sign-in", "create"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSwitchMode(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === tab
                ? "bg-emerald-400/15 text-emerald-400 shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "sign-in" ? t("login.signInTab") : t("login.createTab")}
          </button>
        ))}
      </div>

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
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="dad-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.password")}
            </label>
            <input
              id="dad-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              className={inputClassName}
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-[#071013] shadow-sm transition hover:bg-emerald-400"
          >
            {t("login.openDashboard")}
          </button>
        </form>
      ) : (
        <form onSubmit={onCreateAccount} className="space-y-4">
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
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="dad-display-name" className="mb-1.5 block text-xs font-semibold text-gray-400">
              {t("login.displayName")}
            </label>
            <input
              id="dad-display-name"
              type="text"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder={t("login.displayNamePlaceholder")}
              className={inputClassName}
            />
            <p className="mt-1.5 text-xs text-gray-500">{t("login.savedLocally")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dad-create-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.password")}
              </label>
              <input
                id="dad-create-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="dad-confirm-password" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("login.confirm")}
              </label>
              <input
                id="dad-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                className={inputClassName}
              />
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-[#071013] shadow-sm transition hover:bg-emerald-400"
          >
            {t("login.createProfile")}
          </button>
        </form>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm sm:p-8">
      {content}
    </div>
  );
}
