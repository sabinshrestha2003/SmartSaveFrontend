import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, StyleSheet, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import HomeScreen from '../screens/HomeScreen';
import SavingsScreen from '../screens/SavingsScreen';
import TransactionsScreen from '../screens/TransactionScreen';
import MoreNavigator from './MoreNavigator';
import BillSplittingDashboard from '../screens/BillSplittingDashboard';
import colors from '../styles/colors';

const Tab = createBottomTabNavigator();
const TAB_BAR_HEIGHT = 70;

const TabNavigator = ({ navigation, route }) => {
  const tabAnimations = {
    Home: useRef(new Animated.Value(0)).current,
    Savings: useRef(new Animated.Value(0)).current,
    Transactions: useRef(new Animated.Value(0)).current,
    BillSplitting: useRef(new Animated.Value(0)).current,
    More: useRef(new Animated.Value(0)).current,
  };

  // Custom tab bar icon component with animation
  const TabBarIcon = ({ route, focused, color, size }) => {
    let iconName;

    switch (route.name) {
      case 'Home':
        iconName = focused ? 'home' : 'home-outline';
        break;
      case 'Savings':
        iconName = focused ? 'wallet' : 'wallet-outline';
        break;
      case 'Transactions':
        iconName = focused ? 'receipt' : 'receipt-outline';
        break;
      case 'BillSplitting':
        iconName = focused ? 'people' : 'people-outline';
        break;
      case 'More':
        iconName = focused ? 'menu' : 'menu-outline';
        break;
      default:
        iconName = 'alert-circle-outline';
    }

    // Animate the active tab
    useEffect(() => {
      Animated.spring(tabAnimations[route.name], {
        toValue: focused ? 1 : 0,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }, [focused]);

    const scale = tabAnimations[route.name].interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.15],
    });

    const opacity = tabAnimations[route.name].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <View style={styles.iconContainer}>
        {focused && (
          <Animated.View style={[styles.activeIndicator, { opacity }]}>
            <LinearGradient
              colors={[colors.primaryGreen, colors.primaryGreenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeGradient}
            />
          </Animated.View>
        )}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name={iconName} size={size} color={color} />
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon route={route} focused={focused} color={color} size={size} />
          ),
          tabBarActiveTintColor: colors.primaryGreen, 
          tabBarInactiveTintColor: colors.darkGray,
          tabBarStyle: {
            position: 'absolute',
            height: TAB_BAR_HEIGHT,
            backgroundColor: colors.white,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            paddingTop: 10,
            borderTopWidth: 0,
            elevation: 12,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            paddingBottom: 4,
          },
          tabBarBackground: () => (
            <View style={styles.tabBarBackground}>
              <LinearGradient
                colors={[colors.white, colors.lightGray]} 
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.tabBarGradient}
              />
            </View>
          ),
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Home' }}
        />
        <Tab.Screen
          name="Savings"
          component={SavingsScreen}
          options={{ tabBarLabel: 'Savings' }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ tabBarLabel: 'Transactions' }}
        />
        <Tab.Screen
          name="BillSplitting"
          component={BillSplittingDashboard}
          options={{ tabBarLabel: 'Split Bills' }}
        />
        <Tab.Screen
          name="More"
          component={MoreNavigator}
          options={{ tabBarLabel: 'More' }}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  tabBarGradient: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 40,
  },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 24,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  activeGradient: {
    width: '100%',
    height: '100%',
  },
});

export default TabNavigator;