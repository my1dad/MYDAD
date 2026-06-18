import { Heart, MessageCircle, Pin } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import { Badge, MemberAvatar } from "../components/layout/DashboardCard";
import { useCommunityBoardPosts } from "../lib/communityPostsFeed";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";

export default function CommunityPage({ onNavigate }) {
  const { t } = useLocale();
  const { communityPosts: seedPosts } = useLocalizedData();
  const storedPosts = useCommunityBoardPosts();

  const storedIds = new Set(storedPosts.map((p) => p.id));
  const posts = [
    ...storedPosts,
    ...seedPosts.filter((post) => !storedIds.has(post.id)),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.community.title")}
        description={t("pages.community.description")}
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("post")}
            className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-300"
          >
            {t("pages.community.newPost")}
          </button>
        }
      />

      <div className="space-y-3">
        {posts.length ? (
          posts.map((post) => (
            <div key={post.id} className="dda-panel rounded-xl p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <MemberAvatar
                  initials={post.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{post.author}</span>
                    <span className="text-sm text-gray-500">{post.handle}</span>
                    <span className="text-sm text-gray-600">· {post.time}</span>
                    {post.channelLabel ? (
                      <Badge variant="info">#{post.channelLabel}</Badge>
                    ) : null}
                    {post.pinned ? (
                      <Badge variant="info">
                        <Pin className="mr-0.5 h-2.5 w-2.5" />
                        {t("common.pinned")}
                      </Badge>
                    ) : null}
                  </div>
                  {post.title ? (
                    <p className="mt-2 font-medium text-white">{post.title}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{post.body}</p>
                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                    <button type="button" className="flex items-center gap-1 hover:text-emerald-400">
                      <Heart className="h-3.5 w-3.5" />
                      {post.likes}
                    </button>
                    <button type="button" className="flex items-center gap-1 hover:text-emerald-400">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {post.replies} {t("common.replies")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="dda-panel rounded-xl p-6 text-center text-sm text-gray-500">
            {t("pages.community.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
