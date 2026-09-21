import { deepEqual, equal, match } from "node:assert/strict";
import { describe, it } from "node:test";
import { ExampleFactory } from "../src/modules/examples";
import {
  resolveAMinerCitation,
  type CitationResult,
} from "../src/modules/citations";

import {
  PaperInfo,
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

describe("citation lookup", () => {
  const cases: {
    name: string;
    citationNumber: number | string;
    hitsTotal: number;
    pageSize: number;
    responseText?: string;
    status?: number;
  }[] = [
    {
      name: "retrieves citations with privileged XHR",
      citationNumber: 131,
      hitsTotal: 1,
      pageSize: 1,
    },
    {
      name: "preserves zero citations",
      citationNumber: 0,
      hitsTotal: 1,
      pageSize: 1,
    },
    {
      name: "searches only the returned page when total hits exceed page size",
      citationNumber: 31244,
      hitsTotal: 556,
      pageSize: 100,
    },
    {
      name: "returns Not Found for an empty page with a nonzero total",
      citationNumber: "Not Found",
      hitsTotal: 556,
      pageSize: 0,
    },
    {
      name: "returns Not Found when no results exist",
      citationNumber: "Not Found",
      hitsTotal: 0,
      pageSize: 0,
    },
    {
      name: "reports malformed JSON once",
      citationNumber: "Error: Invalid AMiner response",
      hitsTotal: 0,
      pageSize: 0,
      responseText: "<html>upstream error</html>",
    },
    {
      name: "reports an invalid response envelope once",
      citationNumber: "Error: Invalid AMiner response",
      hitsTotal: 0,
      pageSize: 0,
      responseText: '{"data":null}',
    },
    {
      name: "reports HTTP errors without parsing the body",
      citationNumber: "Error: 503",
      hitsTotal: 0,
      pageSize: 0,
      status: 503,
      responseText: "Service unavailable",
    },
    {
      name: "reports a network failure without converting it to zero",
      citationNumber: "Error: 0",
      hitsTotal: 0,
      pageSize: 0,
      status: 0,
      responseText: "",
    },
  ];
  for (const {
    name,
    citationNumber,
    hitsTotal,
    pageSize,
    responseText,
    status = 200,
  } of cases) {
    it(name, (t) => {
      const title = "Example paper";
      const item = makeItem({ title });
      let requested = false;
      let result: CitationResult | undefined;
      let callbackCount = 0;

      class PrivilegedXHR {
        DONE = 4;
        readyState = 0;
        status = status;
        responseText =
          responseText ??
          JSON.stringify({
            data: {
              hitsTotal,
              // Put the exact match last so every returned record is considered.
              hitList: Array.from({ length: pageSize }, (_, index) => ({
                title:
                  index === pageSize - 1 ? title : `Unrelated paper ${index}`,
                ncitation: index === pageSize - 1 ? citationNumber : 1,
              })),
            },
          });
        listener?: () => void;

        set withCredentials(_value: boolean) {
          throw new DOMException(
            "XMLHttpRequest must not be sending.",
            "InvalidStateError",
          );
        }

        addEventListener(event: string, listener: () => void) {
          equal(event, "readystatechange");
          this.listener = listener;
        }

        open(method: string, url: string) {
          equal(method, "POST");
          equal(
            url,
            "https://searchtest.aminer.cn/aminer-search/search/publication",
          );
          this.readyState = 1;
        }

        setRequestHeader() {}

        send(body: string) {
          equal(JSON.parse(body).searchKeyWordList[0].keyword, title);
          requested = true;
          this.readyState = this.DONE;
          this.listener?.call(this);
        }
      }

      const original = Object.getOwnPropertyDescriptor(
        globalThis,
        "XMLHttpRequest",
      );
      t.after(() => {
        if (original) {
          Object.defineProperty(globalThis, "XMLHttpRequest", original);
        } else {
          Reflect.deleteProperty(globalThis, "XMLHttpRequest");
        }
      });
      Object.defineProperty(globalThis, "XMLHttpRequest", {
        configurable: true,
        value: PrivilegedXHR,
      });

      PaperInfo.getPaperCitationNumber(item, title, (updatedItem, data) => {
        equal(updatedItem, item);
        callbackCount++;
        result = data;
      });

      equal(requested, true);
      equal(callbackCount, 1);
      equal(result?.citationNumber, citationNumber);
      if (typeof citationNumber === "number") {
        equal(result?.citation?.source, "AMiner");
        equal(result?.citation?.matchedTitle, title);
        match(result?.citation?.retrievedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
      } else {
        equal(result?.citation, undefined);
      }
    });
  }
});

describe("citation identity and provenance", () => {
  it("does not use a related paper's larger citation count", () => {
    const result = resolveAMinerCitation(
      "Denoising Diffusion Probabilistic Models",
      {
        data: {
          hitsTotal: 556,
          hitList: [
            {
              title: "Improved Denoising Diffusion Probabilistic Models",
              ncitation: 6424,
            },
          ],
        },
      },
    );
    deepEqual(result, { citationNumber: "Not Found" });
  });

  it("keeps mathematical symbols distinct", () => {
    deepEqual(
      resolveAMinerCitation("Learning C++", {
        data: { hitList: [{ title: "Learning C", ncitation: 50 }] },
      }),
      { citationNumber: "Not Found" },
    );
  });

  it("matches case, typography and whitespace without changing the source count", () => {
    const result = resolveAMinerCitation(
      "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Simple 3D Representations",
      {
        data: {
          hitList: [
            {
              id: "65e9209213fb2c6cf6202394",
              title:
                "3D Diffusion Policy: Generalizable Visuomotor Policy Learning Via Simple 3D Representations",
              ncitation: 38,
            },
          ],
        },
      },
    );
    equal(result.citationNumber, 38);
    equal(result.citation?.source, "AMiner");
    equal(
      result.citation?.url,
      "https://www.aminer.cn/pub/65e9209213fb2c6cf6202394",
    );
    equal(Number.isNaN(Date.parse(result.citation?.retrievedAt ?? "")), false);
    equal(
      resolveAMinerCitation("A Study: Robots & Learning", {
        data: {
          hitList: [
            { title: "A Study — Robots &amp; Learning.", ncitation: 0 },
          ],
        },
      }).citationNumber,
      0,
    );
  });

  for (const ncitation of [undefined, null, -1, 1.5, "38", NaN, Infinity]) {
    it(`does not turn an invalid count (${String(ncitation)}) into zero`, () => {
      deepEqual(
        resolveAMinerCitation("Example paper", {
          data: { hitList: [{ title: "Example paper", ncitation }] },
        }),
        { citationNumber: "Unavailable" },
      );
    });
  }

  it("reports conflicting exact-title records as ambiguous", () => {
    deepEqual(
      resolveAMinerCitation("Example paper", {
        data: {
          hitList: [
            { title: "Example paper", ncitation: 38 },
            { title: "Example Paper", ncitation: 979 },
          ],
        },
      }),
      { citationNumber: "Ambiguous" },
    );
  });

  it("ignores malformed records and permits agreeing duplicate counts", () => {
    equal(
      resolveAMinerCitation("Example paper", {
        data: {
          hitList: [
            null,
            {},
            { title: 123 },
            { title: "Example paper", ncitation: 0 },
            { title: "Example Paper", ncitation: 0 },
          ],
        },
      }).citationNumber,
      0,
    );
  });

  for (const response of [
    null,
    {},
    { data: null },
    { data: { hitList: {} } },
  ]) {
    it(`handles an invalid API response (${JSON.stringify(response)})`, () => {
      deepEqual(resolveAMinerCitation("Example paper", response), {
        citationNumber: "Error: Invalid AMiner response",
      });
    });
  }
});

describe("citation note persistence", () => {
  it("round-trips provenance and zero counts, preserves them on CCF updates, and clears them on lookup failure", async (t) => {
    let content =
      '<div><b>CCF Info & Citations</b></div><pre>{"ccfInfo":"CCF-A NeurIPS","citationNumber":10}</pre>';
    const note = {
      getNoteTitle: () => "CCF Info & Citations",
      getNote: () => content,
      setNote: (value: string) => {
        content = value;
      },
      saveTx: async () => {},
    };
    const item = {
      id: 1,
      itemTypeID: 1,
      getNotes: () => [2],
      isNote: () => false,
      isAttachment: () => false,
    };
    let columns: any[] = [];
    const globals = {
      addon: { data: {} },
      Zotero: {
        ItemTreeManager: {
          registerColumns: async (value: any[]) => {
            columns = value;
          },
        },
        Items: { get: () => note },
        Notifier: { trigger() {} },
        getActiveZoteroPane: () => null,
      },
      ztoolkit: { log() {} },
    };
    for (const [name, value] of Object.entries(globals)) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);
      t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
      });
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const factory = ExampleFactory as any;
    // A legacy note remains readable before it has citation provenance.
    equal(factory.getCCFInfoFromNote(item).citationNumber, 10);
    equal(factory.getCCFInfoFromNote(item).citation, undefined);
    const citation = {
      source: "AMiner",
      retrievedAt: "2026-09-21T00:00:00.000Z",
      matchedTitle: 'Robots & Learning: x < y, "quoted", literal &lt;',
      url: "https://www.aminer.cn/pub/example",
    };
    await factory.saveCCFInfoToNote(item, undefined, 0, citation);
    deepEqual(factory.getCCFInfoFromNote(item), {
      ccfInfo: "CCF-A NeurIPS",
      citationNumber: 0,
      citation,
    });
    equal(content.includes("x < y"), false);
    await ExampleFactory.registerExtraColumn();
    const citationColumn = columns.find(
      (column) => column.dataKey === "citationNumber",
    );
    equal(citationColumn.dataProvider(item, "citationNumber"), "0");
    await factory.saveCCFInfoToNote(item, "CCF-A ICML");
    deepEqual(factory.getCCFInfoFromNote(item), {
      ccfInfo: "CCF-A ICML",
      citationNumber: 0,
      citation,
    });
    await factory.saveCCFInfoToNote(item, undefined, "Not Found");
    equal(factory.getCCFInfoFromNote(item).citation, undefined);
    equal(factory.getCCFInfoFromNote(item).citationNumber, "Not Found");
    equal(citationColumn.dataProvider(item, "citationNumber"), "Not Found");
  });
});

describe("context menu", () => {
  it("updates the current selection without the removed Toolkit Menu API", (t) => {
    const menuItems: EventTarget[] = [];
    const popup = {};
    let selectedItems: unknown[] = [];
    const globals = {
      addon: { data: {} },
      ZoteroPane: { getSelectedItems: () => selectedItems },
      ztoolkit: {
        getGlobal: () => ({
          getElementById: (id: string) =>
            id === "zotero-itemmenu" ? popup : null,
        }),
        UI: {
          appendElement(
            options: {
              listeners: { type: string; listener: EventListener }[];
              enableElementRecord: boolean;
            },
            parent: unknown,
          ) {
            equal(parent, popup);
            // Elements must remain registered for cleanup on plugin shutdown.
            equal(options.enableElementRecord, true);
            const element = new EventTarget();
            for (const { type, listener } of options.listeners) {
              element.addEventListener(type, listener);
            }
            menuItems.push(element);
            return element;
          },
        },
      },
    };
    for (const [name, value] of Object.entries(globals)) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);
      t.after(() => {
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
      });
      Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const update = t.mock.method(
      ExampleFactory,
      "handleGetCCFInfo",
      async () => {},
    );

    ExampleFactory.registerRightClickMenuItem();
    equal(menuItems.length, 1);
    equal(update.mock.callCount(), 0);

    selectedItems = [makeItem({ title: "Newly selected paper" })];
    menuItems[0].dispatchEvent(new Event("command"));
    equal(update.mock.callCount(), 1);
    equal(update.mock.calls[0].arguments[0], selectedItems);
  });
});
