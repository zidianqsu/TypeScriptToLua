import * as ts from "typescript";
import * as lua from "../../../LuaAST";
import {assert} from "../../../utils";
import {TransformationContext} from "../../context";
import {
    hasDefaultExportModifier
} from "../../utils/export";
import {getExtendedNode} from "./utils";

export function createClassSetup(
    context: TransformationContext,
    statement: ts.ClassLikeDeclarationBase,
    className: lua.Identifier,
    localClassName: lua.Identifier,
    extendsType?: ts.Type
): lua.Statement[] {
    const result: lua.Statement[] = [];

    // __TS__Class()
    // const classInitializer = transformLuaLibFunction(context, LuaLibFeature.Class, statement);

    // const defaultExportLeftHandSide = hasDefaultExportModifier(statement)
    //     ? lua.createTableIndexExpression(createExportsIdentifier(), createDefaultExportStringLiteral(statement))
    //     : undefined;

    // // [____exports.]className = __TS__Class()
    // if (defaultExportLeftHandSide) {
    //     result.push(lua.createAssignmentStatement(defaultExportLeftHandSide, classInitializer, statement));
    // } else {
    //     result.push(...createLocalOrExportedOrGlobalDeclaration(context, className, classInitializer, statement));
    // }

    // if (defaultExportLeftHandSide) {
    //     // local localClassName = ____exports.default
    //     result.push(lua.createVariableDeclarationStatement(localClassName, defaultExportLeftHandSide));
    // } else {
    //     const exportScope = getIdentifierExportScope(context, className);
    //     if (exportScope) {
    //         // local localClassName = ____exports.className
    //         result.push(
    //             lua.createVariableDeclarationStatement(
    //                 localClassName,
    //                 createExportedIdentifier(context, lua.cloneIdentifier(className), exportScope)
    //             )
    //         );
    //     }
    // }

    // // localClassName.name = className
    // result.push(
    //     lua.createAssignmentStatement(
    //         lua.createTableIndexExpression(lua.cloneIdentifier(localClassName), lua.createStringLiteral("name")),
    //         getReflectionClassName(statement, className),
    //         statement
    //     )
    // );

    // if (extendsType) {
    //     const extendedNode = getExtendedNode(statement);
    //     assert(extendedNode);
    //     result.push(
    //         lua.createExpressionStatement(
    //             transformLuaLibFunction(
    //                 context,
    //                 LuaLibFeature.ClassExtends,
    //                 getExtendsClause(statement),
    //                 lua.cloneIdentifier(localClassName),
    //                 context.transformExpression(extendedNode.expression)
    //             )
    //         )
    //     );
    // }

    // ngr begin
    let declareClassParams = [];
    declareClassParams.push(lua.createStringLiteral(className.text));

    if(extendsType)
    {
        const extendNode = getExtendedNode(statement);
        assert(extendNode);
        declareClassParams.push(lua.createTableIndexExpression(lua.createIdentifier("ClassLib"), lua.createStringLiteral(extendNode.getText())));
    }

    result.push(lua.createVariableDeclarationStatement(localClassName, lua.createCallExpression(lua.createIdentifier("DeclareClass"), declareClassParams)));
    // ngr end

    return result;
}

export function getReflectionClassName(
    declaration: ts.ClassLikeDeclarationBase,
    className: lua.Identifier
): lua.Expression {
    if (declaration.name) {
        return lua.createStringLiteral(declaration.name.text);
    } else if (ts.isVariableDeclaration(declaration.parent) && ts.isIdentifier(declaration.parent.name)) {
        return lua.createStringLiteral(declaration.parent.name.text);
    } else if (hasDefaultExportModifier(declaration)) {
        return lua.createStringLiteral("default");
    }

    if (getExtendedNode(declaration)) {
        return lua.createTableIndexExpression(className, lua.createStringLiteral("name"));
    }

    return lua.createStringLiteral("");
}
