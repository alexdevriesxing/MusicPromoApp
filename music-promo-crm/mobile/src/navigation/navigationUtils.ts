import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

export function resetNavigation(routeName: string, params = {}) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: routeName, params }],
    });
  }
}

export function getCurrentRoute() {
  if (!navigationRef.isReady()) return null;
  
  let currentRoute = navigationRef.getCurrentRoute();
  while (currentRoute?.state?.index !== undefined) {
    const nestedState = currentRoute.state as any;
    currentRoute = nestedState.routes[nestedState.index];
  }
  
  return currentRoute;
}

export function getCurrentRouteName() {
  return getCurrentRoute()?.name;
}
