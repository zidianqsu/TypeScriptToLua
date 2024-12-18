/**
 * @file ngr
 * @description
 * @author maxstsun
 * @date 2024/12/17
 */
import * as ts from "typescript";
import {Expression, NodeFlags} from "typescript";
import * as lua from "../../LuaAST";
import {TransformationContext} from "../context";
import {getCustomNameFromSymbol} from "../visitors/identifier";

export function ngrTransformBuiltinPropertyAccessExpression(
    context: TransformationContext,
    node: ts.PropertyAccessExpression
): lua.Expression | undefined{
    const ownerType = context.checker.getTypeAtLocation(node.expression);
    if (!ownerType.symbol) {
        return;
    }

    switch (ownerType.symbol.name) {
        case "Global":
            return lua.createIdentifier(node.name.text);
    }

    let curNode = node;
    while (ts.isPropertyAccessExpression(curNode) && curNode.expression) {
        curNode = curNode.expression as ts.PropertyAccessExpression;
    }

    // check is top level type is ue, if true translate to unlua type
    if (context.checker.getTypeAtLocation(curNode).symbol.getName() === "\"ue\"") {
        let property = node.name.text;
        const symbol = context.checker.getSymbolAtLocation(node.name);
        const customName = getCustomNameFromSymbol(symbol);
        if (customName) {
            property = customName;
        }

        const expSymbol = context.checker.getSymbolAtLocation(node.expression);
        if (expSymbol === undefined) {
            return undefined;
        }

        // const flagFilter = ts.SymbolFlags.
        if ((expSymbol.getFlags() & ts.SymbolFlags.Variable) === 0) {
            return lua.createTableIndexExpression(
                lua.createTableIndexExpression(
                    lua.createIdentifier("UE"),
                    lua.createStringLiteral(ownerType.symbol.name)
                ),
                lua.createStringLiteral(property)
            );
        }
    }
}
