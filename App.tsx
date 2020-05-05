import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import {
  createMuiTheme,
  ThemeProvider,
  useTheme
} from "@material-ui/core/styles";
import { Box, Paper, LinearProgress, Typography } from "@material-ui/core";
import { ipcRenderer } from "electron";
import { useSpring, animated } from "react-spring";

const darkTheme = createMuiTheme({
  palette: {
    type: "dark"
  }
});

export default function App() {
  const [breakProgress, setBreakProgress] = useState(-1);
  const [message, setMessage] = useState("");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    ipcRenderer.on("breakProgress", (event, arg) => {
      setBreakProgress(arg);
    });

    ipcRenderer.on("message", (event, arg) => {
      setMessage(arg);
    });

    ipcRenderer.on("breakWarning", () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    });
  }, []);

  const props = useSpring({
    backgroundColor: `rgba(255, 255, 255, ${flash ? 0.1 : 0})`,
    duration: 500
  });

  return (
    <ThemeProvider theme={darkTheme}>
      <animated.div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexDirection: "column",
          ...props
        }}
      >
        {breakProgress >= 0 && (
          <Paper style={{ padding: 10, width: 400, marginBottom: 40 }}>
            <Typography
              style={{ textAlign: "center" }}
              variant="body2"
              gutterBottom
            >
              {message}
            </Typography>
            <LinearProgress
              key={breakProgress > 1 ? Math.random() : "1"}
              variant="determinate"
              value={breakProgress * 100}
            />
          </Paper>
        )}
      </animated.div>
    </ThemeProvider>
  );
}
