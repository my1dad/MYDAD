import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, MemberAvatar } from "../components/layout/DashboardCard";
import { saveCommunityPost } from "../lib/storageWrites";
import { usePoolState } from "../lib/poolState";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";

const channelIcons = {
  governance: Scale,
  investing: TrendingUp,
  announcements: Megaphone,
  support: MessageSquare,
};

export default function NewPostPage({ onNavigate }) {
  const { t } = useLocale();
  const { communityChannels, translateTier } = useLocalizedData();
  const { currentMember } = usePoolState();

  const steps = [
    { id: "welcome", title: t("pages.newPost.welcomeTitle"), description: t("pages.newPost.welcomeDesc") },
    { id: "channel", title: t("pages.newPost.channelTitle"), description: t("pages.newPost.channelDesc") },
    { id: "compose", title: t("pages.newPost.composeTitle"), description: t("pages.newPost.composeDesc") },
  ];

  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [channelId, setChannelId] = useState("governance");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const isLastStep = step === steps.length - 1;
  const progress = completed ? 100 : ((step + 1) / steps.length) * 100;
  const selectedChannel = communityChannels.find((channel) => channel.id === channelId);
  const canPublish = title.trim().length > 0 && body.trim().length >= 12;

  const handleBack = () => {
    if (completed) {
      onNavigate?.("community");
      return;
    }
    if (step === 0) {
      onNavigate?.("community");
      return;
    }
    setStep((current) => Math.max(0, current - 1));
  };

  const handleNext = () => {
    if (isLastStep) {
      if (!canPublish || !selectedChannel) return;
      saveCommunityPost({
        title: title.trim(),
        body: body.trim(),
        channelId,
        channelLabel: selectedChannel.label,
      });
      setCompleted(true);
      return;
    }
    setStep((current) => current + 1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="dda-glass relative overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("pages.newPost.community")}
            </button>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              /post
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-500">
              {t("common.stepOf", {
                current: completed ? steps.length : step + 1,
                total: steps.length,
              })}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="dda-glass rounded-2xl p-5 sm:p-6">
        {completed ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" strokeWidth={2.25} />
            </span>
            <h1 className="mt-5 text-xl font-bold text-white">{t("pages.newPost.published")}</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
              {t("pages.newPost.publishedDesc")}{" "}
              <span className="font-semibold text-emerald-400">#{selectedChannel?.label}</span>.
            </p>

            <div className="dda-panel mt-6 w-full rounded-2xl p-4 text-left">
              <div className="flex items-start gap-3">
                <MemberAvatar initials={currentMember.avatarInitials} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{currentMember.name}</span>
                    <span className="text-sm text-gray-500">{currentMember.handle}</span>
                    <Badge variant="info">#{selectedChannel?.label}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-white">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{body}</p>
                </div>
              </div>
            </div>
          </div>
        ) : step === 0 ? (
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <h1 className="text-xl font-bold text-white">{steps[step].title}</h1>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

            <div className="dda-glass-btn mt-5 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar initials={currentMember.avatarInitials} size="md" />
                <div>
                  <p className="font-semibold text-white">{currentMember.name}</p>
                  <p className="text-xs text-gray-500">
                    {translateTier(currentMember.tier)} · {t("pages.newPost.postingAs", { handle: currentMember.handle })}
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-400">
              <li>{t("pages.newPost.guideline1")}</li>
              <li>{t("pages.newPost.guideline2")}</li>
              <li>{t("pages.newPost.guideline3")}</li>
            </ul>
          </div>
        ) : step === 1 ? (
          <div>
            <h1 className="text-xl font-bold text-white">{steps[step].title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {communityChannels.map((channel) => {
                const Icon = channelIcons[channel.id] ?? MessageSquare;
                const active = channelId === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setChannelId(channel.id)}
                    className={cn(
                      "dda-glass-btn rounded-2xl p-4 text-left transition",
                      active && "border-emerald-400/30 ring-1 ring-emerald-400/20"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset",
                        active
                          ? "bg-emerald-400/15 text-emerald-400 ring-emerald-400/25"
                          : "bg-white/5 text-gray-400 ring-white/10"
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <p className="mt-3 font-semibold text-white">#{channel.label}</p>
                    <p className="mt-1 text-sm text-gray-400">{channel.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-bold text-white">{steps[step].title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

            <div className="dda-glass mt-5 overflow-hidden rounded-2xl">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  #{selectedChannel?.label}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <label htmlFor="post-title" className="mb-1.5 block text-sm text-gray-400">
                    {t("pages.newPost.titleLabel")}
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("pages.newPost.titlePlaceholderShort")}
                    maxLength={120}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="post-body" className="mb-1.5 block text-sm text-gray-400">
                    {t("pages.newPost.messageLabel")}
                  </label>
                  <textarea
                    id="post-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={t("pages.newPost.messagePlaceholder")}
                    rows={6}
                    maxLength={2000}
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-relaxed text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">{t("pages.newPost.charCount", { count: body.length })}</p>
                  {body.trim().length > 0 && body.trim().length < 12 ? (
                    <p className="mt-1 text-xs text-amber-400">{t("pages.newPost.writeMin")}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        {!completed && step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
          >
            {t("common.back")}
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={completed ? () => onNavigate?.("community") : handleNext}
          disabled={!completed && isLastStep && !canPublish}
          className={cn(
            "ml-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
            !completed && isLastStep && !canPublish
              ? "cursor-not-allowed bg-emerald-500/40 text-[#071013]/70"
              : "bg-emerald-500 text-[#071013] hover:bg-emerald-400"
          )}
        >
          {completed ? t("pages.newPost.backToBoard") : isLastStep ? t("pages.newPost.publish") : t("common.continue")}
          {!completed && !isLastStep ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
