import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity, 
  ScrollView,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { ProgressBar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTransaction } from '../context/TransactionContext';
import api from '../utils/api';
import colors from '../styles/colors'; 

const TAB_BAR_HEIGHT = 70;

const MonthlySummaryScreen = ({ navigation }) => {
  const { transactions, loading: transLoading, fetchTransactions } = useTransaction();
  const [summary, setSummary] = useState({
    income: 0,
    expenses: 0,
    savings: 0,
  });
  const [totalTarget, setTotalTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchTransactions();
      await fetchSavingsData();
      setLoading(false);
    };

    fetchData();
  }, [fetchTransactions]);

  const fetchSavingsData = async () => {
    try {
      const trendsResponse = await api.get('/goals/trends?period=monthly');
      const { total_savings } = trendsResponse.data;
      
      const targetResponse = await api.get('/goals/total-target');
      setTotalTarget(targetResponse.data.total_target);

      const currentMonthIdx = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthlyTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate.getMonth() === currentMonthIdx && 
               txnDate.getFullYear() === currentYear;
      });

      const income = monthlyTransactions
        .filter(txn => txn.type === 'income')
        .reduce((sum, txn) => sum + parseFloat(txn.amount), 0);

      const expenses = monthlyTransactions
        .filter(txn => txn.type === 'expense')
        .reduce((sum, txn) => sum + parseFloat(txn.amount), 0);

      setSummary({
        income: income || 0,
        expenses: expenses || 0,
        savings: total_savings || 0,
      });
    } catch (err) {
      setError(err.message);
      Alert.alert('Error', 'Failed to load summary data. Please try again later.');
    }
  };

  const savingsPercentage = summary.income > 0 
    ? ((summary.savings / summary.income) * 100).toFixed(1) 
    : 0;

  const expensePercentage = summary.income > 0 
    ? ((summary.expenses / summary.income) * 100).toFixed(1) 
    : 0;

  const targetPercentage = totalTarget > 0 
    ? ((summary.savings / totalTarget) * 100).toFixed(1) 
    : 0;

  const getInsights = () => {
    const insights = [];

    if (summary.income === 0) {
      insights.push('💡 No income recorded this month. Add your income to track your progress!');
    } else if (savingsPercentage >= 50) {
      insights.push(`🌟 Excellent! You're saving ${savingsPercentage}% of your income—well above average!`);
    } else if (savingsPercentage >= 20) {
      insights.push(`👍 Good job saving ${savingsPercentage}% of your income. Aim for 50% to boost your goals!`);
    } else if (savingsPercentage > 0) {
      insights.push(`🛠 You're saving ${savingsPercentage}% of your income. Try increasing it to 20% or more!`);
    } else {
      insights.push('🚨 No savings this month. Start putting some income aside to meet your goals!');
    }

    if (summary.income === 0 && summary.expenses > 0) {
      insights.push(`⚠️ Expenses of $${summary.expenses.toFixed(2)} recorded without income. Review your spending!`);
    } else if (expensePercentage > 70) {
      insights.push(`📉 High spending alert! ${expensePercentage}% of your income goes to expenses. Cut back where possible.`);
    } else if (expensePercentage > 50) {
      insights.push(`🔔 ${expensePercentage}% of your income is spent. Consider reducing expenses to save more.`);
    } else if (expensePercentage > 0) {
      insights.push(`✅ Nice control! Only ${expensePercentage}% of your income is spent—room to save more!`);
    } else if (summary.expenses === 0 && summary.income > 0) {
      insights.push('🎉 Zero expenses this month! All your income is available for savings or investment.');
    }

    if (totalTarget === 0) {
      insights.push('🎯 No savings target set. Create a goal to track your progress!');
    } else if (targetPercentage >= 100) {
      insights.push(`🏆 Amazing! You've saved $${summary.savings.toFixed(2)}, exceeding your $${totalTarget.toFixed(2)} target!`);
    } else if (targetPercentage >= 75) {
      insights.push(`🌟 Almost there! You're at ${targetPercentage}% of your $${totalTarget.toFixed(2)} target—keep it up!`);
    } else if (targetPercentage >= 50) {
      insights.push(`📈 Halfway mark! You've saved ${targetPercentage}% of your $${totalTarget.toFixed(2)} target.`);
    } else if (targetPercentage > 0) {
      insights.push(`🚀 Progress made! You're at ${targetPercentage}% of your $${totalTarget.toFixed(2)} target—keep pushing!`);
    } else {
      insights.push(`⏳ No progress toward your $${totalTarget.toFixed(2)} target yet. Start saving this month!`);
    }

    return insights;
  };

  if (loading || transLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your summary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorCard}>
          <Icon name="alert-circle-outline" size={50} color={colors.errorRed} />
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchSavingsData()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>Monthly Summary</Text>
            <Text style={styles.subtitle}>{currentMonth}</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => fetchSavingsData()}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent} 
        >
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <TouchableOpacity 
              style={styles.cardWrapper} 
              onPress={() => navigation.navigate('IncomeBreakdown')}
              activeOpacity={0.7}
            >
              <View style={[styles.card, { backgroundColor: colors.incomeLight }]}>
                <Icon name="arrow-down-circle" size={20} color={colors.income} />
                <Text style={styles.cardLabel}>Income</Text>
                <Text style={[styles.cardValue, { color: colors.income }]}>${summary.income.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cardWrapper} 
              onPress={() => navigation.navigate('ExpenseBreakdown')}
              activeOpacity={0.7}
            >
              <View style={[styles.card, { backgroundColor: colors.expenseLight }]}>
                <Icon name="arrow-up-circle" size={20} color={colors.expense} />
                <Text style={styles.cardLabel}>Expenses</Text>
                <Text style={[styles.cardValue, { color: colors.expense }]}>${summary.expenses.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cardWrapper} 
              onPress={() => navigation.navigate('SavingsTrends')}
              activeOpacity={0.7}
            >
              <View style={[styles.card, { backgroundColor: colors.goldLight }]}>
                <Icon name="wallet" size={20} color={colors.gold} />
                <Text style={styles.cardLabel}>Savings</Text>
                <Text style={[styles.cardValue, { color: colors.gold }]}>${summary.savings.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Savings Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Savings Progress</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Target: ${totalTarget.toFixed(2)}</Text>
                <Text style={[styles.progressPercentage, { color: colors.gold }]}>{targetPercentage}%</Text>
              </View>
              <ProgressBar
                progress={totalTarget > 0 ? Math.min(summary.savings / totalTarget, 1) : 0}
                color={colors.gold}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                ${summary.savings.toFixed(2)} saved / ${Math.max(totalTarget - summary.savings, 0).toFixed(2)} to go
              </Text>
            </View>
          </View>

          {/* Distribution */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Income Distribution</Text>
            <View style={styles.distributionItem}>
              <Text style={styles.distributionLabel}>Expenses: {expensePercentage}%</Text>
              <View style={styles.distributionBar}>
                <View style={[styles.distributionFill, { width: `${expensePercentage}%`, backgroundColor: colors.expense }]} />
              </View>
            </View>
            <View style={styles.distributionItem}>
              <Text style={styles.distributionLabel}>Savings: {savingsPercentage}%</Text>
              <View style={styles.distributionBar}>
                <View style={[styles.distributionFill, { width: `${savingsPercentage}%`, backgroundColor: colors.income }]} />
              </View>
            </View>
          </View>

          {/* Insights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights</Text>
            {getInsights().map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddTransaction')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionButtonContent, { backgroundColor: colors.income }]}>
                <Icon name="add-circle" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>Add Transaction</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddGoal')}
              activeOpacity={0.7}
            >
              <View style={[styles.actionButtonContent, { backgroundColor: colors.primary }]}>
                <Icon name="flag" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>Set Goal</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_HEIGHT + 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingText: {
    color: colors.text,
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    width: '100%',
  },
  errorText: {
    color: colors.errorRed,
    fontSize: 16,
    marginVertical: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
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
  headerTitleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  refreshButton: {
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
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    padding: 15,
    alignItems: 'center',
    height: 120,
    justifyContent: 'space-between',
    borderRadius: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  progressContainer: {
    paddingVertical: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  distributionItem: {
    marginBottom: 15,
  },
  distributionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 5,
    fontWeight: '500',
  },
  distributionBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 4,
  },
  insightCard: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
});

export default MonthlySummaryScreen;