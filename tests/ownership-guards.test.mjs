import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";

function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]); }
const privileged = new Set(["src/db/index.ts", "src/db/user-db.ts", "src/lib/auth.ts", "src/lib/accounts.ts", "src/lib/accounts-core.ts", "src/app/account-actions.ts", "src/app/(app)/perfil/contas/page.tsx"]);

test("all learning reads/updates/deletes are owner-scoped and inserts stamp server ownership", () => {
  let reads = 0, writes = 0;
  for (const path of files("src").filter(path => /\.tsx?$/.test(path))) {
    const source = readFileSync(path, "utf8");
    if (!privileged.has(path)) assert.doesNotMatch(source, /import.*\bgetDb\b/, `${path}: unrestricted database import`);
    if (!source.includes('from "@/db/user-db"')) continue;
    assert.match(source, /await getUserDb\(\)/, `${path}: must derive identity from session`);
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (["from", "update", "delete"].includes(method) && /^(db|tx)\./.test(node.getText(sf))) {
          const table = node.arguments[0].getText(sf);
          let top = node, where;
          while (ts.isPropertyAccessExpression(top.parent) && ts.isCallExpression(top.parent.parent)) {
            top = top.parent.parent;
            if (top.expression.name.text === "where") where = top;
          }
          assert.ok(where, `${path}: ${method}(${table}) without owner predicate`);
          assert.ok(where.arguments[0].getText(sf).startsWith(`owned(${table}, userId`), `${path}: incorrect owner predicate`);
          reads++;
        }
        if (method === "values" && /^(db|tx)\./.test(node.getText(sf))) {
          assert.ok(node.arguments[0].getText(sf).startsWith("withOwner(userId,"), `${path}: ownerless insert`); writes++;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  assert.ok(reads > 90); assert.ok(writes > 25);
});

test("admin surface is separately authorized and user credentials cannot set roles", () => {
  for (const path of ["src/app/account-actions.ts", "src/app/(app)/perfil/contas/page.tsx"]) assert.match(readFileSync(path, "utf8"), /await requireAdmin\(\)/);
  assert.doesNotMatch(readFileSync("src/lib/accounts-core.ts", "utf8"), /values\(\{[^}]*role:/);
  for (const route of ["login", "logout", "redeem"]) assert.match(readFileSync(`src/app/api/auth/${route}/route.ts`, "utf8"), /if \(!sameOrigin\(request\)\)/);
});
