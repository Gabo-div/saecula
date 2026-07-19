import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { BibleScreen } from '@/screens/BibleScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SaintsScreen } from '@/screens/SaintsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useAppTheme } from '@/store/themeStore';

export type RootTabParamList = {
  Home: undefined;
  Bible: undefined;
  Explore: undefined;
  Saints: undefined;
  Profile: undefined;
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
  Explore: 'compass-outline',
  Saints: 'account-heart-outline',
  Profile: 'account-circle-outline',
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

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
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarLabel: t('tabs.explore') }}
      />
      <Tab.Screen
        name="Saints"
        component={SaintsScreen}
        options={{ tabBarLabel: t('tabs.saints') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}
