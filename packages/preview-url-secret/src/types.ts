/** @internal */
export type PreviewUrlSecretSchemaIdPrefix = `sanity-preview-url-secret`

/** @internal */
export type PreviewUrlSecretSchemaIdToolName =
  | 'presentation'
  | 'desk'
  | 'production-url'
  | string

/** @internal */
export type PreviewUrlSecretSchemaIdType =
  `${PreviewUrlSecretSchemaIdPrefix}.${PreviewUrlSecretSchemaIdToolName}`

/** @internal */
export type PreviewUrlSecretSchemaType = `sanity.previewUrlSecret`

/**
 * A subset type that's compatible with most SanityClient typings,
 * this makes it easier to use this package in libraries that may use `import type { SanityClient } from 'sanity'`
 * as well as those that use `import type { SanityClient } from '@sanity/client'`
 * @internal
 */
export type SanityClientLike = {
  config(): { token?: string }
  withConfig(config: {
    apiVersion?: string
    useCdn?: boolean
    perspective: 'raw'
    resultSourceMap: boolean
  }): SanityClientLike
  fetch<
    R,
    Q = {
      [key: string]: any
    },
  >(
    query: string,
    params: Q,
    options: { tag?: string },
  ): Promise<R>
}

/** @internal */
export interface PreviewUrlResolverOptions {
  // origin: 'http://localhost:3000',
  origin: string
  // preview: '/en/preview', // Optional, it's '/' by default
  preview?: string
  // The API route that securely puts the app in a "Draft Mode"
  // Next.js docs: https://nextjs.org/docs/app/building-your-application/configuring/draft-mode
  draftMode: {
    /**
     * The route that enables Draft Mode
     * @example '/api/draft'
     */
    enable: string
    /**
     * A route that reports of Draft Mode is enabled or not, useful for debugging
     * @example '/api/check-draft'
     */
    check?: string
    /**
     * The route that disables Draft Mode, useful for debugging
     * @example '/api/disable-draft'
     */
    disable?: string
  }
}

/** @internal */
export interface PreviewUrlResolverContext<SanityClientType> {
  client: SanityClientType
  /**
   * A generated secret, used by `@sanity/preview-url-secret` to verify
   * that the application can securily preview draft content server side.
   * https://nextjs.org/docs/app/building-your-application/configuring/draft-mode
   */
  previewUrlSecret: string
  /**
   * If the user navigated to a preview path already, this will be the path
   *
   */
  previewSearchParam: string | undefined
}

/**
 * @internal
 */
export type PreviewUrlResolver<SanityClientType> = (
  context: PreviewUrlResolverContext<SanityClientType>,
) => Promise<string>
