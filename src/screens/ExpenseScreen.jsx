import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTransaction } from '../context/TransactionContext';
import colors from '../styles/colors';

const ExpenseScreen = ({ onTransactionAdded }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalAnimation = useRef(new Animated.Value(0)).current;
  const amountInputRef = useRef(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  const { addExpense } = useTransaction();

  const expenseCategories = [
    { label: 'Food', icon: 'restaurant' },
    { label: 'Transport', icon: 'bus' },
    { label: 'Shopping', icon: 'cart' },
    { label: 'Bills', icon: 'document' },
    { label: 'Health', icon: 'medkit' },
    { label: 'Entertainment', icon: 'film' },
    { label: 'Education', icon: 'school' },
    { label: 'Home', icon: 'home' },
    { label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const accountTypes = [
    { label: 'Cash', icon: 'cash' },
    { label: 'Credit Card', icon: 'card' },
    { label: 'Debit Card', icon: 'card-outline' },
    { label: 'Bank', icon: 'business' },
    { label: 'E-Wallet', icon: 'wallet' },
    { label: 'Online', icon: 'cloud-outline' },
  ];

  const handleDateChange = useCallback((event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  }, []);

  const openModal = useCallback((modalType) => {
    if (modalType === 'category') {
      setShowCategoryModal(true);
    } else {
      setShowAccountModal(true);
    }
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [modalAnimation]);

  const closeModal = useCallback((modalType) => {
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
  }, [modalAnimation]);

  const handleButtonPressIn = useCallback(() => {
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const handleButtonPressOut = useCallback(() => {
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  const handleSubmit = useCallback(async () => {
    if (!amount || !category || !account) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    const expenseData = {
      amount: parseFloat(amount),
      category,
      account,
      note,
      date: date.toISOString().split('T')[0],
      type: 'expense',
    };

    try {
      await addExpense(expenseData);
      onTransactionAdded(expenseData);
      setIsSubmitting(false);
      Alert.alert('Success', 'Expense added successfully!');
      setAmount('');
      setCategory('');
      setAccount('');
      setNote('');
      setDate(new Date());
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert('Error', 'Failed to add expense.');
    }
  }, [amount, category, account, note, date, addExpense, onTransactionAdded]);

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const backdropOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.8],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.gold} />
            <Text style={styles.dateText}>
              {date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Details</Text>

            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openModal('category')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.expenseLight }]}>
                <Ionicons
                  name={category ? expenseCategories.find((c) => c.label === category)?.icon : 'list'}
                  size={20}
                  color={colors.expense}
                />
              </View>
              <Text style={[styles.inputText, !category && styles.placeholderText]}>
                {category || 'Select Category'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openModal('account')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.tealLight }]}>
                <Ionicons
                  name={account ? accountTypes.find((a) => a.label === account)?.icon : 'wallet-outline'}
                  size={20}
                  color={colors.teal}
                />
              </View>
              <Text style={[styles.inputText, !account && styles.placeholderText]}>
                {account || 'Select Account'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.noteContainer}>
              <View style={[styles.iconContainer, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="create-outline" size={20} color={colors.gold} />
              </View>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.textSecondary}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addButton, (!amount || !category || !account) && styles.disabledButton]}
            onPress={handleSubmit}
            onPressIn={handleButtonPressIn}
            onPressOut={handleButtonPressOut}
            disabled={isSubmitting || !amount || !category || !account}
            activeOpacity={0.9}
          >
            <Animated.View style={[styles.buttonContent, { transform: [{ scale: buttonScale }] }]}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color={colors.white} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Save Expense</Text>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>

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
              <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Category</Text>
                  <TouchableOpacity onPress={() => closeModal('category')}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={expenseCategories}
                  numColumns={3}
                  keyExtractor={(item) => item.label}
                  initialNumToRender={9}
                  maxToRenderPerBatch={12}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => {
                        setCategory(item.label);
                        closeModal('category');
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: colors.expenseLight }]}>
                        <Ionicons name={item.icon} size={24} color={colors.expense} />
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
              <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Account</Text>
                  <TouchableOpacity onPress={() => closeModal('account')}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={accountTypes}
                  numColumns={3}
                  keyExtractor={(item) => item.label}
                  initialNumToRender={6}
                  maxToRenderPerBatch={9}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  currencySymbol: {
    fontSize: 32,
    color: colors.expense,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    color: colors.text,
    fontWeight: '600',
    padding: 0,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  dateText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    minHeight: 80,
    padding: 0,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: '70%',
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
    fontWeight: '600',
    color: colors.text,
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
  },
  gridItemText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpenseScreen;