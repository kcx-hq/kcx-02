import { ChevronRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { InventoryServiceItem } from "./inventory-provider.types";

type ServiceItemRowProps = {
  item: InventoryServiceItem;
  pathname: string;
  search: string;
};

const isPathActive = (pathname: string, candidate: string): boolean =>
  pathname === candidate || pathname.startsWith(`${candidate}/`);

const isItemActive = (pathname: string, item: InventoryServiceItem): boolean => {
  const candidates = [item.href, ...(item.matchPrefixes ?? [])].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return candidates.some((candidate) => isPathActive(pathname, candidate));
};

export function ServiceItemRow({ item, pathname, search }: ServiceItemRowProps) {
  const active = isItemActive(pathname, item);
  const metadata = item.metadata ?? (item.placeholder ? "Coming soon" : null);
  const className = `inventory-service-item${active ? " is-active" : ""}${item.placeholder ? " is-placeholder" : ""}`;

  if (item.href) {
    return (
      <NavLink
        to={{ pathname: item.href, search }}
        className={className}
        aria-current={active ? "page" : undefined}
      >
        <span className="inventory-service-item__label">{item.label}</span>
        <span className="inventory-service-item__tail">
          {metadata ? <span className="inventory-service-item__meta">{metadata}</span> : null}
          <ChevronRight className="inventory-service-item__chevron" aria-hidden="true" />
        </span>
      </NavLink>
    );
  }

  return (
    <button type="button" className={className}>
      <span className="inventory-service-item__label">{item.label}</span>
      <span className="inventory-service-item__tail">
        {metadata ? <span className="inventory-service-item__meta">{metadata}</span> : null}
        <ChevronRight className="inventory-service-item__chevron" aria-hidden="true" />
      </span>
    </button>
  );
}

