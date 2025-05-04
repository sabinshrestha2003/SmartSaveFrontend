import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SavingsContext } from '../context/SavingsContext'; 
import colors from '../styles/colors';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CircularProgress from 'react-native-circular-progress-indicator';

const UpdateProgressScreen = ({ route, navigation }) => {
  const { goal } = route.params; 
  const { updateSavingsGoal } = useContext(SavingsContext);
  const [progressInput, setProgressInput] = useState('');

  const progressPercentage = (goal.progress / goal.target) * 100;

  const handleSave = () => {
    if (progressInput && !isNaN(progressInput)) {
      const updatedProgress = parseFloat(progressInput);

      if (updatedProgress > goal.target) {
        Alert.alert(
          'Invalid Amount',
          `Progress cannot exceed the target amount ($${goal.target}).`,
          [{ text: 'OK' }]
        );
        return;
      }

      const updatedGoal = {
        ...goal,
        progress: updatedProgress,
      };
      updateSavingsGoal(goal.id, updatedGoal);
      navigation.goBack(); 
    } else {
      Alert.alert('Invalid Input', 'Please enter a valid progress amount.', [
        { text: 'OK' },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Progress</Text>
      </View>

      {/* Progress Update Form */}
      <View style={styles.formContainer}>
        <Text style={styles.title}>Update Progress for {goal.name}</Text>
        <Text style={styles.subtitle}>
          Current Progress: ${goal.progress} | Target: ${goal.target}
        </Text>

        {/* Circular Progress Bar */}
        <View style={styles.progressContainer}>
          <CircularProgress
            value={progressPercentage}
            radius={80}
            maxValue={100}
            textColor={colors.white}
            textStyle={{ fontWeight: 'bold', fontSize: 20 }}
            valueSuffix="%"
            activeStrokeColor={colors.primaryGreen}
            activeStrokeSecondaryColor={colors.accentTeal}
            inActiveStrokeColor={colors.mediumGray}
            inActiveStrokeOpacity={0.2}
            activeStrokeWidth={10}
          />
        </View>

        {/* Progress Input */}
        <TextInput
          style={styles.input}
          placeholder="Enter new progress amount"
          placeholderTextColor={colors.mediumGray}
          keyboardType="numeric"
          value={progressInput}
          onChangeText={setProgressInput}
        />

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Progress</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.matteBlack,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
    marginLeft: 10,
  },
  formContainer: {
    marginTop: 20, 
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightGray,
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.cardBackground,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    color: colors.white,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: colors.primaryGreen,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
});

export default UpdateProgressScreen;