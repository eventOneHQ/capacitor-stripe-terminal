import { Plugins } from '@capacitor/core'
import { Observable } from 'rxjs'

import {
  StripeTerminalConfig,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus
} from './definitions'

const { StripeTerminal } = Plugins

export class StripeTerminalPlugin {
  private _fetchConnectionToken: () => Promise<string> = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')

  listeners: any = {}

  constructor(options: StripeTerminalConfig) {
    this._fetchConnectionToken = options.fetchConnectionToken

    StripeTerminal.initialize().then(() => {
      this.listeners['connectionTokenListener'] = StripeTerminal.addListener(
        'requestConnectionToken',
        () => {
          this._fetchConnectionToken()
            .then(token => {
              if (token) {
                StripeTerminal.setConnectionToken({ token }, null)
              } else {
                throw new Error(
                  'User-supplied `fetchConnectionToken` resolved successfully, but no token was returned.'
                )
              }
            })
            .catch(err =>
              StripeTerminal.setConnectionToken(
                null,
                err.message || 'Error in user-supplied `fetchConnectionToken`.'
              )
            )
        }
      )
    })
  }

  public discoverReaders(
    options: DiscoveryConfiguration
  ): Observable<Reader[]> {
    return new Observable(subscriber => {
      // start discovery
      StripeTerminal.discoverReaders(options)
        .then(() => {
          subscriber.complete()
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      StripeTerminal.addListener('readersDiscovered', (readers: any) => {
        subscriber.next(readers.readers)
      })

      return {
        unsubscribe: () => {
          StripeTerminal.abortDiscoverReaders()
          StripeTerminal.removeListener('readersDiscovered')
        }
      }
    })
  }

  public async connectReader(reader: Reader) {
    return StripeTerminal.connectReader(reader)
  }

  public async getConnectedReader() {
    return StripeTerminal.getConnectedReader()
  }

  public async getConnectionStatus() {
    return StripeTerminal.getConnectionStatus()
  }

  public connectionStatus(): Observable<ConnectionStatus> {
    return new Observable(subscriber => {
      let hasSentEvent = false

      // get current value
      StripeTerminal.getConnectionStatus()
        .then((status: any) => {
          // only send the inital value if the event listner hasn't already
          if (!hasSentEvent) {
            subscriber.next(status.status)
          }
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      // then listen for changes
      StripeTerminal.addListener('didChangeConnectionStatus', (status: any) => {
        hasSentEvent = true
        subscriber.next(status.status)
      })

      return {
        unsubscribe: () => {
          StripeTerminal.removeListener('didChangeConnectionStatus')
        }
      }
    })
  }

  public addListener(...opts: any[]) {
    return StripeTerminal.addListener(...opts)
  }

  public removeListener(...opts: any[]) {
    return StripeTerminal.removeListener(...opts)
  }
}
