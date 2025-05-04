import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../styles/colors'; 

const MoreOptionsScreen = ({ navigation }) => {
  const options = [
    {
      name: 'Profile',
      icon: 'person-outline',
      screen: 'UserProfile',
      color: colors.accentPurple, 
      bgColor: colors.primaryLight,
    },
    {
      name: 'Add Transaction',
      icon: 'add-outline',
      screen: 'AddTransaction',
      color: colors.expense,
      bgColor: colors.expenseLight,
    },
    {
      name: 'Reports',
      icon: 'stats-chart-outline',
      screen: 'Reports',
      color: colors.gold,
      bgColor: colors.goldLight,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More Options</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            onPress={() => navigation.navigate(option.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
              <Ionicons name={option.icon} size={22} color={option.color} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionText}>{option.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border, 
    backgroundColor: colors.background, 
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text, 
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground, 
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.shadow, 
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 16,
    color: colors.text, 
    fontWeight: '500',
  },
});

export default MoreOptionsScreen;