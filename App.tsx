import FirstPermissions from './src/components/FirstPermissions';
import LegalPolicyScreen from './src/screens/LegalPolicyScreen';
import LegalConsentScreen from './src/screens/LegalConsentScreen';
import ContactScreen from './src/screens/ContactScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {initializeLanguage,useLanguage} from './src/i18n/language';
import MarketNotifications from './src/components/MarketNotifications';
import * as notificationData from './src/services/supabaseData';
import SellerStoreScreen from './src/screens/SellerStoreScreen';
import 'react-native-gesture-handler';

import React, { useCallback } from 'react';
import {
  StatusBar,
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAccountSession } from './src/services/useAccountSession';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  useNavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {
  createStackNavigator,
  type StackNavigationProp,
} from '@react-navigation/stack';
import {
  createDrawerNavigator,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CartProvider } from './src/context/CartContext';

import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import QuizScreen from './src/screens/QuizScreen';
import HomeScreen from './src/screens/HomeScreen';
import CustomDrawer from './src/components/CustomDrawer';
import SettingsScreen from './src/screens/SettingsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import CalendarCheckInScreen from './src/screens/CalendarCheckInScreen';
import MarketScreen from './src/screens/MarketScreen';
import DonationRecyclingScreen from './src/screens/DonationRecyclingScreen';
import MarketplaceWorkspaceScreen from './src/screens/MarketplaceWorkspaceScreen';
import ItemManagementScreen from './src/screens/ItemManagementScreen';
import AIAnalysisCaptureScreen from './src/screens/AIAnalysisCaptureScreen';
import AIAnalysisProcessingScreen from './src/screens/AIAnalysisProcessingScreen';
import AIAnalysisResultScreen from './src/screens/AIAnalysisResultScreen';
import AIAnalysisAdviceScreen from './src/screens/AIAnalysisAdviceScreen';
import AIAnalysisHistoryScreen from './src/screens/AIAnalysisHistoryScreen';
import AIAnalysisHistoryDetailScreen from './src/screens/AIAnalysisHistoryDetailScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import ChatScreen from './src/screens/ChatScreen';
import AddProductScreen from './src/screens/AddProductScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import CartScreen from './src/screens/CartScreen';
import MarketOrderDetailScreen from './src/screens/MarketOrderDetailScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';

import type { AiAnalysisHistoryRecord } from './src/services/photoTempStore';
import type { ChatItem } from './src/types/ai';

export type RootStackParamList = {
  LegalPolicy: {kind: 'terms' | 'privacy'};
  LegalConsent: undefined;
  Contact: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Quiz: undefined;
  Home: undefined;
  Settings: undefined;
  EditProfile: undefined;
  CalendarCheckIn: undefined;
  Market: undefined;
  MarketplaceWorkspace: { role?: 'buyer' | 'seller'; tab?: string };
  ItemManagement: undefined;
  DonationRecycling:
    | {
        itemCategory?: string;
        condition?: 'usable' | 'broken' | 'unsure';
        kind?: 'all' | 'donation' | 'recycle';
      }
    | undefined;

  AIAnalysisCapture: undefined;

  AIAnalysisProcessing:
    | {
        photoUri?: string;
      }
    | undefined;

  AIAnalysisResult:
    | {
        photoUri?: string;
        detectedItems?: ChatItem[];
      }
    | undefined;

  AIAnalysisAdvice:
    | {
        photoUri?: string;
        detectedItems?: ChatItem[];
      }
    | undefined;

  AIAnalysisHistory: undefined;

  AIAnalysisHistoryDetail: {
    record: AiAnalysisHistoryRecord;
  };

  AIChat:
    | {
        detectedItems?: ChatItem[];
        userPersona?: string;
        persona?: string;
      }
    | undefined;

  Chat: {
    product: any;
    conversationId?: string;
    orderId?: string;
    since?: string;
  };

  AddProduct:
    | {
        product?: any;
        itemName?: string;
        itemCategory?: string;
        itemImageUri?: string;
      }
    | undefined;

  ProductDetail: {
    product: any;
  };

  SellerStore: { sellerId: string };
  Cart: undefined;
  Checkout: { listingId?: string } | undefined;
  MarketOrderDetail: { orderId: string };
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;

export type HomeDrawerParamList = {
  HomeMain: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const Drawer = createDrawerNavigator<HomeDrawerParamList>();

const renderDrawerContent = (props: DrawerContentComponentProps) => (
  <CustomDrawer {...props} />
);

function HomeDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={renderDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: '70%',
        },
      }}
    >
      <Drawer.Screen name="HomeMain" component={HomeScreen} />
    </Drawer.Navigator>
  );
}

function AppContent() {
  const account = useAccountSession();
  const [publicDocument,setPublicDocument]=React.useState<'terms'|'privacy'|null>(null);
  const notificationNavigation = useNavigationContainerRef<any>();
  const openNotificationTarget = useCallback(
    async (target: notificationData.MarketNotification['target']) => {
      if (!notificationNavigation.isReady()) return;
      if (target.orderId)
        notificationNavigation.navigate('MarketOrderDetail', {
          orderId: target.orderId,
        });
      else if (target.listingId && target.conversationId) {
        const product = await notificationData.loadProduct(target.listingId);
        notificationNavigation.navigate('Chat', {
          product,
          conversationId: target.conversationId,
        });
      }
    },
    [notificationNavigation],
  );
  const { theme, isDarkMode } = useTheme();
  const navigationTheme = {
    ...(isDarkMode ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDarkMode ? DarkTheme : DefaultTheme).colors,
      background: theme.background,
      card: theme.cardBg,
      text: theme.textMain,
      primary: theme.primary,
      border: theme.border,
    },
  };
  if(publicDocument)return <LegalPolicyScreen route={{params:{kind:publicDocument}}} navigation={{goBack:()=>setPublicDocument(null)}}/>;
  if (!account.initialScreen)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
          padding: 24,
        }}
      >
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.textMain, marginTop: 16 }}>
          {account.error || '正在恢復登入…'}
        </Text>
        <View style={{flexDirection:'row',gap:20}}>{(['terms','privacy'] as const).map(kind=><TouchableOpacity key={kind} accessibilityRole="link" onPress={()=>setPublicDocument(kind)}><Text style={{color:theme.primary,paddingVertical:16}}>{kind==='terms'?'服務條款':'隱私權政策'}</Text></TouchableOpacity>)}</View>
        {!!account.error && (
          <TouchableOpacity accessibilityRole="button" onPress={account.retry}>
            <Text style={{ color: theme.primary, padding: 16 }}>重新嘗試</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  return (
    <NavigationContainer ref={notificationNavigation} theme={navigationTheme}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Stack.Navigator
        key={(account.accountId || 'signed-out') + (account.initialScreen==='LegalConsent'?'consent':'ready')}
        initialRouteName={account.initialScreen}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="LegalPolicy" component={LegalPolicyScreen} />
        <Stack.Screen name="Contact" component={ContactScreen} />
        {account.initialScreen==='LegalConsent' ? <Stack.Screen name="LegalConsent">{props=><LegalConsentScreen {...props} onAccepted={account.retry}/>}</Stack.Screen> : <>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />

        <Stack.Screen name="Register" component={RegisterScreen} />

        {!!account.accountId && <>
        <Stack.Screen name="Quiz" component={QuizScreen} />

        <Stack.Screen name="Home" component={HomeDrawer} />

        <Stack.Screen name="Settings" component={SettingsScreen} />

        <Stack.Screen name="EditProfile" component={EditProfileScreen} />

        <Stack.Screen
          name="CalendarCheckIn"
          component={CalendarCheckInScreen}
        />

        <Stack.Screen name="Market" component={MarketScreen} />
        <Stack.Screen
          name="MarketplaceWorkspace"
          component={MarketplaceWorkspaceScreen}
        />

        <Stack.Screen name="ItemManagement" component={ItemManagementScreen} />
        <Stack.Screen
          name="DonationRecycling"
          component={DonationRecyclingScreen}
        />

        <Stack.Screen
          name="AIAnalysisCapture"
          component={AIAnalysisCaptureScreen}
        />

        <Stack.Screen
          name="AIAnalysisProcessing"
          component={AIAnalysisProcessingScreen}
        />

        <Stack.Screen
          name="AIAnalysisResult"
          component={AIAnalysisResultScreen}
        />

        <Stack.Screen
          name="AIAnalysisAdvice"
          component={AIAnalysisAdviceScreen}
        />

        <Stack.Screen
          name="AIAnalysisHistory"
          component={AIAnalysisHistoryScreen}
        />

        <Stack.Screen
          name="AIAnalysisHistoryDetail"
          component={AIAnalysisHistoryDetailScreen}
        />

        <Stack.Screen name="AIChat" component={AIChatScreen} />

        <Stack.Screen name="Chat" component={ChatScreen} />

        <Stack.Screen name="AddProduct" component={AddProductScreen} />

        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />

        <Stack.Screen name="SellerStore" component={SellerStoreScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />

        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen
          name="MarketOrderDetail"
          component={MarketOrderDetailScreen}
        />
        </>}
        </>}
      </Stack.Navigator>
      {account.accountId && account.initialScreen!=='LegalConsent' && <MarketNotifications
        accountId={account.accountId}
        openTarget={openNotificationTarget}
      />}
    </NavigationContainer>
  );
}

export default function App() {
  useLanguage();
  React.useEffect(()=>{void initializeLanguage(AsyncStorage);},[]);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CartProvider>
          <AppContent />
          <FirstPermissions/>
        </CartProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
