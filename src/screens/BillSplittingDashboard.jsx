import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useBillSplitting } from '../context/BillSplittingContext';
import colors from '../styles/colors';
import api from '../utils/api';

const BillSplittingDashboard = ({ navigation, route }) => {
  const { groups = [], billSplits = [], loading, error, refreshBillSplitting, user, settlements = [], triggerNotification, validateGroup } = useBillSplitting();
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [enrichedSplits, setEnrichedSplits] = useState([]);
  const [computedStats, setComputedStats] = useState({ totalOwed: 0, totalOwing: 0, netBalance: 0 });
  const [prevSplitCount, setPrevSplitCount] = useState(0);

  const sortedGroups = [...groups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    enrichBillSplits();
  }, [billSplits, fadeAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('BillSplittingDashboard focused, refreshing data');
      handleRefresh();
      if (route.params?.groupCreated) {
        console.log('Group creation detected, refreshing dashboard');
        if (sortedGroups.length > 0) {
          const latestGroup = sortedGroups[0];
          triggerNotification(
            'New Group Created',
            `Group "${latestGroup.name}" has been created.`,
            {
              screen: 'GroupDetails',
              params: { groupId: latestGroup.id, groupName: latestGroup.name },
            }
          );
        }
        navigation.setParams({ groupCreated: false });
      }
      if (route.params?.shouldRefresh) {
        handleRefresh();
        navigation.setParams({ shouldRefresh: false });
      }
    });

    return unsubscribe;
  }, [navigation, route.params?.groupCreated, route.params?.shouldRefresh, sortedGroups, triggerNotification]);

  useEffect(() => {
    console.log('Settlements in context:', settlements);
    console.log('Groups in context:', groups);
  }, [settlements, groups]);

  useEffect(() => {
    const computeStats = () => {
      let totalOwed = 0;
      let totalOwing = 0;

      enrichedSplits.forEach(split => {
        if (!user?.id) return;
        const participant = split.participants.find(p => String(p.user_id) === String(user.id));
        if (!participant) return;

        const yourShare = participant.share_amount || 0;
        const yourPaid = participant.paid_amount || 0;
        const amountOwed = yourShare - yourPaid;

        if (amountOwed > 0) {
          totalOwed += amountOwed;
        } else if (amountOwed < 0) {
          totalOwing += Math.abs(amountOwed);
        }
      });

      const netBalance = totalOwing - totalOwed;
      setComputedStats({ totalOwed, totalOwing, netBalance });
    };

    computeStats();
  }, [enrichedSplits, user?.id]);

  const enrichBillSplits = async () => {
    if (!billSplits.length) {
      setEnrichedSplits([]);
      setPrevSplitCount(0);
      return;
    }

    try {
      const enriched = await Promise.all(
        billSplits.map(async (split) => {
          const enrichedParticipants = await Promise.all(
            split.participants.map(async (p) => {
              if (!user?.id || String(p.user_id) === String(user.id)) {
                return { ...p, name: 'You' };
              }
              try {
                const response = await api.get('/splits/users/search', {
                  params: { q: p.user_id },
                });
                const userData = response.data.users.find(u => String(u.id) === String(p.user_id));
                return { ...p, name: userData?.name || `User ${p.user_id}` };
              } catch (err) {
                console.error(`Error fetching user ${p.user_id}:`, err);
                return { ...p, name: `User ${p.user_id}` };
              }
            })
          );
          return { ...split, participants: enrichedParticipants };
        })
      );
      setEnrichedSplits(enriched);
      setPrevSplitCount(billSplits.length);
    } catch (error) {
      console.error('Error enriching bill splits:', error);
      setEnrichedSplits(billSplits);
      setPrevSplitCount(billSplits.length);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (typeof refreshBillSplitting === 'function') {
        await refreshBillSplitting();
        console.log('Refreshed bill splitting data');
        if (billSplits.length > prevSplitCount) {
          await triggerNotification(
            'Data Refreshed',
            `Found ${billSplits.length - prevSplitCount} new bill split(s).`,
            { screen: 'BillSplittingDashboard' }
          );
        }
      } else {
        console.warn('refreshBillSplitting is not a function. Context might not be fully initialized.');
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBillSplitting, billSplits.length, prevSplitCount, triggerNotification]);

  const renderGroupItem = useCallback(
    ({ item, index }) => {
      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        delay: index * 100,
        useNativeDriver: true,
      }).start();

      const navigateToGroup = async () => {
        console.log(`Attempting navigation to group ${item.id}: ${item.name}`);
        const group = await validateGroup(item.id);
        if (!group) {
          console.warn(`Group ${item.id} not found, refreshing dashboard`);
          Alert.alert('Error', 'This group no longer exists.');
          await refreshBillSplitting();
          return;
        }
        console.log(`Navigating with groupId: ${item.id}, groupName: ${item.name}, group:`, group);
        navigation.navigate('GroupDetails', {
          groupId: String(item.id),
          groupName: item.name,
          group,
        });
      };

      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.groupCard}
            onPress={navigateToGroup}
            activeOpacity={0.8}
          >
            <View style={styles.groupIconContainer}>
              <Ionicons name="people" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.groupContent}>
              <Text style={styles.groupName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.groupMeta}>
                {item.members.length} {item.members.length === 1 ? 'member' : 'members'} • {item.type}
              </Text>
            </View>
            <View style={styles.groupArrowContainer}>
              <Ionicons name="chevron-forward" size={20} color={colors.primaryGreen} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [fadeAnim, navigation, validateGroup, refreshBillSplitting]
  );

  const renderSplitItem = useCallback(
    ({ item, index }) => {
      if (!user?.id) return null;
      const participant = item.participants.find(p => String(p.user_id) === String(user.id));
      const yourShare = participant?.share_amount || 0;
      const yourPaid = participant?.paid_amount || 0;
      const amountOwed = yourShare - yourPaid;
      const isCurrentUser = String(participant?.user_id) === String(user.id);

      const status = amountOwed > 0
        ? isCurrentUser
          ? 'to give'
          : item.creator_id === user?.id
          ? 'to take'
          : 'to give'
        : amountOwed < 0
        ? isCurrentUser
          ? 'to take'
          : item.creator_id === user?.id
          ? 'to give'
          : 'to take'
        : 'settled';

      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        delay: index * 100,
        useNativeDriver: true,
      }).start();

      console.log(`Split ${item.id} (${item.name}): Share=${yourShare}, Paid=${yourPaid}, Owed=${amountOwed}, isCurrentUser=${isCurrentUser}, Creator=${item.creator_id}, Status=${status}, Participants=`, item.participants);

      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.splitCard}
            onPress={() => {
              console.log(`Navigating to SplitDetails for split ${item.id}: ${item.name}`);
              navigation.navigate('SplitDetails', {
                splitId: String(item.id),
                splitName: item.name,
              });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.splitContent}>
              <View style={styles.splitHeader}>
                <Text style={styles.splitName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.splitAmount, { color: colors.primaryGreen }]}>
                  ${item.total_amount.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.splitMeta}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })} • {item.participants.map(p => p.name).join(', ')}
              </Text>
              <View style={styles.splitFooter}>
                <View style={styles.splitShareContainer}>
                  <Text style={styles.splitShareLabel}>Your share:</Text>
                  <Text
                    style={[
                      styles.splitShareAmount,
                      { color: amountOwed > 0 && status === 'to give' ? colors.errorRed : colors.successGreen },
                    ]}
                  >
                    ${yourShare.toFixed(2)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.splitStatusContainer,
                    status === 'to give' && styles.statusOweContainer,
                    status === 'to take' && styles.statusOwedContainer,
                    status === 'settled' && styles.statusSettledContainer,
                  ]}
                >
                  <Text
                    style={[
                      styles.splitStatus,
                      status === 'to give' ? styles.statusOwe : status === 'to take' ? styles.statusOwed : styles.statusSettled,
                    ]}
                  >
                    {status === 'to give'
                      ? `To Give $${Math.abs(amountOwed).toFixed(2)}`
                      : status === 'to take'
                      ? `To Take $${Math.abs(amountOwed).toFixed(2)}`
                      : 'Settled'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [user?.id, fadeAnim, navigation]
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
          <Text style={styles.loadingText}>Loading your expenses...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <Ionicons name="wifi-off-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primaryGreen]}
            tintColor={colors.primaryGreen}
            progressBackgroundColor={colors.white}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Bill Splitting</Text>
              <Text style={styles.headerSubtitle}>Track and manage shared expenses</Text>
            </View>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('AllSplits')}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.statsGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('SettleUp')}
            >
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>To Give</Text>
                  <View style={styles.statIconWrapper}>
                    <Ionicons name="arrow-up" size={16} color={colors.errorRed} />
                  </View>
                </View>
                <Text style={[styles.statValue, { color: colors.errorRed }]}>
                  ${computedStats.totalOwed.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CollectUp')}
            >
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>To Take</Text>
                  <View style={styles.statIconWrapper}>
                    <Ionicons name="arrow-down" size={16} color={colors.successGreen} />
                  </View>
                </View>
                <Text style={[styles.statValue, { color: colors.successGreen }]}>
                  ${computedStats.totalOwing.toFixed(2)}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>Net Balance</Text>
                <View style={styles.statIconWrapper}>
                  <Ionicons
                    name={computedStats.netBalance < 0 ? 'remove' : 'add'}
                    size={16}
                    color={computedStats.netBalance < 0 ? colors.errorRed : colors.successGreen}
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.statValue,
                  { color: computedStats.netBalance < 0 ? colors.errorRed : colors.successGreen },
                ]}
              >
                ${Math.abs(computedStats.netBalance).toFixed(2)}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrapper}>
                <Ionicons name="people" size={20} color={colors.primaryGreen} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Your Groups</Text>
              </View>
              <TouchableOpacity
                style={styles.newButton}
                onPress={() => navigation.navigate('NewGroup')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.textPrimary} />
                <Text style={styles.newButtonText}>New Group</Text>
              </TouchableOpacity>
            </View>

            {sortedGroups.length > 0 ? (
              <FlatList
                data={sortedGroups.slice(0, 3)}
                renderItem={renderGroupItem}
                keyExtractor={item => String(item.id)}
                scrollEnabled={false}
                ListFooterComponent={
                  sortedGroups.length > 3 ? (
                    <TouchableOpacity
                      style={styles.seeMoreButton}
                      onPress={() => navigation.navigate('AllGroups')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.seeMoreText}>
                        See all {sortedGroups.length} groups
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primaryGreen} />
                    </TouchableOpacity>
                  ) : null
                }
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="people-outline" size={32} color={colors.textPrimary} />
                </View>
                <Text style={styles.emptyStateText}>No groups yet</Text>
                <Text style={styles.emptyStateSubtext}>Create a group to start splitting bills</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('NewGroup')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrapper}>
                <Ionicons name="receipt" size={20} color={colors.primaryGreen} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Recent Splits</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => navigation.navigate('AllSplits')}
                activeOpacity={0.8}
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {enrichedSplits.length > 0 ? (
              <FlatList
                data={enrichedSplits.slice(0, 3)}
                renderItem={renderSplitItem}
                keyExtractor={item => String(item.id)}
                scrollEnabled={false}
                ListFooterComponent={
                  enrichedSplits.length > 3 ? (
                    <TouchableOpacity
                      style={styles.seeMoreButton}
                      onPress={() => navigation.navigate('AllSplits')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.seeMoreText}>
                        See all {enrichedSplits.length} splits
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primaryGreen} />
                    </TouchableOpacity>
                  ) : null
                }
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="receipt-outline" size={32} color={colors.textPrimary} />
                </View>
                <Text style={styles.emptyStateText}>No recent splits</Text>
                <Text style={styles.emptyStateSubtext}>Add expenses within a group</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
          }}
        >
          <View style={styles.section}>
            <View style={styles.sectionTitleWrapper}>
              <Ionicons name="flash" size={20} color={colors.primaryGreen} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('NewGroup')}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.primaryGreenLight }]}>
                  <Ionicons name="people-outline" size={24} color={colors.primaryGreen} />
                </View>
                <Text style={styles.actionText}>New Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('SettleUp')}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="cash-outline" size={24} color={colors.successGreen} />
                </View>
                <Text style={styles.actionText}>Settle Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Medium',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  statIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Inter-Bold',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryGreenLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  newButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Inter-SemiBold',
  },
  seeAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.primaryGreenLight,
    borderRadius: 12,
  },
  seeAllText: {
    color: colors.primaryGreen,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  groupContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  groupMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  groupArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitContent: {
    flex: 1,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  splitName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  splitMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  splitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitShareContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitShareLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  splitShareAmount: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  splitStatusContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusOweContainer: {
    backgroundColor: colors.dangerLight,
  },
  statusOwedContainer: {
    backgroundColor: colors.successLight,
  },
  statusSettledContainer: {
    backgroundColor: colors.lightGray,
  },
  splitStatus: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  statusOwe: {
    color: colors.errorRed,
  },
  statusOwed: {
    color: colors.successGreen,
  },
  statusSettled: {
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.white,
    borderRadius: 16,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  primaryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  seeMoreText: {
    color: colors.primaryGreen,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
    fontFamily: 'Inter-SemiBold',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    fontFamily: 'Inter-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'Inter-Medium',
  },
  retryButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  retryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default BillSplittingDashboard;