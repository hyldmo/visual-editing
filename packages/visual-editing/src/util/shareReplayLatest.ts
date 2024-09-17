// @todo potentially import this util from `sanity`
import {
  finalize,
  merge,
  Observable,
  share,
  tap,
  type MonoTypeOperatorFunction,
  type ShareConfig,
} from 'rxjs'

export type ShareReplayLatestConfig<T> = ShareConfig<T> & {predicate: (value: T) => boolean}

/**

 * A variant of share that takes a predicate function to determine which value to replay to new subscribers

 * @param predicate - Predicate function to determine which value to replay

 */

export function shareReplayLatest<T>(predicate: (value: T) => boolean): MonoTypeOperatorFunction<T>

/**

 * A variant of share that takes a predicate function to determine which value to replay to new subscribers

 * @param config - ShareConfig with additional predicate function

 */

export function shareReplayLatest<T>(
  config: ShareReplayLatestConfig<T>,
): MonoTypeOperatorFunction<T>

/**

 * A variant of share that takes a predicate function to determine which value to replay to new subscribers

 * @param configOrPredicate - Predicate function to determine which value to replay

 * @param config - Optional ShareConfig

 */

export function shareReplayLatest<T>(
  configOrPredicate: ShareReplayLatestConfig<T> | ShareReplayLatestConfig<T>['predicate'],

  config?: ShareConfig<T>,
): MonoTypeOperatorFunction<T> {
  return _shareReplayLatest(
    typeof configOrPredicate === 'function'
      ? {predicate: configOrPredicate, ...config}
      : configOrPredicate,
  )
}

function _shareReplayLatest<T>(config: ShareReplayLatestConfig<T>): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    let latest: T | undefined

    let emitted = false

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {predicate, ...shareConfig} = config

    const wrapped = source.pipe(
      tap((value) => {
        if (config.predicate(value)) {
          emitted = true

          latest = value
        }
      }),

      finalize(() => {
        emitted = false

        latest = undefined
      }),

      share(shareConfig),
    )

    const emitLatest = new Observable<T>((subscriber) => {
      if (emitted) {
        subscriber.next(latest)
      }

      subscriber.complete()
    })

    return merge(wrapped, emitLatest)
  }
}