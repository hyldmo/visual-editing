import {filter, fromEvent, take} from 'rxjs'
import {v4 as uuid} from 'uuid'
import {type ActorRefFrom, assign, fromEventObservable, sendParent, setup} from 'xstate'

import {MSG_RESPONSE, RESPONSE_TIMEOUT} from './constants'
import type {Message, MessageData, MessageType, ProtocolMessage, ResponseMessage} from './types'

/**
 * @public
 */
export interface RequestMachineContext<S extends Message> {
  connectionId: string
  data: MessageData | undefined
  domain: string
  expectResponse: boolean
  from: string
  id: string
  resolvable: PromiseWithResolvers<S['response']> | undefined
  response: S['response'] | null
  responseTo: string | undefined
  sources: Set<MessageEventSource>
  targetOrigin: string
  to: string
  type: MessageType
}

/**
 * @public
 */
export type RequestActorRef<S extends Message> = ActorRefFrom<
  ReturnType<typeof createRequestMachine<S>>
>

/**
 * @public
 */
export const createRequestMachine = <
  S extends Message,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
>() => {
  return setup({
    types: {} as {
      context: RequestMachineContext<S>
      // @todo Should response types be specified?
      events: {type: 'message'; data: ProtocolMessage<ResponseMessage>}
      emitted:
        | {
            type: 'request.success'
            requestId: string
            response: MessageData | null
            responseTo: string | undefined
          }
        | {type: 'request.failed'; requestId: string}
      input: {
        connectionId: string
        data?: S['data']
        domain: string
        expectResponse?: boolean
        from: string
        responseTo?: string
        resolvable?: PromiseWithResolvers<S['response']>
        sources: Set<MessageEventSource> | MessageEventSource
        targetOrigin: string
        to: string
        type: S['type']
      }
    },
    actors: {
      listen: fromEventObservable(
        ({input}: {input: {requestId: string; sources: Set<MessageEventSource>}}) =>
          fromEvent<MessageEvent<ProtocolMessage<ResponseMessage>>>(window, 'message').pipe(
            filter(
              (event) =>
                event.data.type === MSG_RESPONSE &&
                event.data.responseTo === input.requestId &&
                !!event.source &&
                input.sources.has(event.source),
            ),
            take(input.sources.size),
          ),
      ),
    },
    actions: {
      'send message': ({context}, params: {message: ProtocolMessage}) => {
        const {sources, targetOrigin} = context
        const {message} = params

        sources.forEach((source) => {
          source.postMessage(message, {targetOrigin})
        })
      },
      'on success': sendParent(({context, self}) => {
        if (context.response) {
          context.resolvable?.resolve(context.response)
        }
        return {
          type: 'request.success',
          requestId: self.id,
          response: context.response,
          responseTo: context.responseTo,
        }
      }),
      'on fail': sendParent(({context, self}) => {
        // eslint-disable-next-line no-console
        console.warn(
          `Received no response to message '${context.type}' on client '${context.from}' (ID: '${context.id}').`,
        )
        context.resolvable?.reject(new Error('No response received'))
        return {type: 'request.failed', requestId: self.id}
      }),
    },
    guards: {
      expectsResponse: ({context}) => context.expectResponse,
    },
    delays: {
      initialTimeout: 0,
      responseTimeout: RESPONSE_TIMEOUT,
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOlwgBswBiAD1gBd0GwT0AzFgJ2QNwdzoKAFVyowAewCuDItTRY8hUuSoBtAAwBdRKAAOE2P1wT8ukLUQBGAEwBWEgBYAnK+eOAzB7sB2DzY8rABoQAE9rDQc3V0cNTw8fAA4NHwBfVJCFHAJiElgwfAgCKGpNHSQQAyMBU3NLBDsrDxI7DTaAjQA2OOcNDxDwhHsNJx9Ou0TOq2cJxP9HdMyMbOU8gqL8ErUrcv1DY1qK+sbm1vaPLp6+gcRnGydo9wDGycWQLKVc9AB3dGNN6jiWCwdAwMrmKoHMxHRCJRKOEiJHwuZKBZwXKzBMKIGyYkhtAkXOweTqOHw2RJvD45Ug-P4CAH0JgsNicMA8LhwAz4fKicTSWTyZafWm-f5QcEVSE1aGgepwhFIlF9aYYrGDC4+JzEppjGzOUkeGbpDIgfASCBwczU5QQ-YyuqIAC0nRuCBd+IJXu9KSpwppZEoYDt1RMsosiEcNjdVjiJEeGisiSTHkcVgWpptuXyhWKIahjqGzi1BqRJINnVcdkcbuTLS9VYC8ISfsUAbp4vzDphCHJIyjBvJNlxNmRNexQ3sJGH43GPj8jWJrZWuXYfyoEC7YcLsbrgRsjkcvkmdgNbopVhIPhVfnsh8ClMz-tWsCkmEwcHgUvt257u8v+6Hse4xnhOdZnImVidPqCRNB4JqpEAA */
    context: ({input}) => {
      return {
        connectionId: input.connectionId,
        data: input.data,
        domain: input.domain,
        expectResponse: input.expectResponse ?? false,
        from: input.from,
        id: `msg-${uuid()}`,
        resolvable: input.resolvable,
        response: null,
        responseTo: input.responseTo,
        sources: input.sources instanceof Set ? input.sources : new Set([input.sources]),
        targetOrigin: input.targetOrigin,
        to: input.to,
        type: input.type,
      }
    },
    initial: 'idle',
    states: {
      idle: {
        after: {
          initialTimeout: 'sending',
        },
      },
      sending: {
        entry: {
          type: 'send message',
          params: ({context}) => {
            const {connectionId, data, domain, from, id, responseTo, to, type} = context
            const message = {
              connectionId,
              data,
              domain,
              from,
              id,
              to,
              type,
              responseTo,
            }
            return {message}
          },
        },
        always: [
          {
            guard: 'expectsResponse',
            target: 'awaiting',
          },
          'success',
        ],
      },
      awaiting: {
        invoke: {
          src: 'listen',
          input: ({context}) => ({
            requestId: context.id,
            sources: context.sources,
          }),
        },
        after: {
          responseTimeout: 'failed',
        },
        on: {
          message: {
            actions: assign({
              response: ({event}) => event.data.data,
              responseTo: ({event}) => event.data.responseTo,
            }),
            target: 'success',
          },
        },
      },
      failed: {
        type: 'final',
        entry: 'on fail',
      },
      success: {
        type: 'final',
        entry: 'on success',
      },
    },
    output: ({context, self}) => {
      const output = {
        requestId: self.id,
        response: context.response,
        responseTo: context.responseTo,
      }
      return output
    },
  })
}

// export const delayedRequestMachine = requestMachine.provide({
//   delays: {
//     initialTimeout: 500,
//   },
// })
