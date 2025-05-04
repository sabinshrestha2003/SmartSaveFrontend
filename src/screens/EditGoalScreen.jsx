import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SavingsContext } from '../context/SavingsContext';
import colors from '../styles/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';

const EditGoalScreen = ({ route, navigation }) => {
  const { goal: initialGoal } = route.params || {};
  const { updateSavingsGoal, refreshSavingsGoals } = useContext(SavingsContext);

  if (!initialGoal || !initialGoal.id || typeof initialGoal.target === 'undefined') {
    Alert.alert('Error', 'Invalid goal data provided.');
    navigation.goBack();
    return null;
  }

  const [name, setName] = useState(initialGoal.name || '');
  const [target, setTarget] = useState(initialGoal.target.toString() || '0');
  const [deadline, setDeadline] = useState(new Date(initialGoal.deadline || Date.now()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || deadline;
    setShowDatePicker(Platform.OS === 'ios');
    setDeadline(currentDate);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name must be a non-empty string.');
      return;
    }

    const parsedTarget = Number.parseFloat(target);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      Alert.alert('Error', 'Target must be a positive number.');
      return;
    }

    if (deadline < new Date()) {
      Alert.alert('Error', 'Deadline cannot be in the past.');
      return;
    }

    Animated.sequence([
      Animated.timing(buttonAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    const updatedGoal = {
      ...initialGoal,
      name,
      target: parsedTarget,
      deadline: new Date(deadline),
      progress: initialGoal.progress || 0,
    };

    try {
      await updateSavingsGoal(initialGoal.id, updatedGoal);
      await refreshSavingsGoals();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update savings goal. Please try again.');
      console.error('Update Error:', error);
    }
  };

  const progressPercentage = initialGoal.target > 0 ? ((initialGoal.progress || 0) / initialGoal.target) * 100 : 0;

  const getProgressColor = () => {
    if (progressPercentage < 30) return colors.errorRed;
    if (progressPercentage < 70) return colors.warningAmber;
    return colors.successGreen;
  };

  const progressColor = getProgressColor();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={[colors.accentPurple, colors.accentPurpleDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backButtonGradient}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Goal</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <View style={styles.goalVisual}>
            <LinearGradient
              colors={[colors.primaryGreen, colors.primaryGreenDark]}
              style={styles.iconContainer}
            >
              <Ionicons name="wallet-outline" size={40} color={colors.white} />
            </LinearGradient>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Goal Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="create-outline" size={20} color={colors.accentPurple} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter goal name"
                  placeholderTextColor={colors.mediumGray}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Amount</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="cash-outline" size={20} color={colors.accentPurple} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter target amount"
                  placeholderTextColor={colors.mediumGray}
                  keyboardType="numeric"
                  value={target}
                  onChangeText={(text) => setTarget(text.replace(/[^0-9.]/g, ''))}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deadline</Text>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={colors.accentPurple} style={styles.inputIcon} />
                <Text style={styles.dateText}>{moment(deadline).format('MMMM D, YYYY')}</Text>
                <Ionicons name="chevron-down" size={20} color={colors.accentPurple} />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={deadline}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Current Progress</Text>
            <View style={styles.progressContainer}>
              <LinearGradient
                colors={[progressColor, adjustColor(progressColor, -20)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${Math.min(100, progressPercentage)}%` }]}
              />
            </View>
            <View style={styles.progressDetails}>
              <Text style={styles.progressText}>
                ${(initialGoal.progress || 0).toFixed(2)} of ${initialGoal.target.toFixed(2)}
              </Text>
              <Text style={[styles.progressPercentage, { color: progressColor }]}>
                {progressPercentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.buttonContainer, { transform: [{ scale: buttonAnim }] }]}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.9}>
          <LinearGradient
            colors={[colors.primaryGreen, colors.primaryGreenDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
            <Ionicons name="checkmark" size={20} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const adjustColor = (color, amount) => {
  const clamp = (val) => Math.min(255, Math.max(0, val));
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const adjustR = clamp(r + amount);
  const adjustG = clamp(g + amount);
  const adjustB = clamp(b + amount);
  return `#${adjustR.toString(16).padStart(2, '0')}${adjustG.toString(16).padStart(2, '0')}${adjustB.toString(16).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 10, 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.matteBlack,
  },
  headerRight: {
    width: 40,
  },
  goalVisual: {
    alignItems: 'center',
    marginTop: 16, 
    marginBottom: 16, 
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16, 
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(237, 242, 247, 0.8)',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.matteBlack,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.subtleAccent,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 14,
    color: colors.matteBlack,
    fontSize: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.subtleAccent,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    padding: 14,
    paddingHorizontal: 12,
  },
  dateText: {
    flex: 1,
    color: colors.matteBlack,
    fontSize: 16,
  },
  progressSection: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 16, 
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(237, 242, 247, 0.8)',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.matteBlack,
    marginBottom: 12,
  },
  progressContainer: {
    height: 12,
    backgroundColor: colors.subtleAccent,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    color: colors.darkGray,
    fontSize: 14,
  },
  progressPercentage: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primaryGreenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginRight: 8,
  },
});

export default EditGoalScreen;