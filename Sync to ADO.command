#!/bin/bash
# Double-click this file to sync your changes to Azure DevOps.

SOURCE_DIR="/Users/piyushbaheti/Project Planner"
ADO_DIR="/Users/piyushbaheti/repos/ado-repo"

# Keep Terminal window open if something goes wrong
trap 'echo ""; echo "Press any key to close..."; read -n1' EXIT

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Sync to Azure DevOps — Project Planner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask for commit message
echo "Commit message (or press Enter for auto-timestamp):"
read -r MSG

if [[ -z "$MSG" ]]; then
  MSG="sync: $(date '+%Y-%m-%d %H:%M')"
fi

echo ""
echo "── Previewing changes ──────────────────────────"
ADO_DIR="$ADO_DIR" "$SOURCE_DIR/sync-to-ado.sh" --dry-run
echo ""

# Ask for confirmation
echo "Proceed with commit + push? (y/n)"
read -r CONFIRM

if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo ""
  ADO_DIR="$ADO_DIR" "$SOURCE_DIR/sync-to-ado.sh" --commit --push --message="$MSG"
else
  echo "Cancelled."
fi
