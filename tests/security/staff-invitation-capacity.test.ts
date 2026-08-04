import { readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const guardedActions = [
  { file: "staff/actions.ts", functions: ["addStaffAction"] },
  { file: "settings/club/actions.ts", functions: ["inviteStaffAction", "createInviteLinkAction"] },
] as const

function findFunction(source: ts.SourceFile, functionName: string): ts.FunctionDeclaration | undefined {
  return source.statements.find(
    (statement): statement is ts.FunctionDeclaration => (
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName
    ),
  )
}

function descendants(node: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = []
  const visit = (child: ts.Node) => {
    nodes.push(child)
    child.forEachChild(visit)
  }
  node.forEachChild(visit)
  return nodes
}

describe("staff invitation capacity guards", () => {
  for (const guarded of guardedActions) {
    const file = path.join(process.cwd(), "src/app/(app)", guarded.file)
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

    for (const functionName of guarded.functions) {
      it(`${guarded.file} / ${functionName} excludes expired invitations at one checkedAt`, () => {
        const declaration = findFunction(source, functionName)
        expect(declaration?.body, "function was renamed or removed").toBeDefined()

        const nodes = descendants(declaration!.body!)
        const checkedAtDeclarations = nodes.filter((node) => (
          ts.isVariableDeclaration(node)
          && ts.isIdentifier(node.name)
          && node.name.text === "checkedAt"
          && node.initializer?.getText(source) === "new Date().toISOString()"
        ))
        const expiryFilters = nodes.filter((node) => (
          ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === "gt"
          && node.arguments[0]?.getText(source) === '"expires_at"'
          && node.arguments[1]?.getText(source) === "checkedAt"
        ))

        expect(checkedAtDeclarations).toHaveLength(1)
        expect(expiryFilters).toHaveLength(1)
      })
    }
  }
})
