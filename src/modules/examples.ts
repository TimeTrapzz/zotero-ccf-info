import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";



export class UIExampleFactory {
  static async registerExtraColumn() {
    await Zotero.ItemTreeManager.registerColumns([
      {
        pluginID: config.addonID,
        dataKey: "ccfInfo",
        label: getString("ccf-info"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          if (item.itemTypeID > 0) {
            const tags = item.getTags() as { tag: string; type: number }[];
            const ccfInfo = tags.find((tag) => tag.tag.startsWith("ccfInfo: "));
            return ccfInfo ? ccfInfo.tag.split(": ")[1] : "";
          }
          return "";
        },
      },
      {
        pluginID: config.addonID,
        dataKey: "citationNumber",
        label: getString("citation-number"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          if (item.itemTypeID > 0) {
            const tags = item.getTags() as { tag: string; type: number }[];
            const citationNumber = tags.find((tag) => tag.tag.startsWith("citationNumber: "));
            return citationNumber ? citationNumber.tag.split(": ")[1] : "";
          }
          return "";
        },
      },
    ]);
  }

  static registerRightClickMenuItem() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
    // item menuitem with icon
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-get-ccf-info",
      label: getString("get-ccf-info"),
      commandListener: (ev) => {
        const items = ZoteroPane.getSelectedItems();
        if (items && items.length > 0) {
          if (items.length === 1) {
            const entry = items[0];
            entry.getTags().forEach((tag) => {
              if (tag.tag.startsWith("ccfInfo:")) {
                entry.removeTag(tag.tag);
              }
              if (tag.tag.startsWith("citationNumber:")) {
                entry.removeTag(tag.tag);
              }
            });
            entry.saveTx();

            PaperInfo.getPaperCCFRank(
              entry,
              entry.getField("title"),
              (item, data) => {
                entry.addTag(`ccfInfo: ${data.ccfInfo}`);
                entry.saveTx();
              },
            );
            PaperInfo.getPaperCitationNumber(
              entry,
              entry.getField("title"),
              (item, data) => {
                entry.addTag(`citationNumber: ${data.citationNumber}`);
                entry.saveTx();
              },
            );
          }
          else {
            items.forEach(async (entry) => {
              // 清除该条目所有ccf信息
              entry.getTags().forEach((tag) => {
                if (tag.tag.startsWith("ccfInfo:")) {
                  entry.removeTag(tag.tag);
                }
                if (tag.tag.startsWith("citationNumber:")) {
                  entry.removeTag(tag.tag);
                }
              });
              entry.saveTx();
            });
            const titles = items.map((item) => item.getField("title"));
            PaperInfo.batchGetPaperCCFRank(
              items,
              titles,
              (items, data) => {
                if (data.length === items.length) {
                  items.forEach((entry: Zotero.Item, index: number) => {
                    entry.addTag(`ccfInfo: ${data[index].ccfInfo}`);
                    entry.saveTx();
                    PaperInfo.getPaperCitationNumber(
                      entry,
                      entry.getField("title"),
                      (item, data) => {
                        entry.addTag(`citationNumber: ${data.citationNumber}`);
                        entry.saveTx();
                      },
                    );
                  });
                }
                else {
                  items.forEach((entry: Zotero.Item) => {
                    entry.addTag(`ccfInfo: ${data.ccfInfo}`);
                    entry.saveTx();
                    PaperInfo.getPaperCitationNumber(
                      entry,
                      entry.getField("title"),
                      (item, data) => {
                        entry.addTag(`citationNumber: ${data.citationNumber}`);
                        entry.saveTx();
                      },
                    );
                  });
                }
              },
            );
          }
        }
      },
      icon: menuIcon,
    });
  }
}
