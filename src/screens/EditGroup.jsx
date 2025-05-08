import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../styles/colors';
import api from '../utils/api';
import { useBillSplitting } from '../context/BillSplittingContext';

const EditGroup = ({ navigation, route }) => {
  const { group: initialGroup } = route.params || {};
  const { refreshBillSplitting, removeGroup, triggerNotification } = useBillSplitting();

  const [groupName, setGroupName] = useState(initialGroup?.name || '');
  const [groupType, setGroupType] = useState(initialGroup?.type || 'Custom');
  const [members, setMembers] = useState(initialGroup?.members || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const searchInputRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({
      title: 'Edit Group',
    });
    if (!initialGroup) {
      Alert.alert('Error', 'No group data provided.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [navigation, initialGroup, searchTimeout]);

  useEffect(() => {
    if (searchQuery.trim()) {
      if (searchTimeout) clearTimeout(searchTimeout);
      const isNumericId = /^\d{6}$/.test(searchQuery);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery);
      if (isNumericId || isEmail) {
        handleSearch();
      } else {
        setSearchTimeout(setTimeout(handleSearch, 500));
      }
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/splits/users/search', {
        params: { q: searchQuery },
      });
      if (!response.data || !Array.isArray(response.data.users)) {
        throw new Error('Invalid API response: "users" array expected');
      }
      setSearchResults(
        response.data.users
          .map(user => ({ ...user, id: String(user.id) }))
          .filter(user => !members.some(m => String(m.id) === String(user.id))),
      );
    } catch (error) {
      console.error('Search error:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.status === 404
          ? 'User search endpoint not found.'
          : error.response?.data?.error || 'Failed to search users.',
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addMember = user => {
    setMembers([
      ...members,
      { id: String(user.id), name: user.name, email: user.email },
    ]);
    setSearchQuery('');
    setSearchResults([]);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const removeMember = memberId => {
    setMembers(members.filter(m => String(m.id) !== String(memberId)));
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    setSaving(true);
    try {
      const updatedGroup = {
        name: groupName.trim(),
        type: groupType,
        members: members.map(m => String(m.id)),
      };

      console.log('Updating group:', initialGroup.id, updatedGroup);
      const response = await api.put(`/splits/groups/${initialGroup.id}`, updatedGroup);
      console.log('Update response:', response.data);
      await refreshBillSplitting();

      for (const member of members) {
        await triggerNotification(
          'Group Updated',
          `The group "${groupName.trim()}" has been updated.`,
          {
            screen: 'GroupDetails',
            params: { groupId: initialGroup.id, groupName: groupName.trim() },
          },
          member.id,
        );
      }

      Alert.alert('Success', 'Group updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Update group error:', error.response?.data || error.message);
      let errorMessage = 'Failed to update group';
      if (error.response) {
        if (error.response.status === 403) {
          errorMessage = 'Only the group creator can edit this group';
        } else if (error.response.status === 404) {
          errorMessage = 'Group not found';
        } else {
          errorMessage = error.response.data?.error || errorMessage;
        }
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              console.log('Attempting to delete group:', initialGroup.id);
              const response = await api.delete(`/splits/groups/${initialGroup.id}`);
              console.log('Delete response:', response.data);
              removeGroup(initialGroup.id);
              console.log(`Removed group ${initialGroup.id} from context (EditGroup)`);
              await refreshBillSplitting();
              for (const member of initialGroup.members) {
                await triggerNotification(
                  'Group Deleted',
                  `The group "${initialGroup.name}" has been deleted.`,
                  { screen: 'BillSplittingDashboard' },
                  member.id,
                );
              }
              navigation.navigate('Tabs', { screen: 'BillSplittingDashboard', params: { shouldRefresh: true } });
              Alert.alert('Success', 'Group deleted successfully');
            } catch (error) {
              console.error('Delete group error:', error.response?.data || error.message);
              let errorMessage = 'Failed to delete group';
              if (error.response) {
                if (error.response.status === 403) {
                  errorMessage = 'Only the group creator can delete this group';
                } else if (error.response.status === 404) {
                  errorMessage = 'Group not found';
                } else {
                  errorMessage = error.response.data?.error || errorMessage;
                }
              }
              Alert.alert('Error', errorMessage);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitial}>
          {item.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name || 'Unknown'}</Text>
        <Text style={styles.memberEmail}>{item.email || `ID: ${item.id}`}</Text>
      </View>
      <TouchableOpacity
        onPress={() => removeMember(item.id)}
        style={styles.removeButton}
        activeOpacity={0.7}
      >
        <View style={styles.removeButtonCircle}>
          <Ionicons name="close" size={16} color={colors.white} />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResult}
      onPress={() => addMember(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchResultAvatar}>
        <Text style={styles.searchResultInitial}>
          {item.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name || 'Unknown'}</Text>
        <Text style={styles.searchResultEmail}>
          {item.email || `ID: ${item.id}`}
        </Text>
      </View>
      <View style={styles.addIconContainer}>
        <Ionicons name="add" size={20} color={colors.white} />
      </View>
    </TouchableOpacity>
  );

  const renderMainContent = () => (
    <View style={styles.formContainer}>
      <View style={styles.card}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Group Name</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="people"
              size={20}
              color={colors.primaryGreen}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name"
              placeholderTextColor={colors.textSecondary}
              maxLength={100}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Group Type</Text>
          <View style={styles.typeContainer}>
            {['Trip', 'Home', 'Event', 'Custom'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  groupType === type && styles.typeButtonSelected,
                ]}
                onPress={() => setGroupType(type)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    type === 'Trip'
                      ? 'airplane'
                      : type === 'Home'
                      ? 'home'
                      : type === 'Event'
                      ? 'calendar'
                      : 'options'
                  }
                  size={18}
                  color={groupType === type ? colors.white : colors.primaryGreen}
                  style={styles.typeIcon}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    groupType === type && styles.typeButtonTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Add Members</Text>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={colors.primaryGreen}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by User ID or Email"
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              keyboardType="default"
              accessibilityLabel="Search users by ID or email"
            />
            {loading && (
              <ActivityIndicator
                size="small"
                color={colors.primaryGreen}
                style={styles.searchLoading}
              />
            )}
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={item => item.id}
                style={styles.searchResultsList}
                scrollEnabled={true}
                ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.membersContainer}>
          <View style={styles.membersHeader}>
            <View style={styles.membersTitleContainer}>
              <Ionicons
                name="people"
                size={20}
                color={colors.primaryGreen}
                style={styles.membersTitleIcon}
              />
              <Text style={styles.membersTitle}>Current Members</Text>
            </View>
            <View style={styles.membersCountBadge}>
              <Text style={styles.membersCount}>{members.length}</Text>
            </View>
          </View>

          {members.length > 0 ? (
            <FlatList
              data={members}
              renderItem={renderMember}
              keyExtractor={item => String(item.id)}
              style={styles.membersList}
              scrollEnabled={true}
              ItemSeparatorComponent={() => <View style={styles.memberSeparator} />}
            />
          ) : (
            <View style={styles.emptyMembers}>
              <Ionicons
                name="people-outline"
                size={40}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyMembersText}>
                No members added yet. Search by ID or email to add.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Group</Text>
        </View>

        <FlatList
          data={[1]}
          renderItem={() => renderMainContent()}
          keyExtractor={() => 'main-content'}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />

        <View style={styles.bottomBar}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.deleteButton, saving && styles.buttonDisabled]}
              onPress={handleDelete}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.white}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.buttonText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={20}
                    color={colors.white}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.buttonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    paddingBottom: 0,
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
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
    fontFamily: 'Inter-SemiBold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 12,
    overflow: 'hidden',
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
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: colors.background,
  },
  typeIcon: {
    marginRight: 8,
  },
  typeButtonSelected: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    fontFamily: 'Inter-Medium',
  },
  typeButtonTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter-Regular',
  },
  searchLoading: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    marginTop: 12,
    maxHeight: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  searchResultsList: {
    backgroundColor: colors.background,
  },
  resultSeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 60,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryGreen,
    fontFamily: 'Inter-SemiBold',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    fontFamily: 'Inter-SemiBold',
  },
  searchResultEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  addIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersContainer: {
    flex: 1,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  membersTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersTitleIcon: {
    marginRight: 8,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  membersCountBadge: {
    backgroundColor: colors.primaryGreenLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  membersCount: {
    fontSize: 14,
    color: colors.primaryGreen,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  membersList: {
    maxHeight: 300,
  },
  memberSeparator: {
    height: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryGreen,
    fontFamily: 'Inter-SemiBold',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  memberEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.errorRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMembers: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMembersText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.errorRed,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primaryGreen,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: colors.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

export default EditGroup;