/// <reference types="mocha" />

declare module "@webwriter/build/test" {
  export function getMochaConfig(): Mocha.MochaOptions
}

// chai 6 ships no type declarations; only the assertions the tests use are listed.
declare module "chai" {
  type Assertion = (...args: any[]) => void
  export const assert: Record<
    | "closeTo" | "containsAllKeys" | "deepEqual" | "deepInclude" | "equal" | "exists" | "include"
    | "isAbove" | "isAtLeast" | "isAtMost" | "isBelow" | "isEmpty" | "isFalse" | "isNotNull" | "isNotOk"
    | "isNull" | "isTrue" | "isUndefined" | "lengthOf" | "notEqual" | "notInclude" | "notProperty" | "strictEqual",
    Assertion
  >
}

// lit-localize generates this module as JavaScript.
declare module "*/generated/locale-codes" {
  export const sourceLocale: string
  export const targetLocales: readonly string[]
}
