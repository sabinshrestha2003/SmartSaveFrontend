import React, { useContext, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  StatusBar,
  Easing,
} from 'react-native';
import { SavingsContext } from '../context/SavingsContext';
import colors from '../styles/colors';
import CircularProgress from 'react-native-circular-progress-indicator';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

const GoalDetailsScreen = ({ route, navigation }) => {
  const { goal: initialGoal } = route.params || {};
  const { savingsGoals, updateSavingsGoal, deleteSavingsGoal } = useContext(SavingsContext);

  const [goal, setGoal] = useState(() => {
    const contextGoal = savingsGoals.find((g) => g.id === initialGoal.id);
    return contextGoal || initialGoal;
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const [isAddFundsModalVisible, setAddFundsModalVisible] = useState(false);
  const [fundsInput, setFundsInput] = useState('');

  useEffect(() => {
    const updatedGoal = savingsGoals.find((g) => g.id === initialGoal.id);
    if (updatedGoal && JSON.stringify(updatedGoal) !== JSON.stringify(goal)) {
      setGoal(updatedGoal);
    }
  }, [savingsGoals, initialGoal.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const progressPercentage = goal.target > 0 ? (goal.progress / goal.target) * 100 : 0;
  const remaining = goal.target - goal.progress;

  const getProgressColor = () => {
    if (progressPercentage < 30) return colors.errorRed;
    if (progressPercentage < 70) return colors.warningAmber;
    return colors.successGreen;
  };

  const progressColor = getProgressColor();

  const formatDate = (date) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch (error) {
      return date;
    }
  };

  const handleEditGoal = () => {
    navigation.navigate('EditGoal', { goal });
  };

  const handleDeleteGoal = async () => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this goal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavingsGoal(goal.id);
              navigation.goBack();
              Alert.alert('Success', 'Goal deleted successfully!');
            } catch (error) {
              console.error('Failed to delete goal:', error);
              Alert.alert('Error', 'Failed to delete goal. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleAddFunds = async () => {
    const additionalFunds = parseFloat(fundsInput);
    if (isNaN(additionalFunds) || additionalFunds <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid positive number.');
      return;
    }

    const newProgress = goal.progress + additionalFunds;
    if (newProgress > goal.target) {
      Alert.alert('Invalid Input', 'Funds cannot exceed the target amount.');
      return;
    }

    const updatedGoal = { ...goal, progress: newProgress, deadline: goal.deadline };
    try {
      await updateSavingsGoal(goal.id, updatedGoal);
      setGoal(updatedGoal);
      setAddFundsModalVisible(false);
      setFundsInput('');
      Alert.alert('Success', 'Funds added successfully!');
    } catch (error) {
      console.error('Error adding funds:', error);
      Alert.alert('Error', 'Failed to add funds. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.headerTitle}>Goal Details</Text>
        <TouchableOpacity style={styles.editIconButton} onPress={handleEditGoal}>
          <LinearGradient
            colors={[colors.accentPurple, colors.accentPurpleDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editButtonGradient}
          >
            <Ionicons name="create-outline" size={22} color={colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>{goal.name}</Text>

            <View style={styles.progressContainer}>
              <CircularProgress
                value={progressPercentage}
                radius={90}
                maxValue={100}
                initialValue={0}
                progressValueColor={colors.matteBlack}
                titleColor={colors.matteBlack}
                titleStyle={{ fontWeight: '600' }}
                activeStrokeWidth={12}
                inActiveStrokeWidth={12}
                duration={1500}
                valueSuffix="%"
                subtitle={'Completed'}
                subtitleStyle={{ color: colors.darkGray, fontSize: 14 }}
                activeStrokeColor={progressColor}
                activeStrokeSecondaryColor={adjustColor(progressColor, -20)}
                inActiveStrokeColor={colors.subtleAccent}
                inActiveStrokeOpacity={0.8}
                clockwise={true}
              />
            </View>

            <View style={styles.amountDetailsContainer}>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Target</Text>
                <Text style={styles.amountValue}>${goal.target.toFixed(2)}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Saved</Text>
                <Text style={[styles.amountValue, { color: colors.successGreen }]}>
                  ${goal.progress.toFixed(2)}
                </Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>Remaining</Text>
                <Text style={[styles.amountValue, { color: colors.warningAmber }]}>
                  ${remaining.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.deadlineContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.accentPurple} />
              <Text style={styles.deadlineText}>Deadline: {formatDate(goal.deadline)}</Text>
            </View>

            <View style={styles.linearProgressContainer}>
              <View style={styles.linearProgressLabels}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={[styles.progressPercentage, { color: progressColor }]}>
                  {progressPercentage.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.linearProgressBackground}>
                <LinearGradient
                  colors={[progressColor, adjustColor(progressColor, -20)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.linearProgressFill,
                    { width: `${Math.min(progressPercentage, 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.addFundsButton}
              onPress={() => setAddFundsModalVisible(true)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.primaryGreen, colors.primaryGreenDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addFundsGradient}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Add Funds</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteGoal}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.errorRed, adjustColor(colors.errorRed, -20)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.deleteGradient}
              >
                <Ionicons name="trash-outline" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Delete Goal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={isAddFundsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddFundsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Funds to {goal.name}</Text>
            <Text style={styles.modalSubtitle}>
              Current: ${goal.progress.toFixed(2)} / ${goal.target.toFixed(2)}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              placeholderTextColor={colors.mediumGray}
              keyboardType="numeric"
              value={fundsInput}
              onChangeText={setFundsInput}
              autoFocus
            />
            <View style={styles.quickAmounts}>
              {[10, 25, 50, 100].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountButton}
                  onPress={() => setFundsInput(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>+${amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setAddFundsModalVisible(false);
                  setFundsInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { opacity: fundsInput ? 1 : 0.5 }]}
                onPress={handleAddFunds}
                disabled={!fundsInput}
              >
                <LinearGradient
                  colors={[colors.primaryGreen, colors.primaryGreenDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
  editIconButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  editButtonGradient: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 20,
  },
  goalCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(237, 242, 247, 0.8)',
  },
  goalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.matteBlack,
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  amountDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  amountBox: {
    alignItems: 'center',
    flex: 1,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.darkGray,
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.matteBlack,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: colors.subtleAccent,
    padding: 12,
    borderRadius: 16,
  },
  deadlineText: {
    fontSize: 16,
    color: colors.matteBlack,
    marginLeft: 10,
    fontWeight: '500',
  },
  linearProgressContainer: {
    marginTop: 10,
  },
  linearProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.darkGray,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  linearProgressBackground: {
    height: 10,
    backgroundColor: colors.subtleAccent,
    borderRadius: 5,
    overflow: 'hidden',
  },
  linearProgressFill: {
    height: '100%',
    borderRadius: 5,
  },
  actionButtonsContainer: {
    marginTop: 10,
  },
  addFundsButton: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.primaryGreenDark,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  addFundsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  deleteButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.errorRed,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  deleteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.white,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.mediumGray,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.matteBlack,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.darkGray,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.subtleAccent,
    padding: 16,
    borderRadius: 16,
    color: colors.matteBlack,
    fontSize: 16,
    marginBottom: 16,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAmountButton: {
    backgroundColor: colors.subtleAccent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  quickAmountText: {
    color: colors.darkGray,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.subtleAccent,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    borderRadius: 16,
    marginLeft: 8,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.darkGray,
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default GoalDetailsScreen;