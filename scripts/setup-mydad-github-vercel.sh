#!/usr/bin/env bash
# One-time setup: create my1dad/MYDAD on GitHub, push code, link + deploy on vercel.com/my1dad
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GITHUB_USER="my1dad"
REPO_NAME="MYDAD"
REMOTE_NAME="my1dad"
VERCEL_SCOPE="my-dollar-a-day-server"
VERCEL_PROJECT="dad"
BRANCH="${1:-main}"

echo "==> Checking GitHub CLI..."
GH=""
if command -v gh >/dev/null 2>&1; then
  GH="gh"
elif [[ -x "$ROOT/.tools/gh_2.63.2_macOS_amd64/bin/gh" ]]; then
  GH="$ROOT/.tools/gh_2.63.2_macOS_amd64/bin/gh"
elif [[ -x "$ROOT/.tools/gh_2.63.2_macOS_arm64/bin/gh" ]]; then
  GH="$ROOT/.tools/gh_2.63.2_macOS_arm64/bin/gh"
else
  echo "Install GitHub CLI first: brew install gh"
  exit 1
fi

GH_USER="$("$GH" api user -q .login 2>/dev/null || true)"
if [[ "$GH_USER" != "$GITHUB_USER" ]]; then
  echo "Log into GitHub as ${GITHUB_USER}:"
  echo "  $GH auth login   # choose GitHub.com, HTTPS, login as ${GITHUB_USER}"
  exit 1
fi

echo "==> Creating ${GITHUB_USER}/${REPO_NAME} (if missing)..."
if "$GH" repo view "${GITHUB_USER}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "    Repo already exists."
else
  "$GH" repo create "${GITHUB_USER}/${REPO_NAME}" --public --description "My Dollar A Day"
fi

if git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  git remote set-url "$REMOTE_NAME" "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
else
  git remote add "$REMOTE_NAME" "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
fi

echo "==> Pushing ${BRANCH} to ${GITHUB_USER}/${REPO_NAME}..."
git push -u "$REMOTE_NAME" "$BRANCH"

echo "==> Checking Vercel CLI login..."
VC_USER="$(npx vercel whoami 2>/dev/null | tail -1 || true)"
if [[ "$VC_USER" != "my1dad" ]]; then
  echo "Log into Vercel as my1dad:"
  echo "  npx vercel logout && npx vercel login"
  exit 1
fi

echo "==> Linking Vercel project..."
npx vercel link --non-interactive --scope "$VERCEL_SCOPE" --project "$VERCEL_PROJECT" --yes

echo "==> Deploying to production..."
npx vercel deploy --prod --yes

echo ""
echo "Done."
echo "  GitHub: https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo "  Vercel: https://vercel.com/${VERCEL_SCOPE}/${VERCEL_PROJECT}"
echo ""
echo "Connect Git for auto-deploy on push:"
echo "  https://vercel.com/${VERCEL_SCOPE}/${VERCEL_PROJECT}/settings/git"
echo "  Import ${GITHUB_USER}/${REPO_NAME} and set production branch to ${BRANCH}."
