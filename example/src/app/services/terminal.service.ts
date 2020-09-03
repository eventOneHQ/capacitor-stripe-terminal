import { Platform } from '@ionic/angular'
import { Injectable, EventEmitter } from '@angular/core'
import { StripeTerminalPlugin } from 'capacitor-stripe-terminal'
import { ApiService } from './api.service'

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  public terminal: StripeTerminalPlugin

  public ready: EventEmitter<boolean> = new EventEmitter<boolean>()

  constructor(private api: ApiService, private platform: Platform) {
    this.init()
  }

  async init() {
    if (this.platform.is('android')) {
      await StripeTerminalPlugin.getPermissions()
    }

    // First, initialize the SDK
    this.terminal = new StripeTerminalPlugin({
      fetchConnectionToken: async () => {
        return this.api.fetchConnectionToken()
      }
    })

    // give the SDK a moment to initialize
    setTimeout(() => {
      this.ready.emit()
    }, 1000)
  }
}
