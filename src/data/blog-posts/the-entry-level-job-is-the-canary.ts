import { BlogPost } from "./types";

export const theEntryLevelJobIsTheCanary: BlogPost = {
  slug: "the-entry-level-job-is-the-canary",
  title: "The Entry-Level Job Is the Canary",
  subtitle:
    "The most-cited number about AI and jobs is real, and almost everyone repeats it wrong. Here is what the Stanford paper actually found, what its authors refuse to claim, and the one fact in it worth building a hiring plan on.",
  date: "2026.08",
  dateISO: "2026-08-18",
  readTime: "7 min",
  tags: ["ai", "hiring", "economics", "startups", "leadership"],
  image: "/images/blog-the-entry-level-job-is-the-canary.webp",
  content: `Your headcount plan is a forecast about which tasks survive. Most people are making it from a statistic they have misread.

The statistic is 16%, and it comes from [*Canaries in the Coal Mine?*](https://digitaleconomy.stanford.edu/publications/canaries-in-the-coal-mine/), a paper by Erik Brynjolfsson, Bharat Chandar and Ruyu Chen at the Stanford Digital Economy Lab. It has been quoted in every direction for months. It is a serious piece of work and the number is real. It just does not say what the reposts say it says.

I read the November 13, 2025 version end to end before writing this, because an earlier draft carried a different figure and that one is still circulating. What follows is the finding stated correctly, followed by the part of it I would actually change a plan over.

## What the 16% Is

Here is the abstract, verbatim:

> "Early-career workers (ages 22-25) in AI-exposed occupations experienced 16% relative employment declines, controlling for firm-level shocks, while employment for experienced workers remained stable."

Two words in that sentence do all the work, and both get dropped in the retelling.

**Relative.** The 16% is a comparison, not a count. It is the gap between young workers in the most AI-exposed occupations and comparable older workers *at the same firms*, after the model absorbs whatever else was happening to those firms. It is not "one in six entry-level jobs disappeared." Nobody lost 16% of anything.

**Controlling.** It is a regression estimate, conditioned on firm-time effects. That conditioning is the point — it is what rules out "this firm was just shrinking" — but it also means the number is a modelled contrast, not something you could count off a payroll.

If you want a figure you can hold in your hand, the paper has better ones, and they are unmodelled. From late 2022 to September 2025, in the **most AI-exposed occupations**, employment for 22-to-25-year-olds **fell 6%**, "compared to a 6-9% increase for older workers." In the three **least**-exposed quintiles, employment grew **5-13% for every age group, with no clear ordering by age**.

Read those two sentences next to each other. That contrast is the entire finding. Where AI exposure is low, young and old grew together. Where it is high, the young line bends down while everyone else's keeps climbing.

And the number that will get screenshotted: by September 2025, employment for **software developers aged 22-25 had declined nearly 20% from its peak in late 2022**. True — with the caveat that late 2022 was a hiring bubble, so some of that fall is a bubble deflating rather than a job vanishing.

## What the Authors Will Not Claim

This is where the honest version parts company with the viral version.

The paper does not say generative AI caused this. Its own words:

> "While our main estimates may be influenced by factors other than generative AI, our results are consistent with the hypothesis that generative AI has begun to affect entry-level employment significantly."

And from the conclusion: "Future work would benefit from better firm-level AI adoption data, which would provide sharper variation for estimating plausible causal effects of AI on employment." The title is *Six Facts*, not six effects. That word choice is deliberate and it is the most-ignored thing in the paper.

Three more limits worth carrying, because they are the ones that will be quoted back at you:

**The data is one payroll provider.** ADP — large, administrative, real, and not a national sample.

**Credible datasets disagree.** The paper cites its own contradictors, which is a good sign about the paper. Hampole et al. (2025), using Revelio Labs job postings and LinkedIn profiles from 2011 to 2023, find limited employment impacts overall, with growing labour demand at firms offsetting relative declines in exposed occupations. Chandar (2025b) — the same Chandar — using CPS data finds little differential trend overall, while noting how hard young workers are to measure there. Two credible datasets, two different pictures.

**Watch for the aggregator trap.** You will see the "nearly 20% for young software developers" figure repeated in other 2026 reports. That is not corroboration. Those reports are citing this same paper. One study restated three times is still one study.

## The Fact Worth Planning Around

Now the part that survives all of that, and the reason I think this paper matters to anyone running a company.

The declines are not spread evenly across "AI-exposed" work. They concentrate where AI **automates** a task, and go muted where it **augments** one.

The authors measure this using the [Anthropic Economic Index](https://www.anthropic.com/economic-index), which classifies the share of real Claude queries per occupational task as automative or augmentative. Occupations with the highest automation shares show declining employment for the youngest workers. Occupations with the highest augmentation shares show no such pattern — the top augmentation quintile has among the *fastest* employment growth for young workers.

Disclose the proxy when you repeat this: query mix is a measure of how people use one AI model, not a measure of what firms have adopted. It is a good proxy. It is still a proxy.

But the mechanism it points at is intuitive enough that I believe it. The paper's framing is that AI is automating "the codifiable, checkable tasks that historically justified entry-level headcount," while complementing the judgment-, client- and process-heavy work that experienced people do. The entry-level job was always partly a training subsidy — you paid someone to do the checkable version of the work while they learned the unwritten version. When the checkable version gets cheap, that arrangement is the first thing to come under pressure.

Two more facts to file next to it.

**It is showing up in headcount, not in pay.** Compensation trends barely diverge by age or exposure; employment trends diverge a lot. The market is repricing *whether the role exists*, not what it pays. (The paper is careful here too — it offers offsetting wage effects or simple short-run wage stickiness as competing explanations.)

**It is probably hiring, not firing — and that part is a hypothesis, not a measurement.** The authors suggest reduced hiring is "the lowest-friction adjustment margin," and that firms "may primarily shrink junior inflows rather than displace incumbents." Note every "may." They did not measure inflows against separations; they proposed a mechanism that fits the shape of the data. Treat it as the best current guess, not a result.

Which, if it holds, means the adjustment is nearly invisible from inside a company. Nobody announces it. There is no layoff. A role just quietly stops being opened.

## So What Do You Do With It

I run a company where agents do a large share of the checkable work. So I have to take this seriously rather than argue with it, and here is where I have landed.

**Audit your roles by task, not by title.** The unit of exposure in this data is the task, not the job. Take each role you were planning to hire and split it: which parts are codified and checkable, which need judgment, context or a relationship. If a role is mostly the first kind, you are not hiring a person, you are buying a workflow — and you should ask whether you want it as a workflow.

**Do not read "automate" as "eliminate."** The augmentation quintiles grew fastest. The instruction the data actually gives is to hire *into* the augmented shape: fewer people doing more leveraged work, earlier. That is a different plan from a hiring freeze, and it is a better one.

**Notice that the cheap-to-check work was also the training ladder.** If you automate every task a junior used to learn on, you have optimised this year and mortgaged your senior bench. Somebody has to still be growing into the judgment work, and it will not happen by accident. I wrote about the individual side of this in [Own Your Career](/blog/own-your-career/); the company side is the same problem viewed from the other end.

**Stop measuring people by output volume.** When the checkable output is nearly free, counting it tells you nothing about who is valuable. That was already true before this paper — it is the whole argument in [The 10x Engineer Myth](/blog/10x-engineer-myth/) — and this data makes it expensive to keep getting wrong.

## The Canary Is a Warning, Not a Verdict

The paper's title is the right metaphor and it is worth taking literally. A canary is an early indicator in a confined space. It tells you something about the air before you can feel it yourself. It does not tell you the mine has collapsed, and it does not tell you why.

That is roughly the epistemic state we are in. Something real is happening at the entry level of AI-exposed work. It is showing up in headcount rather than wages, in automated tasks rather than augmented ones, and most likely through hiring that quietly does not happen. Whether generative AI is the cause is not established, and the honest researchers on this are the ones saying so.

You do not need causality to act on it. You need to know which of your tasks are checkable, and what you plan to do with the people who used to check them.`,
};
