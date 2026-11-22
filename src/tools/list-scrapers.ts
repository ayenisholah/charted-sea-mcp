import { ok } from "../format/result.js";
import { COUNTRIES, HEALTH_SCRAPERS, SCRAPERS } from "./shared.js";
import { defineTool } from "./types.js";

const DOCS = "https://chartedsea.com/docs";

export const listScrapers = defineTool({
  name: "list_scrapers",
  title: "List scrapers",
  description:
    "Lists the Charted Sea scrapers (path names for tasks, upper-case names for health), the countries the health metrics cover, and documentation links. No network call.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: () => () =>
    Promise.resolve(
      ok(`${String(SCRAPERS.length)} scrapers, ${String(COUNTRIES.length)} countries.`, {
        scrapers: SCRAPERS.map((name, i) => ({ name, healthName: HEALTH_SCRAPERS[i] })),
        countries: COUNTRIES,
        docs: { apiReference: `${DOCS}/api-reference`, scrapers: `${DOCS}/scrapers` },
      }),
    ),
});
