/** @internal */
export type PreviewUrlSecretSchemaIdPrefix = `sanity-preview-url-secret`

/** @internal */
export type PreviewUrlSecretSchemaIdToolName = 'presentation' | 'desk' | 'production-url' | string

/** @internal */
export type PreviewUrlSecretSchemaIdType =
  `${PreviewUrlSecretSchemaIdPrefix}.${PreviewUrlSecretSchemaIdToolName}`

/** @internal */
export type PreviewUrlSecretSchemaType = `sanity.previewUrlSecret`

/**
 * A subset type that's compatible with most SanityClient typings,
 * this makes it easier to use this package in libraries that may use `import type { SanityClient } from 'sanity'`
 * as well as those that use `import type { SanityClient } from '@sanity/client'`
 * @public
 */
export type SanityClientLike = {
  config(): {token?: string}
  withConfig(config: {
    apiVersion?: string
    useCdn?: boolean
    perspective?: 'published'
    resultSourceMap?: boolean
  }): SanityClientLike
  fetch<
    R,
    Q = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any
    },
  >(
    query: string,
    params: Q,
    options: {tag?: string},
  ): Promise<R>
}

/**
 * @alpha
 */
export interface PreviewUrlValidateUrlResult {
  isValid: boolean
  /**
   * If the URL is valid, and there's a parameter for what preview path to redirect to, it will be here
   */
  redirectTo?: string
  /**
   * If the URL is valid, and the studio URL is known and valid, then its origin will be here
   */
  studioOrigin?: string
}

/** @internal */
export interface ParsedPreviewUrl {
  secret: string
  redirectTo?: string
}

/** @public */
export interface PreviewUrlResolverOptions {
  /**
   * Leave empty if it's on the same origin as the Studio, or set to `location.origin` explicitly if that's what you want.
   * @defaultValue `location.origin`
   */
  origin?: string
  /**
   * The default preview relative URL (pathname and search), used when the URL to use is not yet known.
   * Otherwise the path that were last used will be restored, or the path used when navigating to the tool when using the `locate` API.
   * @example '/en/preview?q=shoes'
   * @defaultValue '/'
   */
  preview?: string
  /**
   * @deprecated - use `previewMode` instead
   */
  draftMode?: {
    /**
     * @deprecated - use `previewMode.enable` instead
     */
    enable: string
    /**
     * @deprecated - `previewMode` is deprecated, use `draftMode.shareAccess` instead
     */
    shareAccess?: never
    /**
     * @deprecated - use `previewMode.check` instead
     */
    check?: string
    /**
     * @deprecated - use `previewMode.disable` instead
     */
    disable?: string
  }
  /**
   * The API routes for setting the application's "Preview Mode"
   */
  previewMode?: {
    /**
     * The route that enables Preview Mode
     * @example '/api/preview'
     */
    enable: string
    /**
     * Allow sharing access to a preview with others.
     * This is enabled/disabled in the Presentation Tool. It's initially disabled, and can be enabled by someone who has access to creating draft documents in the Studio.
     * Custom roles can limit access to `_id in path("drafts.**") && _type == "sanity.previewUrlSecret"`.
     * This will create a secret that is valid until sharing is disabled. Turning sharing off and on again will create a new secret and can be used to remove access for folks that got the link in an email but should no longer have access.
     * Share URLs to previews will append this secret and give access to anyone who is given the URL, they don't need to be logged into the Studio or to Vercel.
     * Enabling sharing also has the effect of granting access to Presentation Tool in the Studio to Sanity users that otherwise don't have access to creating documents in the Studio,
     * and thus can't generate short-lived URL preview secrets.
     */
    shareAccess?: boolean
    /**
     * The route that reports if Preview Mode is enabled or not, useful for debugging
     * @example '/api/check-preview'
     * @deprecated - this API is not yet implemented
     */
    check?: string
    /**
     * The route that disables Preview Mode, useful for debugging
     * @example '/api/disable-preview'
     * @deprecated - this API is not yet implemented
     */
    disable?: string
  }
}

/** @internal */
export interface FetchSecretQueryParams {
  secret: string
}

/** @internal */
export type FetchSecretQueryResponse = {
  _id: string
  _updatedAt: string | null
  secret: string | null
  studioUrl: string | null
} | null

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
   * The initial perspective the Studio was using when starting to load the preview.
   * It can change over time and should also be handled with `postMessage` listeners.
   * The value can be arbitrary and has to be validated to make sure it's a valid perspective.
   */
  studioPreviewPerspective: string
  /**
   * If the user navigated to a preview path already, this will be the path
   */
  previewSearchParam?: string | null
  /**
   * If the Studio is embedded on the same origin it's necessary to know the base path of the Studio router to avoid infinite iframe embed recursion scenarios
   */
  studioBasePath?: string | null
}

/**
 * @internal
 */
export type PreviewUrlResolver<SanityClientType> = (
  context: PreviewUrlResolverContext<SanityClientType>,
) => Promise<string>
