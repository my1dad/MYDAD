import { useEffect, useState } from "react";
import { Megaphone, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import {
  saveCommunityBoardMessage,
  useCommunityBoardMessage,
} from "../../lib/communityBoardMessage";

export default function CommunityBoardMessage() {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const board = useCommunityBoardMessage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.body);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(board.body);
  }, [board.body, editing]);

  const openEdit = () => {
    setDraft(board.body);
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(board.body);
    setError("");
    setEditing(false);
  };

  const handleSave = () => {
    setSaving(true);
    const result = saveCommunityBoardMessage(draft);
    setSaving(false);
    if (!result.ok) {
      setError(t("pages.community.boardSaveError"));
      return;
    }
    setEditing(false);
    setError("");
  };

  const hasMessage = board.body.trim().length > 0;

  if (!hasMessage && !isAdmin) return null;

  return (
    <section className="dda-community-board" aria-label={t("pages.community.boardTitle")}>
      <div className="dda-accent-bar" />
      <div className="dda-community-board__inner">
        <div className="dda-community-board__head">
          <div className="dda-community-board__kicker">
            <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            <p>{t("pages.community.boardKicker")}</p>
          </div>
          {isAdmin && !editing ? (
            <button
              type="button"
              onClick={openEdit}
              className="dda-community-board__edit"
              aria-label={t("pages.community.boardEditAria")}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {t("pages.community.boardEdit")}
            </button>
          ) : null}
          {isAdmin && editing ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="dda-community-board__edit"
              aria-label={t("common.close")}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              {t("common.cancel")}
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="dda-community-board__editor">
            <label className="sr-only" htmlFor="community-board-message-input">
              {t("pages.community.boardEditLabel")}
            </label>
            <textarea
              id="community-board-message-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={5}
              className="dda-community-board__textarea"
              placeholder={t("pages.community.boardPlaceholder")}
            />
            {error ? <p className="dda-community-board__error">{error}</p> : null}
            <div className="dda-community-board__actions">
              <button
                type="button"
                onClick={cancelEdit}
                className="dda-community-board__secondary"
                disabled={saving}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="dda-community-board__primary"
                disabled={saving}
              >
                {t("pages.community.boardSave")}
              </button>
            </div>
          </div>
        ) : hasMessage ? (
          <p className="dda-community-board__body">{board.body}</p>
        ) : (
          <p className={cn("dda-community-board__body", "dda-community-board__body--empty")}>
            {t("pages.community.boardEmptyAdmin")}
          </p>
        )}

        {!editing && hasMessage && board.updatedByName ? (
          <p className="dda-community-board__meta">
            {t("pages.community.boardUpdatedBy", { name: board.updatedByName })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
