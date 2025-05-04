import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import colors from '../styles/colors'; 

const { width } = Dimensions.get('window');

const ReportsScreen = ({ navigation }) => {
  const fadeAnim = new Animated.Value(0);
  const translateY = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY]);

  const reportOptions = [
    {
      icon: 'pie-chart-outline',
      title: 'Expense Breakdown',
      description: 'Analyze your spending by category',
      route: 'ExpenseBreakdown',
      color: colors.expense, 
      bgColor: colors.expenseLight, 
    },
    {
      icon: 'bar-chart-outline',
      title: 'Income Breakdown',
      description: 'Track your earnings sources',
      route: 'IncomeBreakdown',
      color: colors.income,
      bgColor: colors.incomeLight, 
    },
    {
      icon: 'trending-up-outline',
      title: 'Savings Trends',
      description: 'Monitor savings growth',
      route: 'SavingsTrends',
      color: colors.teal, 
      bgColor: colors.tealLight, 
    },
    {
      icon: 'calendar-outline',
      title: 'Monthly Summary',
      description: 'Monthly financial overview',
      route: 'MonthlySummary',
      color: colors.gold, 
      bgColor: colors.goldLight, 
    },
  ];

  const renderReportCard = (option, index) => {
    const cardAnim = new Animated.Value(0);
    const cardTranslateY = new Animated.Value(30);

    useEffect(() => {
      Animated.parallel([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 400,
          delay: 200 + index * 100,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          delay: 200 + index * 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, [cardAnim, cardTranslateY]);

    return (
      <Animated.View
        key={option.title}
        style={[
          styles.cardContainer,
          {
            opacity: cardAnim,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.reportCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate(option.route)}
        >
          <View style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
              <Icon name={option.icon} size={28} color={option.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </View>
            <Icon name="chevron-forward-outline" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reports</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          activeOpacity={0.7}
        >
          <Icon name="settings-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* Intro Section */}
      <Animated.View
        style={[
          styles.infoContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: Animated.multiply(translateY, 1.1) }],
          },
        ]}
      >
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Your Financial Insights</Text>
          <Text style={styles.infoText}>
            Explore detailed reports to understand your spending patterns and optimize your financial decisions.
          </Text>
        </View>
      </Animated.View>

      {/* Report Categories */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {reportOptions.map((option, index) => renderReportCard(option, index))}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border, 
    backgroundColor: colors.background, 
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text, 
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground, 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground, 
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoContainer: {
    margin: 20,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
    shadowColor: colors.shadow, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoContent: {
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.accentPurple, 
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text, 
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary, 
    lineHeight: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  cardContainer: {
    marginBottom: 16,
  },
  reportCard: {
    borderRadius: 16,
    backgroundColor: colors.cardBackground, 
    overflow: 'hidden',
    shadowColor: colors.shadow, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text, 
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary, 
    lineHeight: 18,
  },
});

export default ReportsScreen;