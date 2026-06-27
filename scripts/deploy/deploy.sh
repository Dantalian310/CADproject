#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cloudcad}"
REPO_URL="${REPO_URL:-https://github.com/Dantalian310/CADproject.git}"
BRANCH="${BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install git first."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required. Install Docker Engine and the Docker Compose plugin first."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env has been created from .env.example."
  echo "Edit .env and set POSTGRES_PASSWORD, JWT_SECRET, CORS_ALLOWED_ORIGINS, then run this script again."
  exit 1
fi

docker compose up -d --build
docker compose ps
