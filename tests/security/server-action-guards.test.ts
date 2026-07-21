import { readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const criticalMutations: Record<string, string[]> = {
  "clients/actions.ts": ["createClientAction", "deleteClientAction", "updateClientAction", "toggleFreezeAction", "renewSubscriptionAction"],
  "clients/import-actions.ts": ["batchImportClientsAction"],
  "memberships/actions.ts": ["createMembershipAction", "updateMembershipAction", "duplicateMembershipAction", "setMembershipActiveAction", "setMembershipArchivedAction", "deleteMembershipAction"],
  "payments/actions.ts": ["createPaymentAction", "createOnlinePaymentAction", "sendPaymentLinkTelegramAction"],
  "visits/actions.ts": ["markVisitAction", "manualVisitAction"],
  "warehouse/actions.ts": ["addProductAction", "addSupplyAction", "writeoffAction"],
  "staff/actions.ts": ["addStaffAction", "updateStaffBasicAction", "updateStaffSalaryAction", "payStaffAction", "updateStaffPermissionsAction", "updateStaffRoleAction", "updateStaffStatusAction"],
  "schedule/actions.ts": ["createRoomAction", "deleteRoomAction", "createClassAction", "cancelClassAction", "rescheduleClassAction", "addClientToClassAction", "markAttendanceAction"],
  "settings/roles/actions.ts": ["saveRoleAction", "createRoleAction", "deleteRoleAction"],
  "settings/club/actions.ts": ["requestPlanAction", "requestPaymentConnectionAction", "cancelPaymentConnectionAction", "cancelPlanRequestAction", "saveClubBasicAction", "saveNotificationsAction", "saveFinanceAction", "inviteStaffAction", "saveIntegrationAction", "createInviteLinkAction", "updateStaffRoleAction", "removeStaffAction", "createBranchAction"],
  "integrations/actions.ts": ["connectTelegramAction", "disconnectTelegramAction", "broadcastTelegramAction", "scheduleBroadcastAction", "testBroadcastAction", "saveTelegramSettingsAction"],
  "payments/reconcile/actions.ts": ["confirmReconAction", "ignoreReconAction", "rematchReconAction", "manualAttachAction"],
}

type FunctionFacts = { calls: Set<string>; hasClubLookup: boolean; hasPermissionGuard: boolean }

function functionFacts(file: string): Map<string, FunctionFacts> {
  const sourceText = readFileSync(file, "utf8")
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const result = new Map<string, FunctionFacts>()

  source.forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return
    const calls = new Set<string>()
    let hasClubLookup = false
    let hasPermissionGuard = false
    const visit = (child: ts.Node) => {
      if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
        calls.add(child.expression.text)
        if (child.expression.text === "getCurrentClub") hasClubLookup = true
        if (child.expression.text === "can") hasPermissionGuard = true
      }
      if (ts.isPropertyAccessExpression(child)) {
        const expression = child.getText(source)
        if (expression.includes(".permissions.")) hasPermissionGuard = true
        if (expression.endsWith(".role")) hasPermissionGuard = true
      }
      child.forEachChild(visit)
    }
    node.body.forEachChild(visit)
    result.set(node.name.text, { calls, hasClubLookup, hasPermissionGuard })
  })

  return result
}

function resolvesAuthorization(functionName: string, facts: Map<string, FunctionFacts>, seen = new Set<string>()): FunctionFacts {
  if (seen.has(functionName)) return { calls: new Set(), hasClubLookup: false, hasPermissionGuard: false }
  seen.add(functionName)
  const direct = facts.get(functionName) ?? { calls: new Set(), hasClubLookup: false, hasPermissionGuard: false }
  let hasClubLookup = direct.hasClubLookup
  let hasPermissionGuard = direct.hasPermissionGuard
  for (const called of direct.calls) {
    if (!facts.has(called)) continue
    const nested = resolvesAuthorization(called, facts, seen)
    hasClubLookup ||= nested.hasClubLookup
    hasPermissionGuard ||= nested.hasPermissionGuard
  }
  return { calls: direct.calls, hasClubLookup, hasPermissionGuard }
}

describe("critical Server Action authorization", () => {
  for (const [relativeFile, functions] of Object.entries(criticalMutations)) {
    const file = path.join(process.cwd(), "src/app/(app)", relativeFile)
    const facts = functionFacts(file)

    for (const functionName of functions) {
      it(relativeFile + " / " + functionName + " resolves club and checks permission", () => {
        expect(facts.has(functionName), "function was renamed or removed").toBe(true)
        const authorization = resolvesAuthorization(functionName, facts)
        expect(authorization.hasClubLookup, "missing getCurrentClub() guard").toBe(true)
        expect(authorization.hasPermissionGuard, "missing permission/role guard").toBe(true)
      })
    }
  }
})
