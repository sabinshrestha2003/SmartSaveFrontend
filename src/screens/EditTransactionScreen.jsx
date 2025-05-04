import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTransaction } from '../context/TransactionContext';

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
  modalBackground: '#F1F5F9', 
  modalOverlay: 'rgba(0, 0, 0, 0.8)',
};

const EditTransactionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const { transactions, updateTransaction } = useTransaction();

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const modalAnimation = useRef(new Animated.Value(0)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  const expenseCategoryOptions = [
    { label: 'Food', icon: 'restaurant' },
    { label: 'Groceries', icon: 'basket' },
    { label: 'Shopping', icon: 'cart' },
    { label: 'Transport', icon: 'bus' },
    { label: 'Entertainment', icon: 'film' },
    { label: 'Bills', icon: 'document' },
    { label: 'Health', icon: 'medkit' },
    { label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const incomeCategoryOptions = [
    { label: 'Salary', icon: 'wallet' },
    { label: 'Freelance', icon: 'briefcase' },
    { label: 'Investment', icon: 'trending-up' },
    { label: 'Gift', icon: 'gift' },
    { label: 'Bonus', icon: 'cash' },
    { label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const accountOptions = [
    { label: 'Cash', icon: 'cash' },
    { label: 'Credit Card', icon: 'card' },
    { label: 'Debit Card', icon: 'card-outline' },
    { label: 'Bank', icon: 'business' },
    { label: 'E-Wallet', icon: 'wallet' },
    { label: 'Online', icon: 'cloud-outline' },
  ];

  useEffect(() => {
    const txn = transactions.find((txn) => txn.id === id);
    if (txn && txn.id) {
      console.log('Transaction found:', txn);
      setTransaction(txn);
      setNote(txn.note || '');
      const isExpense = txn.type === 'expense';
      const categoryList = isExpense ? expenseCategoryOptions : incomeCategoryOptions;
      setCategory(
        txn.category && categoryList.some((opt) => opt.label === txn.category)
          ? txn.category
          : 'Other'
      );
      setAccount(
        txn.account && accountOptions.some((opt) => opt.label === txn.account)
          ? txn.account
          : 'Cash'
      );
      setAmount(txn.amount?.toString() || '');
      setDate(txn.date ? new Date(txn.date) : new Date());
    } else {
      console.log('Transaction not found for ID:', id);
      setError('Transaction not found');
    }
  }, [id, transactions]);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const openModal = (modalType) => {
    if (modalType === 'category') {
      setShowCategoryModal(true);
    } else {
      setShowAccountModal(true);
    }

    Animated.spring(modalAnimation, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = (modalType) => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (modalType === 'category') {
        setShowCategoryModal(false);
      } else {
        setShowAccountModal(false);
      }
    });
  };

  const handleButtonPressIn = () => {
    Animated.spring(saveButtonScale, {
      toValue: 0.95,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = () => {
    Animated.spring(saveButtonScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleSave = async () => {
    if (!note || !category || !account || !amount || isNaN(parseFloat(amount))) {
      let errorMessage = 'Please fill all fields correctly:\n';
      if (!note) errorMessage += '- Description is required\n';
      if (!category) errorMessage += '- Category is required\n';
      if (!account) errorMessage += '- Account is required\n';
      if (!amount || isNaN(parseFloat(amount))) errorMessage += '- Amount must be a valid number\n';
      Alert.alert('Missing Information', errorMessage.trim());
      return;
    }

    setLoading(true);
    try {
      const updatedTransaction = {
        ...transaction,
        note,
        category,
        account,
        amount: parseFloat(amount),
        date: date.toISOString().split('T')[0],
      };

      const response = await updateTransaction(id, updatedTransaction);
      const updatedTxn = response.transaction;
      console.log('Updated transaction:', updatedTxn);

      navigation.reset({
        index: 1,
        routes: [
          { name: 'Tabs', state: { routes: [{ name: 'Transactions' }] } },
          { name: 'TransactionDetail', params: { id: updatedTxn.id, transaction: updatedTxn } },
        ],
      });
    } catch (err) {
      console.error('Error updating transaction:', err);
      Alert.alert('Error', err.message || 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.navigate('Tabs', { screen: 'Transactions' });
  };

  const handleBack = () => {
    navigation.navigate('Tabs', { screen: 'Transactions' });
  };

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const backdropOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.8], 
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Updating transaction...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={colors.expense} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="search" size={60} color={colors.primary} />
        <Text style={styles.errorText}>Transaction not found</Text>
        <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isExpense = transaction.type === 'expense';
  const accentColor = isExpense ? colors.expense : colors.income;
  const accentLightColor = isExpense ? colors.expenseLight : colors.incomeLight;
  const categoryOptions = isExpense ? expenseCategoryOptions : incomeCategoryOptions;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit {isExpense ? 'Expense' : 'Income'}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <View style={styles.inputContainer}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Enter description"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openModal('category')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
              </View>
              <Text style={[styles.inputText, !category && styles.placeholderText]}>
                {category || `Select ${isExpense ? 'Expense' : 'Income'} Category`}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Account</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openModal('account')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.tealLight }]}>
                <Ionicons name="wallet-outline" size={18} color={colors.teal} />
              </View>
              <Text style={[styles.inputText, !account && styles.placeholderText]}>
                {account || 'Select Account'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.inputContainer}>
              <View style={[styles.iconContainer, { backgroundColor: accentLightColor }]}>
                <Ionicons name="cash-outline" size={18} color={accentColor} />
              </View>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.inputText}>
                {date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: accentColor }]}
            onPress={handleSave}
            activeOpacity={0.8}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
          >
            <Animated.View style={[styles.buttonContent, { transform: [{ scale: saveButtonScale }] }]}>
              <Ionicons name="save-outline" size={20} color={colors.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="none"
        onRequestClose={() => closeModal('category')}
      >
        <TouchableWithoutFeedback onPress={() => closeModal('category')}>
          <Animated.View style={[styles.modalOverlay, { opacity: backdropOpacity }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select {isExpense ? 'Expense' : 'Income'} Category
                  </Text>
                  <TouchableOpacity onPress={() => closeModal('category')}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={categoryOptions}
                  numColumns={3}
                  keyExtractor={(item) => item.label}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => {
                        setCategory(item.label);
                        closeModal('category');
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: colors.goldLight }]}>
                        <Ionicons name={item.icon} size={24} color={colors.gold} />
                      </View>
                      <Text style={styles.gridItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Account Modal */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="none"
        onRequestClose={() => closeModal('account')}
      >
        <TouchableWithoutFeedback onPress={() => closeModal('account')}>
          <Animated.View style={[styles.modalOverlay, { opacity: backdropOpacity }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Account</Text>
                  <TouchableOpacity onPress={() => closeModal('account')}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={accountOptions}
                  numColumns={3}
                  keyExtractor={(item) => item.label}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => {
                        setAccount(item.label);
                        closeModal('account');
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: colors.tealLight }]}>
                        <Ionicons name={item.icon} size={24} color={colors.teal} />
                      </View>
                      <Text style={styles.gridItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingVertical: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 16,
    color: colors.text,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 30, 
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  saveButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 12,
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
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay, 
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.modalBackground, 
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: '70%',
    elevation: 12, 
    shadowColor: '#000000', 
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3, 
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 20, 
    fontWeight: '800', 
    color: '#111827', 
  },
  gridItem: {
    alignItems: 'center',
    width: '33.33%',
    marginBottom: 20,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, 
    shadowRadius: 6,
    elevation: 5, 
  },
  gridItemText: {
    fontSize: 14,
    color: '#111827', 
    textAlign: 'center',
    fontWeight: '700', 
  },
});

export default EditTransactionScreen;