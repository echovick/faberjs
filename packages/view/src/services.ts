import { Application } from '@faber-js/core';

/**
 * Resolve a service from the IoC container inside a view component. Mirrors
 * Blade's `@inject` directive.
 *
 * @example
 * function RevenueWidget() {
 *   const metrics = useService<MetricsService>('metrics');
 *   return <div>Monthly: {metrics.monthlyRevenue()}</div>;
 * }
 */
export function useService<T = unknown>(token: string): T {
  return Application.getInstance().make<T>(token);
}
