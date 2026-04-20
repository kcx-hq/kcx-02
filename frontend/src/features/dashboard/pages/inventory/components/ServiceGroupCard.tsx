import type { InventoryServiceGroup, InventoryServiceItem } from "./inventory-provider.types";
import { ServiceItemRow } from "./ServiceItemRow";

type ServiceGroupCardProps = {
  group: InventoryServiceGroup;
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

export function ServiceGroupCard({ group, pathname, search }: ServiceGroupCardProps) {
  const isActive = group.items.some((item) => isItemActive(pathname, item));

  return (
    <article className={`inventory-service-group-card${isActive ? " is-active" : ""}`}>
      <header className="inventory-service-group-card__header">
        <h2 className="inventory-service-group-card__title">{group.title}</h2>
      </header>

      <div className="inventory-service-group-card__body">
        {group.items.map((item) => (
          <ServiceItemRow key={item.id} item={item} pathname={pathname} search={search} />
        ))}
      </div>
    </article>
  );
}

