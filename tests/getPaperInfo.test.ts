import { deepEqual, equal } from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findNotableVenueByPath,
  normalizeVenueName,
  notableVenues,
  resolveCCFInfo,
  resolveNetworkError,
} from "../src/modules/getPaperInfo";

function makeItem(fields: Record<string, string> = {}) {
  return {
    getField(field: string) {
      return fields[field] ?? "";
    },
  };
}

const expectedNotableVenues = [
  ["COLM", "/conf/colm"],
  ["MLSys", "/conf/mlsys"],
  ["CoRL", "/conf/corl"],
  ["FAccT", "/conf/fat"],
  ["SaTML", "/conf/satml"],
  ["MMSys", "/conf/mmsys"],
  ["EACL", "/conf/eacl"],
  ["WACV", "/conf/wacv"],
  ["SIGCSE", "/conf/sigcse"],
  ["AACL/IJCNLP", "/conf/ijcnlp"],
  ["EUVIP", "/conf/euvip"],
  ["RSS", "/conf/rss"],
  ["ISIT", "/conf/isit"],
  ["SIGGRAPH Asia", "/conf/siggrapha"],
  ["APSys", "/conf/apsys"],
  ["EuroSec", "/conf/eurosec"],
  ["HASP", "/conf/hasp"],
  ["HOST", "/conf/host"],
  ["AsianHOST", "/conf/asianhost"],
  ["LAMPS", "/conf/lamps"],
  ["AICAS", "/conf/aicas"],
  ["CNS", "/conf/cns"],
  ["CSUR", "/journals/csur"],
  ["IEEE D&T", "/journals/dt"],
  ["TCAS-II", "/journals/tcasII"],
  ["JETCAS", "/journals/esticas"],
  ["TCCN", "/journals/tccn"],
  ["TMLR", "/journals/tmlr"],
] as const;

describe("notable venue catalog", () => {
  it("contains the expected venues with unique DBLP paths", () => {
    const paths = notableVenues.flatMap((venue) => venue.paths);

    deepEqual(
      notableVenues.map((venue) => [venue.abbr, venue.paths[0]]),
      expectedNotableVenues,
    );
    equal(new Set(paths).size, paths.length);
  });

  it("resolves every configured DBLP path", () => {
    for (const venue of notableVenues) {
      for (const path of venue.paths) {
        equal(findNotableVenueByPath(path), venue);
      }
    }
  });
});

describe("venue normalization", () => {
  it("ignores case, punctuation, whitespace, and publication years", () => {
    equal(
      normalizeVenueName("FAccT 2026: Fairness & Transparency"),
      "facctfairnesstransparency",
    );
  });
});

describe("CCF resolution", () => {
  it("keeps an official CCF rank ahead of notable venue matches", () => {
    const result = resolveCCFInfo(makeItem(), "paper", [
      { title: "paper", url: "conf/colm/paper" },
      { title: "paper", url: "conf/ppopp/paper" },
    ]);

    equal(result, "CCF-A PPoPP");
  });

  it("resolves all notable venues from DBLP URLs", () => {
    for (const venue of notableVenues) {
      const path = venue.paths[0].replace(/^\//, "");
      const result = resolveCCFInfo(makeItem(), "paper", [
        { title: "paper", url: `${path}/paper` },
      ]);

      equal(result, `CCF-None ${venue.abbr}`);
    }
  });

  it("falls back to normalized Zotero metadata", () => {
    const item = makeItem({
      conferenceName:
        "Proceedings of the 2025 Conference on Language Modeling (COLM)",
    });

    equal(resolveCCFInfo(item, "paper", []), "CCF-None COLM");
  });

  it("prefers a concrete unranked venue over CoRR", () => {
    const result = resolveCCFInfo(makeItem(), "paper", [
      { title: "paper", url: "journals/corr/paper" },
      { title: "paper", url: "conf/example/paper" },
    ]);

    equal(result, "CCF-None EXAMPLE");
  });

  it("returns Not Found when neither DBLP nor metadata identifies a venue", () => {
    equal(resolveCCFInfo(makeItem(), "paper", []), "Not Found");
  });
});

describe("network fallback", () => {
  it("uses Zotero metadata for a notable venue", () => {
    const item = makeItem({ proceedingsTitle: "EACL 2026" });

    equal(resolveNetworkError(item, 503), "CCF-None EACL");
  });

  it("preserves the HTTP status when no fallback is available", () => {
    equal(resolveNetworkError(makeItem(), 503), "Net Error: 503");
  });
});
