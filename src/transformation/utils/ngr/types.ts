/**
 * @file types
 * @description
 * @author maxstsun
 * @date 2024/12/18
 */
import * as ts from "typescript";
import {TransformationContext} from "../../context";

export function isPuerArrayType(context: TransformationContext, type: ts.Type): boolean{
    switch (type.getSymbol()?.getName()) {
        case "TArray":
            return true;
        default:
            return false;
    }
}
