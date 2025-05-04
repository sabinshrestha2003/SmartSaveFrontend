import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MoreOptionsScreen from '../screens/MoreOptionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ExpenseBreakdownScreen from '../screens/ExpenseBreakdownScreen';
import IncomeBreakdownScreen from '../screens/IncomeBreakdownScreen';
import SavingsTrendsScreen from '../screens/SavingsTrendsScreen';
import MonthlySummaryScreen from '../screens/MonthlySummaryScreen';
import colors from '../styles/colors'; 

const Stack = createStackNavigator();

const MoreNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, 
        cardStyle: { backgroundColor: colors.background }, 
      }}
    >
      <Stack.Screen name="MoreOptions" component={MoreOptionsScreen} />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ tabBarStyle: { display: 'none' } }} 
      />
      <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen
        name="ExpenseBreakdown"
        component={ExpenseBreakdownScreen}
        options={{ tabBarStyle: { display: 'none' } }} 
      />
      <Stack.Screen
        name="IncomeBreakdown"
        component={IncomeBreakdownScreen}
        options={{ tabBarStyle: { display: 'none' } }} 
      />
      <Stack.Screen name="SavingsTrends" component={SavingsTrendsScreen} />
      <Stack.Screen name="MonthlySummary" component={MonthlySummaryScreen} />
    </Stack.Navigator>
  );
};

export default MoreNavigator;