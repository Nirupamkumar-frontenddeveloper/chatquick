import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"; // Fallback to port 5000
axios.defaults.baseURL = backendURL;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUser, setOnlineUser] = useState([]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  const checkAuth = async () => {
    try {
      const { data } = await axios.get("/api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false); // Set loading to false after check
    }
  };

  // login function
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
        axios.defaults.headers.common["token"] = data.token;
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
      throw error; // Re-throw for component handling
    }
  };

  const connectSocket = (userData) => {
    if (!userData || socket?.connected) return;

    try {
      const newSocket = io(backendURL, {
        query: { userId: userData._id },
      });

      newSocket.connect();
      setSocket(newSocket);

      newSocket.on("getOnlineUsers", (userIds) => {
        setOnlineUser(userIds);
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message);
      });
    } catch (error) {
      console.error("Socket setup error:", error.message);
    }
  };

  // logout function
  const logout = async () => {
    try {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setAuthUser(null);
      setToken(null);
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["token"];
      toast.success("Logged out successfully");
      // Add API call if needed: await axios.post("/api/auth/logout");
    } catch (error) {
      toast.error(error.message);
    }
  };

  // update profile function to handle user profile updates
  const updateProfile = async (body) => {
    try {
      const { data } = await axios.put("/api/auth/update-profile", body);
      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["token"] = token;
    }
    checkAuth();

    // Cleanup socket on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [token]);

  const value = {
    axios,
    authUser,
    onlineUser,
    socket,
    login,
    logout,
    updateProfile,
    loading, // Expose loading state to consumers
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};