import { Download, Search } from "lucide-react";

const TABLE_HEADERS = [
  "Start Date",
  "Duration",
  "Account ID",
  "Account Name",
  "Service",
  "Region",
  "Marketplace",
  "Cost Impact Type",
  "Cost Impact",
  "Cost Impact Percentage",
  "Cost",
  "Status",
  "Feedback",
];

export function AnomalyDetectionTable() {
  return (
    <section className="anomaly-ref-table-shell" aria-label="Anomaly table">
      <div className="anomaly-ref-table-toolbar">
        <div className="anomaly-ref-table-toolbar__left">
          <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
            Submit Feedback
          </button>
          <button type="button" className="anomaly-ref-btn anomaly-ref-btn--subtle">
            <Download size={13} />
            Export
          </button>
        </div>

        <div className="anomaly-ref-table-toolbar__right">
          <span className="anomaly-ref-pill anomaly-ref-pill--active">Active 0</span>
          <span className="anomaly-ref-pill">Inactive 0</span>
          <label className="anomaly-ref-search" aria-label="Search">
            <Search size={13} />
            <input type="text" placeholder="Search" />
          </label>
        </div>
      </div>

      <div className="anomaly-ref-table-scroll">
        <table className="anomaly-ref-table">
          <thead>
            <tr>
              {TABLE_HEADERS.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 18 }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {TABLE_HEADERS.map((header) => (
                  <td key={`${header}-${rowIndex}`}>
                    <span className="anomaly-ref-cell-placeholder" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
