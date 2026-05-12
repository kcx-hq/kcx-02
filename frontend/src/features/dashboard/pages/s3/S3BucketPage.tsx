import { useLocation, useNavigate } from "react-router-dom";
import S3CostPage from "./S3CostPage";
import S3UsagePage from "./S3UsagePage";

type S3BucketView = "cost" | "usage";

const getViewFromPath = (pathname: string): S3BucketView =>
  pathname.startsWith("/dashboard/s3/usage") ? "usage" : "cost";

export default function S3BucketPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = getViewFromPath(location.pathname);

  const goToView = (nextView: S3BucketView) => {
    if (nextView === activeView) return;
    navigate(
      {
        pathname: nextView === "cost" ? "/dashboard/s3/cost" : "/dashboard/s3/usage",
        search: location.search,
      },
      { replace: false },
    );
  };

  return (
    <div className="s3-bucket-page">
      <div className="s3-bucket-tabs" role="tablist" aria-label="S3 bucket section switcher">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "cost"}
          className={`s3-bucket-tab ${activeView === "cost" ? "is-active" : ""}`}
          onClick={() => goToView("cost")}
        >
          Cost
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "usage"}
          className={`s3-bucket-tab ${activeView === "usage" ? "is-active" : ""}`}
          onClick={() => goToView("usage")}
        >
          Usage
        </button>
      </div>
      {activeView === "cost" ? <S3CostPage /> : <S3UsagePage />}
    </div>
  );
}
