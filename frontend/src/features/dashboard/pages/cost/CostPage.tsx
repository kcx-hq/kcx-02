import { useMemo } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CostExplorerPage from "../cost-explorer/CostExplorerPage";

type CostView = "explorer" | "history";

const COST_VIEW_QUERY_KEY = "costView";

const resolveCostView = (search: string): CostView => {
  const params = new URLSearchParams(search);
  return params.get(COST_VIEW_QUERY_KEY) === "history" ? "history" : "explorer";
};

function HistoryPage() {
  return (
    <div className="dashboard-page cost-history-page">
      <section className="cost-history-card">
        <h2 className="cost-history-card__title">History</h2>
        <p className="cost-history-card__message">Welcome into history.</p>
      </section>
    </div>
  );
}

export default function CostPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeView = useMemo(() => resolveCostView(location.search), [location.search]);

  const handleViewChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextView = event.target.value === "history" ? "history" : "explorer";
    const params = new URLSearchParams(location.search);

    if (nextView === "history") {
      params.set(COST_VIEW_QUERY_KEY, "history");
    } else {
      params.delete(COST_VIEW_QUERY_KEY);
    }

    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true },
    );
  };

  return (
    <>
      <section className="cost-page-switcher">
        <label className="cost-page-switcher__label" htmlFor="cost-view-select">
          Cost
        </label>
        <select
          id="cost-view-select"
          className="cost-page-switcher__select"
          value={activeView}
          onChange={handleViewChange}
        >
          <option value="explorer">Explorer</option>
          <option value="history">History</option>
        </select>
      </section>

      {activeView === "explorer" ? <CostExplorerPage /> : <HistoryPage />}
    </>
  );
}
