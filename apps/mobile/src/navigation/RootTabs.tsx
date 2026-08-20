import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { BibleScreen } from '@/screens/BibleScreen';
import { CalendarHubScreen } from '@/screens/CalendarHubScreen';
import { CatechismScreen } from '@/screens/CatechismScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { CelebrationsScreen } from '@/screens/CelebrationsScreen';
import { ConversationsScreen } from '@/screens/ConversationsScreen';
import { DailyReadingsScreen } from '@/screens/DailyReadingsScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { GuidedPrayerScreen } from '@/screens/GuidedPrayerScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PrayerDetailScreen } from '@/screens/PrayerDetailScreen';
import { PrayersHubScreen } from '@/screens/PrayersHubScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SaintsScreen } from '@/screens/SaintsScreen';
import { SavedVersesScreen } from '@/screens/SavedVersesScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { StreakScreen } from '@/screens/StreakScreen';
import { ShareScreen } from '@/screens/ShareScreen';
import { SelectionSheet } from '@/components/SelectionSheet';
import { StreakCelebration } from '@/components/StreakCelebration';
import { useAppTheme } from '@/store/themeStore';

export type RootTabParamList = {
  Home: undefined;
  Bible: undefined;
  Catechism: undefined;
  Explore: undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Prayers: NavigatorScreenParams<PrayersStackParamList> | undefined; // from Home; hidden tab
  Ask: NavigatorScreenParams<AskStackParamList> | undefined; // from Home; hidden tab
  Profile: undefined; // reachable from Home; hidden from the tab bar
  Streak: undefined; // reachable from Home; hidden from the tab bar
  Share: undefined; // opened from the selection sheet; hidden from the tab bar
};

// Ask (hidden tab, opened from Home): the AI chat and its conversation history.
// Bible/Catechism are registered here too so citations tapped in the chat push
// them onto the stack and back returns to the conversation.
export type AskStackParamList = {
  Chat: { conversationId?: string } | undefined;
  Conversations: undefined;
  Bible: undefined;
  Catechism: undefined;
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
  SavedVerses: undefined;
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
  Ask: 'star-four-points-outline',
  Profile: 'account-circle-outline',
  Streak: 'fire',
  Share: 'share-variant-outline',
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const PrayersStack = createNativeStackNavigator<PrayersStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const AskStack = createNativeStackNavigator<AskStackParamList>();

function AskStackNavigator() {
  const c = useAppTheme();
  return (
    <AskStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
    >
      <AskStack.Screen name="Chat" component={ChatScreen} />
      <AskStack.Screen name="Conversations" component={ConversationsScreen} />
      <AskStack.Screen name="Bible" component={BibleScreen} />
      <AskStack.Screen name="Catechism" component={CatechismScreen} />
    </AskStack.Navigator>
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
      <ProfileStack.Screen name="SavedVerses" component={SavedVersesScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    </ProfileStack.Navigator>
  );
}

export function RootTabs() {
  const { t } = useTranslation();
  const c = useAppTheme();

  const tabBarStyle = { backgroundColor: c.bg, borderTopColor: c.border, borderTopWidth: 1 };

  return (
    <>
      <Tab.Navigator
        backBehavior="history"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle,
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
          name="Ask"
          component={AskStackNavigator}
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
            // Full-screen chat: no bottom tab bar while the Ask stack is focused.
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStackNavigator}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tab.Screen
          name="Streak"
          component={StreakScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
        <Tab.Screen
          name="Share"
          component={ShareScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
      </Tab.Navigator>
      <StreakCelebration />
      <SelectionSheet />
    </>
  );
}
