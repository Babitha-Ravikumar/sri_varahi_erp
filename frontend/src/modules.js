/**
 * Application modules - the single list used by the sidebar, the
 * user-permission editor and the navigation guard.
 * `screens` maps every in-app screen to the module it belongs to.
 * `grantable` modules can be enabled/disabled per user by the Super Admin.
 */
export const MODULES = [
  { key: 'dashboard', icon: '🏠', title: 'Dashboard', screens: ['dashboard', 'drillDown', 'topCustomers'] },
  { key: 'sourceSelect', icon: '＋', title: 'New Inward', screens: ['sourceSelect', 'localFarmer', 'localTrader', 'outsideTrader'], grantable: true },
  { key: 'lots', icon: '📦', title: 'Lots', screens: ['lotDetail'], grantable: true },
  { key: 'liveAuction', icon: '🔨', title: 'Live Auction', screens: ['liveAuction'], grantable: true },
  { key: 'billing', icon: '🧾', title: 'Billing', screens: ['billing'], grantable: true },
  { key: 'cashier', icon: '💰', title: 'Cashier', screens: ['cashier'], grantable: true },
  { key: 'nightArrival', icon: '🌙', title: 'Night Arrivals', screens: ['nightArrival'], grantable: true },
  { key: 'vehicleMaster', icon: '🚚', title: 'Vehicle Master', screens: ['vehicleMaster'], grantable: true },
  { key: 'corrections', icon: '✏️', title: 'Corrections', screens: ['corrections'], grantable: true },
  { key: 'audit', icon: '📋', title: 'Audit / History', screens: ['audit'], grantable: true },
  { key: 'qualityGrades', icon: '🏷️', title: 'Quality Grades', screens: ['qualityGrades'] },
  { key: 'userCreation', icon: '👥', title: 'User Management', screens: ['userCreation'] },
];

export const GRANTABLE_MODULES = MODULES.filter((m) => m.grantable);

/** Returns the module key a screen belongs to (null = not a module screen). */
export function moduleOfScreen(screenName) {
  const m = MODULES.find((mod) => mod.screens.includes(screenName));
  return m ? m.key : null;
}
