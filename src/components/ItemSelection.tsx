"use client";

import { createContext, useContext } from "react";
import type { Item } from "@/lib/viewspec";

/**
 * Lets any block open the detail drawer without threading a callback through
 * Renderer and every block signature. Blocks stay pure presentational
 * components taking {block, items} — the contract in AGENTS.md is unchanged.
 *
 * Defaults to a no-op so a block rendered outside the provider (e.g. in an
 * isolated harness) still works.
 */
const ItemSelectionContext = createContext<(item: Item) => void>(() => {});

export const ItemSelectionProvider = ItemSelectionContext.Provider;

export function useSelectItem(): (item: Item) => void {
  return useContext(ItemSelectionContext);
}
