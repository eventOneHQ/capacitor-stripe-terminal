import {
  Component,
  OnInit,
  Input,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core'
import { TerminalService } from '../services/terminal.service'
import {
  DiscoveryConfiguration,
  Reader,
  DiscoveryMethod
} from 'capacitor-stripe-terminal'
import { Subscription } from 'rxjs'
import { ModalController } from '@ionic/angular'

@Component({
  selector: 'app-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.scss']
})
export class DiscoverPage implements OnInit, OnDestroy {
  public DiscoveryMethod = DiscoveryMethod

  @Input() public discoveryConfig: DiscoveryConfiguration

  public searching = true
  public readers: Reader[]

  private discoverySubscription: Subscription

  constructor(
    private stripe: TerminalService,
    private modalCtrl: ModalController,
    private changeDetection: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.discoverySubscription = this.stripe.terminal
      .discoverReaders(this.discoveryConfig)
      .subscribe(
        (readers: Reader[]) => {
          this.readers = readers
          // for some reason, angular doesn't detect changes when we update the readers array so manually tell it to
          this.changeDetection.detectChanges()
        },
        err => {
          console.error(err)
          this.searching = false
          this.discoverySubscription = null
        },
        () => {
          this.searching = false
          this.discoverySubscription = null
        }
      )
  }

  ngOnDestroy() {
    this.stop()
  }

  stop() {
    if (this.discoverySubscription) {
      this.discoverySubscription.unsubscribe()
      this.discoverySubscription = null
    }
  }

  done() {
    this.stop()
    this.modalCtrl.dismiss()
  }

  async connectReader(reader: Reader) {
    await this.stripe.terminal.connectReader(reader)
    this.discoverySubscription = null

    this.done()
  }
}
