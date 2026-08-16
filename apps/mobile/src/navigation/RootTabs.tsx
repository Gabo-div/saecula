import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { BibleScreen } from '@/screens/BibleScreen';
import { CalendarHubScreen } from '@/screens/CalendarHubScreen';
import { CatechismScreen } from '@/screens/CatechismScreen';
import { CelebrationsScreen } from '@/screens/CelebrationsScreen';
import { DailyReadingsScreen } from '@/screens/DailyReadingsScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { GuidedPrayerScreen } from '@/screens/GuidedPrayerScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PrayerDetailScreen } from '@/screens/PrayerDetailScreen';
import { PrayersHubScreen } from '@/screens/PrayersHubScreen';
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
  Prayers: NavigatorScreenParams<PrayersStackParamList> | undefined; // from Home; hidden tab
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

// Prayers (hidden tab, opened from Home): a hub of individual + guided
// prayers, each opening its own page.
export type PrayersStackParamList = {
  PrayersHome: undefined;
  PrayerDetail: { prayerId: string };
  GuidedPrayer: { guidedId: string };
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
const PrayersStack = createNativeStackNavigator<PrayersStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

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

function PrayersStackNavigator() {
  const c = useAppTheme();
  return (
    <PrayersStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
    >
      <PrayersStack.Screen name="PrayersHome" component={PrayersHubScreen} />
      <PrayersStack.Screen name="PrayerDetail" component={PrayerDetailScreen} />
      <PrayersStack.Screen name="GuidedPrayer" component={GuidedPrayerScreen} />
    </PrayersStack.Navigator>
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t('tabs.home'), tabBarButtonTestID: 'tab-home' }}
      />
      <Tab.Screen
        name="Bible"
        component={BibleScreen}
        options={{ tabBarLabel: t('tabs.bible'), tabBarButtonTestID: 'tab-bible' }}
      />
      <Tab.Screen
        name="Catechism"
        component={CatechismScreen}
        options={{ tabBarLabel: t('tabs.catechism'), tabBarButtonTestID: 'tab-catechism' }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarLabel: t('tabs.explore'), tabBarButtonTestID: 'tab-explore' }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarStackNavigator}
        options={{ tabBarLabel: t('tabs.calendar'), tabBarButtonTestID: 'tab-calendar' }}
      />
      <Tab.Screen
        name="Prayers"
        component={PrayersStackNavigator}
        options={({ route }) => {
          // The guided prayer takes over the full screen — no tab bar.
          const focused = getFocusedRouteNameFromRoute(route) ?? 'PrayersHome';
          return {
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
            tabBarStyle:
              focused === 'GuidedPrayer'
                ? { display: 'none' }
                : { backgroundColor: c.bg, borderTopColor: c.border, borderTopWidth: 1 },
          };
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
}
