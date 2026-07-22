import { createContext, useContext } from "react";

const AppNavigateContext = createContext(null);

export function AppNavigateProvider({ value, children }) {
  return <AppNavigateContext.Provider value={value}>{children}</AppNavigateContext.Provider>;
}

export function useAppNavigate() {
  return useContext(AppNavigateContext);
}
