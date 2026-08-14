Somewhere in the last two years, the context window stopped being a limit and started being a feature. A million tokens. Put the whole repository in. Put the whole quarter of support tickets in. The pitch is that you no longer have to think about what goes in the prompt, and it is the most expensive wrong idea in production AI right now.

Here is the tell, and it comes from the vendor, not from me. On several current models, the API writes a tag into the system prompt of every request before your text ever gets there:

```
<budget:token_budget>
  200000
</budget:token_budget>
```

And after each tool call, it writes another one:

```
<system_warning>
  Token usage: 35000/200000;
  165000 remaining
</system_warning>
```

Both are wrapped above for narrow screens; the API writes each on a single line. The [documentation](https://platform.claude.com/docs/en/build-with-claude/context-windows) calls this context awareness, and says the value "matches the context window available to your request" — the 200,000 above is just the example they print. Read the tag name again, though. Not `token_limit`. Not `max_context`. **The model is handed a budget and a running balance, because the people who built it concluded the model would make better decisions if it knew how much it had left to spend.**

That is a design position, and it is the correct one. Most of the systems calling that API do not share it.

## The Number on the Box Is Not the Number You Can Spend

The cleanest measurement of this is still [RULER](https://arxiv.org/abs/2404.06654), from a team at NVIDIA, which evaluated 17 long-context models across 13 tasks. Its method is the useful part: rather than ask whether a model accepts a long input, it asks how long an input the model can still do real work on.

To draw that line they needed a passing grade, and the one they chose is unflattering by construction:

> "To determine the maximum context size a model can effectively handle, we grade each model with a fixed threshold, passing which indicates satisfactory performance at the length of evaluation. We use the performance of Llama2-7b model at the 4K context length as the threshold."

Llama2-7B scored 85.6 at 4K. So a model's "effective" context length is the longest input at which it is **still no worse than a small 2023 model working on four thousand tokens.** That is the floor, not a standard of excellence. Two rows from their results table, and both models were near the top of the field at the time:

- **GPT-4** — claimed context 128K, effective context 64K. Scores fall 96.6 at 4K, 93.2 at 32K, 87.0 at 64K, 81.2 at 128K.
- **Yi-34B** — claimed context 200K, effective context 32K. Scores fall 93.3 at 4K, 87.5 at 32K, 77.3 at 128K.

Yi-34B ships a 200K window and clears that low bar to 32K. You can buy the whole window and reliably spend about a sixth of it. The paper's own summary of the field is the sentence to keep:

> "While these models all claim context sizes of 32K tokens or greater, only half of them can maintain satisfactory performance at the length of 32K."

Those particular models are of their moment and the frontier has moved since. The gap has not closed on its own, and more to the point, **nobody publishes an effective context length on the spec sheet.** The advertised number is a capacity. The usable number is an empirical question about your workload that you have to answer yourself.

## It Is Not a Cliff at the Edge. It Is a Slope Through the Middle.

The second finding is worse than a size limit, because a size limit at least fails loudly. [Lost in the Middle](https://arxiv.org/abs/2307.03172), whose authors list Stanford, UC Berkeley and Samaya AI, moved the position of the one relevant document inside an otherwise identical prompt and watched the answer change:

> "performance is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle of long contexts, even for explicitly long-context models."

Same tokens, same question, same model. Only the position moved. But the number that should reorganize how you think about retrieval is in their comparison of settings. Given only the single document that contains the answer, GPT-3.5-Turbo scored 88.3%. Given no documents at all and forced to answer from memory, it scored 56.1%. And then:

> "GPT-3.5-Turbo's multi-document QA performance can drop by more than 20%—in the worst case, performance in 20- and 30-document settings is lower than performance without any input documents (i.e., closed-book performance; 56.1%)."

Sit with what that describes. They handed the model twenty documents. **The document containing the answer was one of them.** And it did worse than if they had handed it nothing.

That is not a retrieval miss, and it is not a hallucination in the usual sense. The information was present, and supplying it was actively harmful. Nineteen plausible, on-topic, wrong documents cost more than they paid for. If your architecture is "retrieve top-k and let the model sort it out," the value of k is not a tuning detail. Past some point it is negative.

## The Vendor Publishes This Too

What makes this unusually easy to act on is that the people selling the context window document its limits on the page where they explain the product:

> "A larger context window allows the model to handle more complex and lengthy prompts, but more context isn't automatically better. As token count grows, accuracy and recall degrade, a phenomenon known as context rot. This makes curating what's in context just as important as how much space is available."

Anthropic's engineering write-up on [context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) goes further and states the economics outright: context "must be treated as a finite resource with diminishing marginal returns," because models have an "attention budget" that every added token draws down.

Vendors do not usually publish the failure curve of the thing on the price list. Take the gift.

## The Price Is Flat. The Value Is Not.

Now put that next to how the window is billed. From the pricing page:

> "Claude 4.6 and later models and Claude Mythos Preview include the full 1M token context window at standard pricing. (A 900k-token request is billed at the same per-token rate as a 9k-token request.)"

A flat rate across the window is good news for the invoice and a genuine trap for the operator, because **the meter is linear and the value curve is not.** The hundred-thousandth token costs exactly what the first one did and does considerably less for you. If cost is the only instrument on your dashboard, degradation is invisible: the bill for a bloated prompt that confused the model looks exactly like the bill for a tight one that worked.

This is precisely why "budget" is the right word and "limit" is not. A limit is a wall you hit. A budget is an allocation you make under scarcity, where every line item competes with every other, and where nobody sends you a notification for money badly spent.

## You Are Not the Only One Spending It

The other half of budgeting is knowing what is already committed before you start. The documentation is blunt about the scope:

> "Everything in the request counts toward the context window: the system prompt, every message in messages (including tool results, images, and documents), and your tool definitions."

Some line items people forget they signed:

- **Tool definitions bill before any tool runs.** Enabling tool use adds a system prompt of a few hundred to several hundred tokens depending on model, and each tool's schema is charged on top of that. Bash adds hundreds; the text editor tool adds 700. A generous toolbelt is a standing charge on every single turn.
- **Fetched content is enormous.** The docs' own estimates: a typical web page is about 2,500 tokens, a large documentation page about 25,000, and a research paper PDF about 125,000. Three papers is a 200K window, gone, before the agent has reasoned about any of them.
- **Caching changes the price, not the footprint.** Verbatim: "Cached prompt prefixes still occupy the context window: prompt caching changes what you pay for those tokens, not whether they count." Caching is a discount on rent, not extra floor space — and it quietly encourages exactly the large static preamble that eats the budget.
- **Thinking tokens count, and on newer models they persist.** Extended thinking is inside the same envelope, and on current Opus and Sonnet models previous thinking blocks are kept by default rather than stripped.

## What a Budget Discipline Looks Like

None of this argues for short prompts. It argues for deliberate ones.

1. **Decide the allocation before the request, not after the incident.** Estimate with the token counting API rather than discovering the shape of your prompt from a production failure.
2. **Have an eviction policy.** Server-side compaction summarizes earlier turns so a conversation can continue past the limit; context editing can clear stale tool results and thinking blocks. Choosing what leaves is engineering. Hoping it fits is not.
3. **Retrieve just in time instead of pre-loading.** The goal named in the engineering post is "the smallest set of high-signal tokens that maximize the likelihood of some desired outcome," which is the opposite instinct to filling the window because it is there.
4. **Know your behavior at the ceiling.** The two ways you reach it arrive on different channels. If input alone exceeds the window, you get a 400 and "prompt is too long" — an error you catch. If a generation runs into the limit mid-response, you get a perfectly successful response whose stop reason you have to read. A budget with undefined behavior at the limit is not a budget.
5. **Measure the thing that actually degrades.** Cost and latency will not show you context rot, because the request that spent its budget badly is priced identically to the one that spent it well. This is the same trap as [an eval suite that measures the wrong thing](/blog/your-eval-suite-measures-the-wrong-thing/): the instrument reports green while the outcome gets worse.

That fourth one is worth a name. On 4.5 and newer, the stop reason to look for is
`model_context_window_exceeded` — distinct from `max_tokens`, which only means the
response hit the cap you asked for. One says you ran out of room; the other says you
ran out of allowance. Code that treats them the same will retry the wrong one forever.

And the one that saves the most money: **when quality drops in a long conversation, resist answering with a bigger window.** That is the move the measurements say has the least chance of working. The fix is almost always to put less in, better ordered.

## The Tag Was Always the Point

Every piece of the system already agrees. The benchmarks say the usable fraction is smaller than the advertised one. The position studies say a buried fact can be worth less than no fact. The vendor's docs name the degradation and tell you to curate. The price list says you will be charged the same whether those tokens helped or hurt.

The only component still behaving as though the window were free storage is the architecture on top — the code that loads the whole document because the whole document fits.

The API is handing the model a budget and a running balance on every turn. It would be strange for the model to be the only part of your system that knows.
