import { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import colors from '../styles/colors';
import { getGroup, searchUsers } from '../utils/api';

const userCache = {};

const GroupDetails = ({ navigation, route }) => {
  const { group: initialGroup, groupId, groupName } = route.params || {};
  const { groups, billSplits, user, refreshBillSplitting, validateGroup } = useBillSplitting();
  const [group, setGroup] = useState(initialGroup || null);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(!initialGroup);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const fetchUserDetails = useCallback(async userId => {
    if (userCache[userId]) {
      return userCache[userId];
    }

    try {
      const response = await searchUsers(userId);
      const userData = response.data.users.find(u => String(u.id) === String(userId));
      const userDetails = {
        id: userId,
        name: userData?.name || `User ${userId}`,
        email: userData?.email,
        profilePicture: userData?.profilePicture,
      };
      userCache[userId] = userDetails;
      return userDetails;
    } catch (err) {
      console.error(
        `Error fetching user ${userId}:`,
        err.response?.data || err.message,
      );
      return {
        id: userId,
        name: `User ${userId}`,
      };
    }
  }, []);

  const enrichMembers = useCallback(
    async groupData => {
      if (!Array.isArray(groupData.members) || groupData.members.length === 0) {
        return { ...groupData, members: [] };
      }

      if (
        typeof groupData.members[0] === 'object' &&
        'name' in groupData.members[0]
      ) {
        console.log('Group members already enriched:', groupData.members);
        return groupData;
      }

      try {
        const enrichedMembers = await Promise.all(
          groupData.members.map(async memberId => {
            if (String(memberId) === String(user?.id)) {
              return {
                id: memberId,
                name: 'You',
                email: user?.email,
                profilePicture: user?.profilePicture,
              };
            }
            return await fetchUserDetails(memberId);
          }),
        );
        console.log('Enriched members:', enrichedMembers);
        return { ...groupData, members: enrichedMembers };
      } catch (error) {
        console.error('Error enriching members:', error);
        return {
          ...groupData,
          members: groupData.members.map(id => ({
            id,
            name: String(id) === String(user?.id) ? 'You' : `User ${id}`,
          })),
        };
      }
    },
    [user, fetchUserDetails],
  );

  const fetchGroupData = useCallback(async () => {
    if (!groupId || isDeleted) return;

    setLoading(true);
    setError(null);

    try {
      const groupData = await validateGroup(groupId);
      if (!groupData) {
        throw new Error('Group not found');
      }
      const enrichedGroup = await enrichMembers(groupData);
      setGroup(enrichedGroup);
      const groupSplits = billSplits.filter(
        split => split && String(split.group_id) === String(enrichedGroup.id),
      );
      setSplits(groupSplits);
    } catch (error) {
      console.error(
        'Error fetching group data:',
        error.response?.data || error.message,
      );
      if (error.response?.status === 404 || error.message === 'Group not found') {
        setError('This group no longer exists.');
        setIsDeleted(true);
        Alert.alert('Error', 'This group no longer exists.', [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Tabs', params: { screen: 'BillSplitting' } }],
              }),
          },
        ]);
      } else if (error.response?.status === 403) {
        setError("You don't have access to this group.");
        Alert.alert('Error', "You don't have access to this group.", [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Tabs', { screen: 'BillSplitting' }),
          },
        ]);
      } else {
        setError(
          error.response?.data?.error || 'Failed to load group details.',
        );
        Alert.alert(
          'Error',
          'Failed to load group details: ' +
            (error.response?.data?.error || 'Unknown error'),
        );
      }
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, navigation, billSplits, enrichMembers, isDeleted, validateGroup]);

  const updateFromContext = useCallback(() => {
    if (isDeleted) return;

    const contextGroup = groups.find(g => String(g.id) === String(groupId));
    if (contextGroup) {
      setGroup(prevGroup => {
        const members = prevGroup?.members || contextGroup.members;
        const updatedGroup = { ...contextGroup, members };
        if (
          JSON.stringify(prevGroup) !== JSON.stringify(updatedGroup)
        ) {
          return updatedGroup;
        }
        return prevGroup;
      });
      const groupSplits = billSplits.filter(
        split => split && String(split.group_id) === String(contextGroup.id),
      );
      setSplits(prevSplits => {
        if (JSON.stringify(prevSplits) !== JSON.stringify(groupSplits)) {
          return groupSplits;
        }
        return prevSplits;
      });
    } else if (groups.length > 0 && !contextGroup) {
      setError('This group no longer exists.');
      setIsDeleted(true);
      Alert.alert('Error', 'This group no longer exists.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Tabs', params: { screen: 'BillSplitting' } }],
            }),
        },
      ]);
      setGroup(null);
    }
  }, [groups, billSplits, groupId, isDeleted, navigation]);

  useEffect(() => {
    let isMounted = true;

    if (!groupId && !initialGroup) {
      if (isMounted) {
        setError('No group or group ID provided.');
        Alert.alert('Error', 'No group or group ID provided.', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Tabs', { screen: 'BillSplitting' }),
          },
        ]);
      }
      return;
    }

    if (initialGroup) {
      console.log('Using initialGroup:', initialGroup);
      enrichMembers(initialGroup)
        .then(enrichedGroup => {
          if (isMounted) {
            setGroup(enrichedGroup);
            const groupSplits = billSplits.filter(
              split => split && String(split.group_id) === String(enrichedGroup.id),
            );
            setSplits(groupSplits);
            setLoading(false);
          }
        })
        .catch(error => {
          if (isMounted) {
            console.error('Error enriching initial group members:', error);
            setError('Failed to load group members.');
            Alert.alert('Error', 'Failed to load group members.');
            setGroup(null);
            setLoading(false);
          }
        });
    } else if (groupId) {
      console.log('Fetching group data for groupId:', groupId);
      fetchGroupData();
    }

    return () => {
      isMounted = false;
    };
  }, [groupId, initialGroup, billSplits, fetchGroupData, enrichMembers, navigation]);

  useFocusEffect(
    useCallback(() => {
      console.log(
        `GroupDetails focused with groupId: ${groupId}, initialGroup:`,
        initialGroup,
      );
      if (!isDeleted) {
        updateFromContext();
        if (!initialGroup) {
          fetchGroupData();
        }
      }
    }, [groupId, initialGroup, updateFromContext, fetchGroupData, isDeleted]),
  );

  const handleRefresh = async () => {
    if (isDeleted) return;
    setRefreshing(true);
    try {
      await refreshBillSplitting();
      if (groupId) {
        await fetchGroupData();
      }
    } catch (error) {
      console.error('Refresh error:', error);
      setError('Failed to refresh group details.');
      Alert.alert('Error', 'Failed to refresh group details.');
    } finally {
      setRefreshing(false);
    }
  };

  const navigateToNewExpense = async () => {
    try {
      const groupData = await validateGroup(groupId);
      if (!groupData) {
        Alert.alert(
          'Invalid Group',
          'This group no longer exists. Returning to dashboard.',
          [{
            text: 'OK',
            onPress: () => navigation.navigate('Tabs', { screen: 'BillSplitting' }),
          }],
        );
        return;
      }
      navigation.navigate('NewExpense', { groupId: group.id });
    } catch (error) {
      console.error('Error validating group for NewExpense:', error);
      Alert.alert('Error', 'Failed to verify group. Please try again.');
    }
  };

  const renderSplitItem = useCallback(
    ({ item }) => {
      const yourShare =
        item.participants.find(p => String(p.user_id) === String(user?.id))?.share_amount || 0;
      const amountOwed =
        item.participants.find(p => String(p.user_id) === String(user?.id))?.amount_owed || 0;
      const status =
        amountOwed > 0
          ? String(item.creator_id) === String(user?.id)
            ? 'to take'
            : 'to give'
          : 'settled';

      return (
        <Animated.View style={[styles.splitCard, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('SplitDetails', { splitId: item.id })
            }
            activeOpacity={0.7}
          >
            <View style={styles.splitHeader}>
              <View style={styles.splitNameContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={20}
                  color={colors.primaryGreen}
                  style={styles.splitIcon}
                />
                <Text style={styles.splitName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.splitAmount}>
                ${item.total_amount.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.splitMeta}>
              {new Date(item.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              • {item.participants.length}{' '}
              {item.participants.length === 1 ? 'person' : 'people'}
            </Text>
            <View style={styles.splitFooter}>
              <View style={styles.splitShareContainer}>
                <Text style={styles.splitShareLabel}>Your share:</Text>
                <Text style={styles.splitShareAmount}>
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
                    status === 'to give' && styles.statusOwe,
                    status === 'to take' && styles.statusOwed,
                    status === 'settled' && styles.statusSettled,
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
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [user?.id, fadeAnim, navigation],
  );

  const renderMember = useCallback(
    ({ item }) => {
      const memberName =
        item.name || (String(item.id) === String(user?.id) ? 'You' : `User ${item.id}`);
      return (
        <View style={styles.memberRow}>
          <View style={styles.memberAvatarContainer}>
            <Ionicons name="person" size={20} color={colors.white} />
          </View>
          <Text style={styles.memberName}>{memberName}</Text>
          {String(item.id) === String(user?.id) && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>Me</Text>
            </View>
          )}
        </View>
      );
    },
    [user?.id],
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryGreen} />
          <Text style={styles.loadingText}>Loading group details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={colors.background}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="sad-outline" size={40} color={colors.white} />
          </View>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error || 'Group not found'}</Text>
          <TouchableOpacity
            style={styles.backButtonError}
            onPress={() => navigation.navigate('Tabs', { screen: 'BillSplitting' })}
          >
            <Text style={styles.backButtonText}>Back to Dashboard</Text>
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
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primaryGreen]}
            tintColor={colors.primaryGreen}
          />
        }
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Tabs', { screen: 'BillSplitting' })}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{group.name}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.groupCard,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.groupInfo}>
            <View style={styles.groupIconContainer}>
              <Ionicons name="people" size={24} color={colors.white} />
            </View>
            <View style={styles.groupDetails}>
              <Text style={styles.groupType}>{group.type}</Text>
              <Text style={styles.groupMeta}>
                {group.members.length}{' '}
                {group.members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={navigateToNewExpense}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.white}
                style={styles.actionButtonIcon}
              />
              <Text style={styles.actionButtonText}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => navigation.navigate('EditGroup', { group, user })}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.white}
                style={styles.actionButtonIcon}
              />
              <Text style={styles.actionButtonText}>Edit Group</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.sectionTitleWrapper}>
            <Ionicons
              name="people"
              size={20}
              color={colors.primaryGreen}
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Members</Text>
          </View>
          <View style={styles.membersContainer}>
            <FlatList
              data={group.members}
              renderItem={renderMember}
              keyExtractor={item =>
                (typeof item === 'object' ? item.id : item).toString()
              }
              scrollEnabled={false}
              extraData={group}
              ListEmptyComponent={
                <View style={styles.emptyMembers}>
                  <Text style={styles.emptyText}>No members yet</Text>
                </View>
              }
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.sectionTitleWrapper}>
            <Ionicons
              name="receipt"
              size={20}
              color={colors.primaryGreen}
              style={styles.sectionIcon}
            />
            <Text style={styles.sectionTitle}>Expenses</Text>
          </View>
          {splits.length > 0 ? (
            <FlatList
              data={splits}
              renderItem={renderSplitItem}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={32}
                  color={colors.white}
                />
              </View>
              <Text style={styles.emptyStateText}>No expenses yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first expense to start tracking
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={navigateToNewExpense}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={colors.white}
                  style={styles.addButtonIcon}
                />
                <Text style={styles.addButtonText}>Add an Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingActionButton}
        onPress={navigateToNewExpense}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
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
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 16,
    fontFamily: 'Inter-Bold',
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  groupDetails: {
    marginLeft: 16,
  },
  groupType: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  groupMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  editButton: {
    backgroundColor: colors.darkGray,
    shadowColor: colors.darkGray,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Inter-Bold',
  },
  membersContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 4,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  memberAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  memberName: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    fontFamily: 'Inter-Medium',
  },
  youBadge: {
    backgroundColor: colors.primaryGreenLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  youBadgeText: {
    fontSize: 12,
    color: colors.primaryGreen,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  splitCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  splitNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitIcon: {
    marginRight: 8,
  },
  splitName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    fontFamily: 'Inter-SemiBold',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryGreen,
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
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 4,
    fontFamily: 'Inter-Regular',
  },
  splitShareAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
    backgroundColor: colors.primaryGreenLight,
  },
  statusSettledContainer: {
    backgroundColor: colors.lightGray,
  },
  splitStatus: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  statusOwe: {
    color: colors.danger,
  },
  statusOwed: {
    color: colors.primaryGreen,
  },
  statusSettled: {
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  emptyMembers: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  backButtonError: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default GroupDetails;