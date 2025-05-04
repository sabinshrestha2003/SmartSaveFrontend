import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTransaction } from '../context/TransactionContext';

const { width } = Dimensions.get('window');

const colors = {
  background: '#FFFFFF',
  card: '#F8F9FA',
  primary: '#6366F1', 
  primaryLight: '#EEF2FF',
  expense: '#F43F5E', 
  expenseLight: '#FFF1F2',
  income: '#10B981', 
  incomeLight: '#ECFDF5',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  shadow: '#94A3B8',
  white: '#FFFFFF',
  gold: '#F59E0B',
  goldLight: '#FEF3C7',
  teal: '#0EA5E9',
  tealLight: '#E0F2FE',
};

const TransactionDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id, transaction: initialTransaction } = route.params || {};
  const { transactions, loading: contextLoading, error: contextError, deleteTransaction } = useTransaction();

  const [transaction, setTransaction] = useState(initialTransaction || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  useEffect(() => {
    console.log('Route params:', route.params);
    if (initialTransaction) {
      const txn = initialTransaction.transaction || initialTransaction;
      setTransaction(txn);
      setError(null);
      setLoading(false);
    } else if (id && transactions.length > 0) {
      const txn = transactions.find((txn) => txn.id === id);
      if (txn) {
        setTransaction(txn);
        setError(null);
      } else {
        setError('Transaction not found');
      }
      setLoading(false);
    } else {
      setLoading(false);
      setError('No transaction data available');
    }
  }, [id, transactions, initialTransaction]);

  useEffect(() => {
    console.log('Transaction state:', transaction);
  }, [transaction]);

  useEffect(() => {
    if (!loading && transaction) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, transaction, fadeAnim, slideAnim, scaleAnim]);

  const handleEdit = () => {
    console.log('Edit Transaction ID:', id);
    if (id) {
      navigation.navigate('EditTransaction', { id });
    } else {
      setError('Transaction ID is missing');
    }
  };

  const handleDelete = () => {
    if (!id) {
      setError('Transaction ID is missing');
      return;
    }

    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(id);
              navigation.navigate('Tabs', { screen: 'Transactions' });
            } catch (err) {
              setError('Failed to delete transaction. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleBack = () => {
    navigation.navigate('Tabs', { screen: 'Transactions' });
  };

  if (contextLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading transaction details...</Text>
      </View>
    );
  }

  if (contextError || error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.expense} />
        <Text style={styles.errorText}>{contextError || error}</Text>
        <TouchableOpacity style={styles.backButtonFull} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="document-outline" size={60} color={colors.textSecondary} />
        <Text style={styles.errorText}>Transaction not found</Text>
        <TouchableOpacity style={styles.backButtonFull} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isExpense = transaction.type === 'expense' || (transaction.amount && transaction.amount < 0);
  const formattedAmount = transaction.amount ? Math.abs(transaction.amount).toFixed(2) : 'N/A';
  const amountPrefix = isExpense ? '-$' : '+$';
  const amountColor = isExpense ? colors.expense : colors.income;
  const transactionDate = new Date(transaction.date);
  const formattedDate =
    transactionDate instanceof Date && !isNaN(transactionDate.getTime())
      ? transactionDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : transaction.date;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.amountCard,
              {
                backgroundColor: isExpense ? colors.expenseLight : colors.incomeLight,
                borderLeftColor: amountColor,
              },
            ]}
          >
            <View style={styles.amountRow}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isExpense ? colors.expense + '20' : colors.income + '20' },
                ]}
              >
                <Ionicons
                  name={isExpense ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={24}
                  color={amountColor}
                />
              </View>
              <Text style={[styles.amountText, { color: amountColor }]}>
                {amountPrefix}
                {formattedAmount}
              </Text>
            </View>
            <Text style={styles.transactionType}>{isExpense ? 'Expense' : 'Income'}</Text>
          </View>

          <View style={styles.detailCard}>
            <DetailItem
              icon="create-outline"
              label="Description"
              value={transaction.note || 'No Description'}
              iconColor={colors.primary}
              iconBg={colors.primaryLight}
            />
            <DetailItem
              icon="pricetag-outline"
              label="Category"
              value={transaction.category || 'Uncategorized'}
              iconColor={colors.gold}
              iconBg={colors.goldLight}
            />
            <DetailItem
              icon="wallet-outline"
              label="Account"
              value={transaction.account || 'Default Account'}
              iconColor={colors.teal}
              iconBg={colors.tealLight}
            />
            <DetailItem
              icon="calendar-outline"
              label="Date"
              value={formattedDate}
              iconColor={colors.primary}
              iconBg={colors.primaryLight}
            />
            {transaction.paymentMethod && (
              <DetailItem
                icon="card-outline"
                label="Payment Method"
                value={transaction.paymentMethod}
                iconColor={colors.gold}
                iconBg={colors.goldLight}
              />
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit} activeOpacity={0.8}>
              <Ionicons name="create" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
              <Ionicons name="trash" size={20} color={colors.white} />
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const DetailItem = ({ icon, label, value, valueStyle, iconColor, iconBg }) => (
  <View style={styles.detailItem}>
    <View style={styles.detailLabelContainer}>
      <View style={[styles.detailIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonFull: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 16,
  },
  content: {
    padding: 20,
  },
  amountCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 5,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  transactionType: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    marginLeft: 64,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  detailItem: {
    marginBottom: 20,
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 48,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editButton: {
    backgroundColor: colors.teal,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButton: {
    backgroundColor: colors.expense,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 10,
    shadowColor: colors.expense,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.expense,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
});

export default TransactionDetailsScreen;