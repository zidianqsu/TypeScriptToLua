import * as ts from "typescript";
import {UnaryOperator} from "../../LuaAST";
import * as lua from "../../LuaAST";
import {TransformationContext} from "../context";
import {LuaLibFeature, transformLuaLibFunction} from "../utils/lualib";
import {isNumberType} from "../utils/typescript";
import {transformArguments} from "../visitors/call";

export function tryNgrTransformBuiltinGlobalCall(
    context: TransformationContext,
    node: ts.CallExpression,
    expressionType: ts.Type
): lua.Expression | undefined{
    function getParameters(){
        const signature = context.checker.getResolvedSignature(node);
        return transformArguments(context, node.arguments, signature);
    }

    const name = expressionType.symbol.name;
    switch (name) {
        case "SymbolConstructor":
            return transformLuaLibFunction(context, LuaLibFeature.Symbol, node, ...getParameters());
        case "NumberConstructor":
            return transformLuaLibFunction(context, LuaLibFeature.Number, node, ...getParameters());
        case "isNaN":
            return lua.createUnaryExpression(
                lua.createCallExpression(
                    lua.createTableIndexExpression(
                        lua.createIdentifier("math"),
                        lua.createStringLiteral("isNumber")
                    ),
                    getParameters()
                ),
                lua.SyntaxKind.NotOperator
            );
        case "isFinite":
            const numberParameters = isNumberType(context, expressionType)
                                     ?
                                     getParameters()
                                     :
                                     [
                                         transformLuaLibFunction(context, LuaLibFeature.Number, undefined,
                                                                 ...getParameters())
                                     ];

            return transformLuaLibFunction(
                context, LuaLibFeature.NumberIsFinite,
                node,
                ...numberParameters
            );
        case "parseFloat":
            return transformLuaLibFunction(context, LuaLibFeature.ParseFloat, node, ...getParameters());
        case "parseInt":
            return lua.createCallExpression(
                lua.createIdentifier("tonumber"),
                [...getParameters()]
            );
    }
}
