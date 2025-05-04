import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';

const BalanceCard = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Total Balance</Text>
      <Text style={styles.balance}>$12,345.67</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    color: colors.lightGray,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primaryOrange,
    marginTop: 10,
  },
});

export default BalanceCard;
