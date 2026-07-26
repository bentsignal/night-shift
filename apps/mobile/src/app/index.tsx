import { SafeAreaView, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b0e14" }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 28,
        }}
      >
        <Text
          style={{
            color: "#7dd3fc",
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Local execution · durable orchestration
        </Text>
        <Text
          style={{
            color: "#eef2ff",
            fontSize: 64,
            fontWeight: "700",
            letterSpacing: -4,
            marginTop: 8,
          }}
        >
          Code
        </Text>
        <Text
          style={{
            color: "#94a3b8",
            fontSize: 17,
            lineHeight: 26,
            marginTop: 16,
          }}
        >
          Mobile shell ready for the orchestration experience.
        </Text>
      </View>
    </SafeAreaView>
  );
}
