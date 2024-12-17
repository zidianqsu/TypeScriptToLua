import * as ts from "typescript";
import * as lua from "../../../LuaAST";
import { AllAccessorDeclarations, FunctionVisitor, TransformationContext } from "../../context";
import {
    createDefaultExportExpression,
    createExportedIdentifier,
    hasDefaultExportModifier,
    hasExportModifier,
    isSymbolExported,
} from "../../utils/export";
import { createSelfIdentifier } from "../../utils/lua-ast";
import { createSafeName, isUnsafeName } from "../../utils/safe-names";
import { transformIdentifier } from "../identifier";
import { createClassDecoratingExpression, createConstructorDecoratingExpression } from "./decorators";
import { transformAccessorDeclarations } from "./members/accessors";
import {createConstructorName, createUnLuaConstructorName, transformConstructorDeclaration} from "./members/constructor";
import { transformClassInstanceFields, transformStaticPropertyDeclaration } from "./members/fields";
import { transformMethodDeclaration } from "./members/method";
import { getExtendedNode, getExtendedType, isStaticNode } from "./utils";
import { createClassSetup } from "./setup";
import { LuaTarget } from "../../../CompilerOptions";
import { transformInPrecedingStatementScope } from "../../utils/preceding-statements";
import { createClassPropertyDecoratingExpression } from "./decorators";
import { findFirstNodeAbove } from "../../utils/typescript";

export const transformClassDeclaration: FunctionVisitor<ts.ClassLikeDeclaration> = (declaration, context) => {
    // If declaration is a default export, transform to export variable assignment instead
    if (hasDefaultExportModifier(declaration)) {
        // Class declaration including assignment to ____exports.default are in preceding statements
        const { precedingStatements } = transformInPrecedingStatementScope(context, () => {
            transformClassAsExpression(declaration, context);
            return [];
        });
        return precedingStatements;
    }

    const { statements } = transformClassLikeDeclaration(declaration, context);
    return statements;
};

export const transformThisExpression: FunctionVisitor<ts.ThisExpression> = node => createSelfIdentifier(node);

export function transformClassAsExpression(
    expression: ts.ClassLikeDeclaration,
    context: TransformationContext
): lua.Expression {
    const { statements, name } = transformClassLikeDeclaration(expression, context);
    context.addPrecedingStatements(statements);
    return name;
}

/** @internal */
export interface ClassSuperInfo {
    className: lua.Identifier;
    extendedTypeNode?: ts.ExpressionWithTypeArguments;
}

function transformClassLikeDeclaration(
    classDeclaration: ts.ClassLikeDeclaration,
    context: TransformationContext,
    nameOverride?: lua.Identifier
): { statements: lua.Statement[]; name: lua.Identifier } {
    let className: lua.Identifier;
    if (nameOverride !== undefined) {
        className = nameOverride;
    } else if (classDeclaration.name !== undefined) {
        className = transformIdentifier(context, classDeclaration.name);
    } else {
        className = lua.createIdentifier(context.createTempName("class"), classDeclaration);
    }

    // Get type that is extended
    const extendedTypeNode = getExtendedNode(classDeclaration);
    const extendedType = getExtendedType(context, classDeclaration);

    context.classSuperInfos.push({ className, extendedTypeNode });

    // Get all properties with value
    const properties = classDeclaration.members.filter(ts.isPropertyDeclaration).filter(prop => !isStaticNode(prop));

    // Divide properties into static and non-static
    const instanceFields = properties.filter(member => member.initializer);

    const result: lua.Statement[] = [];

    let localClassName: lua.Identifier;
    if (isUnsafeName(className.text, context.options)) {
        localClassName = lua.createIdentifier(
            createSafeName(className.text),
            undefined,
            className.symbolId,
            className.text
        );
        lua.setNodePosition(localClassName, className);
    } else {
        localClassName = className;
    }

    result.push(...createClassSetup(context, classDeclaration, className, localClassName, extendedType));

    // Find first constructor with body
    const constructor = classDeclaration.members.find(
        (n): n is ts.ConstructorDeclaration => ts.isConstructorDeclaration(n) && n.body !== undefined
    );

    if (constructor) {
        // Add constructor plus initialization of instance fields
        const constructorResult = transformConstructorDeclaration(
            context,
            constructor,
            localClassName,
            instanceFields,
            properties,
            classDeclaration
        );

        if (constructorResult) result.push(constructorResult);

        // Legacy constructor decorator
        const decoratingExpression = createConstructorDecoratingExpression(context, constructor, localClassName);
        if (decoratingExpression) result.push(decoratingExpression);
    } else if (!extendedType) {
        // Generate a constructor if none was defined in a base class
        const constructorResult = transformConstructorDeclaration(
            context,
            ts.factory.createConstructorDeclaration([], [], ts.factory.createBlock([], true)),
            localClassName,
            instanceFields,
            properties,
            classDeclaration
        );

        if (constructorResult) result.push(constructorResult);
    } else if (properties.length > 0) {
        // Generate a constructor if none was defined in a class with instance fields that need initialization
        // localClassName.prototype.____constructor = function(self, ...)
        //     baseClassName.prototype.____constructor(self, ...)  // or unpack(arg) for Lua 5.0
        //     ...
        const constructorBody = transformClassInstanceFields(context, instanceFields, properties);
        const argsExpression =
            context.luaTarget === LuaTarget.Lua50
                ? lua.createCallExpression(lua.createIdentifier("unpack"), [lua.createArgLiteral()])
                : lua.createDotsLiteral();
        const constructorFunction = lua.createFunctionExpression(
            lua.createBlock(constructorBody),
            [createSelfIdentifier()],
            lua.createDotsLiteral(),
            lua.NodeFlags.Declaration
        );
        result.push(
            // [NGR Begin][maxstsun] add unlua constructor name
            lua.createAssignmentStatement(context.options.unlua ?
                                          createUnLuaConstructorName(localClassName) :
                                          createConstructorName(localClassName), constructorFunction, classDeclaration)
            // [NGR End]
        );
    }

    // Transform class members

    // First transform the methods, in case the static properties call them
    for (const member of classDeclaration.members) {
        if (ts.isMethodDeclaration(member)) {
            // Methods
            const statements = transformMethodDeclaration(context, member, localClassName);
            result.push(...statements);
        }
    }

    // Then transform the rest
    for (const member of classDeclaration.members) {
        if (ts.isAccessor(member)) {
            // Accessors
            const accessors = getAllAccessorDeclarations(classDeclaration);
            if (accessors.firstAccessor !== member) continue;

            const accessorsResult = transformAccessorDeclarations(context, accessors, localClassName);
            if (accessorsResult) {
                result.push(accessorsResult);
            }
        } else if (ts.isPropertyDeclaration(member)) {
            // Properties
            if (isStaticNode(member)) {
                const statement = transformStaticPropertyDeclaration(context, member, localClassName);
                if (statement) result.push(statement);
            }

            if (ts.getDecorators(member)?.length) {
                result.push(
                    lua.createExpressionStatement(createClassPropertyDecoratingExpression(context, member, className))
                );
            }
        } else if (ts.isClassStaticBlockDeclaration(member)) {
            if (member.body.statements.length > 0) {
                const bodyStatements = context.transformStatements(member.body.statements);
                const iif = lua.createFunctionExpression(lua.createBlock(bodyStatements), [
                    lua.createIdentifier("self"),
                ]);
                const iife = lua.createCallExpression(iif, [className]);
                result.push(lua.createExpressionStatement(iife, member));
            }
        }
    }

    // Decorate the class
    if (ts.canHaveDecorators(classDeclaration) && ts.getDecorators(classDeclaration)) {
        const decoratingExpression = createClassDecoratingExpression(context, classDeclaration, localClassName);
        const decoratingStatement = lua.createAssignmentStatement(localClassName, decoratingExpression);
        result.push(decoratingStatement);

        if (hasExportModifier(classDeclaration)) {
            const exportExpression = hasDefaultExportModifier(classDeclaration)
                ? createDefaultExportExpression(classDeclaration)
                : createExportedIdentifier(context, className);

            const classAssignment = lua.createAssignmentStatement(exportExpression, localClassName);
            result.push(classAssignment);
        }
    }

    context.classSuperInfos.pop();

    return { statements: result, name: className };
}

function getAllAccessorDeclarations(classDeclaration: ts.ClassLikeDeclaration): AllAccessorDeclarations {
    const getAccessor = classDeclaration.members.find(ts.isGetAccessor);
    const setAccessor = classDeclaration.members.find(ts.isSetAccessor);

    // Get the first of the two (that is not undefined)
    const firstAccessor =
        getAccessor && (!setAccessor || getAccessor.pos < setAccessor.pos) ? getAccessor : setAccessor!;

    return {
        firstAccessor,
        setAccessor,
        getAccessor,
    };
}

export const transformSuperExpression: FunctionVisitor<ts.SuperExpression> = (expression, context) => {
    const superInfos = context.classSuperInfos;
    const superInfo = superInfos[superInfos.length - 1];
    if (!superInfo) return lua.createAnonymousIdentifier(expression);
    const { className, extendedTypeNode } = superInfo;

    // [NGR Begin][maxstsun] fix super call mismatch in ngr class
    return lua.createTableIndexExpression(
        lua.createTableIndexExpression(
            lua.createTableIndexExpression(
                lua.createIdentifier("ClassLib"),
                lua.createStringLiteral(className.text)
            ),
            lua.createStringLiteral("__super")
        ),
        lua.createStringLiteral("__vtbl")
    );
    // [NGR End]
};
