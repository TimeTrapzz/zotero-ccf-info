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
          const tags = item.getTags() as { tag: string; type: number }[];
          const ccfInfo = tags.find((tag) => tag.tag.startsWith("ccfInfo: "));
          return ccfInfo ? ccfInfo.tag.split(": ")[1] : "null";
        },
      },
      {
        pluginID: config.addonID,
        dataKey: "citationNumber",
        label: getString("citation-number"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          const tags = item.getTags() as { tag: string; type: number }[];
          const citationNumber = tags.find((tag) =>
            tag.tag.startsWith("citationNumber: "),
          );
          return citationNumber ? citationNumber.tag.split(": ")[1] : "null";
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
        const item = ZoteroPane.getSelectedItems();
        if (item && item.length > 0) {
          item.forEach(async (entry) => {
            try {
              const citationNumber = PaperInfo.getPaperCitationNumber(
                entry,
                entry.getField("title"),
                (item, data) => {
                  entry.addTag(`citationNumber: ${data.citationNumber}`);
                  entry.saveTx();
                },
              );
              const ccfInfo = PaperInfo.getPaperCCFRank(
                entry,
                entry.getField("title"),
                (item, data) => {
                  entry.addTag(`ccfInfo: ${data.ccfInfo}`);
                  entry.saveTx();
                },
              );
              ztoolkit.log(ccfInfo);
              ztoolkit.log(citationNumber);

              // new ztoolkit.ProgressWindow(config.addonName)
              //   .createLine({
              //     text: `已更新"${entry.getField("title")}"的ccf信息`,
              //     type: "success",
              //     progress: 100,
              //   })
              //   .show();
            } catch (error: unknown) {
              console.error(`获取ccf信息时出错：${(error as Error).message}`);
              new ztoolkit.ProgressWindow(config.addonName)
                .createLine({
                  text: `更新"${entry.getField("title")}"的ccf信息失败`,
                  type: "error",
                  progress: 100,
                })
                .show();
            }
          });
        }
      },
      icon: menuIcon,
    });
  }
}
