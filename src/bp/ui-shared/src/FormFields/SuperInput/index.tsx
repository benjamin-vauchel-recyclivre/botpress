import { Button, Icon } from '@blueprintjs/core'
import Tags from '@yaireo/tagify/dist/react.tagify'
import cx from 'classnames'
import React, { Fragment, useEffect, useRef, useState } from 'react'

import { lang } from '../../translations'
import { FieldProps } from '../../Contents/Components/typings'
import Dropdown from '../../Dropdown'
import Icons from '../../Icons'

import style from './style.scss'
import { SuperInputProps } from './typings'
import { convertToString, convertToTags } from './utils'

type Props = FieldProps & SuperInputProps

export default ({
  canAddElements = true,
  canPickEvents = true,
  defaultVariableType = 'string',
  events,
  multiple,
  variables,
  addVariable,
  setCanOutsideClickClose,
  onBlur,
  value
}: Props) => {
  const initialValue = useRef<string>((value && convertToTags(value)) || '')
  const newlyAddedVar = useRef<string[]>([])
  const currentPrefix = useRef<string>()
  const tagifyRef = useRef<any>()
  const [localVariables, setLocalVariables] = useState(variables?.map(({ name }) => name) || [])
  const [localEvents, setLocalEvents] = useState(events?.map(({ name }) => name) || [])
  const eventsDesc = events?.reduce((acc, event) => ({ ...acc, [event.name]: event.description }), {})
  // TODO implement the autocomplete selection when event selected is partial

  useEffect(() => {
    setLocalVariables(variables?.map(({ name }) => name) || [])
  }, [variables])

  useEffect(() => {
    setLocalEvents(events?.map(({ name }) => name) || [])
  }, [events])

  const tagifyCallbacks = {
    add: e => {
      onAddVariable(e.detail.data.value, tagifyRef.current.settings.whitelist)
    },
    ['dropdown:select']: e => {
      const value = e.detail.data.value
      const isAdding = !tagifyRef.current.settings.whitelist.includes(value)
      if (isAdding) {
        newlyAddedVar.current = [...newlyAddedVar.current, value]
      }
    },
    input: e => {
      const prefix = e.detail.prefix
      currentPrefix.current = prefix

      if (prefix && multiple) {
        if (prefix === '$') {
          tagifyRef.current.settings.whitelist = localVariables
        }

        if (prefix === '{{') {
          // TODO refactor to use the schema format properly and allow to breakdown into an object type search
          tagifyRef.current.settings.whitelist = localEvents
        }

        if (e.detail.value.length > 1) {
          e.detail.tagify.dropdown.show.call(e.detail.tagify, e.detail.value)
        }
      }
    },
    keydown: e => {
      const originalEvent = e.detail.originalEvent

      if ((originalEvent.ctrlKey || originalEvent.metaKey) && originalEvent.key === 'a') {
        document.execCommand('selectAll', true)
      }
    },
    ['dropdown:show']: e => {
      setCanOutsideClickClose?.(false)
    },
    ['edit:start']: e => {
      const prefix = e.detail.data.prefix

      if (prefix === '$') {
        tagifyRef.current.settings.whitelist = localVariables
      }

      if (prefix === '{{') {
        // TODO refactor to use the schema format properly and allow to breakdown into an object type search
        tagifyRef.current.settings.whitelist = localEvents
      }
    }
  }

  const onAddVariable = (value, list) => {
    const isAdding = !list.includes(value)

    if (isAdding) {
      const newVariable = {
        type: defaultVariableType,
        name: value
      }

      addVariable?.(newVariable)
    }
  }

  const addPrefix = prefix => {
    const input = tagifyRef.current?.DOM.input
    const lastChildNode = input.lastChild
    const isTag = lastChildNode?.getAttribute ? lastChildNode.getAttribute('class').includes('tagify__tag') : false
    let lastChild = lastChildNode?.wholeText || ''

    if (lastChild.endsWith('{{') || lastChild.endsWith('$')) {
      lastChild = lastChild.replace('{{', '').replace('$', '')
    }

    if (lastChildNode && !isTag) {
      const addSpace = !(lastChild.endsWith('&nbsp;') || lastChild.endsWith(' ') || input.innerTEXT === '')

      input.replaceChild(document.createTextNode(`${lastChild}${addSpace ? ' ' : ''}${prefix}`), lastChildNode)
    } else {
      input.appendChild(document.createTextNode(`${isTag ? ' ' : ''}${prefix}`))
    }

    moveCarretToEndOfString()
  }

  const moveCarretToEndOfString = () => {
    tagifyRef.current?.DOM.input.focus()
    document.execCommand('selectAll', false)
    document.getSelection()?.collapseToEnd()
    tagifyRef.current?.DOM.input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const getSingleTagHtml = () => {
    const tag =
      value &&
      JSON.parse(
        convertToTags(value)
          .replace('[[', '')
          .replace(']]', '')
      )

    return (
      tag && (
        <span contentEditable={false} title={tag.value} tabIndex={-1} className="tagify__tag">
          <span>
            <Icon icon={tag.prefix === '$' ? 'dollar' : <Icons.Brackets iconSize={10} />} iconSize={10} />
            <span className="tagify__tag-text">{tag.value}</span>
          </span>
        </span>
      )
    )
  }

  const singularTagKeyDown = e => {
    e.preventDefault()

    if (e.key === 'Backspace') {
      onBlur?.('')
    }
  }

  const filterSingularDropdown = (query, options) => {
    const addOption = [] as any[]
    if (
      query &&
      !options.find(option => {
        return query.toLowerCase() === option.label.toLowerCase() || query.toLowerCase() === option.value
      })
    ) {
      addOption.push({
        label: (
          <Fragment>
            <Icon icon="plus" iconSize={12} />
            {lang('create')} "{query}"
          </Fragment>
        ),
        value: query
      })
    }

    return [
      ...addOption,
      ...options.filter(option => `${option.label.toLowerCase()} ${option.value}`.indexOf(query.toLowerCase()) > -1)
    ]
  }

  if (!multiple) {
    return (
      <div className={style.superInputWrapper}>
        <div className={style.singularTagBtnWrapper}>
          {canPickEvents && (
            <Dropdown
              items={localEvents.map(name => ({ value: name, label: name }))}
              icon={<Icons.Brackets />}
              onChange={({ value }) => {
                onBlur?.(`{{${value}}}`)
              }}
            />
          )}
          <Dropdown
            items={localVariables.map(name => ({ value: name, label: name }))}
            icon="dollar"
            filterList={filterSingularDropdown}
            onChange={({ value }) => {
              onAddVariable(value, localVariables)
              onBlur?.(`$${value}`)
            }}
          />
        </div>
        <div className={style.superInput} onKeyDown={singularTagKeyDown} contentEditable suppressContentEditableWarning>
          {getSingleTagHtml()}
        </div>
      </div>
    )
  }

  return (
    <div className={style.superInputWrapper}>
      {
        <div className={style.tagBtnWrapper}>
          {canPickEvents && (
            <Button
              className={style.tagBtn}
              onClick={() => {
                addPrefix('{{')
              }}
              icon={<Icons.Brackets />}
            />
          )}
          <Button
            className={style.tagBtn}
            onClick={() => {
              addPrefix('$')
            }}
            icon="dollar"
          />
        </div>
      }
      <Tags
        className={style.superInput}
        tagifyRef={tagifyRef}
        settings={{
          dropdown: {
            classname: 'color-blue',
            enabled: 0,
            maxItems: 5,
            position: 'below',
            closeOnSelect: true,
            highlightFirst: true
          },
          templates: {
            dropdown(settings) {
              return (
                <div
                  className={cx(style.dropdown, 'tagify__dropdown tagify__dropdown--below')}
                  role="listbox"
                  aria-labelledby="dropdown"
                >
                  <div className="tagify__dropdown__wrapper"></div>
                </div>
              )
            },
            dropdownItem({ value, tagifySuggestionIdx }) {
              const isAdding = !tagifyRef.current.settings.whitelist.includes(value)
              const string = isAdding ? `"${value}"` : value

              if (isAdding && (currentPrefix.current === '{{' || !canAddElements)) {
                return null
              }

              return (
                <div
                  {...{ tagifysuggestionidx: tagifySuggestionIdx }}
                  className={cx('tagify__dropdown__item', { [style.addingItem]: isAdding })}
                  tabIndex={0}
                  role="option"
                >
                  {isAdding && (
                    <Fragment>
                      <Icon icon="plus" iconSize={12} />
                      {lang('create')}
                    </Fragment>
                  )}
                  {string}
                  <span className="description">{eventsDesc?.[value] || ''}</span>
                </div>
              )
            },
            tag({ prefix, value }) {
              const isInvalid = !(prefix === '$'
                ? [...localVariables, ...newlyAddedVar.current]
                : localEvents
              ).includes(value)

              return (
                <span
                  title={value}
                  contentEditable={false}
                  spellCheck={false}
                  tabIndex={-1}
                  className={cx('tagify__tag', { ['tagify--invalid']: isInvalid })}
                >
                  <span>
                    <Icon icon={prefix === '$' ? 'dollar' : <Icons.Brackets iconSize={10} />} iconSize={10} />
                    <span className="tagify__tag-text">{value}</span>
                  </span>
                </span>
              )
            }
          },
          duplicates: true,
          callbacks: tagifyCallbacks,
          mode: 'mix',
          pattern: canPickEvents ? /\$|{{/ : /\$/
        }}
        defaultValue={initialValue.current}
        onChange={e => {
          onBlur?.(convertToString(e.currentTarget.value))
        }}
      />
    </div>
  )
}
