#!/usr/bin/env bash

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-prpatel05/website}"
TODAY="$(date -u +%F)"
TOMORROW="$(date -u -d "tomorrow" +%F)"
TODAY_EPOCH="$(date -u -d "$TODAY" +%s)"

echo "Checking open blog PRs for $REPO"
echo "UTC date: $TODAY (tomorrow: $TOMORROW)"

create_social_promotion_issue() {
  local number="$1"
  local branch="$2"
  local title="$3"
  local date_iso="$4"
  local slug="$5"
  local issue_title="Social promotion: $branch"
  local existing_issue_count

  existing_issue_count="$(gh issue list --repo "$REPO" --search "$issue_title" --state all --json title --jq 'length')"

  if [[ "$existing_issue_count" -gt 0 ]]; then
    echo "    Social-promotion issue already exists for $branch."
    return
  fi

  if gh issue create \
    --repo "$REPO" \
    --title "$issue_title" \
    --body "The merged blog PR \`$slug\` needs manual social promotion planning.\n\n- PR: https://github.com/$REPO/pull/$number\n- Title: $title\n- Published date (dateISO): $date_iso\n- Branch: $branch" >/dev/null; then
    echo "    Created social-promotion issue for $branch."
  else
    echo "    Failed to create social-promotion issue for $branch."
  fi
}

create_conflict_issue() {
  local number="$1"
  local branch="$2"
  local date_iso="$3"
  local issue_title="Resolve merge conflict: $branch"
  local existing_issue_count

  existing_issue_count="$(gh issue list --repo "$REPO" --search "$issue_title" --state all --json title --jq 'length')"
  if [[ "$existing_issue_count" -gt 0 ]]; then
    echo "    Conflict-resolution issue already exists for $branch."
    return
  fi

  if gh issue create \
    --repo "$REPO" \
    --title "$issue_title" \
    --body "Mergeability is still CONFLICTING and publish date is within 2 days.\n\n- PR: https://github.com/$REPO/pull/$number\n- Date: $date_iso\n- Branch: $branch\n- Action: resolve conflicts and re-run the blog auto-merge workflow." >/dev/null; then
    echo "    Created conflict-resolution issue for $branch."
  else
    echo "    Failed to create conflict-resolution issue for $branch."
  fi
}

open_prs="$(gh pr list --repo "$REPO" --state open --json number,title,headRefName,isDraft,mergeable --limit 100)"
blog_prs="$(echo "$open_prs" | jq -c '[.[] | select(.headRefName | startswith("blog/"))]')"
blog_count="$(echo "$blog_prs" | jq 'length')"

if [[ "$blog_count" -eq 0 ]]; then
  echo "No open blog PRs found."
  echo "No blog PRs were due for merge."
  exit 0
fi

merged_prs=()
skipped_prs=()
conflict_prs=()

while IFS= read -r pr_json; do
  number="$(jq -r '.number' <<<"$pr_json")"
  title="$(jq -r '.title // ""' <<<"$pr_json")"
  branch="$(jq -r '.headRefName // ""' <<<"$pr_json")"
  is_draft="$(jq -r '.isDraft' <<<"$pr_json")"
  mergeable="$(jq -r '.mergeable // ""' <<<"$pr_json")"
  slug="${branch#blog/}"

  echo "Inspecting PR #$number ($branch)"

  if [[ "$is_draft" == "true" ]]; then
    echo "  Skipping: draft PR."
    skipped_prs+=("$number|$branch|draft")
    continue
  fi

  file_path="src/data/blog-posts/${slug}.ts"
  file_response="$(gh api "repos/$REPO/contents/$file_path?ref=$branch" 2>/dev/null || true)"

  if [[ -z "$file_response" ]]; then
    echo "  Skipping: missing data file at $file_path on branch $branch."
    skipped_prs+=("$number|$branch|missing_data_file")
    continue
  fi

  file_content_b64="$(jq -r '.content // empty' <<<"$file_response")"
  if [[ -z "$file_content_b64" ]]; then
    echo "  Skipping: data file has no content at $file_path."
    skipped_prs+=("$number|$branch|missing_data_content")
    continue
  fi

  decoded_file="$(printf "%s" "$file_content_b64" | base64 -d 2>/dev/null || true)"
  date_iso="$(printf "%s" "$decoded_file" | sed -n 's/^[[:space:]]*dateISO:[[:space:]]*"\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)".*/\1/p' | head -n 1)"

  if [[ -z "$date_iso" ]]; then
    echo "  Skipping: dateISO missing in $file_path."
    skipped_prs+=("$number|$branch|missing_dateISO")
    continue
  fi

  if ! date -u -d "$date_iso" >/dev/null 2>&1; then
    echo "  Skipping: invalid dateISO '$date_iso'."
    skipped_prs+=("$number|$branch|invalid_dateISO:$date_iso")
    continue
  fi

  if [[ "$mergeable" == "CONFLICTING" ]]; then
    date_epoch="$(date -u -d "$date_iso" +%s)"
    within_two_days="false"
    if (( date_epoch >= TODAY_EPOCH - 172800 && date_epoch <= TODAY_EPOCH + 172800 )); then
      within_two_days="true"
    fi

    echo "  Skipping: merge conflict detected."
    skipped_prs+=("$number|$branch|merge_conflict")

    if [[ "$within_two_days" == "true" ]]; then
      conflict_prs+=("$number|$branch|$date_iso")
      create_conflict_issue "$number" "$branch" "$date_iso"
    fi

    continue
  fi

  if [[ "$date_iso" > "$TOMORROW" ]]; then
    echo "  Skipping: publish date $date_iso is more than 1 day out."
    skipped_prs+=("$number|$branch|date_too_far:$date_iso")
    continue
  fi

  if [[ "$date_iso" != "$TODAY" && "$date_iso" != "$TOMORROW" ]]; then
    echo "  Skipping: publish date $date_iso is not today or tomorrow."
    skipped_prs+=("$number|$branch|date_not_due:$date_iso")
    continue
  fi

  echo "  Attempting merge for #$number (\"$title\")."
  if gh pr merge "$number" --repo "$REPO" --merge --delete-branch; then
    echo "  Merged."
    merged_prs+=("$number|$branch|$date_iso|$title")
    create_social_promotion_issue "$number" "$branch" "$title" "$date_iso" "$slug"
  else
    echo "  Merge failed for #$number."
    skipped_prs+=("$number|$branch|merge_failed")
  fi
done < <(echo "$blog_prs" | jq -c '.[]')

echo ""
echo "=== Blog PR Auto-Merge Summary ==="
echo "Merged: ${#merged_prs[@]}"
echo "Skipped: ${#skipped_prs[@]}"
echo "Blocked by conflict: ${#conflict_prs[@]}"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Blog Auto-Merge Routine"
    echo ""
    echo "- UTC date: $TODAY"
    echo "- Tomorrow: $TOMORROW"
    echo ""
    echo "### Merged"
    if (( ${#merged_prs[@]} == 0 )); then
      echo "- None"
    else
      for item in "${merged_prs[@]}"; do
        IFS='|' read -r number branch date title <<<"$item"
        echo "- #$number (\`$branch\`, \`$date\`): $title"
      done
    fi

    echo ""
    echo "### Skipped"
    if (( ${#skipped_prs[@]} == 0 )); then
      echo "- None"
    else
      for item in "${skipped_prs[@]}"; do
        IFS='|' read -r number branch reason <<<"$item"
        echo "- #$number (\`$branch\`): $reason"
      done
    fi

    if (( ${#conflict_prs[@]} > 0 )); then
      echo ""
      echo "### Merge-conflict PRs"
      for item in "${conflict_prs[@]}"; do
        IFS='|' read -r number branch date <<<"$item"
        echo "- #$number (\`$branch\`, dateISO: \`$date\`)"
      done
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

exit 0
