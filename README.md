# Zotero CCF Info

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org) [![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template) <img src="https://img.shields.io/github/stars/TimeTrapzz/zotero-ccf-info?style=social" alt="GitHub stars">

This is a plugin for easily obtaining the ccf rating of a paper, the corresponding conference/journal and the number of citations in [Zotero](https://www.zotero.org/).

# Usage

You can obtain the CCF information of the corresponding paper by selecting one or more entries and clicking "Get CCF Info" in the right-click menu.

![image](https://github.com/user-attachments/assets/5a2b939b-1a20-4b93-ba36-5170124be886)

# Add missing journal/conference information

If the journal/conference information is missing, you can refer to `src/modules/getPaperInfo.ts` to add the missing information. The format is as follows:

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

Then, you can submit a PR to add the missing information.

# Contributors

- [TimeTrapzz](https://github.com/TimeTrapzz): Zotero 7 Plugin Rewrite and Adaptation
- [tojunfeng](https://github.com/tojunfeng): Plugin Core Logic Implementation
