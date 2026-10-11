import type { getDashboardData } from "./queries";
export type AwaitedDashboard = Awaited<ReturnType<typeof getDashboardData>>;
