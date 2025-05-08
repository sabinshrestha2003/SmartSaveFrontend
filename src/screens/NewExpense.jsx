import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../styles/colors';
import api from '../utils/api';
import { useBillSplitting } from '../context/BillSplittingContext';

const userCache = {};

const NewExpense = ({ navigation, route }) => {
  const { groupId } = route.params || {};
  const { user, refreshBillSplitting, groups, triggerNotification } = useBillSplitting();

  const [expenseName, setExpenseName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [splitMethod, setSplitMethod] = useState('equal');
  const [participants, setParticipants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedGroupId, setSavedGroupId] = useState(null);

  const modalAnimation = useRef(new Animated.Value(0)).current;

  const expenseCategories = [
    { label: 'Dining Out', icon: 'restaurant' },
    { label: 'Groceries', icon: 'basket' },
    { label: 'Drinks', icon: 'wine' },
    { label: 'Transport', icon: 'car' },
    { label: 'Ride Share', icon: 'car-sport' },
    { label: 'Travel', icon: 'airplane' },
    { label: 'Hotel', icon: 'bed' },
    { label: 'Entertainment', icon: 'film' },
    { label: 'Activities', icon: 'tennisball' },
    { label: 'Shopping', icon: 'cart' },
    { label: 'Utilities', icon: 'flash' },
    { label: 'Rent', icon: 'home' },
    { label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  const fetchUserDetails = useCallback(async (userId) => {
    if (userCache[userId]) return userCache[userId];

    try {
      const response = await api.get('/splits/users/search', { params: { q: userId } });
      const userData = response.data.users.find(u => String(u.id) === String(userId));
      const userDetails = {
        id: userId,
        name: userData?.name || 'Unknown',
        email: userData?.email,
        profilePicture: userData?.profilePicture,
      };
      userCache[userId] = userDetails;
      return userDetails;
    } catch (err) {
      console.error(`Error fetching user ${userId}:`, err.response?.data || err.message);
      return { id: userId, name: 'Unknown', email: null, profilePicture: null };
    }
  }, []);

  const fetchCreatorUsername = useCallback(async (userId) => {
    if (!userId) return 'Unknown';
    const userDetails = await fetchUserDetails(userId);
    return userDetails.name;
  }, [fetchUserDetails]);

  const fetchGroupMembers = useCallback(async () => {
    if (isSaved && savedGroupId) {
      console.log('Skipping fetchGroupMembers: Expense saved, using savedGroupId:', savedGroupId);
      return;
    }

    if (!groupId) {
      console.log('No groupId provided');
      setError('No group selected. Please select a group to add an expense.');
      setLoadingMembers(false);
      return;
    }

    console.log('fetchGroupMembers - groupId:', groupId, 'groups:', groups);
    const groupExists = groups.some(g => String(g.id) === String(groupId));
    if (!groupExists) {
      console.log(`Group ${groupId} not found in groups:`, groups);
      setError('The selected group does not exist. Please choose a valid group.');
      setLoadingMembers(false);
      Alert.alert(
        'Invalid Group',
        'The selected group does not exist. Returning to group selection.',
        [{ text: 'OK', onPress: () => navigation.navigate('AllGroups') }]
      );
      return;
    }

    setLoadingMembers(true);
    setError(null);

    try {
      const groupResponse = await api.get(`/splits/groups/${groupId}`);
      const group = groupResponse.data.group;
      console.log('Fetched group:', group);

      const memberIds = Array.isArray(group.members)
        ? group.members
            .map(m => (typeof m === 'object' && m ? m.user_id : m))
            .filter(id => id && String(id) !== String(user?.id))
            .concat([user?.id])
        : [];

      if (memberIds.length === 0) {
        setError('No valid members found in this group.');
        setParticipants([]);
        return;
      }

      const userDetailsPromises = memberIds.map(userId =>
        fetchUserDetails(userId).then(data => ({ userId, data }))
      );
      const results = await Promise.all(userDetailsPromises);
      const userDetailsMap = results.reduce((acc, { userId, data }) => {
        acc[userId] = data;
        return acc;
      }, {});

      const initialParticipants = memberIds.map(userId => ({
        user_id: userId,
        name: String(userId) === String(user?.id) ? (user?.name || 'You') : (userDetailsMap[userId]?.name || 'Unknown'),
        paid_amount: String(userId) === String(user?.id) ? parseFloat(totalAmount) || 0 : 0,
        share_amount: 0,
        split_method: 'equal',
        split_value: 1,
      }));

      setParticipants(calculateShares(initialParticipants));
    } catch (err) {
      console.error('Error fetching group members:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to load group members. Please try again.');
    } finally {
      setLoadingMembers(false);
    }
  }, [groupId, user, fetchUserDetails, groups, navigation, isSaved, savedGroupId]);

  useEffect(() => {
    navigation.setOptions({ title: 'Add New Expense' });
    if (!isSaved) {
      fetchGroupMembers();
    }
    return () => {
      setIsSaved(false);
      setSavedGroupId(null);
    };
  }, [fetchGroupMembers, navigation, isSaved]);

  const calculateShares = useCallback((currentParticipants) => {
    const amount = parseFloat(totalAmount) || 0;
    if (!amount || amount <= 0) {
      return currentParticipants.map(p => ({ ...p, share_amount: 0 }));
    }

    let updatedParticipants = [...currentParticipants];

    if (splitMethod === 'equal' || splitMethod === 'exact') {
      const share = amount / updatedParticipants.length;
      updatedParticipants = updatedParticipants.map(p => ({
        ...p,
        share_amount: Number(share.toFixed(2)),
        split_method: splitMethod,
        split_value: 1,
      }));
    } else if (splitMethod === 'percentage') {
      const totalPercentage = updatedParticipants.reduce((sum, p) => sum + (Number(p.split_value) || 0), 0);
      if (totalPercentage <= 0) {
        updatedParticipants = updatedParticipants.map(p => ({
          ...p,
          share_amount: 0,
          split_method: 'percentage',
        }));
      } else {
        updatedParticipants = updatedParticipants.map(p => {
          const percentage = Number(p.split_value) || 0;
          const share = (percentage / totalPercentage) * amount;
          return {
            ...p,
            share_amount: Number(share.toFixed(2)),
            split_method: 'percentage',
          };
        });

        const totalOwed = updatedParticipants.reduce((sum, p) => sum + p.share_amount, 0);
        const difference = amount - totalOwed;
        if (Math.abs(difference) > 0.01 && updatedParticipants.length > 0) {
          updatedParticipants[0].share_amount += Number(difference.toFixed(2));
        }
      }
    }

    return updatedParticipants;
  }, [totalAmount, splitMethod]);

  const handleTotalAmountBlur = () => {
    setParticipants(calculateShares(participants));
  };

  const handleSplitMethodChange = (method) => {
    setSplitMethod(method);
    let updatedParticipants = [...participants];
    if (method === 'percentage') {
      const equalPercentage = participants.length > 0 ? (100 / participants.length).toFixed(2) : 0;
      updatedParticipants = updatedParticipants.map(p => ({
        ...p,
        split_value: Number(equalPercentage),
        split_method: 'percentage',
      }));
    } else {
      updatedParticipants = updatedParticipants.map(p => ({
        ...p,
        split_value: 1,
        split_method: method,
      }));
    }
    setParticipants(calculateShares(updatedParticipants));
  };

  const updateParticipant = (userId, field, value) => {
    const parsedValue = value === '' ? 0 : parseFloat(value) || 0;
    if (parsedValue < 0) {
      Alert.alert('Error', `${field === 'split_value' ? 'Percentage' : 'Amount'} cannot be negative.`);
      return;
    }

    let updatedParticipants = participants.map(p =>
      String(p.user_id) === String(userId) ? { ...p, [field]: parsedValue } : p
    );

    if (field === 'split_value' && splitMethod === 'percentage') {
      updatedParticipants = calculateShares(updatedParticipants);
    }

    setParticipants(updatedParticipants);
  };

  const handleSave = async () => {
    if (!expenseName.trim()) {
      Alert.alert('Error', 'Please enter an expense description.');
      return;
    }
    const amount = parseFloat(totalAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid total amount.');
      return;
    }

    const totalOwed = participants.reduce((sum, p) => sum + (Number(p.share_amount) || 0), 0);
    if (Math.abs(totalOwed - amount) > 0.01) {
      Alert.alert('Error', `Total owed ($${totalOwed.toFixed(2)}) must equal total amount ($${amount.toFixed(2)}).`);
      return;
    }

    if (splitMethod === 'percentage') {
      const totalPercentage = participants.reduce((sum, p) => sum + (Number(p.split_value) || 0), 0);
      if (totalPercentage <= 0) {
        Alert.alert('Error', 'Total percentages cannot be zero. Please assign percentages to participants.');
        return;
      }
      if (Math.abs(totalPercentage - 100) > 0.01) {
        Alert.alert('Error', `Total percentages (${totalPercentage.toFixed(1)}%) must sum to 100%.`);
        return;
      }
    }

    setSaving(true);
    try {
      const expenseData = {
        name: expenseName,
        total_amount: amount,
        group_id: groupId,
        category: category || null,
        notes: notes || null,
        participants: participants.map(p => ({
          user_id: p.user_id,
          paid_amount: Number(p.paid_amount) || 0,
          share_amount: Number(p.share_amount) || 0,
          split_method: p.split_method,
          split_value: Number(p.split_value) || 1,
        })),
      };

      console.log('Saving expense with groupId:', groupId, 'Data:', expenseData);
      const response = await api.post('/splits/bill_splits', expenseData);
      const newExpenseId = response.data.bill_split?.id;
      const groupName = response.data.bill_split?.group_name || groups.find(g => String(g.id) === String(groupId))?.name || 'Unnamed Group';
      const creatorName = response.data.bill_split?.creator_name || user?.name || (await fetchCreatorUsername(user?.id)) || 'You';

      for (const participant of participants) {
        await triggerNotification(
          'New Expense Added',
          `${creatorName} added a new expense "${expenseName}" for $${amount.toFixed(2)} in "${groupName}".`,
          { screen: 'SplitDetails', params: { splitId: newExpenseId } },
          participant.user_id
        );
      }

      setIsSaved(true);
      setSavedGroupId(groupId);
      setError(null);
      console.log('Navigating to GroupDetails with groupId:', groupId);
      navigation.navigate('GroupDetails', { groupId });

      // Refresh context in the background
      console.log('Refreshing bill splitting data in background');
      refreshBillSplitting(groupId).catch(err => {
        console.error('Background refresh failed:', err);
      });
    } catch (error) {
      console.error('Add expense error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderParticipant = ({ item }) => (
    <View style={styles.participantRow}>
      <View style={styles.participantNameContainer}>
        <View style={styles.participantAvatar}>
          <Text style={styles.participantInitial}>{item.name.charAt(0)}</Text>
        </View>
        <Text style={styles.participantName}>{item.name}</Text>
      </View>
      <TextInput
        style={styles.amountInput}
        value={item.paid_amount.toString()}
        onChangeText={(text) => updateParticipant(item.user_id, 'paid_amount', text)}
        keyboardType="numeric"
        placeholder="Paid ($)"
        placeholderTextColor={colors.textSecondary}
      />
      {splitMethod === 'equal' || splitMethod === 'exact' ? (
        <Text style={styles.shareText}>${Number(item.share_amount || 0).toFixed(2)}</Text>
      ) : (
        <TextInput
          style={styles.amountInput}
          value={item.split_value.toString()}
          onChangeText={(text) => updateParticipant(item.user_id, 'split_value', text)}
          keyboardType="numeric"
          placeholder="%"
          placeholderTextColor={colors.textSecondary}
        />
      )}
    </View>
  );

  const backdropOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.9],
  });

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const openCategoryModal = useCallback(() => {
    setShowCategoryModal(true);
    Animated.timing(modalAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [modalAnimation]);

  const closeCategoryModal = useCallback(() => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowCategoryModal(false);
    });
  }, [modalAnimation]);

  if (loadingMembers) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
          <Text style={styles.loadingText}>Loading group members...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !isSaved) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGroupMembers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Expense</Text>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={expenseName}
                    onChangeText={setExpenseName}
                    placeholder="e.g., Dinner at Restaurant"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Total Amount ($)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="cash-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    onBlur={handleTotalAmountBlur}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                <TouchableOpacity 
                  style={styles.categoryInput} 
                  onPress={openCategoryModal}
                >
                  <Ionicons 
                    name={category ? expenseCategories.find(c => c.label === category)?.icon || "pricetag-outline" : "pricetag-outline"} 
                    size={20} 
                    color={colors.textSecondary} 
                    style={styles.inputIcon} 
                  />
                  <Text style={[styles.categoryText, !category && styles.placeholderText]}>
                    {category || 'Select category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Notes</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Additional details"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Split Method</Text>
                <View style={styles.splitMethodContainer}>
                  {['equal', 'exact', 'percentage'].map(method => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.splitMethodButton,
                        splitMethod === method && styles.splitMethodButtonSelected,
                      ]}
                      onPress={() => handleSplitMethodChange(method)}
                    >
                      <Ionicons 
                        name={
                          method === 'equal' ? 'people-outline' : 
                          method === 'exact' ? 'calculator-outline' : 
                          'pie-chart-outline'
                        } 
                        size={18} 
                        color={splitMethod === method ? colors.white : colors.textPrimary} 
                        style={styles.splitMethodIcon}
                      />
                      <Text
                        style={[
                          styles.splitMethodText,
                          splitMethod === method && styles.splitMethodTextSelected,
                        ]}
                      >
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Participants</Text>
                <View style={styles.participantListHeader}>
                  <Text style={styles.participantHeaderText}>Name</Text>
                  <Text style={styles.participantHeaderText}>Paid</Text>
                  <Text style={styles.participantHeaderText}>
                    {splitMethod === 'percentage' ? 'Share %' : 'Owes'}
                  </Text>
                </View>
                <FlatList
                  data={participants}
                  renderItem={renderParticipant}
                  keyExtractor={item => String(item.user_id)}
                  style={styles.participantList}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="people" size={40} color={colors.lightGray} />
                      <Text style={styles.emptyText}>No participants available</Text>
                    </View>
                  }
                />
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={colors.white} style={styles.saveButtonIcon} />
                <Text style={styles.saveButtonText}>Save Expense</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={showCategoryModal}
          transparent
          animationType="none"
          onRequestClose={closeCategoryModal}
        >
          <TouchableWithoutFeedback onPress={closeCategoryModal}>
            <Animated.View style={[styles.modalOverlay, { opacity: backdropOpacity }]}>
              <TouchableWithoutFeedback>
                <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalTranslateY }] }]}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Category</Text>
                    <TouchableOpacity onPress={closeCategoryModal} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={expenseCategories}
                    numColumns={3}
                    keyExtractor={(item) => item.label}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.gridItem,
                          category === item.label && styles.selectedGridItem
                        ]}
                        onPress={() => {
                          setCategory(item.label);
                          closeCategoryModal();
                        }}
                      >
                        <View style={[
                          styles.categoryIcon, 
                          { backgroundColor: category === item.label ? colors.primaryGreen : colors.primaryGreenLight }
                        ]}>
                          <Ionicons 
                            name={item.icon} 
                            size={24} 
                            color={category === item.label ? colors.white : colors.primaryGreen} 
                          />
                        </View>
                        <Text style={[
                          styles.gridItemText,
                          category === item.label && styles.selectedGridItemText
                        ]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </Animated.View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 12,
    fontFamily: 'Inter-Bold',
  },
  formContainer: {
    flex: 1,
    gap: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
  },
  categoryInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  categoryText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
    marginLeft: 8,
  },
  placeholderText: {
    color: colors.textSecondary,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  splitMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  splitMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: colors.background,
  },
  splitMethodButtonSelected: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  splitMethodIcon: {
    marginRight: 6,
  },
  splitMethodText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  splitMethodTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  participantListHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginBottom: 4,
  },
  participantHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  participantList: {
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  participantNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  participantInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryGreen,
    fontFamily: 'Inter-SemiBold',
  },
  participantName: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
  },
  amountInput: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    marginHorizontal: 4,
    fontFamily: 'Inter-Regular',
    backgroundColor: colors.background,
    maxWidth: 80,
  },
  shareText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'right',
    fontFamily: 'Inter-Regular',
    fontWeight: '500',
    maxWidth: 80,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  saveButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.errorRed,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter-Medium',
  },
  retryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  retryButtonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 10,
    fontFamily: 'Inter-Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
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
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gridItem: {
    alignItems: 'center',
    width: '33.33%',
    marginBottom: 20,
    padding: 8,
  },
  selectedGridItem: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
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
    color: colors.textPrimary,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  selectedGridItemText: {
    fontWeight: '600',
    color: colors.primaryGreen,
  },
});

export default NewExpense;