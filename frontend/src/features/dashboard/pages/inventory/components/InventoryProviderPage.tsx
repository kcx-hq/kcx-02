import { useLocation } from "react-router-dom";
import type { InventoryServiceGroup } from "./inventory-provider.types";
import { ServiceGroupCard } from "./ServiceGroupCard";

type InventoryProviderPageProps = {
  title: string;
  subtitle: string;
  groups: InventoryServiceGroup[];
};

export function InventoryProviderPage({ title, subtitle, groups }: InventoryProviderPageProps) {
  const location = useLocation();

  return (
    <section className="dashboard-page inventory-provider-page" aria-label={`${title} navigation`}>
      <header className="dashboard-page-header inventory-provider-page__header">
        <div>
          <p className="inventory-provider-page__eyebrow">Inventory</p>
          <h1 className="dashboard-page-header__title">{title}</h1>
          <p className="inventory-provider-page__subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="inventory-service-groups-grid">
        {groups.map((group) => (
          <ServiceGroupCard
            key={group.id}
            group={group}
            pathname={location.pathname}
            search={location.search}
          />
        ))}
      </div>
    </section>
  );
}

