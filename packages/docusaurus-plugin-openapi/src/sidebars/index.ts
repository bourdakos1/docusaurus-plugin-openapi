/* ============================================================================
 * Copyright (c) Cloud Annotations
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import { ApiPageMetadata } from "../types";

interface Options {
  sidebarCollapsible: boolean;
  sidebarCollapsed: boolean;
}
// todo: theme-common.d.ts
type NavbarItem = {
  type?: string | undefined;
  items?: NavbarItem[];
  label?: string;
  position?: "left" | "right";
} & Record<string, unknown>;

type Item =
  | {
      [key: string]: any;
      type: "info";
      info: any;
      title: string;
      permalink: string;
      id: string;
    }
  | {
      [key: string]: any;
      type: "api";
      api: {
        // todo: include info
        // info: {
        // title: string;
        // },
        tags?: string[] | undefined;
      };
      title: string;
      permalink: string;
      id: string;
    };

function groupByTags(
  items: Item[],
  { sidebarCollapsible, sidebarCollapsed }: Options
) {
  const intros = items
    .filter((item) => {
      if (item.type === "info") {
        return true;
      }
      return false;
    })
    .map((item) => {
      return {
        type: "link",
        label: item.title,
        href: item.permalink,
        docId: item.id,
      };
    });

  const tags = [
    ...new Set(
      items
        .flatMap((item) => {
          if (item.type === "info") {
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
        type: "category",
        label: tag,
        collapsible: sidebarCollapsible,
        collapsed: sidebarCollapsed,
        items: items
          .filter((item) => {
            if (item.type === "info") {
              return false;
            }
            return item.api.tags?.includes(tag);
          })
          .map((item) => {
            return {
              type: "link",
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
      type: "category",
      label: "API",
      collapsible: sidebarCollapsible,
      collapsed: sidebarCollapsed,
      items: items
        .filter((item) => {
          // Filter out info pages and pages with tags
          if (item.type === "info") {
            return false;
          }
          if (item.api.tags === undefined || item.api.tags.length === 0) {
            // no tags
            return true;
          }
          return false;
        })
        .map((item) => {
          return {
            type: "link",
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

export function generateSidebars(
  items: Item[],
  options: Options
): NavbarItem[] {
  return groupByTags(items, options);
}
