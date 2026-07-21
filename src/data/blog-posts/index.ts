export type { BlogPost } from "./types";
import { teachYourAgentToAskForHelp } from "./teach-your-agent-to-ask-for-help";
import { giveYourAgentAnUndoButton } from "./give-your-agent-an-undo-button";
import { agentsFailQuietly } from "./agents-fail-quietly";
import { agentPermissionsAreProductDesign } from "./agent-permissions-are-product-design";
import { agentRunbooksBeatBetterPrompts } from "./agent-runbooks-beat-better-prompts";
import { theAgentLeftTheIde } from "./the-agent-left-the-ide";
import { aiMadeBugsCheapToFind } from "./ai-made-bugs-cheap-to-find";
import { iHaveNotTouchedCodeInOneMonth } from "./i-have-not-touched-code-in-one-month";
import { whatIMissAboutHavingATeam } from "./what-i-miss-about-having-a-team";
import { distributionIsTheNewCode } from "./distribution-is-the-new-code";
import { tasteIsYourMoat } from "./taste-is-your-moat";
import { securityIncidentsOnTheRise } from "./security-incidents-on-the-rise";
import { tenXEngineerMyth } from "./10x-engineer-myth";
import { noMoreUglyWebsites } from "./no-more-ugly-websites";
import { shipItYourself } from "./ship-it-yourself";
import { fromCopilotsToColleagues } from "./from-copilots-to-colleagues";
import { thePowerOfSayingNo } from "./the-power-of-saying-no";
import { ownYourCareer } from "./own-your-career";
import { devinAiCoPilot } from "./devin-ai-co-pilot";
import { theZeroDollarStartup } from "./the-zero-dollar-startup";
import type { BlogPost } from "./types";

export const posts: BlogPost[] = [
  teachYourAgentToAskForHelp,
  giveYourAgentAnUndoButton,
  agentsFailQuietly,
  agentPermissionsAreProductDesign,
  agentRunbooksBeatBetterPrompts,
  theAgentLeftTheIde,
  aiMadeBugsCheapToFind,
  iHaveNotTouchedCodeInOneMonth,
  whatIMissAboutHavingATeam,
  distributionIsTheNewCode,
  tasteIsYourMoat,
  theZeroDollarStartup,
  securityIncidentsOnTheRise,
  tenXEngineerMyth,
  noMoreUglyWebsites,
  shipItYourself,
  fromCopilotsToColleagues,
  devinAiCoPilot,
  thePowerOfSayingNo,
  ownYourCareer,
];

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return posts.find((p) => p.slug === slug);
};
