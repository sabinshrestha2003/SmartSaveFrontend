import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ProgressBar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Collapsible from 'react-native-collapsible';
import api from '../utils/api';
import colors from '../styles/colors'; 

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

const SavingsTrendsScreen = ({ navigation }) => {
  const [summary, setSummary] = useState({
    totalSavings: 0,
    monthlyAvg: 0,
    highestMonth: '',
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [labels, setLabels] = useState(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalTarget, setTotalTarget] = useState(0);
  const [period, setPeriod] = useState('monthly');
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);

  const fetchSavingsTrends = async () => {
    try {
      const response = await api.get(`/goals/trends?period=${period}`);
      const data = response.data;
      setSummary({
        totalSavings: data.total_savings,
        monthlyAvg: data.monthly_avg,
        highestMonth: data.highest_month,
      });
      setMonthlyData(data.monthly_data);
      setLabels(data.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
    } catch (error) {
      setError(error.message);
      Alert.alert('Error', 'Failed to load savings trends. Please try again later.');
    }
  };

  const fetchTotalTarget = async () => {
    try {
      const response = await api.get('/goals/total-target');
      setTotalTarget(response.data.total_target);
    } catch (error) {
      setError(error.message);
      Alert.alert('Error', 'Failed to load total target. Please try again later.');
    }
  };

  const fetchStreak = async () => {
    try {
      const response = await api.get('/goals/streak');
      setStreak(response.data.streak);
    } catch (error) {
      console.error('Failed to fetch streak:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchSavingsTrends(), fetchTotalTarget(), fetchStreak()]);
      setLoading(false);
    };
    fetchData();
  }, [period]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchSavingsTrends(), fetchTotalTarget(), fetchStreak()]);
    setRefreshing(false);
  };

  const getInsights = () => {
    const { totalSavings, monthlyAvg, highestMonth } = summary;
    let insights = [];
    if (progressPercentage >= 100) {
      insights.push({ text: '🎉 Congratulations! You\'ve hit your savings goal!', icon: 'celebration' });
    } else if (progressPercentage >= 75) {
      insights.push({ text: '🌟 Almost there! Keep pushing to reach your goal.', icon: 'star' });
    } else if (progressPercentage >= 50) {
      insights.push({ text: '📈 Halfway done! Stay consistent.', icon: 'trending-up' });
    } else {
      insights.push({ text: '🛠 Progress underway. Try smaller milestones.', icon: 'build' });
    }

    if (monthlyAvg > 0) {
      insights.push({ text: `💰 You save $${monthlyAvg.toFixed(2)} monthly on average.`, icon: 'attach-money' });
    }

    if (highestMonth) {
      insights.push({ text: `📊 Peak savings in ${highestMonth}.`, icon: 'bar-chart' });
    }

    if (streak > 1) {
      insights.push({ text: `🔥 ${streak}-month savings streak!`, icon: 'local-fire-department' });
    }

    return insights;
  };

  const handleDataPointClick = (data, index) => {
    setSelectedDataPoint({
      value: data[index],
      label: labels[index],
    });
    setTimeout(() => setSelectedDataPoint(null), 3000);
  };

  const formatCurrency = amount =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.income} />
          <Text style={styles.loadingText}>Analyzing your savings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Icon name="error-outline" size={60} color={colors.errorRed} />
            <Text style={styles.errorText}>Something went wrong</Text>
            <Text style={styles.errorSubtext}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercentage = totalTarget > 0 ? (summary.totalSavings / totalTarget) * 100 : 0;
  const progressColor = progressPercentage >= 100
    ? colors.income
    : progressPercentage >= 75
    ? colors.teal
    : progressPercentage >= 50
    ? colors.gold
    : colors.warningAmber;

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
            <Icon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Trends</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.income]} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerCard}>
            <Text style={styles.title}>Savings Trends</Text>
            <Text style={styles.subtitle}>Your financial journey</Text>
          </View>

          <View style={styles.toggleContainer}>
            {['weekly', 'monthly', 'yearly'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleButton, period === p && styles.activeToggle]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, period === p && styles.activeToggleText]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.cardsContainer}>
            <View style={styles.card}>
              <View style={[styles.cardIconContainer, { backgroundColor: colors.incomeLight }]}>
                <Icon name="savings" size={24} color={colors.income} />
              </View>
              <Text style={styles.cardValue}>{formatCurrency(summary.totalSavings)}</Text>
              <Text style={styles.cardLabel}>Total Savings</Text>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardIconContainer, { backgroundColor: colors.goldLight }]}>
                <Icon name="trending-up" size={24} color={colors.gold} />
              </View>
              <Text style={styles.cardValue}>{formatCurrency(summary.monthlyAvg)}</Text>
              <Text style={styles.cardLabel}>Monthly Avg</Text>
            </View>

            <View style={styles.card}>
              <View style={[styles.cardIconContainer, { backgroundColor: colors.tealLight }]}>
                <Icon name="local-fire-department" size={24} color={colors.teal} />
              </View>
              <Text style={styles.cardValue}>{streak}</Text>
              <Text style={styles.cardLabel}>Month Streak</Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="flag" size={20} color={colors.income} />
              <Text style={styles.sectionTitle}>Savings Goal</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelContainer}>
                <Text style={styles.progressLabel}>Target: {formatCurrency(totalTarget)}</Text>
                <Text style={[styles.progressPercentage, { color: progressColor }]}>
                  {progressPercentage.toFixed(1)}%
                </Text>
              </View>
              <ProgressBar
                progress={totalTarget > 0 ? summary.totalSavings / totalTarget : 0}
                color={progressColor}
                style={styles.progressBar}
              />
              <View style={styles.progressDetailsContainer}>
                <Text style={styles.progressDetailText}>{formatCurrency(summary.totalSavings)} saved</Text>
                <Text style={styles.progressDetailText}>
                  {formatCurrency(totalTarget - summary.totalSavings)} to go
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Icon name="show-chart" size={20} color={colors.income} />
              <Text style={styles.sectionTitle}>Savings Growth</Text>
            </View>
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: labels,
                  datasets: [
                    {
                      data: monthlyData.length ? monthlyData : [0],
                      color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Matches colors.income
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={width - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.background,
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, 
                  labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`, 
                  style: { borderRadius: 16 },
                  propsForDots: { r: '6', strokeWidth: '2', stroke: colors.income },
                  propsForLabels: { fontSize: 12, fontWeight: 'bold' },
                  propsForBackgroundLines: { strokeDasharray: '', stroke: colors.border },
                }}
                bezier
                style={styles.chart}
                onDataPointClick={({ value, dataset, index }) => handleDataPointClick(dataset.data, index)}
                renderDotContent={({ x, y, index, indexData }) =>
                  selectedDataPoint && selectedDataPoint.value === indexData ? (
                    <View style={[styles.tooltip, { top: y - 40, left: x - 40 }]}>
                      <Text style={styles.tooltipLabel}>{selectedDataPoint.label}</Text>
                      <Text style={styles.tooltipValue}>{formatCurrency(selectedDataPoint.value)}</Text>
                    </View>
                  ) : null
                }
                fromZero
                yAxisSuffix=""
                yAxisInterval={1}
                segments={5}
              />
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <TouchableOpacity
              style={styles.insightsHeader}
              onPress={() => setIsInsightsCollapsed(!isInsightsCollapsed)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeader}>
                <Icon name="lightbulb" size={20} color={colors.gold} />
                <Text style={styles.sectionTitle}>Insights & Tips</Text>
              </View>
              <Icon
                name={isInsightsCollapsed ? 'expand-more' : 'expand-less'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <Collapsible collapsed={isInsightsCollapsed}>
              <View style={styles.insightsContainer}>
                {getInsights().map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <View style={[styles.insightIconContainer, { backgroundColor: colors.incomeLight }]}>
                      <Icon name={insight.icon} size={20} color={colors.income} />
                    </View>
                    <Text style={styles.insightText}>{insight.text}</Text>
                  </View>
                ))}
              </View>
            </Collapsible>
          </View>
        </ScrollView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: colors.background
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
    fontWeight: '500' 
  },
  content: { 
    padding: 20, 
    paddingBottom: TAB_BAR_HEIGHT + 20 
  },
  headerCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    backgroundColor: colors.incomeLight,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: colors.text, 
    marginBottom: 4 
  },
  subtitle: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    fontWeight: '500' 
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 25,
    padding: 4,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeToggle: { 
    backgroundColor: colors.income 
  },
  toggleText: { 
    color: colors.textSecondary, 
    fontWeight: '600', 
    fontSize: 14 
  },
  activeToggleText: { 
    color: colors.white, 
    fontWeight: '700' 
  },
  cardsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardValue: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.text, 
    marginBottom: 4 
  },
  cardLabel: { 
    fontSize: 12, 
    color: colors.textSecondary, 
    fontWeight: '500' 
  },
  sectionContainer: {
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
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: colors.text, 
    marginLeft: 8 
  },
  progressContainer: {},
  progressLabelContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  progressLabel: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    fontWeight: '500' 
  },
  progressPercentage: { 
    fontSize: 14, 
    fontWeight: '700', 
  },
  progressBar: { 
    height: 12, 
    borderRadius: 6, 
    marginBottom: 10 
  },
  progressDetailsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  progressDetailText: { 
    fontSize: 12, 
    color: colors.textSecondary, 
    fontWeight: '500' 
  },
  chartContainer: { 
    alignItems: 'center' 
  },
  chart: { 
    borderRadius: 16 
  },
  insightsHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  insightsContainer: { 
    marginTop: 12 
  },
  insightItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  insightIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightText: { 
    flex: 1, 
    fontSize: 14, 
    color: colors.text, 
    lineHeight: 20, 
    fontWeight: '500' 
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.text,
    borderRadius: 8,
    padding: 8,
    width: 80,
    alignItems: 'center',
    elevation: 5,
    zIndex: 1000,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tooltipLabel: { 
    color: colors.cardBackground, 
    fontSize: 12 
  },
  tooltipValue: { 
    color: colors.white, 
    fontWeight: '700', 
    fontSize: 14 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
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
  },
  errorText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.text, 
    marginTop: 20, 
    marginBottom: 10 
  },
  errorSubtext: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    textAlign: 'center', 
    marginBottom: 20 
  },
  retryButton: {
    backgroundColor: colors.income,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: colors.income,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: { 
    color: colors.white, 
    fontWeight: '600', 
    fontSize: 16 
  },
});

export default SavingsTrendsScreen;