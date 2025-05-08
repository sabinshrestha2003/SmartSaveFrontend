import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {useAuth} from '../context/AuthContext';
import {ActivityIndicator, View} from 'react-native';
import colors from '../styles/colors';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Onboarding logic
import OnboardingScreen from '../screens/OnboardingScreen';
import InitialScreen from '../screens/InitialScreen';

// Main app screens
import TabNavigator from './TabNavigator';
import HomeScreen from '../screens/HomeScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import TransactionDetailsScreen from '../screens/TransactionDetailsScreen';
import EditTransactionScreen from '../screens/EditTransactionScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ExpenseBreakdownScreen from '../screens/ExpenseBreakdownScreen';
import SavingsTrendsScreen from '../screens/SavingsTrendsScreen';
import MonthlySummaryScreen from '../screens/MonthlySummaryScreen';
import AddGoalScreen from '../screens/AddGoalScreen';
import GoalDetailsScreen from '../screens/GoalDetailsScreen';
import EditGoalScreen from '../screens/EditGoalScreen';
import UpdateProgressScreen from '../screens/UpdateProgressScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import IncomeBreakdownScreen from '../screens/IncomeBreakdownScreen';
import BillSplittingDashboard from '../screens/BillSplittingDashboard';
import GroupDetails from '../screens/GroupDetails';
import NewExpense from '../screens/NewExpense';
import NewGroup from '../screens/NewGroup';
import AllGroupsScreen from '../screens/AllGroupsScreen';
import EditGroup from '../screens/EditGroup';
import SplitDetails from '../screens/SplitDetails';
import AllSplits from '../screens/AllSplits';
import SettleUp from '../screens/SettleUp';
import CollectUp from '../screens/CollectUp';
import EditSplit from '../screens/EditSplit';
import Notifications from '../screens/Notifications';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}>
        <ActivityIndicator size="large" color={colors.accentPurple} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="AddTransaction"
            component={AddTransactionScreen}
          />
          <Stack.Screen
            name="TransactionDetail"
            component={TransactionDetailsScreen}
          />
          <Stack.Screen
            name="EditTransaction"
            component={EditTransactionScreen}
          />
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Notifications" component={Notifications} />
          <Stack.Screen
            name="ExpenseBreakdown"
            component={ExpenseBreakdownScreen}
          />
          <Stack.Screen
            name="IncomeBreakdown"
            component={IncomeBreakdownScreen}
          />
          <Stack.Screen name="SavingsTrends" component={SavingsTrendsScreen} />
          <Stack.Screen
            name="MonthlySummary"
            component={MonthlySummaryScreen}
          />
          <Stack.Screen name="AddGoal" component={AddGoalScreen} />
          <Stack.Screen name="GoalDetails" component={GoalDetailsScreen} />
          <Stack.Screen name="EditGoal" component={EditGoalScreen} />
          <Stack.Screen
            name="UpdateProgress"
            component={UpdateProgressScreen}
          />
          <Stack.Screen
            name="BillSplittingDashboard"
            component={BillSplittingDashboard}
          />
          <Stack.Screen name="GroupDetails" component={GroupDetails} />
          <Stack.Screen name="NewExpense" component={NewExpense} />
          <Stack.Screen name="NewGroup" component={NewGroup} />
          <Stack.Screen name="AllGroups" component={AllGroupsScreen} />
          <Stack.Screen name="EditGroup" component={EditGroup} />
          <Stack.Screen name="SplitDetails" component={SplitDetails} />
          <Stack.Screen name="AllSplits" component={AllSplits} />
          <Stack.Screen name="SettleUp" component={SettleUp} />
          <Stack.Screen name="CollectUp" component={CollectUp} />
          <Stack.Screen name="EditSplit" component={EditSplit} />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Initial" component={InitialScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
