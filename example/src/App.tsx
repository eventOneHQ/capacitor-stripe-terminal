/**
 * App shell: Ionic setup, global styles, the Terminal provider, and the six
 * tabs that make up the UI.
 *
 *   POS       - a small point-of-sale: catalog, cart, checkout, receipt
 *   Reader    - find and connect to a card reader
 *   Charge    - enter an amount and collect a payment
 *   Activity  - payment history and a live log of SDK events
 *   Tools     - catalog of the SDK's other features (save card, inputs,
 *               cart display, printing, offline, capability checks...)
 *   Settings  - backend URL, simulator options, discovery method
 */
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import {
  cardOutline,
  hardwareChipOutline,
  settingsOutline,
  storefrontOutline,
  timeOutline,
  constructOutline,
} from 'ionicons/icons'
import { Redirect, Route } from 'react-router-dom'

/* Core Ionic CSS: required for components to render correctly. */
import '@ionic/react/css/core.css'
/* Optional Ionic CSS utilities (padding, typography, flex helpers, ...). */
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/padding.css'
import '@ionic/react/css/float-elements.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'
/* Dark mode follows the device setting. */
import '@ionic/react/css/palettes/dark.system.css'
/* Our own theme overrides. */
import './theme/variables.css'

import UpdateModal from './components/UpdateModal'
import PaymentModals from './components/PaymentModals'
import PosPage from './pos/PosPage'
import ActivityPage from './pages/ActivityPage'
import ChargePage from './pages/ChargePage'
import ReaderPage from './pages/ReaderPage'
import SettingsPage from './pages/SettingsPage'
import ToolsPage from './pages/ToolsPage'
import { TerminalProvider } from './terminal/TerminalProvider'

// Initialize Ionic's React bindings (platform detection, config).
setupIonicReact()

export default function App() {
  return (
    <IonApp>
      {/*
        TerminalProvider sits ABOVE the router so there is one SDK instance for
        the whole app. Switching tabs must not tear down the reader connection.
      */}
      <TerminalProvider>
        <PaymentModals />
        <UpdateModal />
        <IonReactRouter>
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/pos" component={PosPage} />
              <Route exact path="/reader" component={ReaderPage} />
              <Route exact path="/charge" component={ChargePage} />
              <Route exact path="/activity" component={ActivityPage} />
              <Route exact path="/tools" component={ToolsPage} />
              <Route exact path="/settings" component={SettingsPage} />
              <Route exact path="/">
                <Redirect to="/pos" />
              </Route>
            </IonRouterOutlet>

            {/* The tab bar. Each button's `tab` must match a Route path. */}
            <IonTabBar slot="bottom">
              <IonTabButton tab="pos" href="/pos">
                <IonIcon aria-hidden="true" icon={storefrontOutline} />
                <IonLabel>POS</IonLabel>
              </IonTabButton>
              <IonTabButton tab="reader" href="/reader">
                <IonIcon aria-hidden="true" icon={hardwareChipOutline} />
                <IonLabel>Reader</IonLabel>
              </IonTabButton>
              <IonTabButton tab="charge" href="/charge">
                <IonIcon aria-hidden="true" icon={cardOutline} />
                <IonLabel>Charge</IonLabel>
              </IonTabButton>
              <IonTabButton tab="activity" href="/activity">
                <IonIcon aria-hidden="true" icon={timeOutline} />
                <IonLabel>Activity</IonLabel>
              </IonTabButton>
              <IonTabButton tab="tools" href="/tools">
                <IonIcon aria-hidden="true" icon={constructOutline} />
                <IonLabel>Tools</IonLabel>
              </IonTabButton>
              <IonTabButton tab="settings" href="/settings">
                <IonIcon aria-hidden="true" icon={settingsOutline} />
                <IonLabel>Settings</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
      </TerminalProvider>
    </IonApp>
  )
}
