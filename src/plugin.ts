import { Plugins } from '@capacitor/core'

const { StripeTerminal } = Plugins

export interface StripeTerminalConfig {
  fetchConnectionToken: () => Promise<string>
}

export interface StripeTerminalDiscoveryConfiguration {
  simulated: boolean
}

export interface StripeTerminalReader {
    serialNumber: string
}

export class StripeTerminalPlugin {
  _fetchConnectionToken: () => Promise<string> = () =>
    Promise.reject('You must initialize StripeTerminalPlugin first.')

  listeners: any = {}

  constructor(options: StripeTerminalConfig) {
    this._fetchConnectionToken = options.fetchConnectionToken

    StripeTerminal.initialize().then(() => {
      this.listeners['connectionTokenListener'] = StripeTerminal.addListener(
        'requestConnectionToken',
        () => {
          console.log('requestConnectionToken was fired')
          this._fetchConnectionToken()
            .then(token => {
              if (token) {
                StripeTerminal.setConnectionToken(token, null)
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

  async discoverReaders(options: StripeTerminalDiscoveryConfiguration) {
    return StripeTerminal.discoverReaders(options)
  }

  async connectReader(reader: StripeTerminalReader) {
    return StripeTerminal.connectReader(reader)
  }

  addListener(...opts: any[]) {
    return StripeTerminal.addListener(...opts)
  }

  removeListener(...opts: any[]) {
    return StripeTerminal.removeListener(...opts)
  }
}
