import { Plugins } from '@capacitor/core'
import { Observable } from 'rxjs'

import {
  StripeTerminalConfig,
  DiscoveryConfiguration,
  Reader,
  ConnectionStatus,
  ReaderSoftwareUpdate,
  ReaderDisplayMessage,
  ReaderInputOptions,
  PaymentIntent
} from './definitions'

const { StripeTerminal } = Plugins

export class StripeTerminalPlugin {
  private _fetchConnectionToken: () => Promise<string> = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')

  private listeners: any = {}

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

  private _listenerToObservable(
    name: string,
    transformFunc?: (data: any) => any
  ): Observable<any> {
    return new Observable(subscriber => {
      const listener = StripeTerminal.addListener(name, (data: any) => {
        if (transformFunc) {
          return subscriber.next(transformFunc(data))
        }

        return subscriber.next(data)
      })

      return {
        unsubscribe: () => {
          listener.remove()
        }
      }
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

      const listener = StripeTerminal.addListener(
        'readersDiscovered',
        (readers: any) => {
          subscriber.next(readers.readers)
        }
      )

      return {
        unsubscribe: () => {
          StripeTerminal.abortDiscoverReaders()
          listener.remove()
        }
      }
    })
  }

  public async connectReader(reader: Reader): Promise<Reader> {
    try {
      const data = await StripeTerminal.connectReader(reader)

      return data.reader
    } catch (err) {
      throw err
    }
  }

  public async getConnectedReader(): Promise<Reader> {
    try {
      const data = await StripeTerminal.getConnectedReader()

      return data.reader
    } catch (err) {
      throw err
    }
  }

  public async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const data = await StripeTerminal.getConnectionStatus()

      return data.status
    } catch (err) {
      throw err
    }
  }

  public async disconnectReader(): Promise<void> {
    return StripeTerminal.disconnectReader()
  }

  public async checkForUpdate(): Promise<ReaderSoftwareUpdate> {
    try {
      const data = await StripeTerminal.checkForUpdate()

      return data && data.update
    } catch (err) {
      throw err
    }
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
      const listener = StripeTerminal.addListener(
        'didChangeConnectionStatus',
        (status: any) => {
          hasSentEvent = true
          subscriber.next(status.status)
        }
      )

      return {
        unsubscribe: () => {
          listener.remove()
        }
      }
    })
  }

  public installUpdate(): Observable<number> {
    return new Observable(subscriber => {
      // initiate the installation
      StripeTerminal.installUpdate()
        .then(() => {
          subscriber.complete()
        })
        .catch((err: any) => {
          subscriber.error(err)
        })

      // then listen for progress
      const listener = StripeTerminal.addListener(
        'didReportReaderSoftwareUpdateProgress',
        (data: any) => {
          subscriber.next(data.progress)
        }
      )

      return {
        unsubscribe: () => {
          StripeTerminal.abortInstallUpdate()
          listener.remove()
        }
      }
    })
  }

  public readerInput(): Observable<ReaderInputOptions> {
    return this._listenerToObservable('didRequestReaderInput', (data: any) => {
      return parseFloat(data.value)
    })
  }

  public readerDisplayMessage(): Observable<ReaderDisplayMessage> {
    return this._listenerToObservable(
      'didRequestReaderDisplayMessage',
      (data: any) => {
        return parseFloat(data.value)
      }
    )
  }

  public async retrievePaymentIntent(
    clientSecret: string
  ): Promise<PaymentIntent> {
    try {
      const data = await StripeTerminal.retrievePaymentIntent({ clientSecret })

      return data && data.intent
    } catch (err) {
      throw err
    }
  }

  public async collectPaymentMethod(): Promise<PaymentIntent> {
    try {
      const data = await StripeTerminal.collectPaymentMethod()

      return data && data.intent
    } catch (err) {
      throw err
    }
  }

  public async abortCollectPaymentMethod(): Promise<void> {
    return StripeTerminal.abortCollectPaymentMethod()
  }

  public async processPayment(): Promise<PaymentIntent> {
    try {
      const data = await StripeTerminal.processPayment()

      return data && data.intent
    } catch (err) {
      throw err
    }
  }

  public async clearCachedCredentials(): Promise<void> {
    return StripeTerminal.clearCachedCredentials()
  }

  public addListener(eventName: string, listenerFunc: Function) {
    return StripeTerminal.addListener(eventName, listenerFunc)
  }
}
