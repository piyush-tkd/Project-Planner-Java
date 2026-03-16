#!/bin/bash
export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
npm --prefix frontend run dev
