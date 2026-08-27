import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
  withCredentials: true, //mean send cookies with the request
  timeout: 10000, // 10 second timeout for API requests
});
