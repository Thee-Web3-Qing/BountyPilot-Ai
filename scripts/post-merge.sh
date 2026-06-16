#!/bin/bash

pnpm install --frozen-lockfile

if [ -n "$GITHUB_TOKEN" ]; then
  echo "Pushing to GitHub..."
  git push "https://x-access-token:${GITHUB_TOKEN}@github.com/Thee-Web3-Qing/BountyPilot-Ai.git" HEAD:main
  echo "GitHub push complete."
else
  echo "GITHUB_TOKEN not set, skipping GitHub push."
fi
