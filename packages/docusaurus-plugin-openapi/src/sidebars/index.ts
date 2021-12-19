/* ============================================================================
 * Copyright (c) Cloud Annotations
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import path from "path";

// import { validateCategoryMetadataFile } from "@docusaurus/plugin-content-docs/src/sidebars/validation";
import { posixPath } from "@docusaurus/utils";
import chalk from "chalk";
import fs from "fs-extra";
import Yaml from "js-yaml";
import _ from "lodash";

import type { PropSidebar } from "../types";
import { ApiPageMetadata } from "../types";

interface Options {
  sidebarCollapsible: boolean;
  sidebarCollapsed: boolean;
}

export type BaseItem = {
  title: string;
  permalink: string;
  id: string;
  source: string;
  sourceDirName: string;
};

export type InfoItem = BaseItem & {
  type: "info";
};

export type ApiItem = BaseItem & {
  type: "api";
  api: {
    info?: {
      title?: string;
    };
    tags?: string[] | undefined;
  };
};

type Item = InfoItem | ApiItem;

function isApiItem(item: Item): item is ApiItem {
  return item.type === "api";
}

function isInfoItem(item: Item): item is InfoItem {
  return item.type === "info";
}

export function generateSidebars(items: Item[], options: Options): PropSidebar {
  // const foo = readCategoryMetadataFile();
  const sections = _(items)
    .groupBy((item) => item.source)
    .mapValues((items, source) => {
      const prototype = items.filter(isApiItem).find((item) => {
        return item.api?.info != null;
      });
      const info = prototype?.api?.info;
      const fileName = path.basename(source).split(".")[0];
      return {
        sourceDirName: prototype?.sourceDirName ?? ".",

        collapsible: options.sidebarCollapsible,
        collapsed: options.sidebarCollapsed,
        type: "category" as const,
        label: info?.title || fileName,
        items: groupByTags(items, options),
      };
    })
    .values()
    .value();

  if (sections.length === 1) {
    return sections[0].items;
  }

  // group into folders and build recursive category tree
  const paths = sections.map((section) => {
    return section.sourceDirName;
  });

  const rootSections = sections.filter((x) => x.sourceDirName === ".");
  const childSections = sections.filter((x) => x.sourceDirName !== ".");
  console.log(childSections);

  const subCategories = [] as any;

  // [ '.', '.', '.', '.', '.', 'yogurtstore' ]
  childSections.forEach((childSection) => {
    console.log({ childSection });
    const dirs = childSection.sourceDirName.split("/");
    console.log({ dirs });
    let root = subCategories;
    while (dirs.length) {
      const currentDir = dirs.shift();
      const existing = root.find((x: any) => x.label === currentDir);
      if (!existing) {
        console.log("creating child category", currentDir);
        const child = {
          collapsible: options.sidebarCollapsible,
          collapsed: options.sidebarCollapsed,
          type: "category" as const,
          label: currentDir,
          items: [],
        };
        root.push(child);
        // subCategories.push(child);
        root = child.items;
      } else {
        root = existing.items;
      }
    }
    root.push(childSection);
  });

  // console.log(JSON.stringify(subCategories, null, 2));

  // for each section, place the section into a category

  console.log(paths);

  return [...rootSections, ...subCategories];
}

function groupByTags(
  items: Item[],
  { sidebarCollapsible, sidebarCollapsed }: Options
): PropSidebar {
  const intros = items.filter(isInfoItem).map((item) => {
    return {
      type: "link" as const,
      label: item.title,
      href: item.permalink,
      docId: item.id,
    };
  });

  const tags = [
    ...new Set(
      items
        .flatMap((item) => {
          if (isInfoItem(item)) {
            return undefined;
          }
          return item.api.tags;
        })
        .filter(Boolean) as string[]
    ),
  ];

  const tagged = tags
    .map((tag) => {
      return {
        type: "category" as const,
        label: tag,
        collapsible: sidebarCollapsible,
        collapsed: sidebarCollapsed,
        items: items
          .filter((item) => {
            if (isInfoItem(item)) {
              return false;
            }
            return item.api.tags?.includes(tag);
          })
          .map((item) => {
            const apiPage = item as ApiPageMetadata; // TODO: we should have filtered out all info pages, but I don't like this
            return {
              type: "link" as const,
              label: item.title,
              href: item.permalink,
              docId: item.id,
              className: (item as ApiPageMetadata).api.deprecated // TODO: we should have filtered out all info pages, but I don't like this
                ? "menu__list-item--deprecated"
                : undefined,
            };
          }),
      };
    })
    .filter((item) => item.items.length > 0);

  const untagged = [
    {
      type: "category" as const,
      label: "API",
      collapsible: sidebarCollapsible,
      collapsed: sidebarCollapsed,
      items: items
        .filter((item) => {
          // Filter out info pages and pages with tags
          if (isInfoItem(item)) {
            return false;
          }
          if (item.api.tags === undefined || item.api.tags.length === 0) {
            // no tags
            return true;
          }
          return false;
        })
        .map((item) => {
          const apiPage = item as ApiPageMetadata; // TODO: we should have filtered out all info pages, but I don't like this
          return {
            type: "link" as const,
            label: item.title,
            href: item.permalink,
            docId: item.id,
            className: (item as ApiPageMetadata).api.deprecated // TODO: we should have filtered out all info pages, but I don't like this
              ? "menu__list-item--deprecated"
              : undefined,
          };
        }),
    },
  ];

  return [...intros, ...tagged, ...untagged];
}

export const CategoryMetadataFilenameBase = "_category_";

async function readCategoryMetadataFile(
  categoryDirPath: string
): Promise<any | null> {
  async function tryReadFile(filePath: string): Promise<any> {
    const contentString = await fs.readFile(filePath, { encoding: "utf8" });
    const unsafeContent = Yaml.load(contentString);
    try {
      // return validateCategoryMetadataFile(unsafeContent);
    } catch (e) {
      console.error(
        chalk.red(
          `The docs sidebar category metadata file looks invalid!\nPath: ${filePath}`
        )
      );
      throw e;
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const ext of [".json", ".yml", ".yaml"]) {
    // Simpler to use only posix paths for mocking file metadata in tests
    const filePath = posixPath(
      path.join(categoryDirPath, `${CategoryMetadataFilenameBase}${ext}`)
    );
    if (await fs.pathExists(filePath)) {
      return tryReadFile(filePath);
    }
  }
  return null;
}
