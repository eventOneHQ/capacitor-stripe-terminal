import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { IonicModule } from '@ionic/angular'

import { DiscoverPage } from './discover.page'

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule],
  entryComponents: [DiscoverPage],
  exports: [DiscoverPage],
  declarations: [DiscoverPage]
})
export class DiscoverPageModule {}
