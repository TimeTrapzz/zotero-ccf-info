import { config } from "../../package.json";
import { getLocaleID, getString } from "../utils/locale";
import { PaperInfo } from "./getPaperInfo";

function example(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value;
  descriptor.value = function (...args: any) {
    try {
      ztoolkit.log(`Calling example ${target.name}.${String(propertyKey)}`);
      return original.apply(this, args);
    } catch (e) {
      ztoolkit.log(`Error in example ${target.name}.${String(propertyKey)}`, e);
      throw e;
    }
  };
  return descriptor;
}

export class BasicExampleFactory {
  @example
  static registerNotifier() {
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: any },
      ) => {
        if (!addon?.data.alive) {
          this.unregisterNotifier(notifierID);
          return;
        }
        addon.hooks.onNotify(event, type, ids, extraData);
      },
    };

    // Register the callback in Zotero as an item observer
    const notifierID = Zotero.Notifier.registerObserver(callback, [
      "tab",
      "item",
      "file",
    ]);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener(
      "unload",
      (e: Event) => {
        this.unregisterNotifier(notifierID);
      },
      false,
    );
  }

  @example
  static exampleNotifierCallback() {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "Open Tab Detected!",
        type: "success",
        progress: 100,
      })
      .show();
  }

  @example
  private static unregisterNotifier(notifierID: string) {
    Zotero.Notifier.unregisterObserver(notifierID);
  }

  @example
  static registerPrefs() {
    Zotero.PreferencePanes.register({
      pluginID: config.addonID,
      src: rootURI + "chrome/content/preferences.xhtml",
      label: getString("prefs-title"),
      image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    });
  }
}

export class UIExampleFactory {
  static registerRightClickMenuItem() {
    const menuIcon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;
    // item menuitem with icon
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-get-ccf-rank",
      label: getString("get-ccf-rank"),
      commandListener: (ev) => {
        // 打印当前条目的信息
        const item = ZoteroPane.getSelectedItems();
        if (item && item.length > 0) {
          item.forEach(async (entry) => {
            try {
              // 生成16个随机字符作为模拟的索书号
              // const randomCallNumber = Array(16)
              //   .fill(0)
              //   .map(() => Math.random().toString(36)[2])
              //   .join("");
              // const citationNumber = PaperInfo.getPaperCitationNumber(
              //   entry,
              //   entry.getField("title"),
              //   (item, data) => {
              //     entry.setField("callNumber", data.callNumber);
              //     entry.saveTx();
              //   },
              // );
              const ccfRank = PaperInfo.getPaperCCFRank(
                entry,
                entry.getField("title"),
                (item, data) => {
                  entry.setField("callNumber", data.callNumber);
                  entry.saveTx();
                },
              );
              ztoolkit.log(ccfRank);

              await entry.saveTx();
              new ztoolkit.ProgressWindow(config.addonName)
                .createLine({
                  text: `已更新"${entry.getField("title")}"的ccf信息`,
                  type: "success",
                  progress: 100,
                })
                .show();
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
