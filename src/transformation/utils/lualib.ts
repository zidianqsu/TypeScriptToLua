import * as ts from "typescript";
import * as lua from "../../LuaAST";
import { LuaLibFeature } from "../../LuaLib";
import { TransformationContext } from "../context";

export { LuaLibFeature };

export function importLuaLibFeature(context: TransformationContext, feature: LuaLibFeature): void {
    context.usedLuaLibFeatures.add(feature);
}

export function transformLuaLibFunction(
    context: TransformationContext,
    feature: LuaLibFeature,
    tsParent?: ts.Node,
    ...params: lua.Expression[]
): lua.CallExpression {
    importLuaLibFeature(context, feature);
    const functionIdentifier = lua.createIdentifier(`__TS__${feature}`);
    return lua.createCallExpression(functionIdentifier, params, tsParent);
}

// [NGR Begin][maxstsun] transform class creation method to use NGR class type
export function transformUENewFunction(
    context: TransformationContext,
    tsNode: ts.NewExpression,
    ...params: lua.Expression[]): lua.CallExpression {
    const indexNode = tsNode.expression.kind === ts.SyntaxKind.Identifier ? lua.createStringLiteral(
        tsNode.expression.getText()) : context.transformExpression(tsNode.expression);
    return lua.createCallExpression(
        lua.createTableIndexExpression(
            lua.createTableIndexExpression(
                lua.createIdentifier("ClassLib"),
                indexNode,
                undefined
            ),
            lua.createStringLiteral("New")
        ),
        [
            lua.createTableIndexExpression(
                lua.createIdentifier("ClassLib"),
                indexNode,
                undefined
            ),
            ...params
        ]
    );
}
// [NGR End][maxstsun]
