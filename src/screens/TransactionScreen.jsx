import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated,
  SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import colors from '../styles/colors';
import { useTransaction } from '../context/TransactionContext';

const { width } = Dimensions.get('window');

const TransactionScreen = ({ navigation }) => {
  const { transactions, loading, error, fetchTransactions } = useTransaction();
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [dateFilter, setDateFilter] = useState('Today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [sortOption, setSortOption] = useState('Date');
  const [typeFilter, setTypeFilter] = useState('All');
  const [scrollY] = useState(new Animated.Value(0));

  const categoryIcons = {
    'Food': 'restaurant',
    'Transport': 'bus',
    'Shopping': 'cart',
    'Bills': 'document',
    'Health': 'medkit',
    'Entertainment': 'film',
    'Education': 'school',
    'Home': 'home',
    'Other': 'ellipsis-horizontal',
    'Salary': 'wallet',
    'Investment': 'trending-up',
    'Freelance': 'briefcase',
    'Gift': 'gift',
  };

  const categoryColors = {
    'Food': '#FF8C00',
    'Transport': '#4169E1',
    'Shopping': '#9932CC',
    'Bills': '#20B2AA',
    'Health': '#DC143C',
    'Entertainment': '#FF69B4',
    'Education': '#4682B4',
    'Home': '#32CD32',
    'Other': '#708090',
    'Salary': '#2E8B57',
    'Investment': '#DAA520',
    'Freelance': '#8A2BE2',
    'Gift': '#FF4500',
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions])
  );

  useEffect(() => {
    if (transactions) {
      filterTransactionsByDate(dateFilter);
    }
  }, [transactions, dateFilter, typeFilter, sortOption, startDate, endDate]);

  const filterTransactionsByDate = (filter) => {
    const now = new Date();
    let filtered = [...transactions];

    if (filter === 'Today') {
      filtered = transactions.filter(
        (txn) => new Date(txn.date).toDateString() === now.toDateString()
      );
    } else if (filter === 'Weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(now);
      endOfWeek.setHours(23, 59, 59, 999);
      filtered = transactions.filter((txn) => {
        const txnDate = new Date(txn.date);
        return txnDate >= startOfWeek && txnDate <= endOfWeek;
      });
    } else if (filter === 'Monthly') {
      filtered = transactions.filter(
        (txn) =>
          new Date(txn.date).getMonth() === now.getMonth() &&
          new Date(txn.date).getFullYear() === now.getFullYear()
      );
    } else if (filter === 'Annually') {
      filtered = transactions.filter(
        (txn) => new Date(txn.date).getFullYear() === now.getFullYear()
      );
    } else if (filter === 'Custom') {
      filtered = transactions.filter(
        (txn) =>
          new Date(txn.date) >= startDate && new Date(txn.date) <= endDate
      );
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter((txn) => txn.type === typeFilter.toLowerCase());
    }

    setFilteredTransactions(sortTransactions(filtered, sortOption));
  };

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
      setDateFilter('Custom');
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
      setDateFilter('Custom');
    }
  };

  const sortTransactions = (data, option) => {
    if (option === 'Amount') {
      return [...data].sort((a, b) => b.amount - a.amount);
    } else if (option === 'Date') {
      return [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return data;
  };

  const handleSortChange = (option) => {
    setSortOption(option);
    setFilteredTransactions(sortTransactions(filteredTransactions, option));
  };

  const handleTypeFilterChange = (type) => {
    setTypeFilter(type);
  };

  const calculateSummary = () => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((txn) => {
      if (txn.type === 'income') income += txn.amount;
      else expense += txn.amount;
    });
    return { income, expense, balance: income - expense };
  };

  const handleFabPress = () => {
    navigation.navigate('AddTransaction');
  };

  const summary = calculateSummary();

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primaryGreen} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Ionicons name="alert-circle-outline" size={50} color={colors.errorRed} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchTransactions} style={styles.retryButton}>
          <LinearGradient
            colors={[colors.primaryGreen, colors.primaryGreenDark]}
            style={styles.retryButtonGradient}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Animated Header */}
      <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
        <Text style={styles.header}>Transactions</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>
              +${summary.income.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expense</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>
              -${Math.abs(summary.expense).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text
              style={[
                styles.summaryValue,
                summary.balance >= 0 ? styles.incomeText : styles.expenseText,
              ]}
            >
              {summary.balance >= 0 ? '+' : '-'}${Math.abs(summary.balance).toFixed(2)}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Filters Section */}
      <View style={styles.filtersSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['Today', 'Weekly', 'Monthly', 'Annually', 'Custom']}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                dateFilter === item && styles.activeFilterButton,
              ]}
              onPress={() => setDateFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  dateFilter === item && styles.activeFilterText,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterScrollContainer}
        />

        {dateFilter === 'Custom' && (
          <View style={styles.dateRangeContainer}>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primaryGreen} />
              <Text style={styles.dateRangeText}>From: {startDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
            <Text style={styles.dateRangeSeparator}>to</Text>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.primaryGreen} />
              <Text style={styles.dateRangeText}>To: {endDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
          />
        )}

        <View style={styles.filterOptionsContainer}>
          <View style={styles.typeFilterContainer}>
            {['All', 'Income', 'Expense'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeFilterButton,
                  typeFilter === type && styles.activeTypeFilterButton,
                ]}
                onPress={() => handleTypeFilterChange(type)}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    typeFilter === type && styles.activeTypeFilterText,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sortContainer}>
            {['Amount', 'Date'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.sortButton,
                  sortOption === option && styles.activeSortButton,
                ]}
                onPress={() => handleSortChange(option)}
              >
                <Ionicons
                  name={option === 'Amount' ? 'cash-outline' : 'calendar-outline'}
                  size={16}
                  color={sortOption === option ? colors.white : colors.darkGray}
                />
                <Text
                  style={[
                    styles.sortText,
                    sortOption === option && styles.activeSortText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Transactions List */}
      <Animated.FlatList
        data={filteredTransactions}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.transactionItem}
            onPress={() =>
              navigation.navigate('TransactionDetail', {
                id: item.id,
                description: item.note,
                amount: item.amount.toString(),
                date: item.date,
                category: item.category,
                type: item.type,
              })
            }
          >
            <View style={styles.transactionIconContainer}>
              <LinearGradient
                colors={[categoryColors[item.category] || categoryColors.Other, '#FFFFFF']}
                style={styles.iconBackground}
              >
                <Ionicons
                  name={categoryIcons[item.category] || 'ellipsis-horizontal'}
                  size={20}
                  color={colors.matteBlack}
                />
              </LinearGradient>
            </View>
            <View style={styles.transactionMiddle}>
              <Text style={styles.transactionDescription} numberOfLines={1}>
                {item.note || 'No Description'}
              </Text>
              <Text style={styles.transactionDate}>
                {new Date(item.date).toLocaleString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })} • {item.category || 'Uncategorized'}
              </Text>
            </View>
            <View style={styles.transactionAmountContainer}>
              <Text
                style={[
                  styles.transactionAmount,
                  {
                    color: item.type === 'expense' ? colors.errorRed : colors.successGreen,
                  },
                ]}
              >
                {item.type === 'expense' ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
        style={styles.transactionsList}
        contentContainerStyle={styles.transactionsListContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color={colors.mediumGray} />
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubText}>Adjust your filters or add a new transaction</Text>
          </View>
        )}
      />

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleFabPress}>
        <LinearGradient
          colors={[colors.primaryGreen, colors.primaryGreenDark]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={30} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.white,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.matteBlack,
    marginBottom: 10,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  incomeText: {
    color: colors.successGreen,
  },
  expenseText: {
    color: colors.errorRed,
  },
  filtersSection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  filterScrollContainer: {
    paddingVertical: 5,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#F1F3F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 148, 0.1)', // Updated to match primaryGreen
  },
  filterText: {
    fontSize: 14,
    color: colors.darkGray,
    fontWeight: '600',
  },
  activeFilterButton: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  activeFilterText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    padding: 8,
    backgroundColor: colors.subtleAccent,
    borderRadius: 12,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  dateRangeText: {
    color: colors.matteBlack,
    marginLeft: 5,
    fontSize: 14,
  },
  dateRangeSeparator: {
    color: colors.darkGray,
    marginHorizontal: 10,
    fontSize: 14,
  },
  filterOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  typeFilterContainer: {
    flexDirection: 'row',
    flex: 3,
  },
  typeFilterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    marginRight: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 148, 0.1)', // Updated to match primaryGreen
  },
  typeFilterText: {
    fontSize: 13,
    color: colors.darkGray,
    fontWeight: '600',
  },
  activeTypeFilterButton: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  activeTypeFilterText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  sortContainer: {
    flexDirection: 'row',
    flex: 2,
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    marginLeft: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 148, 0.1)', // Updated to match primaryGreen
  },
  sortText: {
    fontSize: 13,
    color: colors.darkGray,
    marginLeft: 4,
    fontWeight: '600',
  },
  activeSortButton: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  activeSortText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  transactionsList: {
    flex: 1,
  },
  transactionsListContent: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: colors.cardBackground,
    marginVertical: 5,
    borderRadius: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  transactionIconContainer: {
    marginRight: 15,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionMiddle: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.matteBlack,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.mediumGray,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 15,
    color: colors.darkGray,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    marginBottom: 20,
    color: colors.errorRed,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: colors.matteBlack,
    fontSize: 18,
    marginTop: 10,
  },
  emptySubText: {
    color: colors.mediumGray,
    fontSize: 14,
    marginTop: 5,
  },
  fab: {
    position: 'absolute',
    bottom: 85,
    right: 30,
    elevation: 10,
    zIndex: 10,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TransactionScreen;