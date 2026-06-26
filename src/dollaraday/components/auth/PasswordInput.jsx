import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLocale } from "../../i18n/LocaleContext.jsx";

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
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
