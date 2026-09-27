/**
 * App shell with a lightweight in-app navigator (no extra libraries).
 * Screens are pure functions receiving (nav, params).
 *
 * Android hardware back: navigates to the previous screen in the flow;
 * the app only exits from a root screen (login / dashboard / forced reset).
 */
import React, { useEffect, useReducer } from 'react';
import { StatusBar, BackHandler } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import UserCreationScreen from './src/screens/UserCreationScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DrillDownScreen from './src/screens/DrillDownScreen';
import SourceSelectScreen from './src/screens/SourceSelectScreen';
import LocalFarmerScreen from './src/screens/LocalFarmerScreen';
import LocalTraderScreen from './src/screens/LocalTraderScreen';
import OutsideTraderScreen from './src/screens/OutsideTraderScreen';
import NightArrivalScreen from './src/screens/NightArrivalScreen';
import VehicleMasterScreen from './src/screens/VehicleMasterScreen';
import LotDetailScreen from './src/screens/LotDetailScreen';
import LiveAuctionScreen from './src/screens/LiveAuctionScreen';
import BillingScreen from './src/screens/BillingScreen';
import CashierScreen from './src/screens/CashierScreen';
import CorrectionsScreen from './src/screens/CorrectionsScreen';
import AuditScreen from './src/screens/AuditScreen';

const SCREENS = {
  login: LoginScreen,
  forgotPassword: ForgotPasswordScreen,
  resetPassword: ResetPasswordScreen,
  userCreation: UserCreationScreen,
  dashboard: DashboardScreen,
  drillDown: DrillDownScreen,
  sourceSelect: SourceSelectScreen,
  localFarmer: LocalFarmerScreen,
  localTrader: LocalTraderScreen,
  outsideTrader: OutsideTraderScreen,
  nightArrival: NightArrivalScreen,
  vehicleMaster: VehicleMasterScreen,
  lotDetail: LotDetailScreen,
  liveAuction: LiveAuctionScreen,
  billing: BillingScreen,
  cashier: CashierScreen,
  corrections: CorrectionsScreen,
  audit: AuditScreen,
};

const initial = { stack: [{ name: 'login', params: {} }] };

function navReducer(state, action) {
  switch (action.type) {
    case 'push':
      return { stack: [...state.stack, { name: action.name, params: action.params || {} }] };
    case 'replace':
      return { stack: [...state.stack.slice(0, -1), { name: action.name, params: action.params || {} }] };
    case 'pop':
      return { stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack };
    case 'reset':
      return { stack: [{ name: action.name, params: action.params || {} }] };
    case 'home':
      return { stack: [{ name: 'dashboard', params: {} }] };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(navReducer, initial);
  const current = state.stack[state.stack.length - 1];
  const Screen_ = SCREENS[current.name];

  const nav = {
    push: (name, params) => dispatch({ type: 'push', name, params }),
    replace: (name, params) => dispatch({ type: 'replace', name, params }),
    pop: () => dispatch({ type: 'pop' }),
    reset: (name, params) => dispatch({ type: 'reset', name, params }),
    home: () => dispatch({ type: 'home' }),
    screen: current.name,
  };

  // Hardware back button: go one screen back; exit only at a root screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (state.stack.length > 1) {
        dispatch({ type: 'pop' });
        return true; // handled - do not exit the app
      }
      return false; // root screen - allow default (exit)
    });
    return () => sub.remove();
  }, [state.stack.length]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a5c1a" />
      <Screen_ nav={nav} params={current.params} />
    </>
  );
}
