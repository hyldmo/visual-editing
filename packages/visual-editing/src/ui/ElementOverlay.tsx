import {pathToUrlString} from '@repo/visual-editing-helpers'
import {DRAFTS_PREFIX} from '@repo/visual-editing-helpers/csm'
import {createEditUrl, studioPath} from '@sanity/client/csm'
import {DocumentIcon} from '@sanity/icons'
import {Box, Card, Flex, Text} from '@sanity/ui'
import {
  type CSSProperties,
  type FunctionComponent,
  memo,
  type MouseEvent,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
import {styled} from 'styled-components'

import type {
  ElementFocusedState,
  OverlayMsg,
  OverlayRect,
  SanityNode,
  SanityStegaNode,
  VisualEditingOptions,
  VisualEditingOverlayComponent,
} from '../types'
import {useOptimisticState} from './optimistic-state/useOptimisticState'
import {usePreviewSnapshots} from './preview/usePreviewSnapshots'
import {getField, getSchemaType} from './schema/schema'
import {useSchema} from './schema/useSchema'
import {UnionOverlay} from './UnionOverlay'

export interface ElementOverlayProps {
  id: string
  components?: VisualEditingOptions['components']
  dispatch: (msg: OverlayMsg) => void
  focused: ElementFocusedState
  hovered: boolean
  rect: OverlayRect
  node: SanityNode | SanityStegaNode
  showActions: boolean
  wasMaybeCollapsed: boolean
}

const Root = styled(Card)`
  background-color: var(--overlay-bg);
  border-radius: 3px;
  pointer-events: none;
  position: absolute;
  will-change: transform;
  box-shadow: var(--overlay-box-shadow);
  transition: none;
  flex-direction: column;
  justify-content: space-between;

  --overlay-bg: transparent;
  --overlay-box-shadow: inset 0 0 0 1px transparent;

  [data-overlays] & {
    --overlay-bg: color-mix(in srgb, transparent 95%, var(--card-focus-ring-color));
    --overlay-box-shadow: inset 0 0 0 2px
      color-mix(in srgb, transparent 50%, var(--card-focus-ring-color));
  }

  [data-fading-out] & {
    transition:
      box-shadow 1550ms,
      background-color 1550ms;

    --overlay-bg: rgba(0, 0, 255, 0);
    --overlay-box-shadow: inset 0 0 0 1px transparent;
  }

  &[data-focused] {
    --overlay-box-shadow: inset 0 0 0 1px var(--card-focus-ring-color);
  }

  &[data-hovered]:not([data-focused]) {
    transition: none;
    --overlay-box-shadow: inset 0 0 0 2px var(--card-focus-ring-color);
  }

  /* [data-unmounted] & {
    --overlay-box-shadow: inset 0 0 0 1px var(--card-focus-ring-color);
  } */

  :link {
    text-decoration: none;
  }
`

const Tab = styled(Flex)`
  bottom: 100%;
  cursor: pointer;
  pointer-events: none;
  position: absolute;
  left: 0;
`

const Labels = styled(Flex)`
  background-color: var(--card-focus-ring-color);
  right: 0;
  border-radius: 3px;
  & [data-ui='Text'],
  & [data-sanity-icon] {
    color: var(--card-bg-color);
    white-space: nowrap;
  }
`

const Actions = styled(Flex)`
  bottom: 100%;
  cursor: pointer;
  pointer-events: none;
  position: absolute;
  right: 0;

  [data-hovered] & {
    pointer-events: all;
  }
`

const ActionOpen = styled(Card)`
  background-color: var(--card-focus-ring-color);
  right: 0;
  border-radius: 3px;

  & [data-ui='Text'] {
    color: var(--card-bg-color);
    white-space: nowrap;
  }
`

function createIntentLink(node: SanityNode) {
  const {id, type, path, baseUrl, tool, workspace} = node

  return createEditUrl({
    baseUrl,
    workspace,
    tool,
    type: type!,
    id,
    path: pathToUrlString(studioPath.fromString(path)),
  })
}

function ComponentWrapper<T>(
  props: PropsWithChildren<{component: VisualEditingOverlayComponent<T>; sanity: SanityNode}>,
) {
  const {component: Component, sanity} = props
  const {commit, mutate, value} = useOptimisticState<T>(sanity)
  return (
    <div style={{pointerEvents: 'all'}} data-sanity-overlay-element>
      <Component node={sanity} mutate={mutate} commit={commit} value={value} />
    </div>
  )
}

const ElementOverlayInner: FunctionComponent<ElementOverlayProps> = (props) => {
  const {id, components, dispatch, focused, node, showActions} = props

  const {schema, resolvedTypes} = useSchema()
  const schemaType = getSchemaType(node, schema)
  const {field, parent} = getField(node, schemaType, resolvedTypes)

  const href = 'path' in node ? createIntentLink(node) : node.href

  const onBubbledEvent = useCallback(
    (event: MouseEvent) => {
      if (event.type === 'contextmenu') {
        dispatch({
          type: 'element/contextmenu',
          id,
          position: {
            x: event.clientX,
            y: event.clientY,
          },
          sanity: node,
        })
      } else if (event.type === 'click') {
        dispatch({
          type: 'element/click',
          id,
          sanity: node,
        })
      }
    },
    [dispatch, id, node],
  )

  const previewSnapshots = usePreviewSnapshots()

  const title = useMemo(() => {
    if (!('path' in node)) return undefined
    const id = 'isDraft' in node ? `${DRAFTS_PREFIX}${node.id}` : node.id
    return previewSnapshots.find((snapshot) => snapshot._id === id)?.title
  }, [node, previewSnapshots])

  const Icon = useMemo(() => {
    if (schemaType?.icon) return <div dangerouslySetInnerHTML={{__html: schemaType.icon}} />
    return <DocumentIcon />
  }, [schemaType?.icon])

  const component = useMemo(
    () =>
      components?.find((c) => {
        return (
          'path' in node &&
          c.name === node.type &&
          c.path === node.path &&
          c.type === field?.value.type
        )
      })?.component,
    [components, field, node],
  )

  return (
    <>
      {showActions ? (
        <Actions gap={1} paddingBottom={1}>
          <Box
            as="a"
            href={href}
            target="_blank"
            rel="noopener"
            // @ts-expect-error -- TODO update typings in @sanity/ui
            referrerPolicy="no-referrer-when-downgrade"
            data-sanity-overlay-element
          >
            <ActionOpen padding={2}>
              <Text size={1} weight="medium">
                Open in Studio
              </Text>
            </ActionOpen>
          </Box>
        </Actions>
      ) : null}

      {title && (
        <Tab gap={1} paddingBottom={1}>
          <Labels gap={2} padding={2}>
            <Text size={1}>{Icon}</Text>
            <Text size={1} weight="medium">
              {title}
            </Text>
          </Labels>
        </Tab>
      )}

      {'path' in node && parent && parent.type === 'union' && (
        <UnionOverlay node={parent} onBubbledEvent={onBubbledEvent} sanity={node} />
      )}
      {focused && component && 'path' in node && (
        <ComponentWrapper component={component} sanity={node} />
      )}
    </>
  )
}

export const ElementOverlay = memo(function ElementOverlay(props: ElementOverlayProps) {
  const {focused, hovered, rect, wasMaybeCollapsed} = props
  const ref = useRef<HTMLDivElement>(null)
  const scrolledIntoViewRef = useRef(false)

  const style = useMemo<CSSProperties>(
    () => ({
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      transform: `translate(${rect.x}px, ${rect.y}px)`,
    }),
    [rect],
  )

  useEffect(() => {
    if (!scrolledIntoViewRef.current && !wasMaybeCollapsed && focused === true && ref.current) {
      const target = ref.current
      scrollIntoView(ref.current, {
        // Workaround issue with scroll-into-view-if-needed struggling with iframes
        behavior: (actions) => {
          if (actions.length === 0) {
            // An empty actions list equals scrolling isn't needed
            return
          }
          // Uses native scrollIntoView to ensure iframes behave correctly
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          })
        },
        scrollMode: 'if-needed',
        block: 'center',
        inline: 'nearest',
      })
    }

    scrolledIntoViewRef.current = focused === true
  }, [focused, wasMaybeCollapsed])

  return (
    <Root
      data-focused={focused ? '' : undefined}
      data-hovered={hovered ? '' : undefined}
      ref={ref}
      style={style}
    >
      {hovered && <ElementOverlayInner {...props} />}
    </Root>
  )
})
