export type InventoryServiceItem = {
  id: string;
  label: string;
  href?: string;
  metadata?: string;
  placeholder?: boolean;
  matchPrefixes?: string[];
};

export type InventoryServiceGroup = {
  id: string;
  title: string;
  items: InventoryServiceItem[];
};

