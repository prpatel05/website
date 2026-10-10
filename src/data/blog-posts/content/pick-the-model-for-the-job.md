I spent an afternoon using the same frontier model for a UI walk, an architecture plan, a 40-file refactor, and a security review.

It was competent at all four. It was the right tool for maybe one. By dinner I had a confident plan that missed the real seam, a refactor that "compiled" while changing the wrong abstraction, a UI report that narrated clicks instead of failing a repro, and a review that sounded thorough while waving past the blast radius. One model. Four jobs. One diluted afternoon.

The usual advice is to pick a favorite model and stick with it, or to chase whichever lab just posted a chart. The inversion is quieter. Models are not personalities you marry. They are instruments. The skill is matching the instrument to the phase of work, then writing down what "done" means before you open the tab.

This is the fourth post in **Ship With Agents**. Earlier posts covered long runs, treating your paid stack as a roster with handoffs, and checking in from a phone without pretending the phone is a full IDE. This one is about picking the model for the job: UI work, planning, long refactors, and review. Different seats. Different proof.

## The Same Model Is Not the Same Job

If you treat every hard problem as "ask the smartest model," you are optimizing for eloquence, not for the artifact you need next.

A UI walk needs a model (and a harness) that can stay inside a product path, fail a repro on purpose, and bring back evidence. A planning pass needs a model that compresses constraints without inventing architecture you did not ask for. A long refactor needs patience across files, respect for existing seams, and a stop condition that is not "looks cleaner." A review needs adversarial attention: holes, overclaims, and blast radius you waved away.

Those are different failure modes. A model that is excellent at long prose will happily write you a beautiful wrong plan. A model that is sharp at code edits will "helpfully" widen scope because nobody told it the blast radius. A model that is great at critique will start rewriting the feature if you never named the seat.

The logo on the tab matters less than the contract you put in front of it. Still, tools are not identical. Latency, context behavior, tool use, stubbornness, and taste for structure all differ. You already feel that. The move is to stop treating the feeling as vibes and start treating it as roles.

## Four Seats I Actually Staff

Here is the roster I use in practice. Names will drift as labs ship. The seats should not.

**UI and product-path work.** Job: enter a real path (or a staging twin), reproduce, observe, return evidence. Proof is a failing-then-passing path, a screenshot of the unbroken screen, a trace id, not a paragraph that says "should work now." I want a model that stays concrete under tool use and does not invent a narrative when the UI disagrees. If the agent cannot fail the old repro after the fix, it is drafting. It is not done.

**Planning and compression.** Job: turn a messy problem into a short contract the next surface can execute. Goal, constraints, blast radius, acceptance checks, unresolved questions. Proof is a brief you can paste into implementation without reconstructing intent from chat tone. I want a model that cuts. If the plan grows into a novel, I picked the wrong pass or the wrong seat.

**Long refactor and multi-file change.** Job: move a seam across the codebase without rewriting the product for sport. Proof is a small, reversible diff against a branch, tests or scripted checks attached, and a clear revert path. I want a model that can hold the local architecture in mind and refuse epic rewrites when the ticket is a rename-plus-call-sites job. Overnight loops belong here only when the trail survives a tab crash (see *Let It Run for Days*).

**Review and adversarial pass.** Job: find the hole before prod does. Punch list of risks, falsifiers, missing checks, and overclaims. Proof is a list that makes the implementer uncomfortable in a useful way. I want a model that is willing to be rude. If it starts building the feature, I pulled it out of its lane.

I map those seats onto Claude Max, ChatGPT Pro, SuperGrok, Cursor, and Antigravity the same way I do in *Your Stack Is a Team, Not a Subscription*: persistence and long loops in one place, compression in another, adversarial review in a third, repo-local implementation where the diff lives, product walking where evidence lives. The mapping can change next quarter. The seats stay.

## A Worked Morning: One Ticket, Four Instruments

Concrete shape, not a stage demo.

The ticket: a settings save drops one field after refresh on staging. Classic. Easy to talk about. Easy to "fix" in the wrong layer.

I do not open the strongest model and paste the whole saga. I open the planning seat for five minutes. Brief only: preserve field X across save and reload on staging. Blast radius: staging, test user, no prod writes. Stop condition: scripted reload shows X still present, plus a note for the empty-field case. Unresolved: client state vs API omit vs cache. That brief is the contract.

Adversarial seat next, with the brief and the first hypothesis. I ask for punches, not a rewrite. It returns three: check the PATCH payload, check empty-string-as-omit, check a second-tab race. Now the implementer has falsifiers instead of vibes.

Refactor or implementation seat owns the change in the repo: smallest reversible fix, tests or script where they fit, PR I can revert. UI seat walks the same path the brief named and returns evidence. Before/after on reload. Empty-field case called out if it still fails.

If I had used one model for all four phases, I would still get words. I would not get clean artifacts at the seams. The morning works when each seat produces the proof that seat is for, and I own the handoff between them.

## Matching Is a Decision You Write Down

People skip the matching step because it feels slower than "just ask."

It is slower for the first thirty seconds. It is faster for the afternoon. Write three lines before you open the tab:

1. **Seat.** UI, plan, refactor, or review (pick one).
2. **Artifact.** What must exist when this pass ends (brief, diff, evidence pack, punch list).
3. **Stop condition.** What "done" means in the product or in the repo, not in the model's self-report.

That sticky note is the whole skill. Without it, every model becomes a chat therapist with a compiler. With it, you can swap models next month and keep the operating system.

Bounded, reversible, inspectable still applies. The seat card should say what the model may write, what it may only read, and how you reverse a bad hour. Demo energy is one model sounding brilliant across every phase. Prod energy is four boring artifacts that survive a handoff.

## What Goes Wrong When You Skip the Match

**Planning model on a UI walk.** You get a confident theory of the bug and zero path evidence. You "fix" a mental model. The screen still drops the field.

**UI walker on a multi-file refactor.** You get click narratives and opportunistic edits near the visible symptom. The abstraction stays wrong. The bug moves.

**Refactor model on a security or blast-radius review.** You get a cleaner module and a quiet permission widen. The PR looks tidy. The risk got prettier.

**Review model on greenfield planning.** You get a brilliant critique of a plan that does not exist yet. Useful as spice. Fatal as the only pass.

Quiet failures love mismatched seats. The output still sounds like work. The next person (often you, two hours later) cannot tell which phase produced which claim. That is how you lose a day to the same bug twice.

## Cut the Default to One Seat Per Pass

If your default is "open the best model and pour the whole problem in," change the default.

One seat per pass. One artifact out. Then hand off. Model-hopping without a contract is still thrash. Model-matching with a contract is how a stack becomes a team.

You do not need a perfect matrix of every model and every task type. You need fewer passes that pretend to be every job at once. When a new model ships, promote it into a seat with a trial ticket and a written stop condition. Demote it if it only produces nicer paragraphs for the wrong artifact.

The next post in this series is about parallel agents and ownership. The through-line does not change. Tools are cheap. Contracts are the work. Picking a model is picking which contract you are about to enforce.

## The Bottom Line

The best model for "everything" is usually the wrong model for the next artifact.

Match the seat to the job, write the stop condition, and demand the proof that seat is for. Eloquence is not a ship gate. The brief, the diff, the evidence, and the punch list are.
