Open any deck about team structure and you will eventually hit this sentence, in quotation marks, attributed to a paper from 1968:

> "Any organization that designs a system will inevitably produce a design whose structure is a copy of the organization's communication structure."

It is the most-quoted sentence in software architecture. It is used to justify reorganizations, to explain why the billing service and the billing team have suspiciously similar shapes, and above all to sell a maneuver: reshape the org, and the architecture you want will follow.

Three things about that sentence are worth knowing. It is not in the 1968 paper. The relationship it describes runs the opposite way from how it is used. And it was never a design instruction — the paper's actual recommendation is something almost nobody quotes, because it is unwelcome.

All three are checkable in an afternoon. The paper is four pages long and free on the author's own website. That is the real pleasure of this one: the most-cited law in our field is mostly cited by people who have not read the four pages.

## The Famous Sentence Is from 2010

Melvin Conway published "How Do Committees Invent?" in Datamation in April 1968. Forty-two years later he put a scan of it on his personal site, with a note on top for the modern reader:

> "Perhaps this paper's most remarkable feature is that it made it to publication with its thesis statement in the third-last paragraph. To save you the trouble of wading through 45 paragraphs to find the thesis, I'll give an informal version of it to you now: Any organization that designs a system (defined more broadly here than just information systems) will inevitably produce a design whose structure is a copy of the organization's communication structure."

There it is. The sentence everyone quotes as Conway's Law is Conway's own 2010 summary of his 1968 paper, offered explicitly as an informal version, written to spare you the reading. It is a good summary. It is not the claim.

The published claim, from the article's conclusion, is weaker and conditional:

> "organizations which design systems (in the broad sense used here) are constrained to produce designs which are copies of the communication structures of these organizations"

Constrained to produce, not will inevitably produce. That is not pedantry, and it is not a translation loss. A constraint tells you what is out of reach. A production rule tells you what comes out. Every practical use of Conway's Law depends on reading it as the second, and the paper only supports the first.

Two small notes for anyone who wants to check this themselves. The scanned PDF is the original; the HTML transcription on the same site drops a word from the opening sentence, which is a nice reminder that a transcription is not a source. And the note is not hard to find — it is the first thing on the page, above the paper.

## The Map Runs from the System to the Org

Conway's argument is not hand-waving about culture. He builds an actual mathematical object, and the direction of that object is the second thing everybody gets backwards.

He draws a system as a graph of subsystems and their interfaces, and the design organization as a graph of groups and their communication paths. Then:

> "In the case where some group designed more than one subsystem we find that the structure of the design organization is a collapsed version of the structure of the system, with the subsystems having the same design group collapsing into one node representing that group. This kind of a structure-preserving relationship between two sets of things is called a homomorphism."

Read the direction. The map goes from the system to the organization, and it is a collapse: several subsystems fold down into the one group that built them. That is not an accident of exposition. It is the only direction that works, because the collapse is where the information is lost.

And a collapsed image cannot be un-collapsed. There is no unique original. Many different system designs collapse onto the same org chart, which means knowing the organization you want does not tell you which design you will get — it tells you which designs are still reachable. Conway says so directly, in the sentence that should be on the slides instead:

> "To the extent that an organization is not completely flexible in its communication structure, that organization will stamp out an image of itself in every design it produces."

An image of itself. Not the design you sketched. A shadow of the org, cast onto whatever gets built.

This is where the Inverse Conway Maneuver — reorganize the teams to obtain the architecture you want — quietly changes the claim. Conway's relation has no inverse, so the maneuver cannot be selecting an architecture. What it is actually doing is described a few paragraphs earlier, and it is subtractive:

> "Every time a delegation is made and somebody's scope of inquiry is narrowed, the class of design alternatives which can be effectively pursued is also narrowed."

That is the honest mechanism. Reorganizing does not produce an architecture; it deletes architectures. Which is still useful — arguably more useful, because it is reliable in a way that steering is not. If you never want a service to depend on another one, putting them in organizations that cannot easily talk will make that dependency expensive and therefore rare. But it means the maneuver should be aimed at what you want to forbid, not at what you want to build. Teams reorganizing to *cause* a target architecture are running an operation the paper does not license, and they will get an image of the new org instead, which is a different thing that arrives looking similar enough to declare victory.

Conway is blunter about the cost than his popularizers are:

> "there is no such thing as a design group which is both organized and unbiased"

## It Was Never About the Org Chart

The third correction is the one most likely to change what you do next week. Conway's word is communication structure, and he treats the org chart as a special case — specifically, as the degenerate case:

> "To the extent that organizational protocol restricts communication along lines of command, the communication structure of an organization will resemble its administrative structure. This is one reason why military-style organizations design systems which look like their organization charts."

To the extent that. The org chart predicts the architecture only insofar as the organization has already succeeded in suppressing every communication path that is not a reporting line. When a system comes out shaped like the org chart, that is not the law working as intended. It is a measurement of how thoroughly the boxes have won.

Which reframes the reorg entirely. If the thing that shapes architecture is who actually talks to whom, then the reporting-line change is the weakest available lever, and it is the one that takes six weeks and costs the most goodwill. The strong levers are the ones that move real communication: who is in which channel, which teams share an on-call rotation, what requires a meeting versus a message, who reviews whose code, and how expensive it is to ask a question of somebody two orgs away.

Conway also supplies the reason organizations drift toward the chart anyway, and it is arithmetic:

> "Elementary probability theory tells us that the number of possible communication paths in an organization is approximately half the square of the number of people in the organization. Even in a moderately small organization it becomes necessary to restrict communication in order that people can get some 'work' done."

Communication paths grow quadratically and attention does not, so every growing organization restricts communication. It has no choice. The only question is whether the restrictions are chosen deliberately, with the architecture in mind, or allowed to default to the reporting lines — at which point the org chart becomes the communication structure, and the architecture becomes the org chart.

## Somebody Measured It

Conway offered anecdotes, and said so. The measurement arrived thirty-nine years later, when Alan MacCormack, Carliss Baldwin and John Rusnak tested what they call the mirroring hypothesis on five matched pairs of software products — each pair a loosely-coupled organization (an open source community) and a tightly-coupled one (a commercial firm), building products of comparable size and function.

Their metric is propagation cost: the share of the system that a change to a randomly chosen file can reach, counting indirect paths as well as direct ones. Their Table 4, loosely-coupled first:

- **Financial management** — 7.74% against 47.14%
- **Word processing** — 8.25% against 41.77%
- **Spreadsheet** — 23.62% against 54.31%
- **Operating system, first pair** — 7.18% against 22.59%
- **Operating system, second pair** — 7.21% against 24.83%
- **Database** — 11.30% against 43.23%

Six comparisons rather than five, because the operating system slot is tested twice against two different commercial systems. Same direction every time, differences of roughly 2.3x to 6.1x within a pair. The authors state it plainly:

> "In all the pairs we examine, the loosely-coupled organization develops a product with a more modular design than that of the tightly-coupled organization."

The sharp detail is not in that table, though. It is in what did not differ. The tightly-coupled organizations were not writing more dependencies:

> "Critically, these differences are not driven by differences in the number of direct dependencies between components — in only three of the pairs does the tightly-coupled organization produce a design with significantly higher density (see Table 3). Rather, each direct dependency gives rise to many more indirect dependencies in products developed by tightly-coupled organizations, as compared to those developed by loosely-coupled organizations."

In one pair the open source product is the denser of the two. Same number of couplings, radically different reach. The organization is not changing how much your code connects; it is changing how far each connection travels — and reach is exactly the property no one can see in a diff, a design doc, or a whiteboard.

The authors put that failure of perception on the record, and it is the paragraph to bring to your next architecture review:

> "Indeed, the commercial managers we work with almost always think their designs are highly modular. Unfortunately, the pristine black boxes they draw on their whiteboards rarely reflect the actual file-to-file interactions embedded in the source code."

Carry their limits with the finding, because they state them and it would be dishonest to drop them. The study is software only, where designs exist purely as information. It is five matched pairs, not a survey. And they do not directly test the functional equivalence of the pairs, matching on size instead. What it establishes is a strong, consistently-signed relationship in one industry — not a law of nature, and not a conversion factor you can apply to your own reorg.

## What Conway Actually Recommended

Here is the part that never makes the deck. Conway's paper does end with a recommendation. It is not "reorganize." It is closer to "hire fewer people."

> "Probably the greatest single common factor behind many poorly designed systems now in existence has been the availability of a design organization in need of work."

A design organization in need of work. Not an incompetent one, not an under-resourced one — an idle one, which will design something, because that is what it is for. If the group exists, it will produce structure, and that structure will end up in the system whether or not the system needed it. His prescription follows from that:

> "Ways must be found to reward design managers for keeping their organizations lean and flexible. There is need for a philosophy of system design management which is not based on the assumption that adding manpower simply adds to productivity."

That second sentence was published in April 1968. "The Mythical Man-Month" arrived seven years later.

Put those together with the collapse, and the executive version of Conway's Law is not a slogan about mirroring. It is this: every headcount decision is an architecture decision, and it is made months before anyone opens an editor. The moment you approve a fourth team, you have added a node whose interfaces will appear in the system — and the sequence is fixed, because the team exists first and the design is drawn afterward by the people you just hired.

So the useful questions are not about the diagram.

1. How many groups can reach this system at all? That number, more than any principle, sets how many seams it will have.
2. Where does communication actually flow — not on the chart, but in practice? Those paths are what the architecture will mirror. The reporting lines only matter to the extent they have crowded everything else out.
3. What is this reorg forbidding? If you cannot name the architecture it makes unreachable, you are not running the maneuver. You are hoping.

None of that requires believing a law. Conway did not think he had one; he thought he had a constraint proof, offered as a warning to managers who believed they were choosing designs on the merits. The paper is four pages. It is right there, and it does not say what you have been told it says.

Sources: Melvin E. Conway, [How Do Committees Invent?](https://www.melconway.com/Home/pdf/committees.pdf), Datamation, April 1968, pages 28-31, with the author's note at [melconway.com](https://www.melconway.com/Home/Committees_Paper.html). Alan MacCormack, Carliss Baldwin and John Rusnak, [Exploring the Duality between Product and Organizational Architectures](https://www.hbs.edu/ris/Publication%20Files/08-039_1861e507-1dc1-4602-85b8-90d71559d85b.pdf), Harvard Business School working paper 08-039.
