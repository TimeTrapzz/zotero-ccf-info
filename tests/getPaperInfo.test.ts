import { deepEqual, equal } from "node:assert/strict";
import { describe, it } from "node:test";
import { ExampleFactory } from "../src/modules/examples";

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
  for (const citationNumber of [131, 0]) {
    it(`retrieves ${citationNumber} citations with privileged XHR`, (t) => {
      const title = "Example paper";
      const item = makeItem({ title });
      let requested = false;
      let result: unknown;

      class PrivilegedXHR {
        DONE = 4;
        readyState = 0;
        status = 200;
        responseText = JSON.stringify({
          data: {
            hitsTotal: 1,
            hitList: [{ title, ncitation: citationNumber }],
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
        result = data;
      });

      equal(requested, true);
      deepEqual(result, { citationNumber });
    });
  }
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
