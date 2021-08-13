import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'
import {
  DeviceType,
  DiscoveryMethod,
  ConnectionStatus,
  Reader
} from 'capacitor-stripe-terminal'
import { TerminalService } from '../services/terminal.service'
import { Subscription } from 'rxjs'
import { ModalController, Platform } from '@ionic/angular'
import { DiscoverPage } from '../discover/discover.page'

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit, OnDestroy {
  public DeviceType = DeviceType
  public DiscoveryMethod = DiscoveryMethod
  public ConnectionStatus = ConnectionStatus

  public discoveryConfig = {
    simulated: true,
    deviceType: DeviceType.Chipper2X,
    discoveryMethod: DiscoveryMethod.BluetoothProximity
  }

  public status = ConnectionStatus.NotConnected
  public connectedReader: Reader

  connectionStatusSubscription: Subscription

  public niceDeviceType = {
    [DeviceType.Chipper2X]: 'Chipper 2X'
  }

  constructor(
    private stripe: TerminalService,
    private changeDetector: ChangeDetectorRef,
    public platform: Platform,
    public modalController: ModalController
  ) {}

  ngOnInit() {
    this.stripe.ready.subscribe(() => {
      this.getStatus()
    })
  }

  ngOnDestroy() {
    if (this.connectionStatusSubscription) {
      this.connectionStatusSubscription.unsubscribe()
      this.connectionStatusSubscription = null
    }
  }

  async getStatus() {
    const currentStatus = await this.stripe.terminal.getConnectionStatus()
    this.newStatus(currentStatus)

    if (!this.connectionStatusSubscription) {
      this.connectionStatusSubscription = this.stripe.terminal
        .connectionStatus()
        .subscribe((newStatus) => {
          this.newStatus(newStatus)
        })
    }
  }

  async newStatus(status: ConnectionStatus) {
    this.status = status
    if (this.status === ConnectionStatus.Connected) {
      await this.getConnectedReader()
    }
    this.changeDetector.detectChanges()
  }

  async getConnectedReader() {
    const reader = await this.stripe.terminal.getConnectedReader()
    this.connectedReader = reader
  }

  async discoverReaders() {
    const modal = await this.modalController.create({
      component: DiscoverPage,
      componentProps: {
        discoveryConfig: this.discoveryConfig
      }
    })
    return await modal.present()
  }

  async disconnectReader() {
    await this.stripe.terminal.disconnectReader()
  }
}
