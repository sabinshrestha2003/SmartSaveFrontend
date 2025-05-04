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

const CollectUp = ({ navigation }) => {
  const { billSplits = [], settlements = [], loading, error, refreshBillSplitting, user, triggerNotification, groups } = useBillSplitting();
  const [refreshing, setRefreshing] = useState(false);
  const [notifying, setNotifying] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [credits, setCredits] = useState([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    navigation.setOptions({
      title: 'Collect Up',
    });
  }, [navigation, fadeAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('CollectUp focused');
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
      setCredits([]);
      return;
    }

    try {
      const newCredits = [];
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
        const isCreator = String(split.creator_id) === String(user?.id);

        const splitSettlements = settlements.filter(s => String(s.split_id) === String(split.id));
        const settledAmounts = {};
        splitSettlements.forEach(s => {
          const debtorId = String(s.payer_id);
          settledAmounts[debtorId] = (settledAmounts[debtorId] || 0) + s.amount;
        });

        const debtors = enrichedParticipants
          .filter(p => String(p.user_id) !== String(user.id))
          .map(p => {
            const shareAmount = p.share_amount || 0;
            const paidAmount = p.paid_amount || 0;
            const settled = settledAmounts[p.user_id] || 0;
            const amountOwedBy = Math.max(0, shareAmount - paidAmount - settled);
            return { ...p, amountOwedBy };
          })
          .filter(p => p.amountOwedBy > 0);

        if (!debtors.length) continue;

        for (const debtor of debtors) {
          newCredits.push({
            split: { ...split, participants: enrichedParticipants },
            debtor,
            amountOwed: parseFloat(debtor.amountOwedBy.toFixed(2)),
          });
        }
      }

      setCredits(newCredits);
      console.log('User credits:', newCredits);
    } catch (error) {
      console.error('Error enriching bill splits for credits:', error);
      setCredits([]);
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
      console.log('CollectUp refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      Alert.alert('Error', 'Failed to refresh credits. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshBillSplitting, enrichBillSplits]);

  const handleRemind = useCallback(async (credit) => {
    const { split, debtor, amountOwed } = credit;
    if (!user?.id) {
      Alert.alert('Error', 'User not logged in. Please log in and try again.');
      return;
    }

    Alert.alert(
      'Send Reminder',
      `Send a reminder to ${debtor.name} to settle $${amountOwed.toFixed(2)} for "${split.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setNotifying(`${split.id}-${debtor.user_id}`);
            try {
              const group = groups?.find(g => String(g.id) === String(split.group_id));
              const groupName = group?.name || '';
              const username = user?.name || (await fetchCreatorUsername(user?.id)) || 'a user';
              const notificationMessage = groupName
                ? `${username} sent a reminder to settle $${amountOwed.toFixed(2)} for "${split.name}" in group "${groupName}".`
                : `${username} sent a reminder to settle $${amountOwed.toFixed(2)} for "${split.name}".`;
              await triggerNotification(
                'Settlement Reminder',
                notificationMessage,
                { screen: 'SettleUp', params: { splitId: split.id } },
                debtor.user_id
              );
              Alert.alert('Success', `Reminder sent to ${debtor.name} for $${amountOwed.toFixed(2)}.`);
            } catch (err) {
              console.error('Error sending reminder:', {
                message: err.message,
                response: err.response?.data,
              });
              Alert.alert('Error', 'Failed to send reminder. Please try again.');
            } finally {
              setNotifying(null);
            }
          },
        },
      ]
    );
  }, [user?.id, user?.name, groups, triggerNotification, fetchCreatorUsername]);

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

  const renderCreditItem = useCallback(
    ({ item, index }) => {
      const { split, debtor, amountOwed } = item;
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
          <View style={styles.creditCard}>
            <View style={styles.creditIconContainer}>
              <View style={styles.creditIcon}>
                <Ionicons name={categoryIcon} size={24} color={colors.primaryGreen} />
              </View>
            </View>
            <View style={styles.creditContent}>
              <View style={styles.creditHeader}>
                <Text style={styles.creditName} numberOfLines={1}>
                  {split.name}
                </Text>
                <Text style={styles.creditAmount}>
                  ${split.total_amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.creditMetaContainer}>
                <View style={styles.creditDateContainer}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} style={styles.creditMetaIcon} />
                  <Text style={styles.creditMetaText}>{formattedDate}</Text>
                </View>
                <View style={styles.creditDebtorContainer}>
                  <Ionicons name="person-outline" size={14} color={colors.textSecondary} style={styles.creditMetaIcon} />
                  <Text style={styles.creditMetaText}>Owed by {debtor.name}</Text>
                </View>
              </View>

              <View style={styles.creditDivider} />

              <View style={styles.creditFooter}>
                <View style={styles.creditShareContainer}>
                  <Text style={styles.creditShareLabel}>You are owed:</Text>
                  <Text style={styles.creditShareAmount}>
                    ${amountOwed.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.remindButton, notifying === `${split.id}-${debtor.user_id}` && styles.remindButtonDisabled]}
                  onPress={() => handleRemind(item)}
                  activeOpacity={0.8}
                  disabled={notifying === `${split.id}-${debtor.user_id}`}
                >
                  {notifying === `${split.id}-${debtor.user_id}` ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="notifications-outline" size={16} color={colors.white} style={styles.remindButtonIcon} />
                      <Text style={styles.remindButtonText}>
                        Remind
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
    [fadeAnim, notifying, handleRemind]
  );

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.headerContainer}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Collect Up</Text>
        </Animated.View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="wallet-outline" size={24} color={colors.white} />
            </View>
            <View style={styles.summaryContent}>
              <Text style={styles.summaryTitle}>Total to Collect</Text>
              <Text style={styles.summaryAmount}>
                ${credits.reduce((sum, credit) => sum + credit.amountOwed, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
    [navigation, fadeAnim, credits]
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIconContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="checkmark-circle" size={40} color={colors.white} />
          </View>
        </View>
        <Text style={styles.emptyStateText}>All Collected!</Text>
        <Text style={styles.emptyStateSubtext}>You don't have any outstanding amounts to collect at the moment.</Text>
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
            <Text style={styles.loadingText}>Loading your credits...</Text>
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
        data={credits}
        renderItem={renderCreditItem}
        keyExtractor={item => `${item.split.id}-${item.debtor.user_id}`}
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
  creditCard: {
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
  creditIconContainer: {
    width: 60,
    backgroundColor: 'rgba(0,0,0,0.02)',
    alignItems: 'center',
    paddingTop: 16,
  },
  creditIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76,175,80,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditContent: {
    flex: 1,
    padding: 16,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creditName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
    marginRight: 8,
  },
  creditAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryGreen,
    fontFamily: 'Inter-Bold',
  },
  creditMetaContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  creditDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  creditDebtorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  creditMetaIcon: {
    marginRight: 4,
  },
  creditMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  creditDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  creditFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditShareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditShareLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 6,
    fontFamily: 'Inter-Medium',
  },
  creditShareAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.successGreen,
    fontFamily: 'Inter-Bold',
  },
  remindButton: {
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
  remindButtonIcon: {
    marginRight: 6,
  },
  remindButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  remindButtonText: {
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

export default CollectUp;