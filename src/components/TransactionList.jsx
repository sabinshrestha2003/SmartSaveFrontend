import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';

const TransactionList = () => {
  const transactions = [
    { id: 1, name: 'Groceries', amount: '-$50.00' },
    { id: 2, name: 'Salary', amount: '+$2000.00' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Transactions</Text>
      {transactions.map((transaction) => (
        <TransactionItem key={transaction.id} name={transaction.name} amount={transaction.amount} />
      ))}
    </View>
  );
};


const TransactionItem = ({ name, amount }) => {
  const isDebit = amount.startsWith('-');
  return (
    <View style={styles.transaction}>
      <Text style={styles.name}>{name}</Text>
      <Text style={isDebit ? styles.debit : styles.credit}>{amount}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryOrange,
    marginBottom: 10,
  },
  transaction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  name: {
    fontSize: 16,
    color: colors.darkGray,
  },
  debit: {
    fontSize: 16,
    color: colors.debitRed || 'red', 
  },
  credit: {
    fontSize: 16,
    color: colors.creditGreen || 'green',
  },
});

export default TransactionList;
