export type RolePermissions = {
  dashboard:   { view: boolean; view_finance: boolean }
  clients:     { view: boolean; create: boolean; edit: boolean; delete: boolean; freeze: boolean; extend: boolean; export: boolean }
  memberships: { view: boolean; sell: boolean; create: boolean; edit: boolean; delete: boolean; change_price: boolean }
  payments:    { view: boolean; create: boolean; refund: boolean; view_revenue: boolean; export: boolean }
  visits:      { view: boolean; checkin: boolean; checkout: boolean; manual: boolean; delete_history: boolean }
  schedule:    { view: boolean; create: boolean; edit: boolean; delete: boolean }
  warehouse:   { view: boolean; sell: boolean; supply: boolean; writeoff: boolean; view_cost_price: boolean }
  staff:       { view: boolean; create: boolean; edit: boolean; delete: boolean; salaries: boolean }
  reports:     { view: boolean; finance: boolean; export: boolean }
  ai:          { use: boolean }
  telegram:    { view: boolean; manage: boolean }
  settings:    { general: boolean; integrations: boolean; subscription: boolean; roles: boolean }
}

export type ClubRole = {
  id: string
  key: string
  name: string
  description: string
  permissions: RolePermissions
  isSystem: boolean
  staffCount: number
}

const ALL_TRUE_PERMS: RolePermissions = {
  dashboard:   { view: true,  view_finance: true  },
  clients:     { view: true,  create: true,  edit: true,  delete: true,  freeze: true,  extend: true,  export: true  },
  memberships: { view: true,  sell: true,    create: true,  edit: true,  delete: true,  change_price: true  },
  payments:    { view: true,  create: true,  refund: true,  view_revenue: true,  export: true  },
  visits:      { view: true,  checkin: true, checkout: true, manual: true, delete_history: true  },
  schedule:    { view: true,  create: true,  edit: true,  delete: true  },
  warehouse:   { view: true,  sell: true,    supply: true,  writeoff: true,  view_cost_price: true  },
  staff:       { view: true,  create: true,  edit: true,  delete: true,  salaries: true  },
  reports:     { view: true,  finance: true, export: true  },
  ai:          { use: true  },
  telegram:    { view: true,  manage: true  },
  settings:    { general: true, integrations: true, subscription: true, roles: true  },
}

const ALL_FALSE_PERMS: RolePermissions = {
  dashboard:   { view: false, view_finance: false },
  clients:     { view: false, create: false, edit: false, delete: false, freeze: false, extend: false, export: false },
  memberships: { view: false, sell: false,   create: false, edit: false, delete: false, change_price: false },
  payments:    { view: false, create: false, refund: false, view_revenue: false, export: false },
  visits:      { view: false, checkin: false, checkout: false, manual: false, delete_history: false },
  schedule:    { view: false, create: false, edit: false, delete: false },
  warehouse:   { view: false, sell: false,   supply: false, writeoff: false, view_cost_price: false },
  staff:       { view: false, create: false, edit: false, delete: false, salaries: false },
  reports:     { view: false, finance: false, export: false },
  ai:          { use: false },
  telegram:    { view: false, manage: false },
  settings:    { general: false, integrations: false, subscription: false, roles: false },
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  owner: ALL_TRUE_PERMS,
  admin: {
    ...ALL_FALSE_PERMS,
    dashboard:   { view: true,  view_finance: false },
    clients:     { view: true,  create: true,  edit: true,  delete: false, freeze: true,  extend: true,  export: true  },
    memberships: { view: true,  sell: true,    create: true,  edit: true,  delete: false, change_price: false },
    payments:    { view: true,  create: true,  refund: true,  view_revenue: false, export: false },
    visits:      { view: true,  checkin: true, checkout: true, manual: true, delete_history: false },
    schedule:    { view: true,  create: true,  edit: true,  delete: true  },
    warehouse:   { view: true,  sell: true,    supply: true,  writeoff: true,  view_cost_price: false },
    staff:       { view: true,  create: false, edit: false, delete: false, salaries: false },
    reports:     { view: true,  finance: false, export: false },
    ai:          { use: true },
    telegram:    { view: true,  manage: false },
    settings:    { general: true, integrations: false, subscription: false, roles: false },
  },
  manager: {
    ...ALL_FALSE_PERMS,
    dashboard:   { view: true,  view_finance: false },
    clients:     { view: true,  create: true,  edit: true,  delete: false, freeze: true,  extend: true,  export: true  },
    memberships: { view: true,  sell: true,    create: false, edit: false, delete: false, change_price: false },
    payments:    { view: true,  create: true,  refund: false, view_revenue: false, export: false },
    visits:      { view: true,  checkin: true, checkout: true, manual: true, delete_history: false },
    schedule:    { view: true,  create: false, edit: false, delete: false },
    warehouse:   { view: true,  sell: true,    supply: false, writeoff: false, view_cost_price: false },
    staff:       { view: true,  create: false, edit: false, delete: false, salaries: false },
    reports:     { view: true,  finance: false, export: false },
    ai:          { use: false },
  },
  trainer: {
    ...ALL_FALSE_PERMS,
    dashboard:   { view: true,  view_finance: false },
    clients:     { view: true,  create: false, edit: false, delete: false, freeze: true,  extend: false, export: false },
    memberships: { view: true,  sell: false,   create: false, edit: false, delete: false, change_price: false },
    visits:      { view: true,  checkin: true, checkout: true, manual: true, delete_history: false },
    schedule:    { view: true,  create: false, edit: false, delete: false },
  },
  accountant: {
    ...ALL_FALSE_PERMS,
    dashboard:   { view: true,  view_finance: true  },
    clients:     { view: true,  create: false, edit: false, delete: false, freeze: false, extend: false, export: true  },
    memberships: { view: true,  sell: false,   create: false, edit: false, delete: false, change_price: false },
    payments:    { view: true,  create: false, refund: false, view_revenue: true,  export: true  },
    visits:      { view: true,  checkin: false, checkout: false, manual: false, delete_history: false },
    warehouse:   { view: true,  sell: false,   supply: false, writeoff: false, view_cost_price: true  },
    staff:       { view: true,  create: false, edit: false, delete: false, salaries: true  },
    reports:     { view: true,  finance: true, export: true  },
  },
  cashier: {
    ...ALL_FALSE_PERMS,
    dashboard:   { view: true,  view_finance: false },
    clients:     { view: true,  create: true,  edit: false, delete: false, freeze: false, extend: true,  export: false },
    memberships: { view: true,  sell: true,    create: false, edit: false, delete: false, change_price: false },
    payments:    { view: true,  create: true,  refund: false, view_revenue: false, export: false },
    visits:      { view: true,  checkin: true, checkout: true, manual: false, delete_history: false },
    schedule:    { view: true,  create: false, edit: false, delete: false },
  },
}

export function getDefaultPermissions(role: string): RolePermissions {
  // Unknown or corrupted role keys must never inherit trainer capabilities.
  return DEFAULT_ROLE_PERMISSIONS[role] ?? ALL_FALSE_PERMS
}

export function mergePermissions(base: RolePermissions, partial: Partial<RolePermissions>): RolePermissions {
  const result = { ...base }
  for (const mod of Object.keys(partial) as (keyof RolePermissions)[]) {
    if (partial[mod]) {
      result[mod] = { ...base[mod], ...partial[mod] } as never
    }
  }
  return result
}

export function can(permissions: RolePermissions, module: keyof RolePermissions, action: string): boolean {
  const mod = permissions[module] as Record<string, boolean>
  return mod?.[action] === true
}
