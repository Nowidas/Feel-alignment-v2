import config from "./config.json";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Dimensions,
  ScrollView,
  Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import * as Notifications from "expo-notifications";

const images = [
  require("./assets/DALLE-caffee2.webp"),
  require("./assets/DALLE-wine.webp"),
  require("./assets/DALLE-tea.webp"),
  require("./assets/DALLE-rum2.webp"),
];

export default function App() {
  const [username, setUsername] = useState("");
  const [quote, setQuote] = useState("");
  const [checkedItems, setCheckedItems] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [sliderValue, setSliderValue] = useState(null);
  const [inputText, setInputText] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(true);
  const [isForToday, setIsForToday] = useState(true); // true: today, false: yesterday

  useEffect(() => {
    const loadUsernameAndQuote = async () => {
      const storedUsername = await AsyncStorage.getItem("username");
      const storedQuote = await AsyncStorage.getItem("quote");
      const storedDate = await AsyncStorage.getItem("quoteDate");
      const currentDate = new Date().toISOString().split("T")[0];
      const storedInputText = await AsyncStorage.getItem("inputText");

      if (storedUsername) {
        setUsername(storedUsername);
      } else {
        setModalVisible(true); // Ask for username if not stored
      }

      if (storedQuote && storedDate === currentDate) {
        setQuote(storedQuote);
      } else {
        fetchNewQuote();
      }

      if (storedInputText) {
        setInputText(storedInputText);
      }
    };
    loadUsernameAndQuote();

    // Check if submit button should be enabled
    const checkSubmitAvailability = async () => {
      const lastSubmitTime = await AsyncStorage.getItem("lastSubmitTime");
      if (lastSubmitTime) {
        const now = new Date();
        const lastSubmitDate = new Date(lastSubmitTime);
        const diffInHours = (now - lastSubmitDate) / (1000 * 60 * 60);
        if (diffInHours < 12) {
          setIsSubmitEnabled(false);
          const remainingTime = 12 - diffInHours;
          setTimeout(
            () => setIsSubmitEnabled(true),
            remainingTime * 60 * 60 * 1000
          );
        }
      }
    };
    checkSubmitAvailability();

    // Request permissions and schedule daily notifications
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
      scheduleDailyNotification();
    })();
  }, []);

  const scheduleDailyNotification = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder",
        body: "Open the app to check-in for today!",
        sound: "default",
      },
      trigger: {
        hour: 21, // Schedule for 9 PM
        minute: 0,
        repeats: true, // Repeat every day
      },
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder",
        body: "I'm not asking 🔫",
        sound: "default",
      },
      trigger: {
        hour: 23, // Schedule for 23:59 PM
        minute: 59,
        repeats: true, // Repeat every day
      },
    });
  };

  const fetchNewQuote = async () => {
    try {
      // Load quotes and usage from localStorage
      const localQuotes =
        JSON.parse(await AsyncStorage.getItem("quotes")) || [];
      const usedQuotes =
        JSON.parse(await AsyncStorage.getItem("usedQuotes")) || [];

      // Try to fetch new quotes from API and sync with localStorage
      let updatedQuotes = [];
      console.log("Fetching quotes from API...");
      try {
        const response = await fetch("http://192.168.100.18:5000/quotes"); // Change later for url fromlocal DNS
        const apiQuotes = await response.json();
        updatedQuotes = syncLocalStorageWithAPI(localQuotes, apiQuotes);
        await AsyncStorage.setItem("quotes", JSON.stringify(updatedQuotes));
      } catch (apiError) {
        console.warn("Failed to sync with API, falling back to local quotes.");
        updatedQuotes = localQuotes;
      }

      // Filter out used quotes
      const availableQuotes = updatedQuotes.filter(
        (q) => !usedQuotes.includes(q)
      );

      // If all quotes have been used, reset the used list
      if (availableQuotes.length === 0) {
        await AsyncStorage.setItem("usedQuotes", JSON.stringify([]));
        availableQuotes.push(...updatedQuotes);
      }

      // Pick a random quote from available ones
      const randomIndex = Math.floor(Math.random() * availableQuotes.length);
      const newQuote = availableQuotes[randomIndex];

      // Set the quote and mark it as used
      setQuote(newQuote);
      usedQuotes.push(newQuote);

      // Update local storage with the selected quote and usage
      await AsyncStorage.setItem("usedQuotes", JSON.stringify(usedQuotes));
      await AsyncStorage.setItem("quote", newQuote);
      await AsyncStorage.setItem(
        "quoteDate",
        new Date().toISOString().split("T")[0]
      );
    } catch (error) {
      console.error("Failed to fetch or load quote:", error);
    }
  };

  // Function to sync local quotes with API quotes
  const syncLocalStorageWithAPI = (localQuotes, apiQuotes) => {
    const quotesSet = new Set(localQuotes);
    console.warn(quotesSet);
    console.warn(apiQuotes);
    // Add any new quotes from the API that aren't already in local storage
    apiQuotes.forEach((quote) => {
      if (!quotesSet.has(quote.quotes)) {
        quotesSet.add(quote.quotes);
      }
    });

    // Optionally: Remove quotes that no longer exist in the API
    return Array.from(quotesSet);
  };

  const saveUsername = async (name) => {
    if (name.trim() === "") {
      setUsernameError("Username cannot be empty");
      return;
    }

    await AsyncStorage.setItem("username", name);
    setUsername(name);
    setModalVisible(false);
    setIsEditing(false);
    setUsernameError("");
  };

  const toggleCheck = (index) => {
    const newCheckedItems = [...checkedItems];
    newCheckedItems[index] = !newCheckedItems[index];
    setCheckedItems(newCheckedItems);
  };

  const formatDate = (now) => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const transformCheckedItems = (items) => {
    const labels = ["coffiee", "wine", "greentea", "rum"];
    const transformed = {};

    items.forEach((item, index) => {
      transformed[labels[index]] = item ? 1 : 0;
    });

    return transformed;
  };

  const handleSubmit = async () => {
    if (!sliderValue) {
      alert("Please rate your day before submitting.");
      return;
    }
    const submissionDate = new Date();
    if (!isForToday) {
      // If it's for yesterday, adjust the date and time
      submissionDate.setDate(submissionDate.getDate() - 1);
      submissionDate.setHours(23, 59, 0, 0); // Set time to 23:59
    }

    const data = {
      nick: username,
      ...transformCheckedItems(checkedItems),
      mood: sliderValue,
      activities: inputText,
      date: formatDate(submissionDate),
    };

    try {
      setIsSubmitEnabled(false);
      await fetch(config.API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [
            {
              id: "DATETIME",
              ...data,
              sheet: "NewDB",
            },
          ],
        }),
      });
      console.log("Submitted data:", data);
      // alert("Data submitted successfully!");
      setCheckedItems([false, false, false, false]);
      setSliderValue(5);
      setInputText("");
      await AsyncStorage.setItem("inputText", "");
      if (isForToday) {
        await AsyncStorage.setItem("lastSubmitTime", new Date().toISOString());
        setTimeout(() => setIsSubmitEnabled(true), 12 * 60 * 60 * 1000); // 12 hours
      } else {
        setIsForToday(true); // Reset to today after submitting for yesterday
        setIsSubmitEnabled(true);
      }
    } catch (error) {
      console.error("Failed to submit data:", error);
      alert("Failed to submit data.");
      setIsSubmitEnabled(true);
    }
  };

  const handleTextChange = (text) => {
    setInputText(text);
    AsyncStorage.setItem("inputText", text); // Save it to AsyncStorage
  };

  const copyToClipboard = () => {
    Clipboard.setString(quote);
    // alert("Quote copied to clipboard!");
  };

  const windowWidth = Dimensions.get("window").width;
  const gridSize = windowWidth * 0.7; // 70% of screen width

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {username && (
        <TouchableOpacity onPress={() => setIsEditing(true)}>
          <Text style={styles.username}>Hello, {username}!</Text>
        </TouchableOpacity>
      )}

      {quote && (
        <TouchableOpacity onLongPress={copyToClipboard}>
          <Text style={styles.quote}>{quote}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>How do you feel today?</Text>

      <View style={styles.gridWrapper}>
        <View
          style={[styles.gridContainer, { width: gridSize, height: gridSize }]}
        >
          {images.map((image, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.gridItem,
                checkedItems[index] ? styles.checkedItem : {},
              ]}
              onPress={() => toggleCheck(index)}
            >
              <Image source={image} style={styles.image} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sliderLabel}>Rate your day:</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        value={sliderValue}
        onValueChange={setSliderValue}
        step={1}
        minimumTrackTintColor="#BB86FC"
        maximumTrackTintColor="#333"
        thumbTintColor="#BB86FC"
      />
      <Text style={styles.sliderValueText}>Score: {sliderValue}</Text>

      <TextInput
        style={styles.textInput}
        placeholder="What did you do today?"
        placeholderTextColor="#777"
        value={inputText}
        onChangeText={handleTextChange}
        multiline
      />
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[
            styles.switchButton,
            isForToday ? styles.activeSwitch : styles.inactiveSwitch,
          ]}
          onPress={() => setIsForToday(true)}
        >
          <Text style={isForToday ? styles.activeText : styles.inactiveText}>
            Today
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.switchButton,
            !isForToday ? styles.activeSwitch : styles.inactiveSwitch,
          ]}
          onPress={() => setIsForToday(false)}
        >
          <Text style={!isForToday ? styles.activeText : styles.inactiveText}>
            Yesterday
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.submitButton, { opacity: isSubmitEnabled ? 1 : 0.5 }]}
        onPress={isSubmitEnabled ? handleSubmit : null}
      >
        <Text style={styles.submitButtonText}>Submit</Text>
      </TouchableOpacity>

      {/* Modal for username input */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible || isEditing}
        onRequestClose={() => {
          // Alert.alert("Username change was cancelled.");
          setModalVisible(false);
          setIsEditing(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <TextInput
              style={styles.usernameInput}
              placeholder="Enter your name"
              placeholderTextColor="#777"
              value={username}
              onChangeText={setUsername}
            />
            {usernameError ? (
              <Text style={styles.errorText}>{usernameError}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => saveUsername(username)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#1c1c1c",
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#BB86FC",
    marginBottom: 20,
    textAlign: "center",
  },
  quote: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#aaa",
    marginBottom: 20,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  gridWrapper: {
    alignItems: "center", // Center the gridContainer horizontally
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  gridItem: {
    width: "48%",
    height: "48%",
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#555",
    overflow: "hidden",
  },
  checkedItem: {
    backgroundColor: "#444",
    borderColor: "#BB86FC",
    borderWidth: 4,
  },
  image: {
    width: "80%",
    height: "80%",
    resizeMode: "contain",
  },
  sliderLabel: {
    marginTop: 20,
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
  },
  slider: {
    width: "100%",
    height: 40,
    marginVertical: 10,
  },
  sliderValueText: {
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: "#333",
    color: "#fff",
    borderWidth: 1,
    borderColor: "#555",
    padding: 15,
    borderRadius: 10,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: "#BB86FC",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalView: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    alignItems: "center",
  },
  usernameInput: {
    width: "100%",
    padding: 10,
    borderColor: "#555",
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: "#444",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#BB86FC",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeSwitch: {
    backgroundColor: "#BB86FC", // Active color for selected option
  },
  inactiveSwitch: {
    backgroundColor: "#f4f3f4", // Inactive color for unselected option
  },
  activeText: {
    color: "white",
    fontWeight: "bold",
  },
  inactiveText: {
    color: "#767577",
  },
});
