import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../utils/api';
import colors from '../styles/colors'; 

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

const categoryColors = [
  colors.errorRed, 
  colors.accentPurple, 
  colors.successGreen, 
  colors.gold, 
  colors.accentTeal, 
  colors.accentPurpleDark, 
  colors.accentPink, 
  colors.accentTealDark, 
];

const ExpenseBreakdownScreen = ({ navigation }) => {
  const [data, setData] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [startDate, setStartDate] = useState(new Date(new Date().setHours(0, 0, 0, 0)));
  const [endDate, setEndDate] = useState(new Date(new Date().setHours(23, 59, 59, 999)));
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [dateFilter, setDateFilter] = useState('Today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, [startDate, endDate]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/transactions');
      if (response.status === 200) {
        const transactions = response.data;
        const expenses = transactions.filter(
          txn =>
            txn.type === 'expense' &&
            new Date(txn.date) >= startDate &&
            new Date(txn.date) <= endDate
        );
        const categories = {};

        expenses.forEach(expense => {
          categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
        });

        const chartData = Object.keys(categories)
          .map((category, index) => ({
            name: category,
            amount: categories[category],
            color: categoryColors[index % categoryColors.length],
            legendFontColor: colors.matteBlack,
            legendFontSize: 12,
          }))
          .sort((a, b) => b.amount - a.amount);

        setData(chartData);
        setTotalExpense(expenses.reduce((sum, item) => sum + item.amount, 0));
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate.setHours(0, 0, 0, 0));
      setTempStartDate(newDate);
      if (Platform.OS === 'ios') setShowEndDatePicker(true);
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate.setHours(23, 59, 59, 999));
      setTempEndDate(newDate);
    }
  };

  const applyCustomDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setDateFilter('Custom');
    setShowCustomModal(false);
  };

  const filterTransactionsByDate = (filter) => {
    if (filter === 'Custom') {
      setShowCustomModal(true);
      setTempStartDate(startDate);
      setTempEndDate(endDate);
      return;
    }

    setDateFilter(filter);
    const now = new Date();
    let newStartDate, newEndDate;

    switch (filter) {
      case 'Today':
        newStartDate = new Date(now.setHours(0, 0, 0, 0));
        newEndDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'Weekly':
        newStartDate = new Date(now);
        newStartDate.setDate(now.getDate() - now.getDay());
        newStartDate.setHours(0, 0, 0, 0);
        newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + 6);
        newEndDate.setHours(23, 59, 59, 999);
        break;
      case 'Monthly':
        newStartDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        newEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'Annually':
        newStartDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        newEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  const formatDate = date =>
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatCurrency = amount =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const renderLegendItem = item => (
    <View key={item.name} style={styles.legendItem}>
      <View style={styles.legendContent}>
        <View style={styles.legendLeft}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendName}>{item.name}</Text>
        </View>
        <View style={styles.legendRight}>
          <Text style={styles.legendValue}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.legendPercent}>
            {((item.amount / totalExpense) * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View
          style={[styles.progress, { width: `${(item.amount / totalExpense) * 100}%`, backgroundColor: item.color }]}
        />
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="sad-outline" size={60} color={colors.mediumGray} />
      <Text style={styles.emptyText}>No expenses found</Text>
      <Text style={styles.emptySubtext}>Try a different date range</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back-outline" size={22} color={colors.matteBlack} />
          </TouchableOpacity>
          <Text style={styles.title}>Expense Breakdown</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {['Today', 'Weekly', 'Monthly', 'Annually', 'Custom'].map(filter => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterButton, dateFilter === filter && styles.activeFilter]}
                onPress={() => filterTransactionsByDate(filter)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, dateFilter === filter && styles.activeFilterText]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.dateRange}>
            {dateFilter === 'Custom' ? (
              <Text style={styles.dateText}>
                {formatDate(startDate)} - {formatDate(endDate)}
              </Text>
            ) : (
              <Text style={styles.dateText}>
                {dateFilter === 'Today'
                  ? 'Today'
                  : dateFilter === 'Weekly'
                  ? `Week of ${formatDate(startDate)}`
                  : dateFilter === 'Monthly'
                  ? formatDate(startDate).split(' ').slice(0, 2).join(' ')
                  : `Year ${startDate.getFullYear()}`}
              </Text>
            )}
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Expenses</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalExpense)}</Text>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.errorRed} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : data.length > 0 ? (
            <>
              <View style={styles.chartContainer}>
                <PieChart
                  data={data}
                  width={width - 40}
                  height={200}
                  chartConfig={{
                    backgroundColor: colors.background,
                    backgroundGradientFrom: colors.background,
                    backgroundGradientTo: colors.background,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: () => colors.matteBlack,
                  }}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="0" 
                  absolute
                  hasLegend={false}
                  center={[90, 0]} 
                  style={styles.chart}
                />
              </View>

              <Text style={styles.breakdownTitle}>Categories</Text>
              <View style={styles.legendList}>
                {data.map(item => renderLegendItem(item))}
              </View>
            </>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>

        <Modal
          visible={showCustomModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCustomModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>

              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Icon name="calendar-outline" size={20} color={colors.accentPurple} />
                <Text style={styles.datePickerText}>
                  Start: {formatDate(tempStartDate)}
                </Text>
              </TouchableOpacity>

              {showStartDatePicker && (
                <DateTimePicker
                  value={tempStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleStartDateChange}
                  maximumDate={tempEndDate}
                />
              )}

              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Icon name="calendar-outline" size={20} color={colors.accentPurple} />
                <Text style={styles.datePickerText}>
                  End: {formatDate(tempEndDate)}
                </Text>
              </TouchableOpacity>

              {showEndDatePicker && (
                <DateTimePicker
                  value={tempEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={tempStartDate}
                  maximumDate={new Date()}
                />
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCustomModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={applyCustomDates}
                  activeOpacity={0.7}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  container: { 
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerSpacer: { width: 40 },
  title: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: colors.matteBlack 
  },
  content: {
    padding: 20,
    paddingBottom: TAB_BAR_HEIGHT + 20, 
  },
  filterContainer: { 
    flexDirection: 'row', 
    paddingRight: 20, 
    marginBottom: 15 
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    marginRight: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterText: { 
    fontSize: 14, 
    color: colors.mediumGray, 
    fontWeight: '500' 
  },
  activeFilter: { 
    backgroundColor: colors.errorRed 
  },
  activeFilterText: { 
    color: colors.white, 
    fontWeight: '600' 
  },
  dateRange: { 
    marginBottom: 20, 
    alignItems: 'center' 
  },
  dateText: { 
    fontSize: 16, 
    color: colors.matteBlack,
    fontWeight: '500'
  },
  totalCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: colors.lightGray,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  totalLabel: { 
    fontSize: 16, 
    color: colors.mediumGray, 
    marginBottom: 5 
  },
  totalAmount: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: colors.errorRed 
  },
  chartContainer: {
    alignItems: 'center', 
    marginBottom: 20,
  },
  chart: { 
    borderRadius: 16,
  },
  breakdownTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: colors.matteBlack, 
    marginBottom: 15 
  },
  legendList: { 
    gap: 10 
  },
  legendItem: { 
    borderRadius: 12, 
    overflow: 'hidden',
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  legendContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  legendLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  legendDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    marginRight: 10 
  },
  legendName: { 
    fontSize: 16, 
    color: colors.matteBlack, 
    fontWeight: '500' 
  },
  legendRight: { 
    alignItems: 'flex-end' 
  },
  legendValue: { 
    fontSize: 16, 
    color: colors.errorRed, 
    fontWeight: '600' 
  },
  legendPercent: { 
    fontSize: 12, 
    color: colors.mediumGray, 
    marginTop: 2 
  },
  progressContainer: { 
    height: 4, 
    backgroundColor: colors.border 
  },
  progress: { 
    height: '100%' 
  },
  loading: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40 
  },
  loadingText: { 
    color: colors.mediumGray, 
    marginTop: 10, 
    fontSize: 16 
  },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 40 
  },
  emptyText: { 
    fontSize: 18, 
    color: colors.matteBlack, 
    marginTop: 15, 
    fontWeight: '500' 
  },
  emptySubtext: { 
    fontSize: 14, 
    color: colors.mediumGray, 
    marginTop: 5 
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.background,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.matteBlack,
    marginBottom: 20,
    textAlign: 'center',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  datePickerText: {
    fontSize: 16,
    color: colors.matteBlack,
    marginLeft: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.mediumGray,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.errorRed,
    alignItems: 'center',
    shadowColor: colors.errorRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  applyButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});

export default ExpenseBreakdownScreen;