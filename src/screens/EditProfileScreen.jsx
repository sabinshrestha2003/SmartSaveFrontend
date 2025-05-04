import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';

const colors = {
  background: '#FFFFFF',
  card: '#F8F9FA',
  primary: '#6366F1', 
  primaryLight: '#EEF2FF',
  expense: '#F43F5E', 
  expenseLight: '#FFF1F2',
  income: '#10B981', 
  incomeLight: '#ECFDF5',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  shadow: '#94A3B8',
  white: '#FFFFFF',
  gold: '#F59E0B',
  goldLight: '#FEF3C7',
  teal: '#0EA5E9',
  tealLight: '#E0F2FE',
};

const EditProfileScreen = () => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profession, setProfession] = useState(user?.profession || '');
  const [customProfession, setCustomProfession] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(user?.profilePicture || null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const majorProfessions = [
    'Software Engineer',
    'Doctor',
    'Teacher',
    'Accountant',
    'Lawyer',
    'Nurse',
    'Engineer',
    'Marketing Manager',
    'Graphic Designer',
    'Data Scientist',
    'Entrepreneur',
    'Chef',
    'Architect',
    'Others',
  ];

  const handleProfessionSelect = (selectedProfession) => {
    setProfession(selectedProfession);
    if (selectedProfession !== 'Others') {
      setCustomProfession('');
    }
    setModalVisible(false);
  };

  const handleSaveProfile = useCallback(async () => {
    const finalProfession = profession === 'Others' ? customProfession.trim() : profession;

    if (!name.trim() || !email.trim() || !finalProfession) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      const response = await API.put('/user', { name, email, profession: finalProfession });
      if (response.data.success) {
        updateUser({ ...user, name, email, profession: finalProfession });
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        throw new Error(response.data.message || 'Unable to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error.message);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [name, email, profession, customProfession, user, updateUser, navigation]);

  const selectImage = useCallback(() => {
    const options = {
      mediaType: 'photo',
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8,
    };

    ImagePicker.launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        console.error('ImagePicker Error:', response.errorMessage);
        Alert.alert('Error', 'Failed to select image');
        return;
      }

      const uri = response.assets?.[0]?.uri;
      if (uri) {
        setImageUri(uri);
        uploadImage(uri);
      }
    });
  }, []);

  const uploadImage = useCallback(
    async (uri) => {
      try {
        setUploadingImage(true);
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
          const newImageUrl = `${response.data.url}?${Date.now()}`;
          setImageUri(newImageUrl);
          updateUser({ ...user, profilePicture: response.data.url });
          Alert.alert('Success', 'Profile picture updated successfully');
        } else {
          throw new Error(response.data.message || 'Failed to upload image');
        }
      } catch (error) {
        console.error('Upload image error:', error.message);
        Alert.alert('Error', error.message || 'Failed to upload profile picture');
      } finally {
        setUploadingImage(false);
      }
    },
    [user, updateUser]
  );

  const renderProfessionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.professionItem}
      onPress={() => handleProfessionSelect(item)}
    >
      <Text style={styles.professionText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back-outline" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profilePictureContainer}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={{ uri: imageUri || 'https://via.placeholder.com/120' }}
              style={styles.profileImage}
            />
            {uploadingImage ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={colors.white} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editIconContainer}
                onPress={selectImage}
                disabled={uploadingImage}
                activeOpacity={0.9}
              >
                <Icon name="camera-outline" size={20} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.profilePictureText}>Change Profile Picture</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.inputWrapper}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <Icon name="person-outline" size={18} color={colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <View style={[styles.iconContainer, { backgroundColor: colors.tealLight }]}>
                <Icon name="mail-outline" size={18} color={colors.teal} />
              </View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Profession</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setModalVisible(true)}
              accessibilityLabel="Profession Selector"
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.goldLight }]}>
                <Icon name="briefcase-outline" size={18} color={colors.gold} />
              </View>
              <View style={styles.professionTextContainer}>
                <Text
                  style={[
                    styles.professionText,
                    profession ? styles.professionSelected : styles.professionPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {profession || 'Select Profession'}
                </Text>
              </View>
              <Icon name="chevron-down-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {profession === 'Others' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Custom Profession</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconContainer, { backgroundColor: colors.goldLight }]}>
                  <Icon name="briefcase-outline" size={18} color={colors.gold} />
                </View>
                <TextInput
                  style={styles.input}
                  value={customProfession}
                  onChangeText={setCustomProfession}
                  placeholder="Enter your profession"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Profession Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Profession</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={majorProfessions}
              renderItem={renderProfessionItem}
              keyExtractor={(item) => item}
              style={styles.professionList}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    backgroundColor: colors.card,
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
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonDisabled: {
    backgroundColor: colors.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  profilePictureText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
  },
  formContainer: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  professionTextContainer: {
    flex: 1,
    justifyContent: 'center', 
    height: 50, 
  },
  professionText: {
    fontSize: 16, 
    lineHeight: 20, 
    paddingVertical: 0, 
  },
  professionPlaceholder: {
    color: colors.textSecondary, 
  },
  professionSelected: {
    color: colors.text, 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  professionList: {
    flexGrow: 0,
  },
  professionItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  professionText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default EditProfileScreen;