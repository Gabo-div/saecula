import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { BibleScreen } from '@/screens/BibleScreen';
import { CalendarHubScreen } from '@/screens/CalendarHubScreen';
import { CatechismHubScreen } from '@/screens/CatechismHubScreen';
import { CatechismPartScreen } from '@/screens/CatechismPartScreen';
import { CatechismReaderScreen } from '@/screens/CatechismReaderScreen';
import { CelebrationsScreen } from '@/screens/CelebrationsScreen';
import { DailyReadingsScreen } from '@/screens/DailyReadingsScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PrayersScreen } from '@/screens/PrayersScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SaintsScreen } from '@/screens/SaintsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useAppTheme } from '@/store/themeStore';

export type RootTabParamList = {
  Home: undefined;
  Bible: undefined;
  Catechism: undefined;
  Explore: undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Prayers: undefined; // reachable from Home; hidden from the tab bar
  Profile: undefined; // reachable from Home; hidden from the tab bar
};

// The Calendar tab hosts a stack: a hub of dated sections (daily readings,
// saints, celebrations) that push on top of it.
export type CalendarStackParamList = {
  CalendarHome: undefined;
  DailyReadings: { date?: string } | undefined;
  SaintsCalendar: undefined;
  Celebrations: undefined;
};

// The Catechism tab hosts a stack: the four-pillars index, then a scoped
// paragraph reader pushed on top.
export type CatechismStackParamList = {
  CatechismHome: undefined;
  CatechismPart: { partKey: string; title: string };
  CatechismReader: { from: number; to: number; title: string };
};

// The Profile tab hosts its own stack so Settings pushes on top of it.
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
};

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  Home: 'home-variant-outline',
  Bible: 'book-cross',
  Catechism: 'book-education-outline',
  Explore: 'compass-outline',
  Calendar: 'calendar-month-outline',
  Prayers: 'hands-pray',
  Profile: 'account-circle-outline',
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const CatechismStack = createNativeStackNavigator<CatechismStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function CatechismStackNavigator() {
  const c = useAppTheme();
  return (
    <CatechismStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
    >
      <CatechismStack.Screen name="CatechismHome" component={CatechismHubScreen} />
      <CatechismStack.Screen name="CatechismPart" component={CatechismPartScreen} />
      <CatechismStack.Screen name="CatechismReader" component={CatechismReaderScreen} />
    </CatechismStack.Navigator>
  );
}

function CalendarStackNavigator() {
  const c = useAppTheme();
  return (
    <CalendarStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
    >
      <CalendarStack.Screen name="CalendarHome" component={CalendarHubScreen} />
      <CalendarStack.Screen name="DailyReadings" component={DailyReadingsScreen} />
      <CalendarStack.Screen name="SaintsCalendar" component={SaintsScreen} />
      <CalendarStack.Screen name="Celebrations" component={CelebrationsScreen} />
    </CalendarStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const c = useAppTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    </ProfileStack.Navigator>
  );
}

export function RootTabs() {
  const { t } = useTranslation();
  const c = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Bible" component={BibleScreen} options={{ tabBarLabel: t('tabs.bible') }} />
      <Tab.Screen
        name="Catechism"
        component={CatechismStackNavigator}
        options={{ tabBarLabel: t('tabs.catechism') }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarLabel: t('tabs.explore') }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarStackNavigator}
        options={{ tabBarLabel: t('tabs.calendar') }}
      />
      <Tab.Screen
        name="Prayers"
        component={PrayersScreen}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}
