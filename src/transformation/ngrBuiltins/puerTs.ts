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
