import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';

const HomeHeader = () => {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Welcome Back!</Text>
      <Text style={styles.subtitle}>Here's your financial overview</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    marginVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryOrange,
  },
  subtitle: {
    fontSize: 16,
    color: colors.darkGray,
    marginTop: 5,
  },
});

export default HomeHeader;
