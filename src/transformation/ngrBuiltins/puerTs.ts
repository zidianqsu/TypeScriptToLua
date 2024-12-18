/**
 * @file puerTs
 * @description
 * @author maxstsun
 * @date 2024/12/16
 */

import {Identifier} from "typescript";
import * as ts from "typescript";
import * as lua from "../../LuaAST";
import {TransformationContext} from "../context";
import {transformForInitializer} from "../visitors/loops/utils";

export function transformPuerTsIdentifier(
    context: TransformationContext,
    node: ts.CallExpression,
    identifier: Identifier
){
    const callId = identifier.getText();

    switch (callId) {
        case "$ref": {
            return lua.createIdentifier("TestRef");
        }
    }
}

export function transformPuerForOfTArrayStatement(
    context: TransformationContext,
    statement: ts.ForOfStatement,
    block: lua.Block
): lua.Statement{
    const valueVariable = transformForInitializer(context, statement.initializer, block);
    const pairsCall = lua.createCallExpression(lua.createIdentifier("pairs"), [
        context.transformExpression(statement.expression),
    ]);

    return lua.createForInStatement(block, [lua.createAnonymousIdentifier(), valueVariable], [pairsCall], statement);
}
