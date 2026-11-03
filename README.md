# Zotero CCF Info

[![zotero target version](https://img.shields.io/badge/Zotero-10-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org) [![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template) <img src="https://img.shields.io/github/stars/TimeTrapzz/zotero-ccf-info?style=social" alt="GitHub stars">

This is a plugin for easily obtaining the ccf rating of a paper, the corresponding conference/journal and the number of citations in [Zotero](https://www.zotero.org/).

# Usage

You can obtain the CCF information of the corresponding paper by selecting one or more entries and clicking "Get CCF Info" in the right-click menu.

![image](https://github.com/user-attachments/assets/5a2b939b-1a20-4b93-ba36-5170124be886)

# Citation counts / 引用次数

The **Citations (AMiner)** column reports the count returned by AMiner. It is
not a Google Scholar count. Database coverage, version grouping and update
schedules differ; a low AMiner count does not establish that a paper has few
citations in other databases. This plugin cannot correct missing citations in
AMiner's index, and refreshing does not guarantee agreement with Google Scholar.

Starting with v0.4.2, successful lookups record the source, retrieval time,
matched title and AMiner record link (when available) in the existing
**CCF Info & Citations** child note. The retrieval time is when the plugin
queried AMiner, not when AMiner last updated its index. Existing notes remain
readable; refresh an item to add this information.

Only an exact title match after normalizing case, whitespace and common
typographic differences is accepted. The plugin searches the returned page
(up to 100 records), not the full AMiner result set. It does not substitute the
closest title or select the largest count from conflicting records.

| Display       | Meaning                                                         |
| ------------- | --------------------------------------------------------------- |
| `0`           | AMiner explicitly returned zero citations for a matching title. |
| `Not Found`   | No matching title was found on the returned page.               |
| `Unavailable` | A matching record has a missing or invalid citation count.      |
| `Ambiguous`   | Matching titles have conflicting citation counts.               |
| `Error: ...`  | The request failed or AMiner returned an invalid response.      |

For a discrepancy, check the matched title and source link in the note, then
search the full paper title in [Google Scholar](https://scholar.google.com/).
Report an incorrect title match separately from a difference between databases.
Google Scholar is not queried automatically; see its
[access guidance](https://scholar.google.com/intl/en/scholar/help.html#export).

**中文说明：**“引用次数（AMiner）”显示的是 AMiner 返回的数字，不能等同于
Google Scholar 的引用次数。不同数据库的收录、版本合并和更新进度可能不同；
AMiner 数字偏低，并不代表论文在其他数据库中的引用也少。v0.4.2 起，更新成功后
会在条目的“CCF Info & Citations”子笔记中保存来源、查询时间、匹配标题和
AMiner 记录链接（如有）。查询时间不是上游数据的更新时间。更新已有条目即可
补充这些信息。标题未匹配显示 `Not Found`，引用数缺失显示 `Unavailable`，
同名记录的引用数冲突显示 `Ambiguous`，只有上游明确返回零才显示 `0`。
如需 Google Scholar 口径，请在其网页按完整标题核对。

# Add missing journal/conference information

If an officially ranked journal or conference is missing, add it to
`ccfRankList` in `src/modules/getPaperInfo.ts`. The format is as follows:

```json
{
  "/conf/icml": {
    "rank": "A",
    "abbr": "ICML",
    "full": "International Conference on Machine Learning",
    "url": "/conf/icml",
    "dblp": "/conf/icml/icml"
  }
}
```

Notable venues that are not in the CCF catalog belong in the separate
`notableVenues` list. They are displayed as `CCF-None <venue>` and must not be
assigned an unofficial CCF rank.

Then, you can submit a PR to add the missing information.

# Contributors

- [TimeTrapzz](https://github.com/TimeTrapzz): Zotero Plugin Rewrite and Adaptation
- [tojunfeng](https://github.com/tojunfeng): Plugin Core Logic Implementation
