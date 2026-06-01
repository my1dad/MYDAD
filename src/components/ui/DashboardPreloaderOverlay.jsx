import { AppPreloaderOverlay } from "./AppPreloader";
import { useLoading } from "../../context/LoadingContext";

export default function DashboardPreloaderOverlay() {
  const { isLoading, loadingLabel } = useLoading();

  if (!isLoading) return null;

  return <AppPreloaderOverlay scope="dashboard" label={loadingLabel} />;
}
