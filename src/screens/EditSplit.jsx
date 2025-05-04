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
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  
  // Calculate total shares for validation and display
  const totalShares = participants.reduce((sum, p) => sum + (parseFloat(p.share_amount) || 0), 0);
  const isBalanced = Math.abs(parseFloat(totalAmount) - totalShares) < 0.01;

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
      })
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

  const fetchSplitDetails = async () => {
    setLoading(true);
    try {
      const splitData = billSplits.find(s => String(s.id) === String(splitId));
      let splitToSet = splitData;
      if (!splitData) {
        const response = await api.get(`/splits/bill_splits/${splitId}`);
        splitToSet = response.data;
      }
      setSplit(splitToSet);

      const enrichedParticipants = await Promise.all(
        splitToSet.participants.map(async (p) => {
          if (String(p.user_id) === String(user?.id)) {
            return { ...p, name: user?.name || 'Unknown' };
          }
          const userDetails = await fetchUserDetails(p.user_id);
          return { ...p, name: userDetails.name };
        })
      );

      setName(splitToSet.name);
      setTotalAmount(splitToSet.total_amount.toString());
      setParticipants(enrichedParticipants);
    } catch (error) {
      console.error('Error fetching split details:', error);
      Alert.alert('Error', 'Failed to load split details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSplitDetails();
  }, [splitId]);

  const handleShareChange = (userId, value) => {
    const newParticipants = participants.map(p =>
      String(p.user_id) === String(userId) ? { ...p, share_amount: parseFloat(value) || 0 } : p
    );
    setParticipants(newParticipants);
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
      Alert.alert('Validation Error', `Total shares ($${totalShares.toFixed(2)}) must equal total amount ($${total.toFixed(2)}).`);
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
          share_amount: p.share_amount,
          paid_amount: p.paid_amount,
          split_method: p.split_method || 'equal',
          split_value: p.split_value || 1,
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
        Alert.alert('Warning', 'Split updated, but failed to send notifications to some participants.');
      }

      await refreshBillSplitting();
      Alert.alert('Success', 'Split updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
    const equalShare = total / participants.length;
    setParticipants(participants.map(p => ({ ...p, share_amount: equalShare })));
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

  if (!split) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={48} color={colors.errorRed} />
            </View>
            <Text style={styles.errorTitle}>Split Not Found</Text>
            <Text style={styles.errorText}>We couldn't find the split you're looking for.</Text>
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
                transform: [{ scale: scaleAnim }]
              }
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
                transform: [{ scale: scaleAnim }]
              }
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
                  keyboardType="numeric"
                  placeholder="Enter total amount"
                  placeholderTextColor={colors.textSecondary}
                />
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
                  <Text style={[
                    styles.balanceValue, 
                    !isBalanced && styles.balanceValueUnbalanced
                  ]}>
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
                    })
                  ]).start();
                  
                  return (
                    <Animated.View 
                      key={participant.user_id} 
                      style={[
                        styles.participantCard,
                        { 
                          opacity: itemFadeAnim,
                          transform: [{ translateY: itemTranslateY }]
                        }
                      ]}
                    >
                      <View style={styles.participantInfo}>
                        <View style={[
                          styles.participantAvatar,
                          isCurrentUser && styles.currentUserAvatar
                        ]}>
                          <Text style={[
                            styles.participantInitial,
                            isCurrentUser && styles.currentUserInitial
                          ]}>
                            {participant.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.participantNameContainer}>
                          <Text style={styles.participantName}>
                            {participant.name}
                          </Text>
                          {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
                        </View>
                      </View>
                      <View style={styles.shareInputContainer}>
                        <Text style={styles.shareLabel}>Share:</Text>
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
                !isBalanced && styles.submitButtonDisabled
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