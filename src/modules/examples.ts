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

  public static async handleGetCCFInfo(items: Zotero.Item[]) {
    if (!items || items.length === 0) return;

    if (items.length === 1) {
      await UIExampleFactory.handleSingleItem(items[0]);
    } else {
      await UIExampleFactory.handleMultipleItems(items);
    }
  }

  private static async handleSingleItem(entry: Zotero.Item) {
    // Clear existing tags
    UIExampleFactory.clearCCFTags(entry);

    // Get new CCF rank and citation number
    PaperInfo.getPaperCCFRank(
      entry,
      entry.getField("title"),
      (item, data) => {
        entry.addTag(`ccfInfo: ${data.ccfInfo}`);
        entry.saveTx();
        UIExampleFactory.updateCitationNumber(entry, 1);
      },
    );
  }

  private static async handleMultipleItems(items: Zotero.Item[]) {
    // Clear existing tags for all items
    items.forEach(entry => UIExampleFactory.clearCCFTags(entry));

    const titles = items.map(item => item.getField("title"));
    PaperInfo.batchGetPaperCCFRank(
      items,
      titles,
      (items, data) => {
        if (data.length === items.length) {
          items.forEach((entry: Zotero.Item, index: number) => {
            entry.addTag(`ccfInfo: ${data[index].ccfInfo}`);
            entry.saveTx();
            UIExampleFactory.updateCitationNumber(entry, index, items.length);
          });
        } else {
          items.forEach((entry: Zotero.Item, index: number) => {
            entry.addTag(`ccfInfo: ${data.ccfInfo}`);
            entry.saveTx();
            UIExampleFactory.updateCitationNumber(entry, items.length, index);
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
    // Create progress window for every request
    const progressWindow = new ztoolkit.ProgressWindow(getString("paper-info-update"), {
      closeOtherProgressWindows: true
    });
    const progressLine = new progressWindow.ItemProgress(
      "default",
      total ?
        getString("requesting-citations-multiple", { args: { count: total } }) :
        getString("requesting-citation-single")
    );
    progressWindow.show();

    PaperInfo.getPaperCitationNumber(
      entry,
      entry.getField("title"),
      (item, data) => {
        entry.addTag(`citationNumber: ${data.citationNumber}`);
        entry.saveTx();
        progressWindow.startCloseTimer(2000);
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
        UIExampleFactory.handleGetCCFInfo(items);
      },
      icon: menuIcon,
    });
  }

  static registerNotifier() {
    Zotero.Notifier.registerObserver({
      notify: async (event: string, type: string, ids: (string | number)[], extraData: object) => {
        if (event === 'add' && type === 'item') {
          const items = ids.map(id => Zotero.Items.get(Number(id)))
            .filter(item => item.isRegularItem());
          if (items.length > 0) {
            await UIExampleFactory.handleGetCCFInfo(items);
          }
        }
      }
    }, ['item']);
  }
}
