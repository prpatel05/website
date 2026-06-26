import { BlogPost } from "./types";

export const iHaveNotTouchedCodeInOneMonth: BlogPost = {
  slug: "i-have-not-touched-code-in-one-month",
  title: "I Haven't Touched Code in One Month",
  subtitle:
    "AI did not make me obsolete. It moved my job up the stack.",
  date: "2026.05",
  dateISO: "2026-05-26",
  readTime: "7 min",
  tags: ["ai", "engineering", "productivity", "building"],
  image: "/images/blog-i-have-not-touched-code.webp",
  content: `I realized something uncomfortable this week: I have not really touched code in a full month.

Not "I stopped building." The opposite. More shipped. More got reviewed. More ideas made it from vague note to working software. But the actual implementation work - the typing, wiring, scaffolding, renaming, fixing imports, chasing test failures - increasingly happened somewhere else.

AI agents handled it.

The honest reaction is not pure excitement. It is stranger than that. Part of me feels more effective than ever. Part of me wonders if I am getting worse at the craft I spent years sharpening. If you do not use the coding muscle, does it atrophy? Probably. But I also think that is the wrong question.

The better question is: **what skill is replacing it?**

## The Work Did Not Disappear

When people talk about AI coding, they usually frame it as automation. The machine writes code, so the human does less work. That is technically true and practically misleading.

The work did not disappear. It changed shape.

I still have to know what good looks like. I still have to understand the system well enough to spot a bad abstraction, a leaky permission model, or a feature that technically works but should not exist. I still have to decide which problems are worth solving and which ones are distractions wearing a product costume.

What I am not doing as much is the mechanical part:

- Creating the fifth version of the same CRUD flow
- Moving state between components because the first pass guessed wrong
- Writing boilerplate tests for behavior that is already clear
- Updating copy across three files
- Chasing TypeScript errors caused by a renamed prop
- Reading docs for the third-party integration and translating them into glue code

That work still matters. It is just no longer the highest-leverage place for me to spend my attention.

## I Am Not Coding Less. I Am Delegating More.

The mental model that finally clicked for me is delegation.

For most of my career, "building software" meant converting intent into code with my own hands. I would hold the product shape in my head, make a series of implementation decisions, and type the thing into existence.

Now the workflow feels closer to leading a small implementation team:

1. Define the outcome clearly.
2. Point the agent at the relevant context.
3. Review the plan before it writes code.
4. Let it implement.
5. Review the diff, the tests, and the behavior.
6. Push back where the work misses the intent.

That is not passive. It is a different kind of active.

The quality of the output is still a reflection of the quality of the input. If I give an agent a lazy task description, I get lazy work back. If I give it the actual constraints, the edge cases, the product intent, and the shape of the existing system, the result is usually good enough to review like a normal pull request.

The job moved from "write the code" to "create the conditions where good code is likely to emerge."

## The Weird Skill Loss Is Real

There is a cost here, and I do not want to hand-wave it away.

I am probably worse at remembering exact APIs than I was a year ago. I am less practiced at grinding through implementation details from a blank file. I feel the friction when I do drop back into the code editor and have to rehydrate the local context myself.

That is real.

But it is not the same as getting worse at engineering. It is closer to what happens when a senior engineer stops being the person who personally writes every line and starts being the person who sets direction, reviews work, and keeps the system coherent.

Some skills fade. Other skills compound.

The skills that feel more important now:

- **Taste:** knowing which version of the product should exist
- **Context design:** giving AI the right boundaries, examples, and constraints
- **Review judgment:** spotting the subtle wrongness in code that passes tests
- **Systems thinking:** understanding where a change belongs before anyone implements it
- **Risk calibration:** knowing when AI output is fine and when it needs deep scrutiny

Those are not softer skills. They are the skills that decide whether AI-generated work becomes leverage or liability.

## The Dangerous Part Is Feeling Fast

The biggest risk in this workflow is not that AI writes bad code. Bad code can be reviewed, tested, and fixed.

The bigger risk is that AI makes bad decisions feel cheap.

When implementation is expensive, you naturally hesitate. You ask whether the feature is worth it. You think about maintenance. You negotiate scope because every extra requirement costs real time.

When implementation feels almost free, the discipline has to come from somewhere else. You need stronger taste, not weaker. You need to say no more often, not less. Otherwise you end up with a product full of features nobody needed, all shipped efficiently.

That is the operator lesson I keep coming back to: **AI removes implementation friction, so judgment becomes the bottleneck.**

This matters a lot for what we are building at [poof.new](https://poof.new). If someone can describe an app and get working software back, the scarce skill is no longer syntax. It is intent. The builder has to know what they want, why it matters, and how to tell whether the result is actually good.

AI can make software real. It cannot tell you whether that software deserves to exist.

## What My Day Looks Like Now

A typical building day used to start with me opening the editor and finding the first file to change.

Now it starts with writing a better task.

I spend more time turning fuzzy ideas into crisp implementation briefs. I describe the user outcome, the current behavior, the desired behavior, the files that probably matter, the constraints that cannot be violated, and the tests that should pass when the work is done.

Then I review the plan.

This is the step I used to undervalue. Plan review is where most AI work succeeds or fails. If the plan reveals a wrong assumption, I would much rather catch it before the agent rewrites half the feature. A five-minute correction at the plan stage can save an hour of cleanup later.

Once the PR exists, I review it in layers:

- Does the behavior match the intent?
- Is the implementation consistent with the existing system?
- Did it add unnecessary abstraction?
- Are the tests proving the right thing?
- Is there any security or data exposure risk?
- Would I be comfortable owning this code six months from now?

That last question is the anchor. AI can write the code, but I still own the consequences.

## The New Builder Is More Editor Than Typist

There is an old romantic version of programming where the builder sits alone, enters flow state, and produces perfect software through direct contact with the machine.

I still love that feeling. I do not think it is going away entirely. There will always be moments where the fastest path is to open the file and make the change yourself.

But for a growing slice of product work, the highest-leverage builder looks less like a typist and more like an editor:

They know what to ask for. They know what to cut. They know when the first draft is good enough and when it is structurally wrong. They can look at a pile of generated work and see the one decision that needs to change.

That is not less creative. It is more like the creativity moved earlier in the process.

The blank page is not the code editor anymore. The blank page is the instruction.

## The Bottom Line

I have not touched much code in a month, and I am trying to be honest about both sides of that.

Yes, some hands-on sharpness fades when AI handles the implementation reps. If I had to sit down tomorrow and rebuild a feature entirely from scratch, I might feel slower than I used to.

But I am also shipping more, thinking more clearly, and spending more of my time on the parts of building that actually determine whether the work matters.

So no, I do not think AI made me dumber.

It made me more aware of which parts of my intelligence were being spent on low-leverage work.

The goal is not to never code again. The goal is to make code the last mile, not the whole journey. And once you experience that shift, it is hard to go back.`,
};
