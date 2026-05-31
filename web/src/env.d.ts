/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    // Request-scoped memo of in-flight global-data fetches, keyed by
    // `${locale}:${preview}`. See getGlobalData.
    globalData?: Map<string, Promise<import('./cms/getGlobalData').GlobalData>>
  }
}
