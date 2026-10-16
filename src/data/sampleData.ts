// SAMPLE 데이터 로더 — src/data/sample/*.json (scripts/generate-sample.mjs로 생성)
import type { Contract, DataMeta, DataSet, InventoryRecord, Item, PurchaseOrder, Supplier } from "./types";
import meta from "./sample/meta.json";
import suppliers from "./sample/suppliers.json";
import items from "./sample/items.json";
import purchaseOrders from "./sample/purchaseOrders.json";
import contracts from "./sample/contracts.json";
import inventory from "./sample/inventory.json";

export function loadSample(): { data: DataSet; meta: DataMeta } {
  return {
    data: {
      suppliers: structuredClone(suppliers) as Supplier[],
      items: structuredClone(items) as Item[],
      purchaseOrders: structuredClone(purchaseOrders) as PurchaseOrder[],
      contracts: structuredClone(contracts) as Contract[],
      inventory: structuredClone(inventory) as InventoryRecord[],
    },
    meta: {
      label: meta.label,
      asOf: meta.asOf,
      isSample: true,
      sources: {
        suppliers: "sample/suppliers.json",
        items: "sample/items.json",
        purchaseOrders: "sample/purchaseOrders.json",
        contracts: "sample/contracts.json",
        inventory: "sample/inventory.json",
      },
      version: 1,
    },
  };
}
