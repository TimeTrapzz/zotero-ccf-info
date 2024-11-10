import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";


export class ExampleFactory {
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

  public static async handleGetCCFInfo(items: Zotero.Item[]) {
    if (!items || items.length === 0) return;
    ztoolkit.log("handleGetCCFInfo", items);
    if (items.length === 1) {
      await ExampleFactory.handleSingleItem(items[0]);
    } else {
      await ExampleFactory.handleMultipleItems(items);
    }
  }

  private static async handleSingleItem(entry: Zotero.Item) {
    // Clear existing tags
    ExampleFactory.clearCCFTags(entry);
    const progressWindow = new ztoolkit.ProgressWindow(getString("paper-info-update"), {
      closeOtherProgressWindows: true
    });
    progressWindow.createLine({
      text: getString("requesting-citation-single"),
      type: "default"
    });
    progressWindow.show();
    progressWindow.startCloseTimer(2000);

    // Get new CCF rank and citation number
    PaperInfo.getPaperCCFRank(
      entry,
      entry.getField("title"),
      (item, data) => {
        entry.addTag(`ccfInfo: ${data.ccfInfo}`);
        entry.saveTx();
        ExampleFactory.updateCitationNumber(entry, 1);
      },
    );
  }

  private static async handleMultipleItems(items: Zotero.Item[]) {
    // Clear existing tags for all items
    items.forEach(entry => ExampleFactory.clearCCFTags(entry));

    const progressWindow = new ztoolkit.ProgressWindow(getString("paper-info-update"), {
      closeOtherProgressWindows: true
    });
    progressWindow.createLine({
      text: getString("requesting-citations-multiple", { args: { count: items.length } }),
      type: "default"
    });
    progressWindow.show();
    progressWindow.startCloseTimer(2000);

    const titles = items.map(item => item.getField("title"));
    PaperInfo.batchGetPaperCCFRank(
      items,
      titles,
      (items, data) => {
        if (data.length === items.length) {
          items.forEach((entry: Zotero.Item, index: number) => {
            entry.addTag(`ccfInfo: ${data[index].ccfInfo}`);
            entry.saveTx();
            ExampleFactory.updateCitationNumber(entry, index, items.length);
          });
        } else {
          items.forEach((entry: Zotero.Item, index: number) => {
            entry.addTag(`ccfInfo: ${data.ccfInfo}`);
            entry.saveTx();
            ExampleFactory.updateCitationNumber(entry, items.length, index);
          });
        }
      },
    );
  }

  private static clearCCFTags(entry: Zotero.Item) {
    entry.getTags().forEach(tag => {
      if (tag.tag.startsWith("ccfInfo:") || tag.tag.startsWith("citationNumber:")) {
        entry.removeTag(tag.tag);
      }
    });
    entry.saveTx();
  }

  private static async updateCitationNumber(entry: Zotero.Item, index?: number, total?: number) {
    PaperInfo.getPaperCitationNumber(
      entry,
      entry.getField("title"),
      (item, data) => {
        entry.addTag(`citationNumber: ${data.citationNumber}`);
        entry.saveTx();
      },
    );
  }

  static registerRightClickMenuItem() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-get-ccf-info",
      label: getString("get-ccf-info"),
      commandListener: (ev) => {
        const items = ZoteroPane.getSelectedItems();
        ExampleFactory.handleGetCCFInfo(items);
      },
      icon: menuIcon,
    });
  }

  static registerNotifier() {
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (!addon?.data.alive) {
          this.unregisterNotifier(notifierID);
          return;
        }
        addon.hooks.onNotify(event, type, ids, extraData);
      },
    };

    const notifierID = Zotero.Notifier.registerObserver(callback, ["item"]);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener(
      "unload",
      (e: Event) => {
        this.unregisterNotifier(notifierID);
      },
      false,
    );
  }

  static async exampleNotifierCallback(regularItems: any) {
    // 等待 10s 以防止 Zotero 未完成条目添加
    await new Promise(resolve => setTimeout(resolve, 10000));
    await ExampleFactory.handleGetCCFInfo(regularItems);
  }

  private static unregisterNotifier(notifierID: string) {
    Zotero.Notifier.unregisterObserver(notifierID);
  }
}
