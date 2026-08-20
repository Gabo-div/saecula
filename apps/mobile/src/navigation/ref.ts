import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootTabParamList } from '@/navigation/RootTabs';

// Root navigation ref so components rendered OUTSIDE the navigator (e.g. the
// global selection sheet, a sibling of the Tab.Navigator) can still navigate.
export const navigationRef = createNavigationContainerRef<RootTabParamList>();
