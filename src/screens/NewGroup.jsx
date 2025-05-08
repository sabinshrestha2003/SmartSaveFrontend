import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import api from '../utils/api';
import colors from '../styles/colors';
import { useBillSplitting } from '../context/BillSplittingContext';

const userCache = {};

const NewGroup = ({ navigation, route }) => {
  const { refreshBillSplitting, user, triggerNotification } = useBillSplitting();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Custom',
    members: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [addedUsers, setAddedUsers] = useState({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchTimeout]);

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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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

      const filteredResults = response.data.users
        .map(user => ({ ...user, id: String(user.id) }))
        .filter(u => !formData.members.includes(u.id));

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.status === 404
          ? 'User search endpoint not found. Please check your server configuration.'
          : error.response?.data?.error || 'Failed to search users. Please try again later.'
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addMember = useCallback(
    async (user) => {
      const userId = String(user.id);
      if (!formData.members.includes(userId)) {
        setLoading(true);
        try {
          const userDetails = await fetchUserDetails(userId);
          setFormData(prev => ({
            ...prev,
            members: [...prev.members, userId],
          }));
          setAddedUsers(prev => ({
            ...prev,
            [userId]: {
              id: userId,
              name: userDetails.name,
              email: userDetails.email,
              profilePicture: userDetails.profilePicture,
            },
          }));
          setSearchResults([]);
          setSearchQuery('');
        } catch (error) {
          console.error('Error adding member:', error.message);
          Alert.alert('Error', 'Failed to add member. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    },
    [formData.members, fetchUserDetails]
  );

  const removeMember = useCallback(
    (userId) => {
      const scaleAnim = new Animated.Value(1);
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setFormData(prev => ({
          ...prev,
          members: prev.members.filter(id => id !== userId),
        }));
        setAddedUsers(prev => {
          const newAddedUsers = { ...prev };
          delete newAddedUsers[userId];
          return newAddedUsers;
        });
      });
    },
    []
  );

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Group name is required.');
      return;
    }
    if (formData.members.length === 0) {
      Alert.alert('Error', 'At least one member is required.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/splits/groups', {
        name: formData.name.trim(),
        type: formData.type,
        members: formData.members,
      });

      if (!response.data || !response.data.group) {
        throw new Error('Invalid API response: "group" object expected');
      }

      const newGroup = response.data.group;
      console.log('Group created:', newGroup);

      // Fetch creator's username, prioritizing user.name
      const username = user?.name || (await fetchCreatorUsername(user?.id)) || 'a user';

      // Trigger notification for all group members, including the creator
      const allMembers = [...formData.members, String(user.id)]; // Include creator
      for (const memberId of allMembers) {
        await triggerNotification(
          'New Group Created',
          `Group "${newGroup.name}" was created by ${username}.`,
          {
            screen: 'GroupDetails',
            params: { groupId: newGroup.id, groupName: newGroup.name },
          },
          memberId
        );
      }

      if (typeof refreshBillSplitting === 'function') {
        await refreshBillSplitting();
        console.log('Context refreshed after group creation');
      } else {
        console.warn('refreshBillSplitting is not a function');
      }

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Alert.alert('Success', 'Group created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Tabs', { screen: 'BillSplittingDashboard', params: { groupCreated: true } });
            },
          },
        ]);
      });
    } catch (error) {
      console.error('Submit error:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.status === 404
          ? 'Group creation endpoint not found. Please check your server.'
          : error.response?.data?.error || 'Failed to create group. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSearchResult = useCallback(
    ({ item, index }) => {
      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 50,
        useNativeDriver: true,
      }).start();

      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.searchResult}
            onPress={() => addMember(item)}
            activeOpacity={0.7}
          >
            <View style={styles.userInfo}>
              {item.profilePicture ? (
                <Image source={{ uri: item.profilePicture }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={20} color={colors.white} />
                </View>
              )}
              <View style={styles.userTextContainer}>
                <Text style={styles.searchResultText}>{item.name || 'Unknown'}</Text>
                <Text style={styles.userEmail}>
                  {item.email || 'No email'} (ID: {item.id})
                </Text>
              </View>
            </View>
            <View style={styles.addIconContainer}>
              <Ionicons name="add-circle" size={24} color={colors.primaryGreen} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [addMember, fadeAnim]
  );

  const renderMember = useCallback(
    ({ item, index }) => {
      const user = addedUsers[item] || { id: item, name: 'Unknown' };
      const scaleAnim = new Animated.Value(0.95);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 50,
        useNativeDriver: true,
      }).start();

      return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <View style={styles.memberRow}>
            <View style={styles.userInfo}>
              {user.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={20} color={colors.white} />
                </View>
              )}
              <View style={styles.userTextContainer}>
                <Text style={styles.memberName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email || 'No email'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeMember(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    },
    [addedUsers, fadeAnim, removeMember]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.form,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.formSection}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={text => handleInputChange('name', text)}
              placeholder="e.g., Road Trip 2025"
              placeholderTextColor={colors.textSecondary}
              maxLength={100}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.type}
                onValueChange={value => handleInputChange('type', value)}
                style={styles.picker}
              >
                <Picker.Item label="Trip" value="Trip" />
                <Picker.Item label="Home" value="Home" />
                <Picker.Item label="Event" value="Event" />
                <Picker.Item label="Custom" value="Custom" />
              </Picker>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Add Members</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchInputContainer}>
                <Ionicons
                  name="search"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
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
              </View>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
                activeOpacity={0.7}
              >
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primaryGreen} />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            )}

            <View style={styles.listContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                renderItem={renderSearchResult}
                ListEmptyComponent={
                  !loading && searchQuery.trim() && (
                    <View style={styles.emptyResults}>
                      <Ionicons name="search" size={24} color={colors.textSecondary} />
                      <Text style={styles.noResultsText}>No users found</Text>
                    </View>
                  )
                }
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.membersHeader}>
              <Text style={styles.label}>Members</Text>
              <View style={styles.memberCountBadge}>
                <Text style={styles.memberCountText}>{formData.members.length}</Text>
              </View>
            </View>

            <View style={styles.membersListContainer}>
              <FlatList
                data={formData.members}
                keyExtractor={item => item}
                renderItem={renderMember}
                ListEmptyComponent={
                  <View style={styles.emptyMembers}>
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="people-outline" size={32} color={colors.white} />
                    </View>
                    <Text style={styles.noMembers}>No members added yet</Text>
                    <Text style={styles.emptySubtext}>
                      Search for users by ID or email to add them
                    </Text>
                  </View>
                }
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!formData.name.trim() || formData.members.length === 0) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!formData.name.trim() || formData.members.length === 0 || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.white}
                  style={styles.submitIcon}
                />
                <Text style={styles.submitButtonText}>Create Group</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
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
    padding: 20,
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
  form: {
    flex: 1,
    gap: 24,
  },
  formSection: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    fontFamily: 'Inter-Regular',
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  picker: {
    height: 50,
    color: colors.text,
    fontFamily: 'Inter-Regular',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Inter-Regular',
  },
  searchButton: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 10,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  listContainer: {
    maxHeight: 180,
    marginTop: 8,
  },
  searchResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  userTextContainer: {
    flex: 1,
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  addIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  noResultsText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberCountBadge: {
    backgroundColor: colors.primaryGreen,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCountText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  membersListContainer: {
    maxHeight: 220,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  memberName: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  memberText: {
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyMembers: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
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
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  noMembers: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 6,
    fontFamily: 'Inter-SemiBold',
  },
  emptySubtext: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primaryGreen,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.mediumGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitIcon: {
    marginRight: 10,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Inter-SemiBold',
  },
});

export default NewGroup;