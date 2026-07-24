#!/usr/bin/env bash

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-prpatel05/website}"

# `date -d` is GNU-only. On macOS the BSD date rejects it at line one, so the
# whole routine used to die before it listed a single PR -- and die quietly,
# because a piped run still reports the pipe's exit status. Probe once and use
# whichever dialect this machine speaks. BSD needs an explicit midnight or it
# fills in the current time of day.
if date -u -d 2026-01-01 +%s >/dev/null 2>&1; then
  iso_epoch()    { date -u -d "$1" +%s; }
  iso_tomorrow() { date -u -d "$1 +1 day" +%F; }
else
  iso_epoch()    { date -u -j -f "%Y-%m-%d %H:%M:%S" "$1 00:00:00" +%s; }
  iso_tomorrow() { date -u -j -v+1d -f "%Y-%m-%d %H:%M:%S" "$1 00:00:00" +%F; }
fi

# AUTOMERGE_TODAY pins the clock so the routine's date branches are testable.
TODAY="${AUTOMERGE_TODAY:-$(date -u +%F)}"
TOMORROW="$(iso_tomorrow "$TODAY")"
TODAY_EPOCH="$(iso_epoch "$TODAY")"

# GitHub computes `mergeable` lazily and reports UNKNOWN until it has built the
# test merge commit. Any push to main invalidates it for every open PR, so the
# 08:30 cron routinely races a freshly-invalidated cache.
MERGEABLE_RETRIES="${AUTOMERGE_MERGEABLE_RETRIES:-5}"
MERGEABLE_RETRY_SLEEP="${AUTOMERGE_MERGEABLE_RETRY_SLEEP:-2}"

# How long after its publish date a ready post may still be merged.
PUBLISH_GRACE_DAYS="${AUTOMERGE_PUBLISH_GRACE_DAYS:-7}"
GRACE_SECONDS=$(( PUBLISH_GRACE_DAYS * 86400 ))

# Failures that must redden the run on the day they happen, rather than waiting
# for the publish date to arrive. A merge is only ever attempted on a post that
# is already due, and an alarm nobody can file is an alarm nobody will see.
hard_failures=()

resolve_mergeable() {
  local number="$1"
  local mergeable="$2"
  local attempts="$MERGEABLE_RETRIES"

  while [[ "$mergeable" == "UNKNOWN" || -z "$mergeable" ]] && (( attempts > 0 )); do
    attempts=$(( attempts - 1 ))
    sleep "$MERGEABLE_RETRY_SLEEP"
    mergeable="$(gh pr view "$number" --repo "$REPO" --json mergeable --jq '.mergeable' 2>/dev/null || echo "UNKNOWN")"
  done

  printf '%s' "${mergeable:-UNKNOWN}"
}

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

  existing_issue_count="$(gh issue list --repo "$REPO" --search "$issue_title in:title" --state all --json title --jq 'length')"

  if [[ "$existing_issue_count" -gt 0 ]]; then
    echo "    Social-promotion issue already exists for $branch."
    return
  fi

  if gh issue create \
    --repo "$REPO" \
    --title "$issue_title" \
    --body "$(printf 'The merged blog PR `%s` needs manual social promotion planning.\n\n- PR: https://github.com/%s/pull/%s\n- Title: %s\n- Published date (dateISO): %s\n- Branch: %s\n' "$slug" "$REPO" "$number" "$title" "$date_iso" "$branch")" >/dev/null; then
    echo "    Created social-promotion issue for $branch."
  else
    echo "    Failed to create social-promotion issue for $branch."
    hard_failures+=("$number|$branch|social_promotion_issue_failed")
  fi
}

create_blocked_merge_issue() {
  local number="$1"
  local branch="$2"
  local date_iso="$3"
  local reason="$4"
  local issue_title="Resolve blocked blog merge: $branch"
  local existing_issue_count

  existing_issue_count="$(gh issue list --repo "$REPO" --search "$issue_title in:title" --state all --json title --jq 'length')"
  if [[ "$existing_issue_count" -gt 0 ]]; then
    echo "    Blocked-merge issue already exists for $branch."
    return
  fi

  if gh issue create \
    --repo "$REPO" \
    --title "$issue_title" \
    --body "$(printf 'The blog auto-merge routine could not merge this PR on or before its publish date.\n\n- PR: https://github.com/%s/pull/%s\n- Date (dateISO): %s\n- Branch: %s\n- Reason: %s\n- Action: unblock the merge, then re-run the blog auto-merge workflow.\n' "$REPO" "$number" "$date_iso" "$branch" "$reason")" >/dev/null; then
    echo "    Created blocked-merge issue for $branch ($reason)."
  else
    echo "    Failed to create blocked-merge issue for $branch."
    hard_failures+=("$number|$branch|blocked_merge_issue_failed")
  fi
}

# Alarm on anything that cannot merge and is due within 2 days -- or is already
# past due. Without the past-due arm, a post that slips its date by >2 days goes
# permanently silent: never merged, never reported.
alarm_if_due() {
  local number="$1"
  local branch="$2"
  local date_iso="$3"
  local reason="$4"
  local date_epoch

  date_epoch="$(iso_epoch "$date_iso")"
  if (( date_epoch <= TODAY_EPOCH + 172800 )); then
    conflict_prs+=("$number|$branch|$date_iso|$reason")
    create_blocked_merge_issue "$number" "$branch" "$date_iso" "$reason"
  fi

  # A publish date that has arrived without a merge is a missed date, not a
  # warning. Fail the job so the run goes red instead of green-with-an-issue.
  # Bounded by the grace window: an abandoned PR is reported once, not allowed
  # to pin the daily cron red forever.
  if (( date_epoch <= TODAY_EPOCH && date_epoch >= TODAY_EPOCH - GRACE_SECONDS )); then
    missed_publish_prs+=("$number|$branch|$date_iso|$reason")
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
missed_publish_prs=()

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

  if ! iso_epoch "$date_iso" >/dev/null 2>&1; then
    echo "  Skipping: invalid dateISO '$date_iso'."
    skipped_prs+=("$number|$branch|invalid_dateISO:$date_iso")
    continue
  fi

  mergeable="$(resolve_mergeable "$number" "$mergeable")"

  if [[ "$mergeable" == "CONFLICTING" ]]; then
    echo "  Skipping: merge conflict detected."
    skipped_prs+=("$number|$branch|merge_conflict")
    alarm_if_due "$number" "$branch" "$date_iso" "merge_conflict"
    continue
  fi

  # Never attempt a merge on an unresolved mergeability. `gh pr merge` would
  # fail, and the old code recorded that as a bare `merge_failed` with no issue
  # and a green run -- the silent missed-publish this routine exists to prevent.
  if [[ "$mergeable" != "MERGEABLE" ]]; then
    echo "  Skipping: mergeability unresolved after $MERGEABLE_RETRIES retries (got '$mergeable')."
    skipped_prs+=("$number|$branch|mergeable_unknown")
    alarm_if_due "$number" "$branch" "$date_iso" "mergeable_unknown"
    continue
  fi

  if [[ "$date_iso" > "$TOMORROW" ]]; then
    echo "  Skipping: publish date $date_iso is more than 1 day out."
    skipped_prs+=("$number|$branch|date_too_far:$date_iso")
    continue
  fi

  # A past-due PR used to land here as `date_not_due` and be skipped forever:
  # never merged, never reported, even though it was ready to publish. Publish
  # it late instead. Beyond the grace window it is treated as abandoned -- it is
  # reported, but never silently auto-published long after the fact.
  date_epoch="$(iso_epoch "$date_iso")"
  if (( date_epoch < TODAY_EPOCH - GRACE_SECONDS )); then
    echo "  Skipping: publish date $date_iso is more than $PUBLISH_GRACE_DAYS days past due."
    skipped_prs+=("$number|$branch|stale_past_due:$date_iso")
    alarm_if_due "$number" "$branch" "$date_iso" "stale_past_due"
    continue
  fi

  if [[ "$date_iso" < "$TODAY" ]]; then
    echo "  Publishing late: $date_iso is past due but within the $PUBLISH_GRACE_DAYS-day grace window."
  fi

  echo "  Attempting merge for #$number (\"$title\")."
  if gh pr merge "$number" --repo "$REPO" --merge --delete-branch; then
    echo "  Merged."
    merged_prs+=("$number|$branch|$date_iso|$title")
    create_social_promotion_issue "$number" "$branch" "$title" "$date_iso" "$slug"
  else
    echo "  Merge failed for #$number."
    skipped_prs+=("$number|$branch|merge_failed")
    hard_failures+=("$number|$branch|merge_failed")
    alarm_if_due "$number" "$branch" "$date_iso" "merge_failed"
  fi
done < <(echo "$blog_prs" | jq -c '.[]')

echo ""
echo "=== Blog PR Auto-Merge Summary ==="
echo "Merged: ${#merged_prs[@]}"
echo "Skipped: ${#skipped_prs[@]}"
echo "Blocked by conflict: ${#conflict_prs[@]}"
echo "Missed publish date: ${#missed_publish_prs[@]}"
echo "Failed operations: ${#hard_failures[@]}"

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
      echo "### Blocked PRs"
      for item in "${conflict_prs[@]}"; do
        IFS='|' read -r number branch date reason <<<"$item"
        echo "- #$number (\`$branch\`, dateISO: \`$date\`): $reason"
      done
    fi

    if (( ${#missed_publish_prs[@]} > 0 )); then
      echo ""
      echo "### Missed publish date"
      for item in "${missed_publish_prs[@]}"; do
        IFS='|' read -r number branch date reason <<<"$item"
        echo "- #$number (\`$branch\`, dateISO: \`$date\`): $reason"
      done
    fi

    if (( ${#hard_failures[@]} > 0 )); then
      echo ""
      echo "### Failed operations"
      for item in "${hard_failures[@]}"; do
        IFS='|' read -r number branch reason <<<"$item"
        echo "- #$number (\`$branch\`): $reason"
      done
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi

# A post whose publish date has arrived and did not merge is a failure of this
# routine's one job. Report it as one -- a green run here has, until now, been
# indistinguishable from a run that published nothing.
if (( ${#missed_publish_prs[@]} > 0 )); then
  for item in "${missed_publish_prs[@]}"; do
    IFS='|' read -r number branch date reason <<<"$item"
    echo "::error::Blog PR #$number ($branch) missed its publish date $date: $reason"
  done
fi

# A failed merge or a failed alarm is a failure today, not on the publish date.
# Waiting for the date to arrive hides a broken run for a full day, and hides a
# permanently broken one forever if something else merges the PR first.
if (( ${#hard_failures[@]} > 0 )); then
  for item in "${hard_failures[@]}"; do
    IFS='|' read -r number branch reason <<<"$item"
    echo "::error::Blog PR #$number ($branch): $reason"
  done
fi

if (( ${#missed_publish_prs[@]} > 0 || ${#hard_failures[@]} > 0 )); then
  exit 1
fi

exit 0
