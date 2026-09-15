import { getDailyCategory } from "./config.js";
import { getDailyLocalDate, getDailyTimeZone } from "./date.js";
import {
  chooseCandidate,
  claimActivation,
  getActivationForDate,
  getMinimumActiveLevel,
  getPreviousContentId
} from "./repository.js";
import { serializeDailyActivation } from "./serializers.js";

const MAX_CLAIM_ATTEMPTS = 3;

export async function activateDailyCategory(db, categorySlug, now = new Date()) {
  const category = getDailyCategory(categorySlug);
  if (!category) return { state: "not_found" };

  const localDate = getDailyLocalDate(now);
  const timeZone = getDailyTimeZone();

  const existing = await getActivationForDate(db, categorySlug, localDate);
  if (existing) return serializeDailyActivation(existing, categorySlug);

  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt += 1) {
    const minLevel = await getMinimumActiveLevel(db, categorySlug);
    if (minLevel === null) {
      return {
        state: "empty",
        category: categorySlug,
        date: localDate,
        timeZone
      };
    }

    const previousContentId = await getPreviousContentId(db, categorySlug);
    const contentId = await chooseCandidate(db, categorySlug, minLevel, previousContentId);
    if (!contentId) continue;

    await claimActivation({
      db,
      categorySlug,
      localDate,
      timeZone,
      contentId,
      selectionLevel: minLevel,
      activationId: crypto.randomUUID(),
      activationToken: crypto.randomUUID()
    });

    const winner = await getActivationForDate(db, categorySlug, localDate);
    if (winner) return serializeDailyActivation(winner, categorySlug);
  }

  throw new Error("Unable to claim Daily Content activation after retries");
}
