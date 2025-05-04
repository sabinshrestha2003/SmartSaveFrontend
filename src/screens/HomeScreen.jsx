import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../utils/api';
import colors from '../styles/colors';
import { useTransaction } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import { getNotifications } from '../utils/notifications';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [todaysTransactions, setTodaysTransactions] = useState([]);
  const [userName, setUserName] = useState('User');
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [monthlyBudget, setMonthlyBudget] = useState(2000);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const { transactions, loading, error, fetchTransactions } = useTransaction();
  const [scrollDirection, setScrollDirection] = useState('up');
  const [unreadCount, setUnreadCount] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const circleProgressAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  const fetchUserDetails = async () => {
    try {
      const response = await api.get('/user');
      if (response.data.success) {
        setUserName(response.data.user.name.split(' ')[0]);
      }
    } catch (err) {
      console.error('Error fetching user details:', err.message);
    }
  };

  const fetchSavingsGoals = async () => {
    try {
      const response = await api.get('/goals');
      setSavingsGoals(response.data);
    } catch (err) {
      console.error('Error fetching savings goals:', err.message);
    }
  };

  const fetchMonthlyExpenseData = async () => {
    setExpenseLoading(true);
    try {
      const currentMonthIdx = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthlyTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return (
          txnDate.getMonth() === currentMonthIdx &&
          txnDate.getFullYear() === currentYear &&
          txn.type === 'expense'
        );
      });

      const totalExpenses = monthlyTransactions.reduce(
        (sum, txn) => sum + parseFloat(txn.amount),
        0,
      );
      setMonthlyExpense(totalExpenses);
    } catch (err) {
      console.error('Error fetching monthly expense data:', err.message);
    } finally {
      setExpenseLoading(false);
    }
  };

  const filterTodaysTransactions = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTxns = transactions.filter(
      txn => txn.date && txn.date.startsWith(today),
    );
    setTodaysTransactions(todaysTxns);
  };

  const updateUnreadCount = async () => {
    try {
      const notifications = await getNotifications(user?.id);
      const unread = notifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Update unread count error:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUserDetails();
      fetchTransactions();
      fetchSavingsGoals();
      fetchMonthlyExpenseData();
      updateUnreadCount();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.back(1)),
          useNativeDriver: true,
        }),
        Animated.timing(fabAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      return () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(20);
        scaleAnim.setValue(0.9);
        fabAnim.setValue(0);
      };
    }, [fetchTransactions, user?.id])
  );

  useEffect(() => {
    filterTodaysTransactions();
    fetchMonthlyExpenseData();
  }, [transactions]);

  useEffect(() => {
    const expenseProgress =
      monthlyBudget > 0 ? (monthlyExpense / monthlyBudget) * 100 : 0;
    const totalTarget = savingsGoals.reduce(
      (sum, goal) => sum + goal.target,
      0,
    );
    const totalProgress = savingsGoals.reduce(
      (sum, goal) => sum + goal.progress,
      0,
    );
    const overallProgress =
      totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0;

    Animated.timing(progressAnim, {
      toValue: Math.min(expenseProgress, 100) / 100,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();

    Animated.timing(circleProgressAnim, {
      toValue: overallProgress / 100,
      duration: 1500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [monthlyExpense, monthlyBudget, savingsGoals]);

  const handleScroll = event => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    if (currentScrollY > lastScrollY.current && scrollDirection !== 'down') {
      setScrollDirection('down');
      Animated.timing(fabAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (
      currentScrollY < lastScrollY.current &&
      scrollDirection !== 'up'
    ) {
      setScrollDirection('up');
      Animated.timing(fabAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    lastScrollY.current = currentScrollY;
  };

  const limitedTransactions = todaysTransactions.slice(-4).reverse();
  const totalTarget = savingsGoals.reduce((sum, goal) => sum + goal.target, 0);
  const totalProgress = savingsGoals.reduce(
    (sum, goal) => sum + goal.progress,
    0,
  );
  const overallProgress =
    totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatCurrency = amount => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const categoryIcons = {
    Food: 'restaurant',
    Transport: 'bus',
    Shopping: 'cart',
    Bills: 'document',
    Health: 'medkit',
    Entertainment: 'film',
    Education: 'school',
    Home: 'home',
    Other: 'ellipsis-horizontal',
    Salary: 'wallet',
    Investment: 'trending-up',
    Freelance: 'briefcase',
    Gift: 'gift',
  };

  const categoryColors = {
    Food: '#FF8C00',
    Transport: '#4169E1',
    Shopping: '#9932CC',
    Bills: '#20B2AA',
    Health: '#DC143C',
    Entertainment: '#FF69B4',
    Education: '#4682B4',
    Home: '#32CD32',
    Other: '#708090',
    Salary: '#2E8B57',
    Investment: '#DAA520',
    Freelance: '#8A2BE2',
    Gift: '#FF4500',
  };

  const handleFabPress = () => {
    Animated.sequence([
      Animated.timing(fabAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fabAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => navigation.navigate('AddTransaction'));
  };

  const renderData = [
    { type: 'header', key: 'header' },
    { type: 'summary', key: 'summary' },
    { type: 'savings', key: 'savings' },
    { type: 'transactionsHeader', key: 'transactionsHeader' },
    ...(loading || error || limitedTransactions.length === 0
      ? [{ type: 'status', key: 'status' }]
      : limitedTransactions.map((item, index) => ({
          type: 'transaction',
          key: item.id,
          data: item,
          index,
        }))),
  ];

  const renderItem = ({ item, index }) => {
    switch (item.type) {
      case 'header':
        return (
          <Animated.View
            style={[
              styles.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.headerTitle}>{userName}!</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Notifications')}
                style={styles.headerButton}
              >
                <LinearGradient
                  colors={[colors.primaryGreen, colors.primaryGreenDark]}
                  style={styles.gradientButton}
                >
                  <Ionicons name="notifications-outline" size={24} color={colors.white} />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('UserProfile')}
                style={styles.headerButton}
              >
                <LinearGradient
                  colors={[colors.accentPurple, colors.accentPurpleDark]}
                  style={styles.gradientButton}
                >
                  <Ionicons name="person" size={24} color={colors.white} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      case 'summary':
        return (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
          >
            <TouchableOpacity
              style={styles.summaryCard}
              onPress={() => navigation.navigate('MonthlySummary')}
              activeOpacity={0.95}
            >
              <LinearGradient
                colors={[colors.secondaryBlue, colors.secondaryBlueDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Monthly Expense</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.white}
                  />
                </View>
                {expenseLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Text style={styles.summaryAmount}>
                      ${formatCurrency(monthlyExpense)}
                    </Text>
                    <View style={styles.progressBar}>
                      <Animated.View
                        style={[
                          styles.progressFill,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.summaryText}>
                      {((monthlyExpense / monthlyBudget) * 100).toFixed(0)}% of
                      ${formatCurrency(monthlyBudget)}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        );
      case 'savings':
        return (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
          >
            <TouchableOpacity
              style={styles.savingsCard}
              onPress={() => navigation.navigate('Savings')}
              activeOpacity={0.95}
            >
              <LinearGradient
                colors={[colors.primaryGreen, colors.primaryGreenDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Savings Progress</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.white}
                  />
                </View>
                <View style={styles.savingsContent}>
                  <View style={styles.chartContainer}>
                    <Svg height={90} width={90} viewBox="0 0 100 100">
                      <Defs>
                        <SvgGradient
                          id="grad"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <Stop offset="0%" stopColor={colors.accentGold} />
                          <Stop
                            offset="100%"
                            stopColor={colors.accentGoldDark}
                          />
                        </SvgGradient>
                      </Defs>
                      <Circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={colors.white}
                        strokeWidth="8"
                        fill="none"
                        opacity={0.2}
                      />
                      <AnimatedCircle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="url(#grad)"
                        strokeWidth="8"
                        strokeDasharray="251"
                        strokeDashoffset={circleProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [251, 0],
                        })}
                        strokeLinecap="round"
                        fill="none"
                        transform="rotate(-90, 50, 50)"
                      />
                    </Svg>
                    <Text style={styles.progressText}>
                      {`${overallProgress.toFixed(0)}%`}
                    </Text>
                  </View>
                  <View style={styles.savingsDetails}>
                    <Text style={styles.savingsAmount}>
                      ${formatCurrency(totalProgress)}
                    </Text>
                    <Text style={styles.savingsTarget}>
                      of ${formatCurrency(totalTarget)}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        );
      case 'transactionsHeader':
        return (
          <Animated.View
            style={[
              styles.transactionsHeader,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.sectionTitle}>Today's Transactions</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Transactions')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={colors.secondaryBlue}
              />
            </TouchableOpacity>
          </Animated.View>
        );
      case 'status':
        return (
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          >
            {loading ? (
              <ActivityIndicator
                size="large"
                color={colors.accentPurple}
                style={styles.loader}
              />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={24}
                  color={colors.errorRed}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={40}
                  color={colors.mediumGray}
                />
                <Text style={styles.emptyText}>No transactions today</Text>
              </View>
            )}
          </Animated.View>
        );
      case 'transaction':
        const categoryColor =
          categoryColors[item.data.category] || categoryColors['Other'];

        return (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  translateY: Animated.add(
                    slideAnim,
                    new Animated.Value(item.index * 10)
                  ),
                },
              ],
            }}
          >
            <TouchableOpacity
              style={styles.transactionItem}
              onPress={() =>
                navigation.navigate('TransactionDetail', { id: item.data.id })
              }
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[categoryColor, '#FFFFFF']}
                style={styles.iconBackground}
              >
                <Ionicons
                  name={
                    categoryIcons[item.data.category] || 'ellipsis-horizontal'
                  }
                  size={20}
                  color={colors.matteBlack}
                />
              </LinearGradient>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDescription} numberOfLines={1}>
                  {item.data.note || 'No Description'}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(item.data.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  {
                    color:
                      item.data.type === 'expense'
                        ? colors.errorRed
                        : colors.successGreen,
                  },
                ]}
              >
                {item.data.type === 'expense' ? '-' : '+'}$
                {formatCurrency(Math.abs(item.data.amount))}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <FlatList
        data={renderData}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      <Animated.View style={[styles.fab, { opacity: fabAnim }]}>
        <TouchableOpacity onPress={handleFabPress} activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.primaryGreen, colors.primaryGreenDark]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={30} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
  },
  gradientButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.errorRed,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 16,
    color: colors.darkGray,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.matteBlack,
  },
  profileGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    borderRadius: 20,
    marginBottom: 16,
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    overflow: 'hidden',
  },
  savingsCard: {
    borderRadius: 20,
    marginBottom: 24,
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    overflow: 'hidden',
  },
  gradientCard: {
    padding: 20,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentGold,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
  },
  savingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  progressText: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  savingsDetails: {
    flex: 1,
  },
  savingsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
  },
  savingsTarget: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.matteBlack,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.subtleAccent,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.secondaryBlue,
    fontWeight: '600',
    marginRight: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  iconBackground: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.matteBlack,
    marginBottom: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDate: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.subtleAccent,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.darkGray,
    marginTop: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 118, 117, 0.15)',
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.errorRed,
    marginLeft: 8,
  },
  loader: {
    marginVertical: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 85,
    right: 30,
    elevation: 8,
    shadowColor: colors.accentPurpleDark,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;