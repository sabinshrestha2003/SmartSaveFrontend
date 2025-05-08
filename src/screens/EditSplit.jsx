import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBillSplitting } from '../context/BillSplittingContext';
import colors from '../styles/colors';
import api from '../utils/api';

const userCache = {};

const EditSplit = ({ navigation, route }) => {
  const { splitId, splitName } = route.params || {};
  const { billSplits, refreshBillSplitting, user, groups, triggerNotification } = useBillSplitting();
  const [split, setSplit] = useState(null);
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitMethod, setSplitMethod] = useState('equal');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedGroupId, setSavedGroupId] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  // Calculate total shares for validation and display
  const totalShares = participants.reduce((sum, p) => sum + (parseFloat(p.share_amount) || 0), 0);
  const isBalanced = Math.abs(parseFloat(totalAmount) - totalShares) < 0.01;
  const totalPercentage = splitMethod === 'percentage'
    ? participants.reduce((sum, p) => sum + (parseFloat(p.split_value) || 0), 0)
    : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    navigation.setOptions({
      title: `Edit ${splitName || 'Split'}`,
      headerShown: false,
    });
  }, [fadeAnim, scaleAnim, navigation, splitName]);

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
      const totalPercent = updatedParticipants.reduce((sum, p) => sum + (Number(p.split_value) || 0), 0);
      if (totalPercent <= 0) {
        updatedParticipants = updatedParticipants.map(p => ({
          ...p,
          share_amount: 0,
          split_method: 'percentage',
        }));
      } else {
        updatedParticipants = updatedParticipants.map(p => {
          const percentage = Number(p.split_value) || 0;
          const share = (percentage / totalPercent) * amount;
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

  const fetchSplitDetails = useCallback(async () => {
    if (isSaved && savedGroupId) {
      console.log('Skipping fetchSplitDetails: Split saved, using savedGroupId:', savedGroupId);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const splitData = billSplits.find(s => String(s.id) === String(splitId));
      let splitToSet = splitData;
      if (!splitData) {
        const response = await api.get(`/splits/bill_splits/${splitId}`);
        splitToSet = response.data;
      }

      console.log('Fetched split data:', splitToSet);

      if (!splitToSet.group_id) {
        throw new Error('Split has no associated group ID.');
      }

      const groupExists = groups.some(g => String(g.id) === String(splitToSet.group_id));
      if (!groupExists && !isSaved) {
        console.log(`Group ${splitToSet.group_id} not found in groups:`, groups);
        setError('The associated group does not exist.');
        setLoading(false);
        Alert.alert(
          'Invalid Group',
          'The group for this split does not exist. Returning to previous screen.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setSplit(splitToSet);
      setSplitMethod(splitToSet.participants[0]?.split_method || 'equal');

      const enrichedParticipants = await Promise.all(
        splitToSet.participants.map(async (p) => {
          const userDetails = String(p.user_id) === String(user?.id)
            ? { name: user?.name || 'Unknown' }
            : await fetchUserDetails(p.user_id);
          return {
            ...p,
            name: userDetails.name,
            split_method: p.split_method || 'equal',
            split_value: p.split_value || 1,
          };
        })
      );

      setName(splitToSet.name);
      setTotalAmount(splitToSet.total_amount.toString());
      setParticipants(calculateShares(enrichedParticipants));
    } catch (error) {
      console.error('Error fetching split details:', error);
      setError('Failed to load split details. Please try again.');
      Alert.alert('Error', 'Failed to load split details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [splitId, billSplits, user, groups, navigation, isSaved, savedGroupId]);

  useEffect(() => {
    fetchSplitDetails();
  }, [fetchSplitDetails]);

  const handleSplitMethodChange = (method) => {
    console.log('Changing split method to:', method);
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

  const handleShareChange = (userId, value) => {
    const parsedValue = parseFloat(value) || 0;
    if (parsedValue < 0) {
      Alert.alert('Error', 'Share amount cannot be negative.');
      return;
    }
    const newParticipants = participants.map(p =>
      String(p.user_id) === String(userId) ? { ...p, share_amount: parsedValue } : p
    );
    setParticipants(newParticipants);
  };

  const handleSplitValueChange = (userId, value) => {
    const parsedValue = parseFloat(value) || 0;
    if (parsedValue < 0) {
      Alert.alert('Error', 'Percentage cannot be negative.');
      return;
    }
    let updatedParticipants = participants.map(p =>
      String(p.user_id) === String(userId) ? { ...p, split_value: parsedValue } : p
    );
    if (splitMethod === 'percentage') {
      updatedParticipants = calculateShares(updatedParticipants);
    }
    setParticipants(updatedParticipants);
  };

  const handleTotalAmountBlur = () => {
    setParticipants(calculateShares(participants));
  };

  const validateInputs = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Split name is required.');
      return false;
    }
    const total = parseFloat(totalAmount) || 0;
    if (total <= 0) {
      Alert.alert('Validation Error', 'Total amount must be greater than 0.');
      return false;
    }
    if (!isBalanced) {
      Alert.alert(
        'Validation Error',
        `Total shares ($${totalShares.toFixed(2)}) must equal total amount ($${total.toFixed(2)}).`
      );
      return false;
    }
    if (splitMethod === 'percentage' && Math.abs(totalPercentage - 100) > 0.01) {
      Alert.alert(
        'Validation Error',
        `Total percentages (${totalPercentage.toFixed(1)}%) must sum to 100%.`
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    setSubmitting(true);
    try {
      const updatedSplit = {
        name: name.trim(),
        total_amount: parseFloat(totalAmount),
        group_id: split?.group_id,
        category: split?.category || null,
        notes: split?.notes || null,
        participants: participants.map(p => ({
          user_id: p.user_id,
          share_amount: Number(p.share_amount) || 0,
          paid_amount: Number(p.paid_amount) || 0,
          split_method: p.split_method,
          split_value: Number(p.split_value) || 1,
        })),
      };

      console.log('Updating split with payload:', JSON.stringify(updatedSplit, null, 2));
      const response = await api.put(`/splits/bill_splits/${splitId}`, updatedSplit);
      console.log('Update response:', response.data);

      // Send notifications
      try {
        const group = groups.find(g => String(g.id) === String(split?.group_id));
        const groupName = group?.name || 'Unnamed Group';
        const username = user?.name || (await fetchCreatorUsername(user?.id)) || 'a user';

        for (const participant of participants) {
          await triggerNotification(
            'Expense Updated',
            `The expense "${name}" in group "${groupName}" was updated by ${username}.`,
            { screen: 'SplitDetails', params: { splitId } },
            participant.user_id
          );
        }
      } catch (notificationError) {
        console.error('Error sending notifications:', notificationError);
        Alert.alert(
          'Warning',
          'Split updated, but failed to send notifications to some participants.'
        );
      }

      setIsSaved(true);
      setSavedGroupId(split?.group_id);
      setError(null);
      console.log('Navigating back after successful update, groupId:', split?.group_id);
      navigation.goBack({ edited: true });

      // Refresh context in the background
      console.log('Refreshing bill splitting data in background');
      refreshBillSplitting(split?.group_id).catch(err => {
        console.error('Background refresh failed:', err);
      });
    } catch (error) {
      console.error('Error updating split:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      Alert.alert('Error', error.response?.data?.error || 'Failed to update split. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const distributeEqually = () => {
    const total = parseFloat(totalAmount) || 0;
    if (total <= 0 || participants.length === 0) return;
    let updatedParticipants = [...participants];
    if (splitMethod === 'percentage') {
      const equalPercentage = (100 / participants.length).toFixed(2);
      updatedParticipants = updatedParticipants.map(p => ({
        ...p,
        split_value: Number(equalPercentage),
        split_method: 'percentage',
      }));
    } else {
      const equalShare = total / participants.length;
      updatedParticipants = updatedParticipants.map(p => ({
        ...p,
        share_amount: Number(equalShare.toFixed(2)),
        split_method: splitMethod,
        split_value: 1,
      }));
    }
    setParticipants(calculateShares(updatedParticipants));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primaryGreen} />
            <Text style={styles.loadingText}>Loading split details...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !isSaved) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.errorRed} />
            </View>
            <Text style={styles.errorTitle}>Split Not Found</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchSplitDetails}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color={colors.white} style={styles.retryButtonIcon} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Split</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.formSection}>
              <Text style={styles.label}>Split Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="receipt-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter split name"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={100}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>Total Amount ($)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="cash-outline" size={20} color={colors.primaryGreen} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  onBlur={handleTotalAmountBlur}
                  keyboardType="numeric"
                  placeholder="Enter total amount"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.formSection}>
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

            <View style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Total Amount</Text>
                  <Text style={styles.balanceValue}>${parseFloat(totalAmount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Total Shares</Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      !isBalanced && styles.balanceValueUnbalanced,
                    ]}
                  >
                    ${totalShares.toFixed(2)}
                  </Text>
                </View>
              </View>
              {!isBalanced && (
                <View style={styles.balanceWarning}>
                  <Ionicons name="warning-outline" size={16} color={colors.errorRed} style={styles.balanceWarningIcon} />
                  <Text style={styles.balanceWarningText}>
                    Shares don't match total amount (${Math.abs(parseFloat(totalAmount || 0) - totalShares).toFixed(2)} difference)
                  </Text>
                </View>
              )}
              {splitMethod === 'percentage' && (
                <View style={[styles.balanceWarning, totalPercentage === 100 ? styles.balanceInfo : styles.balanceWarningRed]}>
                  <Ionicons
                    name={totalPercentage === 100 ? 'checkmark-circle-outline' : 'warning-outline'}
                    size={16}
                    color={totalPercentage === 100 ? colors.primaryGreen : colors.errorRed}
                    style={styles.balanceWarningIcon}
                  />
                  <Text style={[styles.balanceWarningText, totalPercentage === 100 && styles.balanceInfoText]}>
                    Total percentages: {totalPercentage.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.participantsSection}>
              <View style={styles.participantsHeader}>
                <View style={styles.participantsTitleContainer}>
                  <Ionicons name="people" size={20} color={colors.primaryGreen} style={styles.participantsTitleIcon} />
                  <Text style={styles.participantsTitle}>Participants</Text>
                </View>
                <TouchableOpacity
                  onPress={distributeEqually}
                  style={styles.equalButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="sync" size={16} color={colors.primaryGreen} style={styles.equalButtonIcon} />
                  <Text style={styles.equalButtonText}>Distribute Equally</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.participantsList}>
                {participants.map((participant, index) => {
                  const isCurrentUser = String(participant.user_id) === String(user?.id);

                  // Animation for each participant row
                  const itemFadeAnim = new Animated.Value(0);
                  const itemTranslateY = new Animated.Value(20);

                  Animated.parallel([
                    Animated.timing(itemFadeAnim, {
                      toValue: 1,
                      duration: 300,
                      delay: index * 100,
                      useNativeDriver: true,
                    }),
                    Animated.timing(itemTranslateY, {
                      toValue: 0,
                      duration: 300,
                      delay: index * 100,
                      useNativeDriver: true,
                    }),
                  ]).start();

                  return (
                    <Animated.View
                      key={participant.user_id}
                      style={[
                        styles.participantCard,
                        {
                          opacity: itemFadeAnim,
                          transform: [{ translateY: itemTranslateY }],
                        },
                      ]}
                    >
                      <View style={styles.participantInfo}>
                        <View
                          style={[
                            styles.participantAvatar,
                            isCurrentUser && styles.currentUserAvatar,
                          ]}
                        >
                          <Text
                            style={[
                              styles.participantInitial,
                              isCurrentUser && styles.currentUserInitial,
                            ]}
                          >
                            {participant.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.participantNameContainer}>
                          <Text style={styles.participantName}>{participant.name}</Text>
                          {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
                        </View>
                      </View>
                      <View style={styles.shareInputContainer}>
                        <Text style={styles.shareLabel}>
                          {splitMethod === 'percentage' ? 'Share %:' : 'Share:'}
                        </Text>
                        {splitMethod === 'percentage' ? (
                          <View style={styles.shareInputWrapper}>
                            <TextInput
                              style={styles.shareInput}
                              value={participant.split_value?.toString()}
                              onChangeText={(value) => handleSplitValueChange(participant.user_id, value)}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                            />
                            <Text style={styles.shareCurrency}>%</Text>
                          </View>
                        ) : (
                          <View style={styles.shareInputWrapper}>
                            <Text style={styles.shareCurrency}>$</Text>
                            <TextInput
                              style={styles.shareInput}
                              value={participant.share_amount?.toString()}
                              onChangeText={(value) => handleShareChange(participant.user_id, value)}
                              keyboardType="numeric"
                              placeholder="0.00"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                        )}
                        {splitMethod === 'percentage' && (
                          <Text style={styles.shareAmountText}>
                            ${Number(participant.share_amount || 0).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
                !isBalanced && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !isBalanced}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save" size={20} color={colors.white} style={styles.submitButtonIcon} />
                  <Text style={styles.submitButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 12,
    fontFamily: 'Inter-Bold',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
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
  balanceCard: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  balanceValueUnbalanced: {
    color: colors.errorRed,
  },
  balanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(244,67,54,0.1)',
    borderRadius: 8,
    padding: 8,
  },
  balanceWarningRed: {
    backgroundColor: 'rgba(244,67,54,0.1)',
  },
  balanceInfo: {
    backgroundColor: 'rgba(76,175,80,0.1)',
  },
  balanceInfoText: {
    color: colors.primaryGreen,
  },
  balanceWarningIcon: {
    marginRight: 6,
  },
  balanceWarningText: {
    fontSize: 12,
    color: colors.errorRed,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  participantsSection: {
    marginBottom: 20,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsTitleIcon: {
    marginRight: 8,
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  equalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  equalButtonIcon: {
    marginRight: 6,
  },
  equalButtonText: {
    fontSize: 14,
    color: colors.primaryGreen,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  participantsList: {
    gap: 12,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 12,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentUserAvatar: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  participantInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  currentUserInitial: {
    color: colors.primaryGreen,
  },
  participantNameContainer: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    fontFamily: 'Inter-Medium',
  },
  youBadge: {
    fontSize: 12,
    color: colors.primaryGreen,
    fontFamily: 'Inter-Medium',
  },
  shareInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    fontFamily: 'Inter-Medium',
  },
  shareInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  shareCurrency: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Inter-Medium',
  },
  shareInput: {
    width: 80,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'right',
    fontFamily: 'Inter-Regular',
  },
  shareAmountText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 8,
    fontFamily: 'Inter-Medium',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryGreen,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: 300,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 16,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    maxWidth: 300,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244,67,54,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default EditSplit;