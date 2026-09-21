export interface CitationMetadata {
  source: "AMiner";
  retrievedAt: string;
  matchedTitle: string;
  url?: string;
}

export interface CitationResult {
  citationNumber: number | string;
  citation?: CitationMetadata;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\s.,:\-]/g, "");
}

/** An exact title is required; a nearest neighbour may be a different paper. */
export function resolveAMinerCitation(
  title: string,
  response: unknown,
): CitationResult {
  const data = (response as { data?: { hitList?: unknown } } | null)?.data;
  if (!Array.isArray(data?.hitList)) {
    return { citationNumber: "Error: Invalid AMiner response" };
  }
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return { citationNumber: "Not Found" };

  // hitsTotal includes pages that are not present in this response (PR #55).
  const matches = data.hitList.filter(
    (paper) =>
      typeof paper?.title === "string" &&
      normalizeTitle(paper.title) === normalizedTitle,
  );
  if (matches.length === 0) return { citationNumber: "Not Found" };
  if (
    matches.some(
      (paper) => !Number.isSafeInteger(paper.ncitation) || paper.ncitation < 0,
    )
  ) {
    // Missing counts are unknown, not zero citations.
    return { citationNumber: "Unavailable" };
  }
  if (matches.some((paper) => paper.ncitation !== matches[0].ncitation)) {
    // Do not silently choose a version or inflate the result by taking a max.
    return { citationNumber: "Ambiguous" };
  }
  const paper = matches[0];
  const citation: CitationMetadata = {
    source: "AMiner",
    retrievedAt: new Date().toISOString(),
    matchedTitle: paper.title,
  };
  if (typeof paper.id === "string" && /^[a-zA-Z0-9_-]+$/.test(paper.id)) {
    citation.url = `https://www.aminer.cn/pub/${paper.id}`;
  }
  return { citationNumber: paper.ncitation, citation };
}
