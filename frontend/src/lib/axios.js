import axios from "axios";

const apiUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");

export const axiosInstance = axios.create({
  baseURL: apiUrl,
  withCredentials: true, //mean send cookies with the request
  timeout: 10000, // 10 second timeout for API requests
});
