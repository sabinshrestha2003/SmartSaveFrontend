import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBillSplitting } from '../context/BillSplittingContext';
import colors from '../styles/colors';
import api from '../utils/api';

const userCache = {};

const SettleUp = ({ navigation }) => {
  const { billSplits = [], settlements = [], loading, error, refreshBillSplitting, user, addSettlement, triggerNotification, groups } = useBillSplitting();
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [debts, setDebts] = useState([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    navigation.setOptions({
      title: 'Settle Up',
    });
  }, [navigation, fadeAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('SettleUp focused');
      handleRefresh();
    });
    return () => unsubscribe();
  }, [navigation, handleRefresh]);

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

  const enrichBillSplits = useCallback(async () => {
    if (!billSplits.length || !user?.id) {
      setDebts([]);
      return;
    }

    try {
      const newDebts = [];
      for (const split of billSplits) {
        const enrichedParticipants = await Promise.all(
          split.participants.map(async (p) => {
            if (String(p.user_id) === String(user.id)) {
              return { ...p, name: user?.name || 'Unknown' };
            }
            const userDetails = await fetchUserDetails(p.user_id);
            return { ...p, name: userDetails.name };
          })
        );

        const userParticipant = enrichedParticipants.find(p => String(p.user_id) === String(user?.id));
        if (!userParticipant) continue;

        const userShare = userParticipant.share_amount || 0;
        const userPaid = userParticipant.paid_amount || 0;
        const userOwed = userShare - userPaid;
        if (userOwed <= 0) continue;

        const splitSettlements = settlements.filter(s => String(s.split_id) === String(split.id) && String(s.payer_id) === String(user.id));
        const settledAmounts = {};
        splitSettlements.forEach(s => {
          settledAmounts[s.payee_id] = (settledAmounts[s.payee_id] || 0) + s.amount;
        });

        const payees = enrichedParticipants
          .filter(p => String(p.user_id) !== String(user.id))
          .map(p => {
            const settled = settledAmounts[p.user_id] || 0;
            const amountOwedTo = Math.max(0, (p.paid_amount || 0) - (p.share_amount || 0) - settled);
            return { ...p, amountOwedTo };
          })
          .filter(p => p.amountOwedTo > 0);

        if (!payees.length) continue;

        const totalOwedByOthers = payees.reduce((sum, p) => sum + p.amountOwedTo, 0);
        if (totalOwedByOthers <= 0) continue;

        for (const payee of payees) {
          const proportion = payee.amountOwedTo / totalOwedByOthers;
          const amountOwedToPayee = Math.min(userOwed, userOwed * proportion);
          if (amountOwedToPayee > 0) {
            newDebts.push({
              split: { ...split, participants: enrichedParticipants },
              payee,
              amountOwed: parseFloat(amountOwedToPayee.toFixed(2)),
            });
          }
        }
      }

      setDebts(newDebts);
      console.log('User debts:', newDebts);
    } catch (error) {
      console.error('Error enriching bill splits:', error);
      setDebts([]);
    }
  }, [billSplits, settlements, user?.id, user?.name, fetchUserDetails]);

  useEffect(() => {
    enrichBillSplits();
  }, [enrichBillSplits]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBillSplitting();
      await enrichBillSplits();
      console.log('SettleUp refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      Alert.alert('Error', 'Failed to refresh debts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshBillSplitting, enrichBillSplits]);

  const handleSettleUp = useCallback(async (debt) => {
    const { split, payee, amountOwed } = debt;
    if (!user?.id) {
      Alert.alert('Error', 'User not logged in. Please log in and try again.');
      return;
    }

    const userParticipant = split.participants.find(p => String(p.user_id) === String(user.id));
    if (!userParticipant) {
      Alert.alert('Error', 'You are not a participant in this split.');
      return;
    }

    if (amountOwed <= 0) {
      Alert.alert('Error', 'No amount is owed to this participant.');
      return;
    }

    Alert.alert(
      'Confirm Settlement',
      `Are you sure you want to settle $${amountOwed.toFixed(2)} for "${split.name}" with ${payee.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            setSettling(`${split.id}-${payee.user_id}`);
            try {
              const updatedParticipants = split.participants.map(p => {
                if (String(p.user_id) === String(user.id)) {
                  return { ...p, paid_amount: (p.paid_amount || 0) + amountOwed };
                }
                return p;
              });

              const updatedSplit = {
                name: split.name,
                total_amount: split.total_amount,
                group_id: split.group_id,
                category: split.category || null,
                notes: split.notes || null,
                participants: updatedParticipants.map(p => ({
                  user_id: p.user_id,
                  share_amount: p.share_amount,
                  paid_amount: p.paid_amount,
                  split_method: p.split_method || 'equal',
                  split_value: p.split_value || 1,
                })),
              };

              console.log('Updating split with payload:', JSON.stringify(updatedSplit, null, 2));
              const response = await api.put(`/splits/bill_splits/${split.id}`, updatedSplit);
              console.log('Update response:', response.data);

              const settlement = {
                split_id: String(split.id),
                split_name: split.name,
                amount: amountOwed,
                payer_id: String(user.id),
                payee_id: String(payee.user_id),
                timestamp: new Date().toISOString(),
                method: null,
                notes: null,
              };
              await addSettlement(settlement);

              try {
                const group = groups?.find(g => String(g.id) === String(split.group_id));
                const groupName = group?.name || '';
                const username = user?.name || (await fetchCreatorUsername(user?.id)) || 'a user';
                const notificationMessage = groupName
                  ? `${username} settled $${amountOwed.toFixed(2)} for "${split.name}" in group "${groupName}".`
                  : `${username} settled $${amountOwed.toFixed(2)} for "${split.name}".`;
                await triggerNotification(
                  'Settlement Received',
                  notificationMessage,
                  { screen: 'SplitDetails', params: { splitId: split.id } },
                  payee.user_id
                );
              } catch (notificationError) {
                console.error('Error sending notification:', {
                  message: notificationError.message,
                  response: notificationError.response?.data,
                });
                Alert.alert('Warning', 'Settlement completed, but failed to notify the payee.');
              }

              // Navigate to SettleUp to refresh the screen
              navigation.replace('SettleUp');
              Alert.alert('Success', `You have settled $${amountOwed.toFixed(2)} for "${split.name}" with ${payee.name}.`);
            } catch (err) {
              console.error('Error settling up:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
              });
              const errorMessage = err.response?.data?.error || 'Failed to settle the amount. Please try again.';
              Alert.alert('Error', errorMessage);
            } finally {
              setSettling(null);
            }
          },
        },
      ]
    );
  }, [user?.id, user?.name, groups, addSettlement, navigation, fetchCreatorUsername, triggerNotification]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Dining Out': return 'restaurant-outline';
      case 'Groceries': return 'basket-outline';
      case 'Drinks': return 'wine-outline';
      case 'Transport': return 'car-outline';
      case 'Ride Share': return 'car-sport-outline';
      case 'Travel': return 'airplane-outline';
      case 'Hotel': return 'bed-outline';
      case 'Entertainment': return 'film-outline';
      case 'Activities': return 'tennisball-outline';
      case 'Shopping': return 'cart-outline';
      case 'Utilities': return 'flash-outline';
      case 'Rent': return 'home-outline';
      default: return 'receipt-outline';
    }
  };

  const renderDebtItem = useCallback(
    ({ item, index }) => {
      const { split, payee, amountOwed } = item;
      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        delay: index * 100,
        useNativeDriver: true,
      }).start();

      const categoryIcon = getCategoryIcon(split.category);
      const formattedDate = new Date(split.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <View style={styles.debtCard}>
            <View style={styles.debtIconContainer}>
              <View style={styles.debtIcon}>
                <Ionicons name={categoryIcon} size={24} color={colors.primaryGreen} />
              </View>
            </View>
            <View style={styles.debtContent}>
              <View style={styles.debtHeader}>
                <Text style={styles.debtName} numberOfLines={1}>
                  {split.name}
                </Text>
                <Text style={styles.debtAmount}>
                  ${split.total_amount.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.debtMetaContainer}>
                <View style={styles.debtDateContainer}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={styles.debtMetaIcon} />
                  <Text style={styles.debtMetaText}>{formattedDate}</Text>
                </View>
                <View style={styles.debtPayeeContainer}>
                  <Ionicons name="person-outline" size={14} color={colors.textSecondary} style={styles.debtMetaIcon} />
                  <Text style={styles.debtMetaText}>Pay to {payee.name}</Text>
                </View>
              </View>
              
              <View style={styles.debtDivider} />
              
              <View style={styles.debtFooter}>
                <View style={styles.debtShareContainer}>
                  <Text style={styles.debtShareLabel}>You owe:</Text>
                  <Text style={styles.debtShareAmount}>
                    ${amountOwed.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.settleButton, settling === `${split.id}-${payee.user_id}` && styles.settleButtonDisabled]}
                  onPress={() => handleSettleUp(item)}
                  activeOpacity={0.8}
                  disabled={settling === `${split.id}-${payee.user_id}`}
                >
                  {settling === `${split.id}-${payee.user_id}` ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={styles.settleButtonIcon} />
                      <Text style={styles.settleButtonText}>
                        Settle Up
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      );
    },
    [fadeAnim, settling, handleSettleUp]
  );

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settle Up</Text>
        </Animated.View>
        
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="wallet-outline" size={24} color={colors.white} />
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Total to Settle</Text>
              <Text style={styles.summaryAmount}>
                ${debts.reduce((sum, debt) => sum + debt.amountOwed, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
    [navigation, fadeAnim, debts]
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIconContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="checkmark-circle" size={40} color={colors.white} />
          </View>
        </View>
        <Text style={styles.emptyStateText}>All Settled Up!</Text>
        <Text style={styles.emptyStateSubtext}>You don't have any outstanding debts to settle at the moment.</Text>
        <TouchableOpacity style={styles.emptyStateButton} onPress={() => navigation.navigate('BillSplittingDashboard')}>
          <Text style={styles.emptyStateButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    ),
    [navigation]
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.primaryGreen} />
            <Text style={styles.loadingText}>Loading your debts...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="wifi-off" size={40} color={colors.errorRed} />
            </View>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
      <FlatList
        data={debts}
        renderItem={renderDebtItem}
        keyExtractor={item => `${item.split.id}-${item.payee.user_id}`}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primaryGreen]}
            tintColor={colors.primaryGreen}
            progressBackgroundColor={colors.white}
          />
        }
      />
    </SafeAreaView>
  );
};

// Styles remain unchanged
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 16,
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 12,
    fontFamily: 'Inter-Bold',
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    fontFamily: 'Inter-Bold',
  },
  debtCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  debtIconContainer: {
    width: 60,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    paddingTop: 16,
  },
  debtIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76,175,80,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtContent: {
    flex: 1,
    padding: 16,
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  debtName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
    marginRight: 8,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryGreen,
    fontFamily: 'Inter-Bold',
  },
  debtMetaContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  debtDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  debtPayeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  debtMetaIcon: {
    marginRight: 4,
  },
  debtMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  debtDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  debtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtShareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtShareLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 6,
    fontFamily: 'Inter-Medium',
  },
  debtShareAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.errorRed,
    fontFamily: 'Inter-Bold',
  },
  settleButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settleButtonIcon: {
    marginRight: 6,
  },
  settleButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  settleButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyStateIconContainer: {
    marginBottom: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  emptyStateButton: {
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
  emptyStateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: '#F8F9FA',
  },
  errorContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
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

export default SettleUp;