Ask ten engineers what code review is for and you will get one answer: catching bugs before they ship. It is on the pull request template. It is why the branch protection rule exists. It is what you would say in an audit, and it is what you would say to a new hire on their first day.

Now open your last twenty review comments and count how many of them found a bug.

This is not a trick, and the answer is not a verdict on your team. The gap between what review is for and what review does has been measured — at Microsoft in 2013 and at Google in 2018, in two studies that had access to more review data than any of us will ever see. Both found the same gap. Neither found that review was worthless. What they found is that most organizations are running one set of machinery to collect the benefits of an entirely different one, and have never noticed, because nobody ever wrote down which one they had chosen.

## Three Answers, Fifty Years Apart

The first answer is Michael Fagan's, from 1976. He formalized the code inspection, described in the 2013 Microsoft paper as a highly structured process "based on line-by-line group reviews, done in extended meetings." The purpose was not ambiguous, and neither is the evidence that accumulated around it. That same paper credits inspections with benefits "especially in terms of defect finding."

Almost every review habit you have inherited descends from that idea. The approval gate. The reviewer quorum. The instinct that more eyes on a change is strictly better than fewer. What did not survive was Fagan's actual method, and the 2018 Google paper writes the epitaph in a single clause:

> "Over the years, researchers provided evidence on the benefits of code inspection, especially for defect finding, but the cumbersome, time-consuming, and synchronous nature of this approach hindered its universal adoption in practice."

What replaced it is the thing you did this morning: asynchronous, tool-based, lightweight review. A diff in a browser. Comments in a thread. No meeting.

The purpose, though, was never re-derived. We kept Fagan's stated goal and discarded his method — which is a strange trade, because the method was the part engineered to achieve the goal. The extended meeting, the line-by-line pass, the group in one room: those were not ceremony around defect detection, they were the mechanism of it. Keeping the goal and dropping the mechanism leaves you asserting an outcome you no longer have a process for.

## 2013: Somebody Finally Counted

Alberto Bacchelli and Christian Bird did the counting, at Microsoft, published at ICSE 2013. They observed and interviewed seventeen developers across sixteen product teams with, in their words, "distinct reviewing cultures and policies," surveyed 165 managers and 873 programmers, and then did the part nobody had done: they hand-classified the content of 570 individual review comments drawn from 200 review threads.

Start with what people said they wanted. Defects lead comfortably:

> "finding defects is the first motivation for code review for 383 of the programmers (44%), second motivation for 204 (23%), and third for 96 (11%)"

For managers it is the top reason 44% of the time. So far, so Fagan.

Then the card sort of what reviewers actually wrote:

- **Code improvements: 165 comments, 29% of the sample** — the single largest category. Inside it, 58 comments on better coding practices, 55 on removing unnecessary or unused code, 52 on readability.
- **Defects: 78 comments, 14%** — the fourth most frequent category out of nine.
- **Inside those 78 defect comments** — 65 were logical issues such as a wrong expression in an if clause, 6 were high-level issues, 5 were security, and 3 were wrong exception handling.

Five comments about security. Out of 570. At Microsoft.

The authors state the conclusion themselves, and it is worth reading in their words rather than mine:

> "the outcome of code review does not match the main expectation of both programmers and managers—finding defects. Review comments about defects are few, comprising one-eighth of the total in our sample, and mostly address 'micro' level and superficial concerns"

Two warnings about that 14%, because it is the most misquoted number in this literature. First, it is the share of review comments that were about defects. It is not a defect-catch rate. This study measures no defect yield at all, and neither does the Google one, so anybody who tells you "code review only catches 14% of bugs" has taken a real number and swapped its meaning. Second, the honest complication that the summaries drop: code improvement was already the second most-cited motivation, primary for 337 programmers (39%). It is not that nobody valued it. It is that nearly everybody ranked defects first, got improvement instead, and left the policy pointed at defects.

The paper also explains the mechanism, and this is the part that should change what you do on Monday. Asked which outcomes demanded the most understanding of the change, developers put one at the top:

> "The most difficult task from the understanding perspective is finding defects"

Finding a real defect requires understanding a change, and the context around it, better than the person who wrote it did. Suggesting a clearer variable name does not. So when you make review harder — bigger diffs, more files, less context, a longer queue, a reviewer three timezones away — the first capability you lose is precisely the one you said review was for. The comments do not stop. They just slide down to the tier that survives on partial understanding.

## 2018: Google Says the Quiet Part

Google's study covers approximately nine million changes from more than 25,000 authors and reviewers between January 2014 and July 2016, alongside twelve interviews and a developer survey. The interviews reached one of the company's first employees, who explained why review was introduced at all:

> "the main impetus behind the introduction of code review was to force developers to write code that other developers could understand; this was deemed important since code must act as a teacher for future developers"

Not a gate. A teaching requirement. The paper's first finding puts it on the record:

> "Expectations for code review at Google do not center around problem solving. Reviewing was introduced at Google to ensure code readability and maintainability. Today's developers also perceive this educational aspect, in addition to maintaining norms, tracking history, gatekeeping, and accident prevention. Defect finding is welcomed but not the only focus."

That is a third position, not a restatement of the second. The paper is explicit that its focus does not align with the earlier framing of review as a group problem-solving activity. Fagan says review is inspection. Microsoft's data says review produces improvement whatever you intended. Google says review is how norms and comprehension move through an organization, and has built the process to match: directories have explicit owners who must approve changes to them, and engineers earn a per-language readability certification that every change must have somewhere on it, from either the author or a reviewer.

## The Numbers Only Make Sense If Review Is Education

Here is where it stops being a literature argument and starts being an operating decision. Google had been refining this process for more than a decade when the study was written, across more than 25,000 developers, and had tuned it in exactly the direction a defect gate would forbid.

- **Median reviewer count: one.** Fewer than 25% of changes have more than one reviewer, and over 99% have at most five.
- **Median change size: 24 lines.** Over 35% of changes touch only a single file, about 90% touch fewer than ten, and over 10% modify a single line.
- **Median latency for the entire review process: under four hours.** During the week, 70% of changes are committed less than 24 hours after being mailed out for initial review.

Read those as a defect gate and every line is a scandal. One reviewer, twenty-four lines, shipped by lunch. If the job is to catch what the author missed, you want more reviewers, more time, more thoroughness, bigger batches to amortize the context-switch.

Read them as education and they are not just defensible, they are forced. Comprehension is destroyed by size and by delay. A 24-line change read by one person within the hour teaches somebody something and gets a real reaction. A 900-line change reviewed over three days by four people is a rubber stamp with a quorum, and everyone involved knows it. Read that way, the small fast review is not a compromise the quality bar tolerates. It is the only size at which the thing Google says it wants from review can happen at all.

The educational effect also shows up in the data rather than only in the interviews. The average number of comments on an engineer's changes falls as their tenure rises, which is what learning looks like from the outside. And the number of distinct files an engineer has seen — edited plus reviewed — is clearly larger than the number they have edited. Review is how most of an engineer's knowledge of a codebase arrives.

## Your Review Policy Is a Claim

You are already answering this question. The answer is encoded in your defaults, and if you have not chosen it deliberately then you have chosen it accidentally.

Three questions, in order.

1. What does your written policy optimize for? Required reviewer counts, blocking approvals, mandatory checklists and sign-off matrices are all Fagan. They are the machinery of defect detection, and they are the machinery whose own method the industry abandoned when it moved to the pull request.
2. What do your review comments actually say? Take a sample of fifty from last month and sort them into piles: defects, improvements, questions, style, approvals with no content. You now have your own version of the 2013 card sort, on your own codebase, and it costs an afternoon.
3. When those two disagree, which one do you change? This is the only question that matters, and almost nobody asks it, because it is much easier to keep asserting the goal than to admit the process is producing something else.

There is no wrong answer to the third question. Defect detection is a legitimate thing to want, and if you want it you should build for it — smaller changes, better context in the diff, invested reviewer time, tooling that automates the micro tier so humans can afford the expensive kind of understanding. Education is a legitimate thing to want, and if you want it you should build for that instead — fast turnarounds, one reviewer, deliberate pairing of authors with the people they should be learning from or teaching.

What does not work is the default: running the 1976 machinery, measuring nothing, collecting the 2018 benefit by accident, and calling it a quality gate in the postmortem. That configuration is not merely inefficient. It is a team that has never been told what its most-performed ritual is for, and is quietly deciding on its own, one comment at a time.

Sources: Alberto Bacchelli and Christian Bird, [Expectations, Outcomes, and Challenges of Modern Code Review](https://sback.it/publications/icse2013.pdf), ICSE 2013. Caitlin Sadowski, Emma Söderberg, Luke Church, Michal Sipko and Alberto Bacchelli, [Modern Code Review: A Case Study at Google](https://sback.it/publications/icse2018seip.pdf), ICSE-SEIP 2018.
