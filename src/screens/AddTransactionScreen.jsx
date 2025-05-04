import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ExpenseScreen from './ExpenseScreen';
import IncomeScreen from './IncomeScreen';
import colors from '../styles/colors';

const AddTransactionScreen = () => {
  const [activeTab, setActiveTab] = useState('Expense');
  const [loading, setLoading] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setLoading(false));
  }, []);

  const handleTransactionAdded = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: tab === 'Expense' ? 0 : 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [activeTab, fadeAnim, slideAnim]);

  const indicatorPosition = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  const expenseColor = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.errorRed, colors.textSecondary],
  });

  const incomeColor = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primaryGreen],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add {activeTab}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.tabContainer}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              left: indicatorPosition,
              backgroundColor: activeTab === 'Expense' ? colors.errorRedLight : colors.primaryGreenLight,
            },
          ]}
        />
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabChange('Expense')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-down-circle"
            size={20}
            color={activeTab === 'Expense' ? colors.errorRed : colors.textSecondary}
            style={styles.tabIcon}
          />
          <Animated.Text style={[styles.tabText, { color: expenseColor }]}>
            Expense
          </Animated.Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabChange('Income')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-up-circle"
            size={20}
            color={activeTab === 'Income' ? colors.primaryGreen : colors.textSecondary}
            style={styles.tabIcon}
          />
          <Animated.Text style={[styles.tabText, { color: incomeColor }]}>
            Income
          </Animated.Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {activeTab === 'Expense' ? (
          <ExpenseScreen onTransactionAdded={handleTransactionAdded} />
        ) : (
          <IncomeScreen onTransactionAdded={handleTransactionAdded} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 4,
    position: 'relative',
    height: 48,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabIndicator: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    borderRadius: 10,
    top: 0,
    zIndex: 0,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  contentContainer: {
    flex: 1,
    marginHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default AddTransactionScreen;