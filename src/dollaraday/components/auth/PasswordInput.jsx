import { useState } from "react";
import { useLocale } from "../../i18n/LocaleContext.jsx";

/** Inline icons — avoids pulling the full lucide chunk onto the login page. */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.5 10.6a3 3 0 004 4M9.6 5.4A10.8 10.8 0 0112 5c6.5 0 10 7 10 7a18.4 18.4 0 01-4.2 4.7M6.2 6.3A18.2 18.2 0 002 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  className = "dda-input",
}) {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);

  return (
    <div className="dda-password-field">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
      />
      <button
        type="button"
        className="dda-password-field__toggle"
        onClick={() => setVisible((show) => !show)}
        aria-label={visible ? t("login.hidePassword") : t("login.showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
