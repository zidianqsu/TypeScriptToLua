import * as ts from "typescript";
import * as lua from "../../../../LuaAST";
import { TransformationContext } from "../../../context";
import { createSelfIdentifier } from "../../../utils/lua-ast";
import { transformInPrecedingStatementScope } from "../../../utils/preceding-statements";
import { transformPropertyName } from "../../literal";

export function transformClassInstanceFields(
    context: TransformationContext,
    instanceFields: ts.PropertyDeclaration[],
    propertiesFields : ts.PropertyDeclaration[]
): lua.Statement[] {
    const statements: lua.Statement[] = [];

    // [NGR Begin][maxstsun] This is a workaround for a bug in the compiler where it will not emit a property if it is never initialized.
    for (const f of propertiesFields.filter(member => !member.initializer)) {
        const { precedingStatements, result: statement } = transformInPrecedingStatementScope(context, () => {
            // Get identifier
            const fieldName = transformPropertyName(context, f.name);

            const value = f.initializer ? context.transformExpression(f.initializer) : lua.createBooleanLiteral(false);

            // self[fieldName]
            const selfIndex = lua.createTableIndexExpression(createSelfIdentifier(), fieldName);

            // self[fieldName] = value
            const assignClassField = lua.createAssignmentStatement(selfIndex, value, f);

            return assignClassField;
        });

        statements.push(...precedingStatements, statement);
    }
    // [NGR End]

    for (const f of instanceFields) {
        const { precedingStatements, result: statement } = transformInPrecedingStatementScope(context, () => {
            // Get identifier
            const fieldName = transformPropertyName(context, f.name);

            const value = f.initializer ? context.transformExpression(f.initializer) : undefined;

            // self[fieldName]
            const selfIndex = lua.createTableIndexExpression(createSelfIdentifier(), fieldName);

            // self[fieldName] = value
            const assignClassField = lua.createAssignmentStatement(selfIndex, value, f);

            return assignClassField;
        });

        statements.push(...precedingStatements, statement);
    }

    return statements;
}

export function transformStaticPropertyDeclaration(
    context: TransformationContext,
    field: ts.PropertyDeclaration,
    className: lua.Identifier
): lua.AssignmentStatement | undefined {
    if (!field.initializer) return;
    const fieldName = transformPropertyName(context, field.name);
    const value = context.transformExpression(field.initializer);
    const classField = lua.createTableIndexExpression(lua.cloneIdentifier(className), fieldName);

    return lua.createAssignmentStatement(classField, value);
}
