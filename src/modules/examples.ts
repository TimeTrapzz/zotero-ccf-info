import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";

// Note标题常量
const CCF_INFO_NOTE_TITLE = "CCF Info & Citations";

// 数据接口
interface CCFInfoData {
  ccfInfo: string;
  citationNumber: string;
}

export class ExampleFactory {
  // 从note中获取CCF信息
  private static getCCFInfoFromNote(item: Zotero.Item): CCFInfoData {
    try {
      // getNotes()返回的是note ID数组
      const noteIDs = item.getNotes();
      if (!noteIDs || noteIDs.length === 0) {
        return { ccfInfo: "", citationNumber: "" };
      }

      // 遍历所有notes查找CCF信息note
      for (const noteID of noteIDs) {
        const note = Zotero.Items.get(noteID);
        if (!note) continue;

        const title = note.getNoteTitle();
        if (title === CCF_INFO_NOTE_TITLE) {
          const noteContent = note.getNote();
          ztoolkit.log("Found CCF note, content:", noteContent);

          // 移除HTML标签，提取JSON内容
          const textContent = noteContent.replace(/<[^>]*>/g, '').trim();
          ztoolkit.log("Text content:", textContent);

          // 尝试找到JSON部分
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]) as CCFInfoData;
            ztoolkit.log("Parsed data:", data);
            return {
              ccfInfo: data.ccfInfo || "",
              citationNumber: data.citationNumber || "",
            };
          }
        }
      }
    } catch (error) {
      ztoolkit.log("Error reading CCF info from note:", error);
    }
    return { ccfInfo: "", citationNumber: "" };
  }

  // 保存CCF信息到note
  private static async saveCCFInfoToNote(item: Zotero.Item, ccfInfo?: string, citationNumber?: string) {
    try {

      // getNotes()返回的是note ID数组
      const noteIDs = item.getNotes();
      let ccfNote: Zotero.Item | null = null;

      // 查找现有的CCF信息note
      if (noteIDs && noteIDs.length > 0) {
        for (const noteID of noteIDs) {
          const note = Zotero.Items.get(noteID);
          if (note && note.getNoteTitle() === CCF_INFO_NOTE_TITLE) {
            ccfNote = note;
            break;
          }
        }
      }

      // 如果note不存在，创建新的
      if (!ccfNote) {
        ccfNote = new Zotero.Item("note");
        ccfNote.libraryID = item.libraryID;
        ccfNote.parentID = item.id;
        // 设置临时内容以便note有标题
        ccfNote.setNote(`<div><b>${CCF_INFO_NOTE_TITLE}</b></div>`);
        await ccfNote.saveTx();
        ztoolkit.log("Created new CCF note for item:", item.id);
      }

      // 获取现有数据
      const existingData = ExampleFactory.getCCFInfoFromNote(item);

      // 只更新提供的字段，保留现有值
      const finalCcfInfo = ccfInfo !== undefined && ccfInfo !== "" ? ccfInfo : existingData.ccfInfo;
      const finalCitationNumber = citationNumber !== undefined && citationNumber !== "" ? citationNumber : existingData.citationNumber;

      // 构建JSON数据
      const jsonData: CCFInfoData = {
        ccfInfo: finalCcfInfo,
        citationNumber: finalCitationNumber,
      };

      // 构建note内容（使用HTML格式包装JSON，便于在Zotero中查看）
      const jsonString = JSON.stringify(jsonData, null, 2);
      const noteContent = `<div><b>${CCF_INFO_NOTE_TITLE}</b></div><div><br /></div><div><pre>${jsonString}</pre></div>`;

      ztoolkit.log("Saving CCF note with data:", jsonData);
      ccfNote.setNote(noteContent);
      await ccfNote.saveTx();

      // 等待一小段时间确保保存完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 刷新列显示
      ExampleFactory.refreshItemTreeRow(item);
    } catch (error) {
      ztoolkit.log("Error saving CCF info to note:", error);
    }
  }

  // 刷新条目树中的行显示
  private static refreshItemTreeRow(item: Zotero.Item) {
    try {
      // 方法1: 使用 Zotero.Notifier 触发刷新
      Zotero.Notifier.trigger('refresh', 'item', [item.id]);

      // 方法2: 尝试直接刷新itemsView
      const ZoteroPane = Zotero.getActiveZoteroPane();
      if (ZoteroPane && ZoteroPane.itemsView) {
        try {
          const rowIndex = ZoteroPane.itemsView.getRowIndexByID(item.id.toString());
          if (rowIndex !== false && rowIndex !== undefined) {
            ZoteroPane.itemsView.tree.invalidateRow(rowIndex);
          }
        } catch (e) {
          ztoolkit.log("Could not invalidate specific row, refreshing all:", e);
        }
      }

      ztoolkit.log("Refreshed display for item:", item.id);
    } catch (error) {
      ztoolkit.log("Error refreshing item tree row:", error);
    }
  }

  static async registerExtraColumn() {
    await Zotero.ItemTreeManager.registerColumns([
      {
        pluginID: config.addonID,
        dataKey: "ccfInfo",
        label: getString("ccf-info"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          try {
            // 确保是正常条目，不是note或附件
            if (!item || !item.itemTypeID || item.isNote() || item.isAttachment()) {
              return "";
            }

            const data = ExampleFactory.getCCFInfoFromNote(item);
            const result = data.ccfInfo || "";
            return result;
          } catch (error) {
            ztoolkit.log("Error in ccfInfo dataProvider:", error);
            return "";
          }
        },
        zoteroPersist: ["width", "hidden", "sortDirection"],
      },
      {
        pluginID: config.addonID,
        dataKey: "citationNumber",
        label: getString("citation-number"),
        dataProvider: (item: Zotero.Item, dataKey: string) => {
          try {
            // 确保是正常条目，不是note或附件
            if (!item || !item.itemTypeID || item.isNote() || item.isAttachment()) {
              return "";
            }

            const data = ExampleFactory.getCCFInfoFromNote(item);
            const result = data.citationNumber || "";
            return result;
          } catch (error) {
            ztoolkit.log("Error in citationNumber dataProvider:", error);
            return "";
          }
        },
        zoteroPersist: ["width", "hidden", "sortDirection"],
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
      async (item, data) => {
        await ExampleFactory.saveCCFInfoToNote(item, data.ccfInfo);
        ExampleFactory.updateCitationNumber(entry, 1);
      },
    );
  }

  private static async handleMultipleItems(items: Zotero.Item[]) {
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
      async (items, data) => {
        if (data.length === items.length) {
          for (let index = 0; index < items.length; index++) {
            const entry = items[index];
            await ExampleFactory.saveCCFInfoToNote(entry, data[index].ccfInfo);
            ExampleFactory.updateCitationNumber(entry, index, items.length);
          }
        } else {
          for (let index = 0; index < items.length; index++) {
            const entry = items[index];
            await ExampleFactory.saveCCFInfoToNote(entry, data.ccfInfo);
            ExampleFactory.updateCitationNumber(entry, items.length, index);
          }
        }
      },
    );
  }

  private static async updateCitationNumber(entry: Zotero.Item, index?: number, total?: number) {
    PaperInfo.getPaperCitationNumber(
      entry,
      entry.getField("title"),
      async (item, data) => {
        await ExampleFactory.saveCCFInfoToNote(item, undefined, data.citationNumber);
      },
    );
  }

  static registerRightClickMenuItem() {
    const doc = ztoolkit.getGlobal("document");
    const menu = doc.getElementById("zotero-itemmenu");
    if (!menu) return;

    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
    // Toolkit 5.2 removed Menu. UITool supports the same XUL menu on Zotero 7+
    // and removes the registered element when the toolkit is unregistered.
    ztoolkit.UI.appendElement(
      {
        tag: "menuitem",
        namespace: "xul",
        id: "zotero-itemmenu-get-ccf-info",
        removeIfExists: true,
        enableElementRecord: true,
        attributes: {
          label: getString("get-ccf-info"),
          class: "menuitem-iconic",
          image: menuIcon,
        },
        listeners: [
          {
            type: "command",
            listener: () => {
              const items = ZoteroPane.getSelectedItems();
              void ExampleFactory.handleGetCCFInfo(items);
            },
          },
        ],
      },
      menu,
    );
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
