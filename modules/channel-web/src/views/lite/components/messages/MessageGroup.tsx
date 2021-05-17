import classnames from 'classnames'
import { formatUrl } from 'common/url'
import { omit } from 'lodash'
import sortBy from 'lodash/sortBy'
import { inject } from 'mobx-react'
import React from 'react'

import { RootStore, StoreDef } from '../../store'
import { Message as MessageDetails } from '../../typings'

import { InlineFeedback } from './InlineFeedback'
import Message from './Message'

class MessageGroup extends React.Component<Props> {
  state = {
    hasError: false
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  /**
   * @deprecated 12.0
   * Here, we convert old format to the new format Botpress uses internally.
   * - payload: all the data (raw, whatever) that is necessary to display the element
   * - type: extracted from payload for easy sorting
   */
  convertPayloadFromOldFormat = data => {
    let payload = data.payload || data.message_data || data.message_raw || { text: data.message_text }
    if (!payload.type) {
      payload.type = data.message_type || data.message_data?.type || 'text'
    }

    // Keeping compatibility with old schema for the quick reply
    if (data.message_type === 'quick_reply' && !payload.text) {
      payload.text = data.message_text
    }

    if (data.message_type === 'file' && !payload.url) {
      payload.url = data.message_data?.url || data.message_raw?.url
    }

    if (this.props.messageWrapper && payload.type !== 'session_reset') {
      payload = {
        type: 'custom',
        module: this.props.messageWrapper.module,
        component: this.props.messageWrapper.component,
        wrapped: payload
      }
    }

    return payload
  }

  renderPayload = payload => {
    if (payload?.type === 'single-choice') {
      if (payload.isDropdown) {
        return {
          type: 'custom',
          module: 'extensions',
          component: 'Dropdown',
          message: payload.text,
          buttonText: '',
          displayInKeyboard: true,
          options: payload.choices.map(c => ({ label: c.title, value: c.value.toUpperCase() })),
          width: 300,
          placeholderText: payload.dropdownPlaceholder
        }
      }
      return {
        type: 'custom',
        module: 'channel-web',
        component: 'QuickReplies',
        quick_replies: payload.choices.map(c => ({
          title: c.title,
          payload: c.value.toUpperCase()
        })),
        disableFreeText: payload.disableFreeText,
        wrapped: {
          type: 'text',
          ...omit(payload, 'choices', 'type')
        }
      }
    } else if (payload?.type === 'image') {
      return {
        type: 'file',
        title: payload.title,
        url: formatUrl('', payload.image),
        collectFeedback: payload.collectFeedback
      }
    } else if (payload?.type === 'carousel') {
      return {
        text: ' ',
        type: 'carousel',
        collectFeedback: payload.collectFeedback,
        elements: payload.items.map(card => ({
          title: card.title,
          picture: card.image ? formatUrl('', card.image) : null,
          subtitle: card.subtitle,
          buttons: (card.actions || []).map(a => {
            if (a.action === 'Say something') {
              return {
                type: 'say_something',
                title: a.title,
                text: a.text
              }
            } else if (a.action === 'Open URL') {
              return {
                type: 'open_url',
                title: a.title,
                // TODO: fix url
                url: a.url && a.url.replace('BOT_URL', '') // data.BOT_URL)
              }
            } else if (a.action === 'Postback') {
              return {
                type: 'postback',
                title: a.title,
                payload: a.payload
              }
            } else {
              throw new Error(`Webchat carousel does not support "${a.action}" action-buttons at the moment`)
            }
          })
        }))
      }
    }

    return payload
  }

  render() {
    const { messages, avatar, isBot, showUserName, userName } = this.props

    const fromLabel = this.props.store.intl.formatMessage({
      id: this.props.isBot ? 'message.fromBotLabel' : 'message.fromMeLabel',
      defaultMessage: 'Me'
    })

    if (this.state.hasError) {
      return '* Cannot display message *'
    }

    return (
      <div
        role="main"
        className={classnames('bpw-message-big-container', {
          'bpw-from-user': !isBot,
          'bpw-from-bot': isBot
        })}
      >
        {avatar}
        <div role="region" className={'bpw-message-container'}>
          {showUserName && <div className={'bpw-message-username'}>{userName}</div>}
          <div aria-live="assertive" role="log" className={'bpw-message-group'}>
            <span data-from={fromLabel} className="from hidden" aria-hidden="true">
              {fromLabel}
            </span>
            {sortBy(messages, 'eventId').map((message, i, messages) => {
              const isLastMsg = i === messages.length - 1
              let payload = this.convertPayloadFromOldFormat(message)
              if (payload?.wrapped) {
                payload.wrapped = this.renderPayload(payload.wrapped)
              } else {
                payload = this.renderPayload(payload)
              }

              const showInlineFeedback =
                isBot && isLastMsg && (payload.wrapped ? payload.wrapped.collectFeedback : payload.collectFeedback)

              return (
                <Message
                  key={message.eventId}
                  isHighlighted={
                    this.props.highlightedMessages && this.props.highlightedMessages.includes(message.incomingEventId)
                  }
                  inlineFeedback={
                    showInlineFeedback && (
                      <InlineFeedback
                        intl={this.props.store.intl}
                        incomingEventId={message.incomingEventId}
                        onFeedback={this.props.onFeedback}
                        eventFeedbacks={this.props.store.eventFeedbacks}
                      />
                    )
                  }
                  noBubble={!!payload.noBubble}
                  fromLabel={fromLabel}
                  isLastOfGroup={i >= this.props.messages.length - 1}
                  isLastGroup={this.props.isLastGroup}
                  isBotMessage={!message.userId}
                  incomingEventId={message.incomingEventId}
                  payload={payload}
                  sentOn={message.sent_on}
                  onSendData={this.props.onSendData}
                  onFileUpload={this.props.onFileUpload}
                  bp={this.props.bp}
                  store={this.props.store}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }
}

export default inject(({ store }: { store: RootStore }) => ({
  store,
  bp: store.bp,
  onFeedback: store.sendFeedback,
  onSendData: store.sendData,
  onFileUpload: store.uploadFile,
  messageWrapper: store.messageWrapper,
  showUserName: store.config.showUserName,
  highlightedMessages: store.view.highlightedMessages
}))(MessageGroup)

type Props = {
  isBot: boolean
  avatar: JSX.Element
  userName: string
  messages: MessageDetails[]
  isLastGroup: boolean
  onFileUpload?: any
  onSendData?: any
  onFeedback?: any
  store?: RootStore
  highlightedMessages?: string[]
} & Pick<StoreDef, 'showUserName' | 'messageWrapper' | 'bp'>
