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
else
  iso_epoch()    { date -u -j -f "%Y-%m-%d %H:%M:%S" "$1 00:00:00" +%s; }
fi

# AUTOMERGE_TODAY pins the clock so the routine's date branches are testable.
TODAY="${AUTOMERGE_TODAY:-$(date -u +%F)}"
TODAY_EPOCH="$(iso_epoch "$TODAY")"

# GitHub computes `mergeable` lazily and reports UNKNOWN until it has built the
# test merge commit. Any push to main invalidates it for every open PR, so the
# 08:30 cron routinely races a freshly-invalidated cache.
MERGEABLE_RETRIES="${AUTOMERGE_MERGEABLE_RETRIES:-5}"
MERGEABLE_RETRY_SLEEP="${AUTOMERGE_MERGEABLE_RETRY_SLEEP:-2}"

# How long after its publish date a ready post may still be merged.
PUBLISH_GRACE_DAYS="${AUTOMERGE_PUBLISH_GRACE_DAYS:-7}"
GRACE_SECONDS=$(( PUBLISH_GRACE_DAYS * 86400 ))

# A dry run reads everything and writes nothing: no merge, no issue. It exists
# because every other way of exercising this routine publishes a real post --
# the one thing you cannot undo -- so until now nobody could run it to find out
# whether it works. The test suite drives this script against a stubbed `gh`,
# so it proves the logic and nothing at all about the real API or the token the
# workflow runs as. The first dry run earned its keep immediately: it showed
# the CI gate reads GREEN with `checks: none` as readily as with `checks: read`,
# because this repo is public. See the note in blog-automerge.yml.
#
# `true` and `1` both count, because a workflow_dispatch boolean arrives as the
# string "true".
DRY_RUN=0
case "${AUTOMERGE_DRY_RUN:-}" in
  1 | true | TRUE | yes) DRY_RUN=1 ;;
esac

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

# `mergeable` is GitHub's *conflict* state; it says nothing about CI. `main` is
# unprotected (`protected: false`, `rulesets: []`) and `ci.yml` only runs
# `on: pull_request`, so nothing re-checks a commit on its way in. Once this
# routine merges on the publish date there is no longer a spare day in which a
# human notices a red branch, which makes this gate the only thing standing
# between a broken post and a live site.
#
# Deliberately NOT `commits/{sha}/status`: that legacy combined-status endpoint
# reports `{"state":"pending","total_count":0}` for this repo's green PRs,
# because CI here posts check-runs. A gate written against it would read every
# healthy PR as pending and stall the queue forever.
ci_verdict() {
  local number="$1"
  local sha check_runs verdict err

  # Both reads used to discard stderr, so a 403 from a missing `checks: read`
  # scope was indistinguishable from a network blip or a deleted PR -- every
  # one of them just became UNVERIFIED. Fail-safe, but undiagnosable: the run
  # would stall the queue without ever naming the scope that caused it. The
  # verdict still goes to stdout and only to stdout; this goes to stderr, so
  # the caller's `$(...)` is unaffected.
  err="$(mktemp)"
  sha="$(gh api "repos/$REPO/pulls/$number" --jq '.head.sha' 2>"$err" || true)"
  if [[ -z "$sha" ]]; then
    echo "    CI gate: no head sha for #$number: $(tr '\n' ' ' <"$err")" >&2
    rm -f "$err"
    printf 'UNVERIFIED'
    return
  fi

  check_runs="$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100" 2>"$err" || true)"
  if [[ -z "$check_runs" ]]; then
    echo "    CI gate: no check-runs for #$number ($sha): $(tr '\n' ' ' <"$err")" >&2
    rm -f "$err"
    printf 'UNVERIFIED'
    return
  fi
  rm -f "$err"

  # Unknown is unsafe: anything that does not parse, or a page we can only see
  # part of, resolves to UNVERIFIED rather than falling through to a merge.
  verdict="$(jq -r '
    if (.check_runs | type) != "array" then "UNVERIFIED"
    elif ((.total_count // (.check_runs | length)) > (.check_runs | length)) then "UNVERIFIED"
    elif (.check_runs | length) == 0 then "NONE"
    elif any(.check_runs[]; .conclusion == "failure" or .conclusion == "timed_out" or .conclusion == "action_required") then "RED"
    elif any(.check_runs[]; .status != "completed") then "PENDING"
    elif all(.check_runs[]; .conclusion == "success" or .conclusion == "neutral" or .conclusion == "skipped") then "GREEN"
    else "UNVERIFIED"
    end
  ' <<<"$check_runs" 2>/dev/null || true)"

  printf '%s' "${verdict:-UNVERIFIED}"
}

echo "Checking open blog PRs for $REPO"
echo "UTC date: $TODAY (merging posts due on or before $TODAY)"
if (( DRY_RUN )); then
  echo "DRY RUN: no PR will be merged and no issue will be created."
fi

create_social_promotion_issue() {
  local number="$1"
  local branch="$2"
  local title="$3"
  local date_iso="$4"
  local slug="$5"
  local issue_title="Social promotion: $branch"
  local existing_issue_count

  if (( DRY_RUN )); then
    echo "    Dry run: would create social-promotion issue for $branch."
    return
  fi

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

  # Reachable in a dry run, unlike the social-promotion issue: alarm_if_due
  # fires on a due PR that cannot merge, and no merge is needed to get here.
  if (( DRY_RUN )); then
    echo "    Dry run: would create blocked-merge issue for $branch ($reason)."
    return
  fi

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
would_merge_prs=()
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

  # A post publishes on its dateISO, so it merges on the morning of that date --
  # not the day before. The old `> $TOMORROW` form put every post live a full
  # day early, which is what this comparison exists to prevent.
  if [[ "$date_iso" > "$TODAY" ]]; then
    echo "  Skipping: publish date $date_iso has not arrived yet."
    skipped_prs+=("$number|$branch|not_yet_due:$date_iso")
    # The real run stops here to keep a far-future PR free of API calls. A dry
    # run reads the gate anyway, because on most days nothing is due and a dry
    # run that skipped every PR on the date would exercise the CI gate -- and
    # so the `checks: read` scope -- exactly never, which is the state this
    # whole mode exists to get out of. Informational: nothing branches on it.
    if (( DRY_RUN )); then
      echo "  Dry run: not due, but reading the CI gate anyway: $(ci_verdict "$number")."
    fi
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

  # The date rules above decide whether it is *time* to merge; this decides
  # whether it is *safe*. Checked last so a far-future PR costs no API calls,
  # which means everything reaching here is already due -- so any non-green
  # verdict is a publish date at risk today, and alarms rather than deferring
  # quietly to a tomorrow that no longer exists.
  verdict="$(ci_verdict "$number")"
  if [[ "$verdict" != "GREEN" && "$verdict" != "NONE" ]]; then
    echo "  Skipping: CI verdict is $verdict."
    skipped_prs+=("$number|$branch|ci_${verdict}")
    alarm_if_due "$number" "$branch" "$date_iso" "ci_${verdict}"
    continue
  fi
  echo "  CI verdict: $verdict."

  if (( DRY_RUN )); then
    echo "  Dry run: would merge #$number (\"$title\")."
    would_merge_prs+=("$number|$branch|$date_iso|$title")
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
    hard_failures+=("$number|$branch|merge_failed")
    alarm_if_due "$number" "$branch" "$date_iso" "merge_failed"
  fi
done < <(echo "$blog_prs" | jq -c '.[]')

echo ""
echo "=== Blog PR Auto-Merge Summary ==="
if (( DRY_RUN )); then
  echo "Would merge: ${#would_merge_prs[@]} (dry run -- nothing was merged)"
fi
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
    echo "- Merging posts due on or before: $TODAY"
    if (( DRY_RUN )); then
      echo "- **Dry run**: nothing was merged and no issue was created."
      echo ""
      echo "### Would merge"
      if (( ${#would_merge_prs[@]} == 0 )); then
        echo "- None"
      else
        for item in "${would_merge_prs[@]}"; do
          IFS='|' read -r number branch date title <<<"$item"
          echo "- #$number (\`$branch\`, \`$date\`): $title"
        done
      fi
    fi
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
