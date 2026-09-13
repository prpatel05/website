In 2025, total AI-related investment reached **$581.69 billion** — a 129.9% jump over the year before, and roughly forty times what it was in 2013. In the same year, when [Stanford's AI Index](https://hai.stanford.edu/ai-index/2026-ai-index-report/economy) asked organizations how much they actually used AI agents, the most common answer, across most business functions, was none.

Those two facts belong in the same sentence, because the distance between them is the most useful thing a founder can hold in their head right now. Almost everyone has bought in. Almost nobody is running agents at scale. Depending on where you sit, that is the bubble thesis or the opportunity thesis — and the point of this post is to give you the numbers to decide, plus enough survey literacy to notice when two credible reports say opposite-sounding things.

## Where the Money Went

Start with the $581.69 billion, because it is the number everyone quotes and almost nobody reads carefully. It is not a corporate AI budget. The AI Index compiles it from mergers and acquisitions, minority stakes, private investment, and public offerings — the flow of capital *toward* AI, not the amount spent *deploying* it. Private investment alone was **$344.66 billion**, up 127.5%; M&A activity rose 132.6%. However you slice it, the money is real and it is accelerating.

Adoption looks just as emphatic. In the same body of surveys, **88% of organizations** reported using AI in at least one part of the business, and **70%** reported using generative AI in at least one function. If you stopped reading there, you would conclude the transformation is essentially complete.

Then you get to the agents.

## Where It Didn't

Here is the sentence from the chapter that reorganizes everything above it, quoted exactly because the summary version of it is misleading:

> "Across most business functions, a majority of respondents reported no agent use at all. Scaled use was in the single digits for nearly all functions."

Read that carefully, because the chapter's own one-line overview flattens it into "AI agent deployment was in the single digits," and that is not what the data says. "Single digits" describes *scaled* use — agents running as real infrastructure rather than in a pilot. The share reporting *no* agent use at all is much larger than single digits. In the words of the report: "Even in functions with the most activity, including IT and knowledge management, about two-thirds or more of respondents reported no use."

The high end is instructive. The functions with the most scaled agent use are exactly where you'd expect: software engineering at 24%, IT at 22%, service operations at 21%. Those are the peaks. Everywhere else falls away fast. So the picture is not "agents are everywhere." It is "agents are in engineering, and rare-to-absent in the rest of the company that engineering was supposed to be building them for."

One caveat the AI Index carries and I will carry too: these adoption figures come from McKinsey's annual State of AI surveys, and they are self-reported. The report itself says they "should be viewed as directional rather than comprehensive." Directional is enough for the argument. The direction is a two-order-of-magnitude gap between money in and agents out.

## The Number That Says the Opposite

Now the part that separates a useful reading from a credulous one.

If you spend any time in the agent-building community, the picture above will feel wrong, because you have seen a very different number. LangChain's [State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) survey found that **57.3% of respondents already had agents running in production**. Not piloting. Production. That is not single digits; that is a majority.

Both numbers are honestly reported. They disagree because they asked different people. The McKinsey/AI Index data samples *enterprises* — a broad cross-section of organizations and the functions inside them. The LangChain survey is a self-selected community sample: 1,340 respondents, fielded in late November and early December of 2025, 63% from the technology industry, and roughly half at companies with fewer than a hundred people. One instrument measured "how much do organizations use agents." The other measured "how much do people who build agents use agents." Of course they diverge.

The habit worth building is smaller than either statistic and worth more than both: before you believe an AI adoption number, ask **who was surveyed.** A figure sampled from agent engineers tells you the frontier is real and shipping. A figure sampled from enterprises tells you the frontier is narrow and hasn't diffused. Neither is a lie. They are answers to different questions, and most of the confusion in the market comes from treating them as answers to the same one.

The same discipline catches errors, not just framing. The AI Index chapter states, twice, that Google reported "more than $150 billion in capex" in 2025. Alphabet's own filing puts 2025 capital expenditure at **$91.4 billion**, up from $52.5 billion the year before, with $175–185 billion *guided* for 2026. The $150 billion figure looks like a 2026 projection read as a 2025 actual — a mistake even a careful report can make when it restates a third party's number about a specific company. When a claim can be checked against a primary source, check it. The gap between "money in" and "agents out" is real, but you want to be sure every number describing it is measuring what you think it is.

## What a Founder Should Do With This

The temptation is to treat the gap as a verdict — proof of a bubble, or proof of an untapped market. It is neither on its own. It is a description of *timing*.

If you are selling agents, the gap is your addressable market and your warning label at once. The demand signal is unambiguous: nearly nine in ten organizations are already using AI, and the capital is flooding in. But the thing you are selling — agents running at scale, in functions beyond engineering — barely exists yet in the enterprises you are selling to. That is not a market that needs another demo. It is a market that needs the operational work of making agents trustworthy enough to run unattended: the permissions, the runbooks, the observability, the ownership. The companies that closed that gap for themselves are the ones with agents in production. Everyone else is stuck at the pilot.

If you are buying, the gap is permission to move deliberately. You are not late. The single-digit scaled-use number means the median organization has not figured this out either, and the ones that have did it by treating agents as infrastructure rather than as a feature to switch on. The advantage is not in adopting first. It is in being one of the few that gets an agent past the pilot and into the part of the business that isn't engineering.

The consumer side hints at where the real value is accruing while enterprises deliberate. One estimate puts the annual consumer surplus from generative AI in the US at **$172 billion, up from $112 billion** the year before, with the share of US adults using generative AI rising from 48% to 56% (Bick et al., 2026). Worth flagging what that figure is: a stated-preference measure, drawn from online experiments asking people what they'd need to be paid to give up generative AI for a month — not revenue, not revealed behavior. But even discounted, it points the same way. The tools are being used. The enterprise agent, running at scale, in production, owning real work, is the thing that hasn't arrived.

$581.69 billion went looking for that agent last year. In most of the companies that spent it, the agent isn't running yet. The gap is not the failure of the story. It is the middle of it — and it is a better place to be building than either end.

If you want the setup to this, [The Zero Dollar Startup](/blog/the-zero-dollar-startup/) is about what happened when building got cheap, and [Distribution Is the New Code](/blog/distribution-is-the-new-code/) is about where the leverage moved next.
