/**
 * @file map
 * @description
 * @author maxstsun
 * @date 2024/12/16
 */

import * as lua from "../../LuaAST";
import * as ts from "typescript";
import { TransformationContext } from "../context";
import { unsupportedProperty } from "../utils/diagnostics";
import {transformArguments, transformCallAndArguments} from "../visitors/call";
import { LuaLibFeature, transformLuaLibFunction } from "../utils/lualib";

export function ngrTransformMapConstructorCall(
    context: TransformationContext,
    node: ts.CallExpression,
    calledMethod: ts.PropertyAccessExpression
): lua.Expression | undefined {
    const args = transformArguments(context, node.arguments);
    const methodName = calledMethod.name.text;

    switch (methodName) {
        case "groupBy":
            return transformLuaLibFunction(context, LuaLibFeature.MapGroupBy, node, ...args);
        default:
            context.diagnostics.push(unsupportedProperty(calledMethod.name, "Map", methodName));
    }
}

export function ngrTransformMapPrototypeCall(
    context: TransformationContext,
    node: ts.CallExpression,
    calledMethod: ts.PropertyAccessExpression
): lua.Expression | undefined{
    const signature = context.checker.getResolvedSignature(node);
    const [caller, params] = transformCallAndArguments(context, calledMethod.expression, node.arguments, signature);

    const expressionName = calledMethod.name.text;
    switch (expressionName) {
        case "set":
            return lua.createCallExpression(
                lua.createTableIndexExpression(
                    lua.createIdentifier("table"),
                    lua.createStringLiteral("set"),
                ), [
                    caller,
                    params[0],
                    params[1],
                ]
            );
        case "get":
            return lua.createTableIndexExpression(
                caller,
                params[0]
            );
        case "forEach":
            return lua.createCallExpression(
                lua.createTableIndexExpression(
                    lua.createIdentifier("table"), lua.createStringLiteral("foreach")
                ),
                [
                    caller,
                    ...params
                ],
                node
            );
    }
}
