import app from "./app.js";
import { connectDB } from "./lib/db.js";

const PORT = process.env.PORT || 5001;
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to connect to MongoDB:", error.message);
  });
