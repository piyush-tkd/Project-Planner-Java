import React from 'react';
import { DrillCtx, GlobalFilterCtx } from './types';

const DrillContext = React.createContext<DrillCtx>({
  drill: null,
  setDrill: () => {},
  openDrawer: () => {},
});

const GlobalFilterContext = React.createContext<GlobalFilterCtx>({
  globalFilters: {},
  setGlobalFilters: () => {},
});

export { DrillContext, GlobalFilterContext };
