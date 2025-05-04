import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import colors from '../styles/colors';

const { width } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 70;

const UserProfileScreen = () => {
  const { user, logout, loading: authLoading, isLoggedOut } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(authLoading);
  const [profile, setProfile] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const isLoggingOut = useRef(false);

  const fetchUserProfile = useCallback(async () => {
    console.log('fetchUserProfile called, isLoggingOut:', isLoggingOut.current, 'isLoggedOut:', isLoggedOut);
    if (isLoggingOut.current) {
      console.log('Logout in progress, skipping fetchUserProfile');
      return;
    }
    try {
      setLoading(true);
      const response = await API.get('/user');
      if (response.data.success) {
        setProfile(response.data.user);
        setImageUri(response.data.user.profilePicture || null);
      } else {
        throw new Error(response.data.message || 'Unable to fetch user profile');
      }
    } catch (error) {
      console.error('Fetch profile error:', error.message);
      Alert.alert('Error', error.message || 'An error occurred while fetching the profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('UserProfileScreen useEffect, user:', user, 'isLoggedOut:', isLoggedOut, 'isLoggingOut:', isLoggingOut.current);
    if (isLoggingOut.current || isLoggedOut) {
      console.log('Logout detected, resetting profile and skipping fetch');
      setProfile(null);
      setLoading(false);
      return;
    }
    if (user) {
      console.log('User present, setting profile from context');
      setProfile(user);
      setImageUri(user.profilePicture || null);
      setLoading(false);
    } else if (!authLoading && !isLoggedOut) {
      console.log('No user, not loading, not logged out, fetching profile');
      fetchUserProfile();
    }
  }, [user, authLoading, isLoggedOut, fetchUserProfile]);

  const handleLogout = useCallback(async () => {
    isLoggingOut.current = true;
    console.log('Logout initiated, blocking further API calls');
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel', onPress: () => (isLoggingOut.current = false) },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout');
            isLoggingOut.current = false;
          }
        },
      },
    ]);
  }, [logout, navigation]);

  const selectImage = useCallback(() => {
    if (isLoggingOut.current) return;
    const options = {
      mediaType: 'photo',
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        console.error('ImagePicker Error:', response.errorMessage);
        Alert.alert('Error', 'Failed to select image');
        return;
      }

      const uri = response.assets?.[0]?.uri;
      if (uri) {
        setImageUri(uri);
        await uploadImage(uri);
      }
    });
  }, []);

  const uploadImage = useCallback(async (uri) => {
    if (isLoggingOut.current) return;
    try {
      const formData = new FormData();
      const fileExtension = uri.split('.').pop().toLowerCase();
      formData.append('profilePicture', {
        uri,
        type: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
        name: `profile_${Date.now()}.${fileExtension}`,
      });

      const response = await API.post('/user/upload-profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setProfile(prev => ({ ...prev, profilePicture: response.data.url }));
        setImageUri(`${response.data.url}?${Date.now()}`);
        Alert.alert('Success', 'Profile picture updated successfully');
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error.message);
      Alert.alert('Error', error.message || 'Failed to upload profile picture');
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.accentPurple} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Icon name="alert-circle-outline" size={60} color={colors.errorRed} />
        <Text style={styles.errorText}>Unable to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileInfoContainer}>
          <TouchableOpacity 
            style={styles.profileImageWrapper} 
            onPress={selectImage}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: imageUri || 'https://via.placeholder.com/120' }}
              style={styles.profileImage}
            />
            <View style={styles.editIcon}>
              <Icon name="camera-outline" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileDetails}>{profile.email}</Text>
          <Text style={styles.profileDetails}>ID: {profile.id}</Text>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <Icon name="create-outline" size={16} color={colors.white} />
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Finance Tools</Text>
          
          {[
            { 
              icon: 'pie-chart-outline', 
              text: 'Expense Tracking', 
              route: 'ExpenseBreakdown',
              color: colors.expense,
              bgColor: colors.expenseLight
            },
            { 
              icon: 'trending-up-outline', 
              text: 'Savings Goals', 
              route: 'SavingsTrends',
              color: colors.income,
              bgColor: colors.incomeLight
            },
            { 
              icon: 'calendar-outline', 
              text: 'Monthly Summaries', 
              route: 'MonthlySummary',
              color: colors.gold,
              bgColor: colors.goldLight
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionCard}
              onPress={() => navigation.navigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: item.bgColor }]}>
                <Icon name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>{item.text}</Text>
                <Icon name="chevron-forward-outline" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Account Settings</Text>
          
          {[
            { 
              icon: 'notifications-outline', 
              text: 'Notifications', 
              route: 'Notifications',
              color: colors.teal,
              bgColor: colors.tealLight
            },
            { 
              icon: 'lock-closed-outline', 
              text: 'Change Password', 
              route: 'ChangePassword',
              color: colors.accentPurple,
              bgColor: colors.accentPurpleLight
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionCard}
              onPress={() => navigation.navigate(item.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconContainer, { backgroundColor: item.bgColor }]}>
                <Icon name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionText}>{item.text}</Text>
                <Icon name="chevron-forward-outline" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Icon name="log-out-outline" size={18} color={colors.white} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: TAB_BAR_HEIGHT + 40,
  },
  profileInfoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.accentPurple,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accentPurple,
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 5,
  },
  profileDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPurple,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: colors.accentPurple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  editProfileButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 15,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorRed,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    shadowColor: colors.errorRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: colors.errorRed,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.accentPurple,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 25,
    shadowColor: colors.accentPurple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default UserProfileScreen;