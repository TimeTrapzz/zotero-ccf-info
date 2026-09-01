# Zotero CCF Info

[![zotero target version](https://img.shields.io/badge/Zotero-10-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org) [![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template) <img src="https://img.shields.io/github/stars/TimeTrapzz/zotero-ccf-info?style=social" alt="GitHub stars">

This is a plugin for easily obtaining the ccf rating of a paper, the corresponding conference/journal and the number of citations in [Zotero](https://www.zotero.org/).

# Usage

You can obtain the CCF information of the corresponding paper by selecting one or more entries and clicking "Get CCF Info" in the right-click menu.

![image](https://github.com/user-attachments/assets/5a2b939b-1a20-4b93-ba36-5170124be886)

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
