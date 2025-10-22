import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/main/HomeScreen';
import { CampaignsScreen } from '../screens/campaigns/CampaignsScreen';
import { ContactsScreen } from '../screens/contacts/ContactsScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { CampaignDetailsScreen } from '../screens/campaigns/CampaignDetailsScreen';
import { CreateCampaignScreen } from '../screens/campaigns/CreateCampaignScreen';
import { ContactDetailsScreen } from '../screens/contacts/ContactDetailsScreen';
import { Icon } from '../components/common/Icon';
import { useTheme } from '../theme';
import { View } from 'react-native';

export type MainTabParamList = {
  Home: undefined;
  Campaigns: undefined;
  Contacts: undefined;
  Analytics: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CampaignDetails: { campaignId: string };
  CreateCampaign: undefined;
  ContactDetails: { contactId: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'home';

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Campaigns':
              iconName = 'campaign';
              break;
            case 'Contacts':
              iconName = 'contacts';
              break;
            case 'Analytics':
              iconName = 'analytics';
              break;
            case 'Profile':
              iconName = 'person';
              break;
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={iconName} size={size} color={color} />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.primary,
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          );
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Campaigns" component={CampaignsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CampaignDetails" component={CampaignDetailsScreen} />
      <Stack.Screen name="CreateCampaign" component={CreateCampaignScreen} />
      <Stack.Screen name="ContactDetails" component={ContactDetailsScreen} />
    </Stack.Navigator>
  );
};
