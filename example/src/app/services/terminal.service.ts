import { Injectable } from '@angular/core'
import { StripeTerminalPlugin } from 'capacitor-stripe-terminal'
import { ApiService } from './api.service'

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  public terminal: StripeTerminalPlugin

  constructor(private api: ApiService) {
    // First, initialize the SDK
    this.terminal = new StripeTerminalPlugin({
      fetchConnectionToken: async () => {
        return this.api.fetchConnectionToken()
      }
    })
  }
}
